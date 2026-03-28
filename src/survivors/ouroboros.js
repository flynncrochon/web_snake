/**
 * Ouroboros — Evolution of Serpent's Scales + Venom Shot.
 *
 * A chaotic ultra-fast swarm of fangs all orbiting in one direction.
 * Pure swarm damage, no projectiles.
 */

import { play_ouroboros_hit, play_ouroboros_hum } from '../audio/sound.js';

// ---- Swarm config ----
const NUM_FANGS = 44;
const MIN_ORBIT = 4.5;
const MAX_ORBIT = 9.5;

const BASE_DAMAGE = 180;
const HIT_COOLDOWN = 0.3;
const HIT_RADIUS = 1.1;
const TRAIL_LENGTH = 4;

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

        this.fangs = [];
        this._init_fangs();

        this._hit_cd = new Map();
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
            speed: rand(4.0, 8.0),                      // ultra fast spin
            size: rand(0.55, 1.0),
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

        // All fangs spin same direction — ultra fast
        for (const f of this.fangs) {
            f.angle += f.speed * dt;
        }

        // Ambient swarm hum
        this._hum_timer += dt;
        if (this._hum_timer >= 0.45) {
            this._hum_timer -= 0.45;
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
    }

    // No-op for compatibility
    render_tracking() {}

    clear() {
        this._init_fangs();
        this._hum_timer = 0;
        this._hit_cd.clear();
    }
}
