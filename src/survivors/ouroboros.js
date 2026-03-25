/**
 * Ouroboros — Evolution of Serpent's Scales + Venom Shot.
 *
 * A chaotic swarm of large fangs all orbiting in one direction.
 * Constantly pulses out bursts of fangs in every direction at
 * high frequency. Pulse rate scales with attack speed, extra
 * fangs per pulse scales with Coiled Volley. Raw damage, no knockback.
 */

import { play_ouroboros_hit, play_ouroboros_hum, play_ouroboros_burst } from '../audio/sound.js';
import { play_fang_fire, play_fang_hit } from '../audio/sound.js';

// ---- Swarm config ----
const NUM_FANGS = 44;
const MIN_ORBIT = 4.5;
const MAX_ORBIT = 9.5;

const BASE_DAMAGE = 180;
const HIT_COOLDOWN = 0.3;
const HIT_RADIUS = 1.1;
const TRAIL_LENGTH = 4;

// ---- Pulse burst config ----
const BASE_PULSE_CD = 0.35;       // seconds between pulses (very frequent)
const PULSE_DIRECTIONS = 12;      // fangs per pulse (every 30°)
const BURST_FANG_SPEED = 30;
const BURST_FANG_LIFE = 0.5;
const BURST_DAMAGE = 200;
const BURST_FANG_RADIUS = 0.3;

// ---- Tracking fang config ----
const TRACKING_COOLDOWN = 1.8;
const TRACKING_SPEED = 22;
const TRACKING_LIFETIME = 1.0;
const TRACKING_TURN_SPEED = 9;
const TRACKING_DAMAGE = 350;
const TRACKING_RADIUS = 0.2;
const TRACKING_RANGE = 14;

function rand(min, max) { return min + Math.random() * (max - min); }

export class Ouroboros {
    constructor() {
        this.active = false;
        this.gorger_dmg_mult = 1;
        this.crit_chance = 0;
        this.radius_mult = 1;
        this.fire_cd_mult = 1;
        this.extra_projectiles = 0;
        this._hum_timer = 0;
        this._tracking_timer = 0;
        this._pulse_timer = 0;
        this._pulse_angle_offset = 0;  // rotates each pulse for coverage

        // Each fang has independent orbit but all spin same direction
        this.fangs = [];
        this._init_fangs();

        this._hit_cd = new Map();
        this.burst_fangs = [];
        this.tracking_fangs = [];
    }

    _init_fangs() {
        this.fangs = [];
        for (let i = 0; i < NUM_FANGS; i++) {
            this.fangs.push(this._make_fang());
        }
    }

    _make_fang() {
        return {
            angle: Math.random() * Math.PI * 2,
            orbit: rand(MIN_ORBIT, MAX_ORBIT),
            speed: rand(1.0, 2.5),                     // all positive = same direction
            size: rand(0.55, 1.0),                      // bigger fangs
            // Wobble on radius
            wobble_r_amp: rand(0.3, 1.0),
            wobble_r_freq: rand(1.0, 3.0),
            wobble_r_phase: Math.random() * Math.PI * 2,
            // Wobble on angle
            wobble_a_amp: rand(0.03, 0.12),
            wobble_a_freq: rand(0.8, 2.5),
            wobble_a_phase: Math.random() * Math.PI * 2,
        };
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const now_s = performance.now() / 1000;
        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;

        // All fangs spin same direction
        for (const f of this.fangs) {
            f.angle += f.speed * dt;
        }

        // Ambient hum
        this._hum_timer += dt;
        if (this._hum_timer >= 0.6) {
            this._hum_timer -= 0.6;
            play_ouroboros_hum();
        }

        // Tick hit cooldowns
        for (const [e, t] of this._hit_cd) {
            const remaining = t - dt;
            if (remaining <= 0) this._hit_cd.delete(e);
            else this._hit_cd.set(e, remaining);
        }

        // ---- Orbit damage ----
        for (const f of this.fangs) {
            const wr = f.wobble_r_amp * Math.sin(f.wobble_r_phase + now_s * f.wobble_r_freq);
            const wa = f.wobble_a_amp * Math.cos(f.wobble_a_phase + now_s * f.wobble_a_freq);
            const r = (f.orbit + wr) * this.radius_mult;
            const a = f.angle + wa;
            const fx = hx + Math.cos(a) * r;
            const fy = hy + Math.sin(a) * r;

            enemy_manager.query_radius(fx, fy, HIT_RADIUS, (e) => {
                if (this._hit_cd.has(e)) return;
                const edx = fx - e.x;
                const edy = fy - e.y;
                if (Math.sqrt(edx * edx + edy * edy) > HIT_RADIUS + e.radius) return;

                this._hit_cd.set(e, HIT_COOLDOWN);
                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                const dmg = Math.round(BASE_DAMAGE * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
                const dead = e.take_damage(dmg);
                play_ouroboros_hit();
                if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
                if (particles) {
                    particles.emit(e.x * cell_size, e.y * cell_size, 4, '#22cc44', 3);
                    particles.emit(e.x * cell_size, e.y * cell_size, 3, '#66ff88', 2);
                }
                if (dead) {
                    const bx = Math.floor(e.x);
                    const by = Math.floor(e.y);
                    if (bx >= 0 && bx < arena.size && by >= 0 && by < arena.size) {
                        arena.food.push({ x: bx, y: by });
                        enemy_manager._try_drop_heart(bx, by);
                    }
                    enemy_manager.total_kills++;
                    if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                }
            });
        }

        // ---- Constant pulse bursts ----
        const pulse_cd = BASE_PULSE_CD * this.fire_cd_mult;
        this._pulse_timer += dt;
        if (this._pulse_timer >= pulse_cd) {
            this._pulse_timer -= pulse_cd;

            const dirs = PULSE_DIRECTIONS + this.extra_projectiles;
            const step = (Math.PI * 2) / dirs;
            const spawn_r = (MIN_ORBIT + MAX_ORBIT) * 0.5 * this.radius_mult;

            for (let i = 0; i < dirs; i++) {
                const a = this._pulse_angle_offset + step * i;
                const sx = hx + Math.cos(a) * spawn_r;
                const sy = hy + Math.sin(a) * spawn_r;
                this.burst_fangs.push({
                    x: sx, y: sy,
                    dx: Math.cos(a), dy: Math.sin(a),
                    life: BURST_FANG_LIFE,
                    alive: true,
                    angle: a,
                    size: rand(0.6, 1.0),
                });
            }

            // Rotate offset each pulse so coverage sweeps
            this._pulse_angle_offset += step * 0.5;

            play_ouroboros_burst();
            if (particles) {
                particles.emit(hx * cell_size, hy * cell_size, 6, '#44ff66', 3);
                particles.emit(hx * cell_size, hy * cell_size, 4, '#22cc44', 2);
            }
        }

        // ---- Update burst fangs ----
        for (const f of this.burst_fangs) {
            if (!f.alive) continue;
            f.x += f.dx * BURST_FANG_SPEED * dt;
            f.y += f.dy * BURST_FANG_SPEED * dt;
            f.life -= dt;
            if (f.life <= 0) f.alive = false;
            if (f.x < 0 || f.x > arena.size || f.y < 0 || f.y > arena.size) f.alive = false;
        }

        // Burst fang collision
        for (const f of this.burst_fangs) {
            if (!f.alive) continue;
            enemy_manager.query_radius(f.x, f.y, BURST_FANG_RADIUS + 0.55, (e) => {
                if (!f.alive) return;
                if (Math.sqrt((f.x - e.x) ** 2 + (f.y - e.y) ** 2) > BURST_FANG_RADIUS + e.radius) return;
                f.alive = false;
                play_ouroboros_hit();
                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                const dmg = Math.round(BURST_DAMAGE * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
                const dead = e.take_damage(dmg);
                if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
                if (particles) {
                    particles.emit(e.x * cell_size, e.y * cell_size, 5, '#44ff66', 3);
                    particles.emit(e.x * cell_size, e.y * cell_size, 3, '#aaffcc', 2);
                }
                if (dead) {
                    const bx = Math.floor(e.x);
                    const by = Math.floor(e.y);
                    if (bx >= 0 && bx < arena.size && by >= 0 && by < arena.size) {
                        arena.food.push({ x: bx, y: by });
                        enemy_manager._try_drop_heart(bx, by);
                    }
                    enemy_manager.total_kills++;
                    if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                }
            });
        }

        // Compact burst fangs
        let bw = 0;
        for (let r = 0; r < this.burst_fangs.length; r++) {
            if (this.burst_fangs[r].alive) this.burst_fangs[bw++] = this.burst_fangs[r];
        }
        this.burst_fangs.length = bw;

        // ---- Fire tracking fang ----
        this._tracking_timer += dt;
        if (this._tracking_timer >= TRACKING_COOLDOWN * this.fire_cd_mult) {
            this._tracking_timer -= TRACKING_COOLDOWN * this.fire_cd_mult;
            const range = TRACKING_RANGE * this.radius_mult;
            let nearest = null;
            let best_d = Infinity;
            enemy_manager.query_radius(hx, hy, range, (e) => {
                const d = (e.x - hx) ** 2 + (e.y - hy) ** 2;
                if (d < best_d) { best_d = d; nearest = e; }
            });
            if (nearest) {
                const dx = nearest.x - hx;
                const dy = nearest.y - hy;
                const len = Math.sqrt(dx * dx + dy * dy);
                this.tracking_fangs.push({
                    x: hx, y: hy,
                    dx: len > 0.01 ? dx / len : 0,
                    dy: len > 0.01 ? dy / len : 1,
                    target: nearest,
                    life: TRACKING_LIFETIME,
                    alive: true,
                    trail: [],
                    wobble: Math.random() * Math.PI * 2,
                });
                play_fang_fire();
            }
        }

        // ---- Update tracking fangs ----
        for (const f of this.tracking_fangs) {
            if (!f.alive) continue;
            if (f.target && f.target.alive) {
                const tx = f.target.x - f.x;
                const ty = f.target.y - f.y;
                const len = Math.sqrt(tx * tx + ty * ty);
                if (len > 0.01) {
                    const cur = Math.atan2(f.dy, f.dx);
                    let want = Math.atan2(ty / len, tx / len);
                    let diff = want - cur;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const max_turn = TRACKING_TURN_SPEED * dt;
                    const turn = Math.max(-max_turn, Math.min(max_turn, diff));
                    const na = cur + turn;
                    f.dx = Math.cos(na);
                    f.dy = Math.sin(na);
                }
            }
            f.trail.push({ x: f.x, y: f.y });
            if (f.trail.length > 8) f.trail.shift();
            f.x += f.dx * TRACKING_SPEED * dt;
            f.y += f.dy * TRACKING_SPEED * dt;
            f.life -= dt;
            if (f.life <= 0) f.alive = false;
            if (f.x < 0 || f.x > arena.size || f.y < 0 || f.y > arena.size) f.alive = false;
        }

        // Tracking fang collision
        for (const f of this.tracking_fangs) {
            if (!f.alive) continue;
            enemy_manager.query_radius(f.x, f.y, TRACKING_RADIUS + 0.55, (e) => {
                if (!f.alive) return;
                if (Math.sqrt((f.x - e.x) ** 2 + (f.y - e.y) ** 2) > TRACKING_RADIUS + e.radius) return;
                f.alive = false;
                play_fang_hit();
                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                const dmg = Math.round(TRACKING_DAMAGE * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
                const dead = e.take_damage(dmg);
                if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
                if (particles) {
                    particles.emit(e.x * cell_size, e.y * cell_size, 6, '#44ff66', 4);
                    particles.emit(e.x * cell_size, e.y * cell_size, 4, '#aaffcc', 3);
                }
                if (dead) {
                    const bx = Math.floor(e.x);
                    const by = Math.floor(e.y);
                    if (bx >= 0 && bx < arena.size && by >= 0 && by < arena.size) {
                        arena.food.push({ x: bx, y: by });
                        enemy_manager._try_drop_heart(bx, by);
                    }
                    enemy_manager.total_kills++;
                    if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                }
            });
        }

        // Compact tracking fangs
        let tw = 0;
        for (let r = 0; r < this.tracking_fangs.length; r++) {
            if (this.tracking_fangs[r].alive) this.tracking_fangs[tw++] = this.tracking_fangs[r];
        }
        this.tracking_fangs.length = tw;
    }

    // ---- Render swarm ----
    render(ctx, cell_size, interp_x, interp_y) {
        if (!this.active) return;

        const hx = interp_x * cell_size;
        const hy = interp_y * cell_size;
        const now_s = performance.now() / 1000;

        for (const f of this.fangs) {
            const wr = f.wobble_r_amp * Math.sin(f.wobble_r_phase + now_s * f.wobble_r_freq);
            const wa = f.wobble_a_amp * Math.cos(f.wobble_a_phase + now_s * f.wobble_a_freq);
            const r_px = ((f.orbit + wr) * this.radius_mult) * cell_size;
            const a = f.angle + wa;
            const fx = hx + Math.cos(a) * r_px;
            const fy = hy + Math.sin(a) * r_px;
            const fang_size = cell_size * 0.55 * f.size;

            // Trail — all same rotation direction
            for (let t = TRAIL_LENGTH; t >= 1; t--) {
                const ta = a - (t * 0.10);
                const tx_t = hx + Math.cos(ta) * r_px;
                const ty_t = hy + Math.sin(ta) * r_px;
                const alpha = 0.04 * (TRAIL_LENGTH - t + 1) / TRAIL_LENGTH;
                const sz = fang_size * (0.4 + 0.6 * (TRAIL_LENGTH - t) / TRAIL_LENGTH);

                ctx.save();
                ctx.translate(tx_t, ty_t);
                ctx.rotate(ta + Math.PI / 2);
                ctx.fillStyle = `rgba(40, 180, 80, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(sz, 0);
                ctx.lineTo(-sz * 0.5, -sz * 0.45);
                ctx.lineTo(-sz * 0.5, sz * 0.45);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // Main fang — perpendicular, all same direction
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(a + Math.PI / 2);

            ctx.shadowColor = '#22cc44';
            ctx.shadowBlur = cell_size * 0.4;

            ctx.fillStyle = '#22cc44';
            ctx.beginPath();
            ctx.moveTo(fang_size, 0);
            ctx.lineTo(-fang_size * 0.5, -fang_size * 0.45);
            ctx.lineTo(-fang_size * 0.5, fang_size * 0.45);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(150, 255, 180, 0.45)';
            ctx.beginPath();
            ctx.moveTo(fang_size * 0.55, 0);
            ctx.lineTo(-fang_size * 0.15, -fang_size * 0.2);
            ctx.lineTo(-fang_size * 0.15, fang_size * 0.2);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ---- Burst fangs flying outward ----
        for (const f of this.burst_fangs) {
            if (!f.alive) continue;
            const px = f.x * cell_size;
            const py = f.y * cell_size;
            const sz = cell_size * 0.45 * f.size;
            const fade = f.life / BURST_FANG_LIFE;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(f.angle);
            ctx.globalAlpha = fade;

            ctx.shadowColor = '#44ff66';
            ctx.shadowBlur = cell_size * 0.5;

            ctx.fillStyle = '#44ff66';
            ctx.beginPath();
            ctx.moveTo(sz, 0);
            ctx.lineTo(-sz * 0.5, -sz * 0.45);
            ctx.lineTo(-sz * 0.5, sz * 0.45);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    // ---- Render tracking fangs ----
    render_tracking(ctx, cell_size) {
        if (!this.active) return;
        const now = performance.now();

        ctx.lineCap = 'round';
        const bands = [
            { frac: 0.3, color: 'rgba(40, 220, 80, 0.10)', w: 0.04 },
            { frac: 0.6, color: 'rgba(40, 220, 80, 0.20)', w: 0.08 },
            { frac: 0.9, color: 'rgba(40, 220, 80, 0.30)', w: 0.12 },
        ];
        for (const band of bands) {
            ctx.strokeStyle = band.color;
            ctx.lineWidth = band.w * cell_size;
            ctx.beginPath();
            for (const f of this.tracking_fangs) {
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

        for (const f of this.tracking_fangs) {
            if (!f.alive) continue;
            const px = f.x * cell_size;
            const py = f.y * cell_size;
            const angle = Math.atan2(f.dy, f.dx);
            const fl = cell_size * 0.55;
            const gap = cell_size * 0.07;
            const spread = cell_size * 0.28;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);

            ctx.fillStyle = 'rgba(40, 220, 80, 0.15)';
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

            ctx.fillStyle = '#44ff66';
            ctx.beginPath();
            ctx.moveTo(fl, -gap);
            ctx.lineTo(-fl * 0.4, -spread);
            ctx.lineTo(-fl * 0.3, -gap * 2);
            ctx.closePath();
            ctx.moveTo(fl, gap);
            ctx.lineTo(-fl * 0.4, spread);
            ctx.lineTo(-fl * 0.3, gap * 2);
            ctx.closePath();
            ctx.fill();

            const pulse = 0.5 + Math.sin(f.wobble + now * 0.012) * 0.5;
            ctx.fillStyle = `rgba(80, 255, 100, ${0.5 + pulse * 0.5})`;
            const vr = fl * 0.08;
            ctx.fillRect(fl + fl * 0.04 - vr, -gap - vr, vr * 2, vr * 2);
            ctx.fillRect(fl + fl * 0.04 - vr, gap - vr, vr * 2, vr * 2);

            ctx.restore();
        }
    }

    clear() {
        this._init_fangs();
        this._hum_timer = 0;
        this._tracking_timer = 0;
        this._pulse_timer = 0;
        this._pulse_angle_offset = 0;
        this.burst_fangs = [];
        this._hit_cd.clear();
        this.tracking_fangs = [];
    }
}
