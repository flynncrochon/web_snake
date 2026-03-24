import { play_lash } from '../audio/sound.js';

const BASE_RANGE = 3;
const BASE_COOLDOWN = 2000;
const CONE_HALF_ANGLE = Math.PI / 3; // 60° half = 120° cone
const LASH_VISUAL_DURATION = 0.35;
const SLOW_DURATION = 1.5; // seconds
const SLOW_FACTOR = 0.4;  // enemies move at 40% speed
const SWEEP_HALF = Math.PI / 4; // tongue sweeps ±45° around its center

export class TongueLash {
    constructor() {
        this.level = 0;
        this.last_lash = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.range_mult = 1;
        this.radius_mult = 1;
        this.extra_projectiles = 0;
        this.duration_mult = 1;
        this.fire_cooldown_mult = 1;
        this.lashes = []; // visual tongue sweeps
        this._sweep_dir = 1; // alternates each lash
    }

    get_cooldown() {
        return Math.max(600, BASE_COOLDOWN - (this.level - 1) * 180) * this.fire_cooldown_mult;
    }

    get_range() {
        return (BASE_RANGE + (this.level - 1) * 0.35) * this.range_mult;
    }

    get_damage() {
        return (1 + Math.floor(this.level / 2)) * 80;
    }

    get_lash_count() {
        return 1 + this.extra_projectiles;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // Snake facing direction
        const face_dx = snake.direction.dx;
        const face_dy = snake.direction.dy;

        if (now - this.last_lash >= this.get_cooldown()) {
            play_lash();
            const range = this.get_range();
            const dmg_base = this.get_damage();
            const lash_count = this.get_lash_count();
            const cone_half = CONE_HALF_ANGLE * this.radius_mult;
            const cone_cos = Math.cos(Math.min(cone_half, Math.PI));
            const slow_dur = SLOW_DURATION * this.duration_mult;

            // Sweep through each lash (extra projectiles = extra sweeps with offset angles)
            for (let l = 0; l < lash_count; l++) {
                // Offset angle for extra lashes — fan them out
                let lash_angle_offset = 0;
                if (lash_count > 1) {
                    lash_angle_offset = ((l / (lash_count - 1)) - 0.5) * 0.8;
                }
                const base_angle = Math.atan2(face_dy, face_dx) + lash_angle_offset;
                const ldx = Math.cos(base_angle);
                const ldy = Math.sin(base_angle);

                // Alternate sweep direction each lash
                const sweep_dir = this._sweep_dir;
                this._sweep_dir *= -1;

                // Visual lash — tracks snake head live
                this.lashes.push({
                    snake: snake,
                    center_angle: base_angle,
                    sweep_dir: sweep_dir,
                    range: range,
                    cone_half: cone_half,
                    elapsed: 0,
                    duration: LASH_VISUAL_DURATION,
                });

                // Damage all enemies in cone
                enemy_manager.query_radius(hx, hy, range, (e) => {
                    const ex = e.x - hx;
                    const ey = e.y - hy;
                    const dist = Math.sqrt(ex * ex + ey * ey);
                    if (dist < 0.01) return;
                    const dot = (ex * ldx + ey * ldy) / dist;
                    if (dot < cone_cos) return;

                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const final_dmg = Math.round((is_crit ? dmg_base * 2 : dmg_base) * this.gorger_dmg_mult);
                    const dead = e.take_damage(final_dmg);

                    // Apply slow
                    e._tongue_slow = slow_dur;
                    e._tongue_slow_factor = SLOW_FACTOR;

                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, final_dmg, is_crit);
                    }
                    if (particles) {
                        const sx = e.x * cell_size;
                        const sy = e.y * cell_size;
                        particles.emit(sx, sy, 4, '#ff5588', 2);
                        particles.emit(sx, sy, 2, '#ff88aa', 1.5);
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
                        // Knockback away from head
                        const kb = 0.4;
                        e.x += (ex / dist) * kb;
                        e.y += (ey / dist) * kb;
                    }
                });
            }

            // Burst particles at head
            if (particles) {
                const px = hx * cell_size;
                const py = hy * cell_size;
                particles.emit(px, py, 8, '#ff4477', 4);
                particles.emit(px, py, 5, '#ff88aa', 2);
            }

            this.last_lash = now;
        }

        // --- Update lash visuals ---
        for (const v of this.lashes) {
            v.elapsed += dt;
        }
        // In-place compaction
        {
            let w = 0;
            for (let r = 0; r < this.lashes.length; r++) {
                if (this.lashes[r].elapsed < this.lashes[r].duration) this.lashes[w++] = this.lashes[r];
            }
            this.lashes.length = w;
        }

        // --- Update slow on enemies ---
        for (const e of enemy_manager.enemies) {
            if (e._tongue_slow > 0) {
                e._tongue_slow -= dt;
                if (e._tongue_slow <= 0) {
                    e._tongue_slow = 0;
                    e._tongue_slow_factor = 1;
                }
            }
        }
    }

    render(ctx, cell_size) {
        const now = performance.now();
        for (const v of this.lashes) {
            const t = v.elapsed / v.duration;
            if (t >= 1) continue;

            // Track snake head position live
            const head = v.snake.head;
            const px = (head.x + 0.5) * cell_size;
            const py = (head.y + 0.5) * cell_size;
            const reach = v.range * cell_size;

            // Sweep: tongue angle sweeps across the cone over time
            // ease-in-out for smooth sweep feel
            const sweep_t = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            const sweep_offset = SWEEP_HALF * (2 * sweep_t - 1) * v.sweep_dir;
            const current_angle = v.center_angle + sweep_offset;

            // Extend then retract — quick snap out, slower pull back
            const extend = t < 0.25 ? t / 0.25 : 1;
            const retract = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
            const ease_extend = 1 - (1 - extend) * (1 - extend); // ease-out
            const len = reach * ease_extend * retract;
            const alpha = (1 - t * t) * 0.9;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(current_angle);

            // --- Cone glow (the area of effect indicator, concentric arcs) ---
            const cone_half = v.cone_half;
            ctx.save();
            ctx.rotate(-cone_half);
            // Outer cone fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, len * 0.9, 0, cone_half * 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(200, 20, 60, ${alpha * 0.04})`;
            ctx.fill();
            // Mid cone fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, len * 0.5, 0, cone_half * 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 40, 80, ${alpha * 0.06})`;
            ctx.fill();
            // Inner cone fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, len * 0.15, 0, cone_half * 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 60, 100, ${alpha * 0.1})`;
            ctx.fill();
            ctx.restore();

            // --- Tongue body (forked) ---
            const tongue_w = cell_size * 0.12;
            const fork_start = len * 0.65;
            const fork_spread = cell_size * 0.22 * ease_extend;

            // Pulsing color
            const pulse = 0.7 + Math.sin(now * 0.015 + t * 10) * 0.3;

            // Glow layer — slightly wider, semi-transparent tongue stroke
            const glow_alpha = alpha * 0.15;
            ctx.strokeStyle = `rgba(255, 50, 90, ${glow_alpha})`;
            ctx.lineWidth = tongue_w * 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(len * 0.4, Math.sin(t * Math.PI * 3) * cell_size * 0.06 * (t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1), fork_start, 0);
            ctx.stroke();

            // Slight wave in the tongue shaft for organic feel
            const wave = Math.sin(t * Math.PI * 3) * cell_size * 0.06 * retract;
            const mid = len * 0.4;

            // Main tongue shaft — curved
            ctx.strokeStyle = `rgba(220, 40, 70, ${alpha * pulse})`;
            ctx.lineWidth = tongue_w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(mid, wave, fork_start, 0);
            ctx.stroke();

            // Brighter center line
            ctx.strokeStyle = `rgba(255, 100, 130, ${alpha * 0.7 * pulse})`;
            ctx.lineWidth = tongue_w * 0.4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(mid, wave, fork_start, 0);
            ctx.stroke();

            // Forked tips
            ctx.strokeStyle = `rgba(220, 40, 70, ${alpha * pulse})`;
            ctx.lineWidth = tongue_w * 0.7;
            ctx.beginPath();
            ctx.moveTo(fork_start, 0);
            ctx.quadraticCurveTo(fork_start + (len - fork_start) * 0.5, -fork_spread * 0.5, len, -fork_spread);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fork_start, 0);
            ctx.quadraticCurveTo(fork_start + (len - fork_start) * 0.5, fork_spread * 0.5, len, fork_spread);
            ctx.stroke();

            // Tip glow dots
            ctx.fillStyle = `rgba(255, 120, 150, ${alpha * pulse})`;
            ctx.beginPath();
            ctx.arc(len, -fork_spread, tongue_w * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(len, fork_spread, tongue_w * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    clear() {
        this.lashes = [];
        this.last_lash = 0;
    }
}
