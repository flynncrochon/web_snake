import { play_mortar_launch, play_gravity_well, play_explosion } from '../audio/sound.js';

const MORTAR_RANGE = 18;
const MORTAR_RANGE_SQ = MORTAR_RANGE * MORTAR_RANGE;
const COOLDOWN = 5500;
const FLIGHT_DURATION = 1.0;
const MAX_ARC_HEIGHT = 9;
const PULL_DURATION = 2.0;
const PULL_RADIUS = 4;
const PULL_STRENGTH = 6.0;
const DETONATION_DAMAGE = 2500;
const PULL_TICK_DAMAGE = 80;
const PULL_TICK_INTERVAL = 0.4;
const GRID_PULL_INTERVAL = 0.16;
const MAX_TRAIL_POINTS = 40;
const MAX_WELLS = 15;

export class SingularityMortar {
    constructor() {
        this.projectiles = [];
        this.wells = [];
        this.last_fire = 0;
        this.active = false;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.radius_mult = 1;
        this.duration_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_pull_radius() {
        return PULL_RADIUS * this.radius_mult;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire at densest enemy cluster ---
        if (now - this.last_fire >= COOLDOWN * this.fire_cooldown_mult) {
            const pull_r = this.get_pull_radius();
            const mort_range = MORTAR_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, mort_range);

            let best = null;
            let best_score = -1;
            const sample = candidates.length <= 15 ? candidates
                : candidates.sort(() => Math.random() - 0.5).slice(0, 15);

            for (const e of sample) {
                const score = 1 + enemy_manager.query_count(e.x, e.y, pull_r, e);
                if (score > best_score) {
                    best_score = score;
                    best = e;
                }
            }

            if (best) {
                play_mortar_launch();
                this.projectiles.push({
                    start_x: hx,
                    start_y: hy,
                    target_x: best.x,
                    target_y: best.y,
                    elapsed: 0,
                    duration: FLIGHT_DURATION,
                    trail: [],
                    drips: [],
                });
                this.last_fire = now;
            }
        }

        // --- Update projectiles in flight ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.elapsed += dt;
            const t = Math.min(p.elapsed / p.duration, 1);

            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = MAX_ARC_HEIGHT * 4 * t * (1 - t);

            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_TRAIL_POINTS) p.trail.shift();

            // Drips
            if (Math.random() < dt * 10 && height > 1) {
                p.drips.push({
                    x: gx + (Math.random() - 0.5) * 0.3,
                    y: gy - height,
                    vy: 0,
                    life: 0.55,
                    size: 0.03 + Math.random() * 0.04,
                });
            }

            for (let j = p.drips.length - 1; j >= 0; j--) {
                const d = p.drips[j];
                d.vy += 18 * dt;
                d.y += d.vy * dt;
                d.life -= dt;
                if (d.life <= 0 || d.y >= gy) {
                    p.drips.splice(j, 1);
                }
            }

            // Landed — create gravity well
            if (t >= 1) {
                const pull_dur = PULL_DURATION * this.duration_mult;
                if (this.wells.length >= MAX_WELLS) {
                    // Force-detonate oldest well
                    this.wells[0].detonated = true;
                    this.wells[0].detonate_flash = 0;
                    this.wells.shift();
                }
                play_gravity_well();
                this.wells.push({
                    x: p.target_x,
                    y: p.target_y,
                    radius: this.get_pull_radius(),
                    pull_remaining: pull_dur,
                    pull_duration: pull_dur,
                    detonated: false,
                    detonate_flash: 0,
                    damage_accum: 0,
                    pull_move_accum: 0,
                    spin_phase: 0,
                });

                if (particles) {
                    const px = p.target_x * cell_size;
                    const py = p.target_y * cell_size;
                    particles.emit(px, py, 15, '#a040ff', 5);
                    particles.emit(px, py, 10, '#6020cc', 4);
                }

                this.projectiles.splice(i, 1);
            }
        }

        // --- Update gravity wells ---
        for (let i = this.wells.length - 1; i >= 0; i--) {
            const well = this.wells[i];
            well.spin_phase += dt * 4;

            if (!well.detonated) {
                well.pull_remaining -= dt;
                well.damage_accum += dt;

                const r = well.radius;
                const cx = well.x;
                const cy = well.y;

                // Slow enemies inside the well
                enemy_manager.query_radius(cx, cy, r, (e) => {
                    e._tongue_slow = 0.5;
                    e._tongue_slow_factor = 0.2;
                });

                // Tick damage during pull
                if (well.damage_accum >= PULL_TICK_INTERVAL) {
                    well.damage_accum -= PULL_TICK_INTERVAL;
                    const tick_dmg = Math.round(PULL_TICK_DAMAGE * this.gorger_dmg_mult);

                    enemy_manager.query_radius(cx, cy, r, (e) => {
                        const is_crit = Math.random() < this.crit_chance;
                        const dmg = is_crit ? tick_dmg * 2 : tick_dmg;
                        const dead = e.take_damage(dmg);
                        if (damage_numbers) {
                            damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
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

                // Pull phase complete — DETONATE
                if (well.pull_remaining <= 0) {
                    well.detonated = true;
                    well.detonate_flash = 0.6;
                    play_explosion();

                    const det_dmg = Math.round(DETONATION_DAMAGE * this.gorger_dmg_mult);

                    enemy_manager.query_radius(cx, cy, r, (e) => {
                        const is_crit = Math.random() < this.crit_chance;
                        const dmg = is_crit ? det_dmg * 2 : det_dmg;
                        const dead = e.take_damage(dmg);
                        if (damage_numbers) {
                            damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
                        }
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 6, '#ff80ff', 3);
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
                                particles.emit(e.x * cell_size, e.y * cell_size, 10, e.color, 4);
                            }
                        }
                    });

                    // Big explosion particles
                    if (particles) {
                        const px = cx * cell_size;
                        const py = cy * cell_size;
                        particles.emit(px, py, 40, '#cc44ff', 8);
                        particles.emit(px, py, 30, '#8822cc', 6);
                        particles.emit(px, py, 20, '#fff', 4);
                    }
                }
            }

            // Fade out after detonation
            if (well.detonated) {
                well.detonate_flash -= dt;
                if (well.detonate_flash <= 0) {
                    this.wells.splice(i, 1);
                }
            }
        }
    }

    // --- Render gravity wells (call inside camera transform, BEFORE enemies) ---
    render_wells(ctx, cell_size) {
        for (const well of this.wells) {
            const px = well.x * cell_size;
            const py = well.y * cell_size;
            const r = well.radius * cell_size;

            if (well.detonated) {
                // Explosion flash (layered circles)
                const flash_t = well.detonate_flash / 0.6;
                const expand = 1 + (1 - flash_t) * 0.5;
                const re = r * expand;

                ctx.beginPath();
                ctx.arc(px, py, re, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(100, 30, 180, ${(flash_t * 0.15).toFixed(3)})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, re * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 80, 255, ${(flash_t * 0.35).toFixed(3)})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, re * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 200, 255, ${(flash_t * 0.6).toFixed(3)})`;
                ctx.fill();
                continue;
            }

            const life_ratio = well.pull_remaining / well.pull_duration;
            // Intensity ramps up as detonation approaches
            const intensity = 1 - life_ratio;

            // Outer pull field (layered circles)
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(60, 15, 140, ${(0.06 + intensity * 0.04).toFixed(3)})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, r * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(100, 30, 200, ${(0.1 + intensity * 0.07).toFixed(3)})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(160, 60, 255, ${(0.18 + intensity * 0.1).toFixed(3)})`;
            ctx.fill();

            // Inner core — dark singularity (layered circles)
            const core_r = r * (0.12 + intensity * 0.08);
            ctx.beginPath();
            ctx.arc(px, py, core_r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(80, 20, 160, ${(0.3 + intensity * 0.15).toFixed(3)})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, core_r * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(20, 0, 40, ${(0.7 + intensity * 0.2).toFixed(3)})`;
            ctx.fill();

            // Spinning spiral arms
            ctx.save();
            ctx.strokeStyle = `rgba(180, 100, 255, ${0.2 + intensity * 0.15})`;
            ctx.lineWidth = cell_size * 0.08;
            for (let arm = 0; arm < 3; arm++) {
                const base_angle = well.spin_phase + (arm * Math.PI * 2 / 3);
                ctx.beginPath();
                for (let s = 0; s <= 20; s++) {
                    const frac = s / 20;
                    const spiral_r = r * 0.1 + frac * r * 0.8;
                    const angle = base_angle + frac * Math.PI * 2.5;
                    const sx = px + Math.cos(angle) * spiral_r;
                    const sy = py + Math.sin(angle) * spiral_r;
                    if (s === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.stroke();
            }
            ctx.restore();

            // Pulsing boundary ring
            const ring_alpha = 0.15 + intensity * 0.2 + Math.sin(well.spin_phase * 2) * 0.05;
            // Glow layer for boundary ring
            ctx.strokeStyle = `rgba(160, 60, 255, ${ring_alpha * 0.18})`;
            ctx.lineWidth = cell_size * 0.35;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.save();
            ctx.strokeStyle = `rgba(180, 80, 255, ${ring_alpha})`;
            ctx.lineWidth = cell_size * 0.1;
            ctx.setLineDash([cell_size * 0.25, cell_size * 0.15]);
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Countdown indicator — shrinking ring toward center
            const countdown_r = r * life_ratio;
            ctx.strokeStyle = `rgba(255, 150, 255, ${0.3 + intensity * 0.2})`;
            ctx.lineWidth = cell_size * 0.06;
            ctx.beginPath();
            ctx.arc(px, py, countdown_r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // --- Render projectiles in flight ---
    render_projectiles(ctx, cell_size) {
        for (const p of this.projectiles) {
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = MAX_ARC_HEIGHT * 4 * t * (1 - t);

            const ground_px = gx * cell_size;
            const ground_py = gy * cell_size;
            const orb_py = (gy - height) * cell_size;

            // Ground shadow
            const height_ratio = height / MAX_ARC_HEIGHT;
            const shadow_scale = 1 - height_ratio * 0.5;
            const shadow_alpha = 0.1 + (1 - height_ratio) * 0.15;
            ctx.fillStyle = `rgba(100, 30, 180, ${shadow_alpha})`;
            ctx.beginPath();
            ctx.ellipse(ground_px, ground_py,
                cell_size * 0.7 * shadow_scale,
                cell_size * 0.35 * shadow_scale,
                0, 0, Math.PI * 2);
            ctx.fill();

            // Smooth tapered trail
            if (p.trail.length >= 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < p.trail.length; i++) {
                    const frac = i / (p.trail.length - 1);
                    const a = frac * frac * 0.5;
                    const w = frac * cell_size * 0.28;
                    ctx.strokeStyle = `rgba(160, 80, 255, ${a})`;
                    ctx.lineWidth = Math.max(0.5, w);
                    ctx.beginPath();
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // Drips
            for (const d of p.drips) {
                const d_alpha = Math.max(0, d.life / 0.55);
                ctx.fillStyle = `rgba(140, 50, 220, ${d_alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(d.x * cell_size, d.y * cell_size, d.size * cell_size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Outer glow halo (layered circles)
            const orb_r = cell_size * 0.35;

            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(140, 65, 228, 0.08)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(180, 100, 255, 0.18)';
            ctx.fill();

            // Main orb with wobble (layered circles)
            const wobble = Math.sin(p.elapsed * 12) * 0.12 + 1;
            const rx = orb_r * wobble;
            const ry = orb_r * (2 - wobble) * 0.52 + orb_r * 0.48;

            ctx.fillStyle = 'rgba(40, 10, 100, 0.5)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx, ry, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(100, 30, 200, 0.8)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.75, ry * 0.75, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(160, 80, 255, 0.9)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.4, ry * 0.4, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(240, 220, 255, 0.45)';
            ctx.beginPath();
            ctx.arc(ground_px - orb_r * 0.2, orb_py - orb_r * 0.25, orb_r * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    clear() {
        this.projectiles = [];
        this.wells = [];
        this.last_fire = 0;
    }
}
