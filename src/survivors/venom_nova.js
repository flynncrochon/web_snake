import { play_nova } from '../audio/sound.js';

const BASE_COOLDOWN = 3500;
const BASE_RADIUS = 2.5;
const RADIUS_PER_LEVEL = 0.4;
const PULSE_VISUAL_DURATION = 0.45;
const MAX_PULSES = 75;

export class VenomNova {
    constructor() {
        this.level = 0;
        this.last_pulse = 0;
        this.duration_mult = 1;
        this.extra_projectiles = 0;
        this.radius_mult = 1;
        this.gorger_dmg_mult = 1;
        this.crit_chance = 0;
        this.fire_cooldown_mult = 1;
        this.pulses = []; // visual-only ring expansions
    }

    get_cooldown() {
        return Math.max(1200, BASE_COOLDOWN - (this.level - 1) * 350) * this.fire_cooldown_mult;
    }

    get_radius() {
        return (BASE_RADIUS + (this.level - 1) * RADIUS_PER_LEVEL) * this.radius_mult;
    }

    get_damage() {
        return (1 + Math.floor(this.level / 3)) * 100;
    }

    get_pulse_count() {
        return 1 + this.extra_projectiles;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire pulse ---
        if (now - this.last_pulse >= this.get_cooldown()) {
            const radius = this.get_radius();
            const dmg = Math.round(this.get_damage() * this.gorger_dmg_mult);
            const pulse_count = this.get_pulse_count();

            // Damage enemies in radius
            enemy_manager.query_radius(hx, hy, radius, (e) => {
                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                const final_dmg = Math.round(dmg * pulse_count * (is_crit ? 2 : 1));
                const dead = e.take_damage(final_dmg);
                if (damage_numbers) {
                    damage_numbers.emit(e.x, e.y - e.radius, final_dmg, is_crit);
                }
                if (particles) {
                    const sx = e.x * cell_size;
                    const sy = e.y * cell_size;
                    particles.emit(sx, sy, 4, '#66ff88', 2);
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
                }
            });

            // Spawn visual pulse rings — duration_mult adds extra aftershock waves
            const aftershock_count = Math.floor((this.duration_mult - 1) / 0.25);
            const total_waves = 1 + aftershock_count;
            for (let w = 0; w < total_waves; w++) {
                for (let i = 0; i < pulse_count && this.pulses.length < MAX_PULSES; i++) {
                    this.pulses.push({
                        x: hx,
                        y: hy,
                        max_radius: radius,
                        elapsed: 0,
                        duration: PULSE_VISUAL_DURATION,
                        delay: i * 0.12 + w * 0.25,
                        deals_damage: w > 0,  // first wave already dealt damage above
                    });
                }
            }

            play_nova();

            // Burst particles at head
            if (particles) {
                const px = hx * cell_size;
                const py = hy * cell_size;
                particles.emit(px, py, 15, '#44ff66', 5);
                particles.emit(px, py, 10, '#88ffaa', 3);
            }

            this.last_pulse = now;
        }

        // --- Update pulses (visual + aftershock damage) ---
        for (const p of this.pulses) {
            if (p.delay > 0) {
                const prev_delay = p.delay;
                p.delay -= dt;
                // Aftershock wave triggers damage when delay crosses zero
                if (p.deals_damage && prev_delay > 0 && p.delay <= 0) {
                    const radius = p.max_radius;
                    const dmg = Math.round(this.get_damage() * this.gorger_dmg_mult * 0.5);
                    enemy_manager.query_radius(p.x, p.y, radius, (e) => {
                        const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                        const aftershock_dmg = Math.round(dmg * (is_crit ? 2 : 1));
                        const dead = e.take_damage(aftershock_dmg);
                        if (damage_numbers) {
                            damage_numbers.emit(e.x, e.y - e.radius, aftershock_dmg, is_crit);
                        }
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 3, '#66ff88', 2);
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
                        }
                    });
                }
            } else {
                p.elapsed += dt;
            }
        }
        // In-place compaction
        {
            let w = 0;
            for (let r = 0; r < this.pulses.length; r++) {
                const p = this.pulses[r];
                if (p.delay > 0 || p.elapsed < p.duration) this.pulses[w++] = p;
            }
            this.pulses.length = w;
        }
    }

    render(ctx, cell_size) {
        for (const p of this.pulses) {
            if (p.delay > 0) continue;

            const t = p.elapsed / p.duration;
            const ease_t = 1 - (1 - t) * (1 - t); // ease-out quad
            const r = p.max_radius * ease_t * cell_size;
            const alpha = (1 - t) * 0.6;

            const px = p.x * cell_size;
            const py = p.y * cell_size;

            // Outer glow ring — transparent wider ring for glow effect
            ctx.strokeStyle = `rgba(60, 255, 100, ${alpha * 0.15})`;
            ctx.lineWidth = cell_size * 0.5 * (1 - t);
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.stroke();
            // Main ring
            ctx.strokeStyle = `rgba(60, 255, 100, ${alpha * 0.8})`;
            ctx.lineWidth = cell_size * 0.2 * (1 - t);
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.stroke();

            // Inner fill (concentric circles)
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(20, 150, 40, ${alpha * 0.04})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(30, 200, 60, ${alpha * 0.08})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, r * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(60, 255, 100, ${alpha * 0.15})`;
            ctx.fill();
        }
    }

    clear() {
        this.pulses = [];
        this.last_pulse = 0;
    }
}
