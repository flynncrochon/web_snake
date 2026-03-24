import { play_fang_fire, play_fang_hit } from '../audio/sound.js';

const FANG_RANGE = 9;
const FANG_RANGE_SQ = FANG_RANGE * FANG_RANGE;
const BASE_COOLDOWN = 2500;
const FANG_SPEED = 18;
const FANG_LIFETIME = 0.6;
const FANG_TURN_SPEED = 10; // radians/sec — aggressive homing
const FANG_RADIUS = 0.18;

export class FangBarrage {
    constructor() {
        this.fangs = [];
        this.last_fire = 0;
        this.level = 0;
        this.extra_projectiles = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_cooldown() {
        return Math.max(1000, BASE_COOLDOWN - (this.level - 1) * 250) * this.fire_cooldown_mult;
    }

    get_fang_count() {
        return this.level + this.extra_projectiles;
    }

    get_damage() {
        return (1 + Math.floor(this.level / 3)) * 150;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire burst at nearby enemies ---
        if (now - this.last_fire >= this.get_cooldown()) {
            // Gather enemies in range
            const fang_range = FANG_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, fang_range);

            if (candidates.length > 0) {
                const count = this.get_fang_count();
                // Sort by distance so we prioritize closest enemies
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
                    // Slight angular offset so multiple fangs spread out
                    const offset_angle = count > 1
                        ? (i / (count - 1) - 0.5) * 0.5
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
                        life: FANG_LIFETIME,
                        alive: true,
                        trail: [],
                        wobble: Math.random() * Math.PI * 2,
                    });
                }
                this.last_fire = now;
                play_fang_fire();
            }
        }

        // --- Update fangs ---
        for (const f of this.fangs) {
            if (!f.alive) continue;

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
                    const max_turn = FANG_TURN_SPEED * dt;
                    const turn = Math.max(-max_turn, Math.min(max_turn, diff));
                    const new_angle = cur_angle + turn;
                    f.dx = Math.cos(new_angle);
                    f.dy = Math.sin(new_angle);
                }
            }

            f.trail.push({ x: f.x, y: f.y });
            if (f.trail.length > 8) f.trail.shift();

            f.x += f.dx * FANG_SPEED * dt;
            f.y += f.dy * FANG_SPEED * dt;
            f.life -= dt;
            if (f.life <= 0) f.alive = false;

            // Out of bounds
            if (f.x < 0 || f.x > arena.size || f.y < 0 || f.y > arena.size) {
                f.alive = false;
            }
        }

        // --- Collision with enemies ---
        const dmg = this.get_damage();
        for (const f of this.fangs) {
            if (!f.alive) continue;
            const hit_r = FANG_RADIUS + 0.55;
            enemy_manager.query_radius(f.x, f.y, hit_r, (e) => {
                if (!f.alive) return;
                const dx = f.x - e.x;
                const dy = f.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < FANG_RADIUS + e.radius) {
                    f.alive = false;
                    play_fang_hit();
                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const final_dmg = Math.round((is_crit ? dmg * 2 : dmg) * this.gorger_dmg_mult);
                    const dead = e.take_damage(final_dmg);
                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, final_dmg, is_crit);
                    }
                    if (particles) {
                        const sx = e.x * cell_size;
                        const sy = e.y * cell_size;
                        particles.emit(sx, sy, 5, '#ff4466', 3);
                        particles.emit(sx, sy, 3, '#ff8888', 2);
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
                        e.x += f.dx * 0.3;
                        e.y += f.dy * 0.3;
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

        // --- Batch all fang trails first (3 bands instead of per-segment strokes) ---
        ctx.lineCap = 'round';
        const trail_bands = [
            { frac: 0.3, color: 'rgba(80, 255, 100, 0.10)', w_mult: 0.045 },
            { frac: 0.6, color: 'rgba(80, 255, 100, 0.21)', w_mult: 0.09 },
            { frac: 0.9, color: 'rgba(80, 255, 100, 0.31)', w_mult: 0.135 },
        ];
        for (const band of trail_bands) {
            ctx.strokeStyle = band.color;
            ctx.lineWidth = band.w_mult * cell_size;
            ctx.beginPath();
            for (const f of this.fangs) {
                if (!f.alive || f.trail.length < 2) continue;
                const tlen = f.trail.length;
                const lo = Math.max(1, Math.floor(band.frac * tlen * 0.4));
                const hi = Math.min(tlen, Math.ceil(band.frac * tlen * 1.4));
                for (let i = lo; i < hi; i++) {
                    ctx.moveTo(f.trail[i - 1].x * cell_size, f.trail[i - 1].y * cell_size);
                    ctx.lineTo(f.trail[i].x * cell_size, f.trail[i].y * cell_size);
                }
            }
            ctx.stroke();
        }

        for (const f of this.fangs) {
            if (!f.alive) continue;

            const px = f.x * cell_size;
            const py = f.y * cell_size;
            const angle = Math.atan2(f.dy, f.dx);

            // --- Two curved fangs ---
            const fl = cell_size * 0.55;     // fang length
            const gap = cell_size * 0.07;    // gap from center
            const spread = cell_size * 0.28; // how far each fang curves outward

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);

            // --- Glow layer (single path for both fangs) ---
            ctx.fillStyle = 'rgba(80, 255, 100, 0.15)';
            ctx.beginPath();
            ctx.moveTo(fl * 1.3, -gap * 1.3);
            ctx.lineTo(-fl * 0.4, -spread * 1.3);
            ctx.lineTo(-fl * 0.3, -gap * 1.3);
            ctx.closePath();
            ctx.moveTo(fl * 1.3, gap * 1.3);
            ctx.lineTo(-fl * 0.4, spread * 1.3);
            ctx.lineTo(-fl * 0.3, gap * 1.3);
            ctx.closePath();
            ctx.fill();

            // --- Both fangs in one path ---
            ctx.fillStyle = '#f0e8e0';
            ctx.beginPath();
            // Upper fang
            ctx.moveTo(fl, -gap);
            ctx.lineTo(-fl * 0.4, -spread);
            ctx.lineTo(-fl * 0.3, -gap * 2);
            ctx.closePath();
            // Lower fang
            ctx.moveTo(fl, gap);
            ctx.lineTo(-fl * 0.4, spread);
            ctx.lineTo(-fl * 0.3, gap * 2);
            ctx.closePath();
            ctx.fill();

            // --- Highlight (both fangs, one path) ---
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.moveTo(fl * 0.8, -gap * 1.1);
            ctx.lineTo(-fl * 0.1, -spread * 0.5);
            ctx.lineTo(fl * 0.1, -gap * 1.4);
            ctx.closePath();
            ctx.moveTo(fl * 0.8, gap * 1.1);
            ctx.lineTo(-fl * 0.1, spread * 0.5);
            ctx.lineTo(fl * 0.1, gap * 1.4);
            ctx.closePath();
            ctx.fill();

            // --- Venom at tips ---
            const pulse = 0.5 + Math.sin(f.wobble + now * 0.012) * 0.5;
            ctx.fillStyle = `rgba(80, 238, 68, ${0.5 + pulse * 0.5})`;
            const vr = fl * 0.06;
            const vtx = fl + fl * 0.04;
            ctx.fillRect(vtx - vr, -gap - vr, vr * 2, vr * 2);
            ctx.fillRect(vtx - vr, gap - vr, vr * 2, vr * 2);

            ctx.restore();
        }
    }

    clear() {
        this.fangs = [];
        this.last_fire = 0;
    }
}
