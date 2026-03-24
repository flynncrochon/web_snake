import { play_gatling_fire, play_gatling_hit } from '../audio/sound.js';

const GATLING_RANGE = 11;
const GATLING_RANGE_SQ = GATLING_RANGE * GATLING_RANGE;
const GATLING_COOLDOWN = 180;      // extremely rapid fire
const GATLING_SPEED = 24;          // faster than normal fangs
const GATLING_LIFETIME = 0.5;
const GATLING_TURN_SPEED = 12;     // tighter homing
const GATLING_RADIUS = 0.14;       // smaller projectiles
const GATLING_DAMAGE = 120;
const GATLING_MAX_PIERCE = 3;      // pierce through 3 enemies

export class SerpentGatling {
    constructor() {
        this.active = false;
        this.fangs = [];
        this.last_fire = 0;
        this.crit_chance = 0;
        this.extra_projectiles = 0;
        this.gorger_dmg_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_fang_count() {
        return 2 + this.extra_projectiles;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Rapid-fire burst ---
        if (now - this.last_fire >= GATLING_COOLDOWN * this.fire_cooldown_mult) {
            const gat_range = GATLING_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, gat_range);

            if (candidates.length > 0) {
                const count = this.get_fang_count();
                candidates.sort((a, b) => {
                    const da = (a.x - hx) ** 2 + (a.y - hy) ** 2;
                    const db = (b.x - hx) ** 2 + (b.y - hy) ** 2;
                    return da - db;
                });

                for (let i = 0; i < count; i++) {
                    const target = candidates[i % candidates.length];
                    const dx = target.x - hx;
                    const dy = target.y - hy;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const ndx = len > 0.01 ? dx / len : 0;
                    const ndy = len > 0.01 ? dy / len : 1;

                    // Wider spread for gatling
                    const offset_angle = count > 1
                        ? (i / (count - 1) - 0.5) * 0.7
                        : 0;
                    const cos_o = Math.cos(offset_angle);
                    const sin_o = Math.sin(offset_angle);
                    const fdx = ndx * cos_o - ndy * sin_o;
                    const fdy = ndx * sin_o + ndy * cos_o;

                    this.fangs.push({
                        x: hx,
                        y: hy,
                        dx: fdx,
                        dy: fdy,
                        target: target,
                        life: GATLING_LIFETIME,
                        alive: true,
                        trail: [],
                        wobble: Math.random() * Math.PI * 2,
                        pierce_count: 0,
                        hit_ids: new Set(),
                    });
                }
                play_gatling_fire();
                this.last_fire = now;
            }
        }

        // --- Update fangs ---
        for (const f of this.fangs) {
            if (!f.alive) continue;

            // Re-target if current target is dead
            if (!f.target || !f.target.alive) {
                f.target = enemy_manager.query_nearest(f.x, f.y, 30, f.hit_ids);
            }

            // Home toward target
            if (f.target && f.target.alive) {
                const tx = f.target.x - f.x;
                const ty = f.target.y - f.y;
                const len = Math.sqrt(tx * tx + ty * ty);
                if (len > 0.01) {
                    const cur_angle = Math.atan2(f.dy, f.dx);
                    let target_angle = Math.atan2(ty / len, tx / len);
                    let diff = target_angle - cur_angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const max_turn = GATLING_TURN_SPEED * dt;
                    const turn = Math.max(-max_turn, Math.min(max_turn, diff));
                    const new_angle = cur_angle + turn;
                    f.dx = Math.cos(new_angle);
                    f.dy = Math.sin(new_angle);
                }
            }

            f.trail.push({ x: f.x, y: f.y });
            if (f.trail.length > 6) f.trail.shift();

            f.x += f.dx * GATLING_SPEED * dt;
            f.y += f.dy * GATLING_SPEED * dt;
            f.life -= dt;
            if (f.life <= 0) f.alive = false;

            if (f.x < 0 || f.x > arena.size || f.y < 0 || f.y > arena.size) {
                f.alive = false;
            }
        }

        // --- Collision — piercing ---
        for (const f of this.fangs) {
            if (!f.alive) continue;
            const hit_r = GATLING_RADIUS + 0.55;
            enemy_manager.query_radius(f.x, f.y, hit_r, (e) => {
                if (!f.alive || f.hit_ids.has(e)) return;
                const dx = f.x - e.x;
                const dy = f.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < GATLING_RADIUS + e.radius) {
                    f.hit_ids.add(e);
                    f.pierce_count++;
                    play_gatling_hit();

                    // Damage falls off per pierce: 100%, 70%, 50%
                    const pierce_mult = f.pierce_count === 1 ? 1.0 : f.pierce_count === 2 ? 0.7 : 0.5;
                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const final_dmg = Math.round(GATLING_DAMAGE * pierce_mult * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
                    const dead = e.take_damage(final_dmg);

                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, final_dmg, is_crit);
                    }
                    if (particles) {
                        const sx = e.x * cell_size;
                        const sy = e.y * cell_size;
                        particles.emit(sx, sy, 4, '#ffaa33', 3);
                        particles.emit(sx, sy, 3, '#44ff88', 2);
                    }
                    if (dead) {
                        const fx = Math.floor(e.x);
                        const fy = Math.floor(e.y);
                        if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                            arena.food.push({ x: fx, y: fy });
                            enemy_manager._try_drop_heart(fx, fy);
                        }
                        enemy_manager.total_kills++;
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                        }
                    } else {
                        e.x += f.dx * 0.2;
                        e.y += f.dy * 0.2;
                    }

                    if (f.pierce_count >= GATLING_MAX_PIERCE) {
                        f.alive = false;
                    } else {
                        // Re-target next enemy after pierce
                        f.target = null;
                        f.life = Math.min(f.life + 0.15, GATLING_LIFETIME);
                    }
                }
            });
        }

        // In-place compaction
        let w = 0;
        for (let r = 0; r < this.fangs.length; r++) {
            if (this.fangs[r].alive) this.fangs[w++] = this.fangs[r];
        }
        this.fangs.length = w;
    }

    render(ctx, cell_size) {
        const now = performance.now();
        for (const f of this.fangs) {
            if (!f.alive) continue;

            const px = f.x * cell_size;
            const py = f.y * cell_size;
            const angle = Math.atan2(f.dy, f.dx);

            // --- Trail: orange-green gradient ---
            if (f.trail.length >= 2) {
                ctx.lineCap = 'round';
                for (let i = 1; i < f.trail.length; i++) {
                    const frac = i / f.trail.length;
                    const x0 = f.trail[i - 1].x * cell_size;
                    const y0 = f.trail[i - 1].y * cell_size;
                    const x1 = f.trail[i].x * cell_size;
                    const y1 = f.trail[i].y * cell_size;

                    // Outer orange-green glow
                    const r = Math.round(80 + 175 * (1 - frac));
                    const g = Math.round(180 + 75 * frac);
                    ctx.strokeStyle = `rgba(${r}, ${g}, 50, ${frac * 0.4})`;
                    ctx.lineWidth = frac * cell_size * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();

                    // Bright core
                    ctx.strokeStyle = `rgba(255, 240, 180, ${frac * 0.3})`;
                    ctx.lineWidth = frac * cell_size * 0.04;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();
                }
            }

            // --- Single sharp fang (smaller than normal) ---
            const fl = cell_size * 0.4;
            const spread = cell_size * 0.14;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);

            // Glow layer (simple triangle)
            ctx.fillStyle = 'rgba(255, 180, 50, 0.15)';
            ctx.beginPath();
            ctx.moveTo(fl * 1.3, 0);
            ctx.lineTo(-fl * 0.35, -spread * 0.8);
            ctx.lineTo(-fl * 0.35, spread * 0.8);
            ctx.closePath();
            ctx.fill();

            // Sharp needle fang (triangle)
            ctx.fillStyle = '#f0e8d8';
            ctx.beginPath();
            ctx.moveTo(fl, 0);
            ctx.lineTo(-fl * 0.3, -spread * 0.6);
            ctx.lineTo(-fl * 0.25, 0);
            ctx.lineTo(-fl * 0.3, spread * 0.6);
            ctx.closePath();
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.moveTo(fl * 0.85, 0);
            ctx.lineTo(-fl * 0.1, -spread * 0.25);
            ctx.lineTo(fl * 0.1, 0);
            ctx.closePath();
            ctx.fill();

            // Venom-fire at tip
            const pulse = 0.5 + Math.sin(f.wobble + now * 0.015) * 0.5;
            ctx.fillStyle = `rgba(255, 180, 50, ${0.6 + pulse * 0.4})`;
            const vr = fl * 0.07;
            ctx.fillRect(fl + fl * 0.06 - vr, -vr, vr * 2, vr * 2);

            ctx.restore();
        }
    }

    clear() {
        this.fangs = [];
        this.last_fire = 0;
    }
}
