import { play_mortar_launch, play_mortar_land, play_pool_tick } from '../audio/sound.js';

const MORTAR_RANGE = 16;
const MORTAR_RANGE_SQ = MORTAR_RANGE * MORTAR_RANGE;
const BASE_COOLDOWN = 4000;
const FLIGHT_DURATION = 0.9;
const MAX_ARC_HEIGHT = 7;
const POOL_DURATION = 4.0;
const POOL_DAMAGE_INTERVAL = 0.35;
const BASE_POOL_RADIUS = 2.2;
const POOL_RADIUS_PER_LEVEL = 0.35;
const MAX_TRAIL_POINTS = 40;
const MAX_POOLS = 30;

export class PoisonMortar {
    constructor() {
        this.projectiles = [];
        this.pools = [];
        this.last_fire = 0;
        this.level = 0;
        this.duration_mult = 1;
        this.extra_projectiles = 0;
        this.radius_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_cooldown() {
        return Math.max(1500, BASE_COOLDOWN - (this.level - 1) * 400) * this.fire_cooldown_mult;
    }

    get_pool_radius() {
        return (BASE_POOL_RADIUS + (this.level - 1) * POOL_RADIUS_PER_LEVEL) * this.radius_mult;
    }

    get_damage() {
        return (1 + Math.floor(this.level / 3)) * 125;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire at densest enemy cluster ---
        if (now - this.last_fire >= this.get_cooldown()) {
            const pool_r = this.get_pool_radius();
            const mortar_range = MORTAR_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, mortar_range);

            let best = null;
            let best_score = -1;
            const sample = candidates.length <= 15 ? candidates
                : candidates.sort(() => Math.random() - 0.5).slice(0, 15);

            for (const e of sample) {
                const score = 1 + enemy_manager.query_count(e.x, e.y, pool_r, e);
                if (score > best_score) {
                    best_score = score;
                    best = e;
                }
            }

            if (best) {
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
                // Extra mortars target different enemies spread across the range
                if (this.extra_projectiles > 0 && candidates.length > 1) {
                    // Sort remaining candidates by distance from primary target (farthest first for spread)
                    const used = new Set();
                    used.add(best);
                    for (let ei = 0; ei < this.extra_projectiles; ei++) {
                        let extra_target = null;
                        let extra_best_score = -1;
                        for (const e of candidates) {
                            if (used.has(e)) continue;
                            // Prefer enemies far from already-targeted spots for spread
                            let min_dist_sq = Infinity;
                            for (const u of used) {
                                const ddx = e.x - u.x;
                                const ddy = e.y - u.y;
                                min_dist_sq = Math.min(min_dist_sq, ddx * ddx + ddy * ddy);
                            }
                            if (min_dist_sq > extra_best_score) {
                                extra_best_score = min_dist_sq;
                                extra_target = e;
                            }
                        }
                        if (extra_target) {
                            used.add(extra_target);
                            this.projectiles.push({
                                start_x: hx,
                                start_y: hy,
                                target_x: extra_target.x,
                                target_y: extra_target.y,
                                elapsed: 0,
                                duration: FLIGHT_DURATION + ei * 0.12,
                                trail: [],
                                drips: [],
                            });
                        } else {
                            // No more unique targets — offset around primary
                            const angle = (ei / this.extra_projectiles) * Math.PI * 2 + Math.random() * 0.5;
                            const spread = pool_r * 1.5;
                            this.projectiles.push({
                                start_x: hx,
                                start_y: hy,
                                target_x: best.x + Math.cos(angle) * spread,
                                target_y: best.y + Math.sin(angle) * spread,
                                elapsed: 0,
                                duration: FLIGHT_DURATION + ei * 0.12,
                                trail: [],
                                drips: [],
                            });
                        }
                    }
                }
                play_mortar_launch();
                this.last_fire = now;
            }
        }

        // --- Update projectiles ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.elapsed += dt;
            const t = Math.min(p.elapsed / p.duration, 1);

            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = MAX_ARC_HEIGHT * 4 * t * (1 - t);

            // Trail point every frame
            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_TRAIL_POINTS) p.trail.shift();

            // Drips falling from the orb
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

            // Landed
            if (t >= 1) {
                const pool_dur = POOL_DURATION * this.duration_mult;
                // Cap pools to prevent unbounded growth
                if (this.pools.length >= MAX_POOLS) {
                    this.pools.shift(); // remove oldest pool
                }
                play_mortar_land();
                this.pools.push({
                    x: p.target_x,
                    y: p.target_y,
                    radius: this.get_pool_radius(),
                    remaining: pool_dur,
                    duration: pool_dur,
                    damage_accum: 0,
                    impact_time: 0,
                });

                if (particles) {
                    const px = p.target_x * cell_size;
                    const py = p.target_y * cell_size;
                    particles.emit(px, py, 20, '#0f0', 6);
                    particles.emit(px, py, 12, '#8f0', 4);
                    particles.emit(px, py, 8, '#ff0', 3);
                }

                this.projectiles.splice(i, 1);
            }
        }

        // --- Update pools ---
        for (let i = this.pools.length - 1; i >= 0; i--) {
            const pool = this.pools[i];
            pool.remaining -= dt;
            pool.impact_time += dt;
            pool.damage_accum += dt;

            // Continuous green particles across the pool
            if (particles) {
                const rate = 3 + pool.radius * 1.5;
                const count = Math.floor(dt * rate + (Math.random() < (dt * rate) % 1 ? 1 : 0));
                for (let j = 0; j < count; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * pool.radius * 0.85;
                    const px = (pool.x + Math.cos(angle) * dist) * cell_size;
                    const py = (pool.y + Math.sin(angle) * dist) * cell_size;
                    particles.emit(px, py, 1, '#0c3', 1);
                }
            }

            // Damage enemies in pool
            if (pool.damage_accum >= POOL_DAMAGE_INTERVAL) {
                pool.damage_accum -= POOL_DAMAGE_INTERVAL;
                play_pool_tick();
                const dmg = this.get_damage();

                enemy_manager.query_radius(pool.x, pool.y, pool.radius, (e) => {
                    const dead = e.take_damage(dmg);
                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, dmg, false);
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

            if (pool.remaining <= 0) {
                this.pools.splice(i, 1);
            }
        }
    }

    // --- Render poison pools (call inside camera transform, BEFORE enemies) ---
    render_pools(ctx, cell_size) {
        for (const pool of this.pools) {
            const life_ratio = pool.remaining / pool.duration;

            // Ease-out cubic expansion
            const expand_t = Math.min(1, pool.impact_time / 0.35);
            const appear = 1 - (1 - expand_t) * (1 - expand_t) * (1 - expand_t);

            // Smooth fade in final 25%
            const fade = life_ratio < 0.25 ? life_ratio / 0.25 : 1;
            const alpha = appear * fade;

            const px = pool.x * cell_size;
            const py = pool.y * cell_size;
            const r = pool.radius * cell_size * appear;

            ctx.fillStyle = `rgba(0, 200, 40, ${0.25 * alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Render projectiles in flight (call inside camera transform, AFTER snake) ---
    render_projectiles(ctx, cell_size) {
        for (const p of this.projectiles) {
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = MAX_ARC_HEIGHT * 4 * t * (1 - t);

            const ground_px = gx * cell_size;
            const ground_py = gy * cell_size;
            const orb_py = (gy - height) * cell_size;

            // ---- Ground shadow ----
            const height_ratio = height / MAX_ARC_HEIGHT;
            const shadow_scale = 1 - height_ratio * 0.5;
            const shadow_alpha = 0.1 + (1 - height_ratio) * 0.15;
            ctx.fillStyle = `rgba(0, 150, 30, ${shadow_alpha})`;
            ctx.beginPath();
            ctx.ellipse(ground_px, ground_py,
                cell_size * 0.7 * shadow_scale,
                cell_size * 0.35 * shadow_scale,
                0, 0, Math.PI * 2);
            ctx.fill();

            // ---- Smooth tapered trail ----
            if (p.trail.length >= 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < p.trail.length; i++) {
                    const frac = i / (p.trail.length - 1);
                    const a = frac * frac * 0.5;
                    const w = frac * cell_size * 0.28;
                    ctx.strokeStyle = `rgba(60, 230, 60, ${a})`;
                    ctx.lineWidth = Math.max(0.5, w);
                    ctx.beginPath();
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // ---- Drips ----
            for (const d of p.drips) {
                const d_alpha = Math.max(0, d.life / 0.55);
                ctx.fillStyle = `rgba(0, 200, 40, ${d_alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(d.x * cell_size, d.y * cell_size, d.size * cell_size, 0, Math.PI * 2);
                ctx.fill();
            }

            // ---- Outer glow halo (layered circles) ----
            const orb_r = cell_size * 0.32;

            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 50, 0.08)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 50, 0.15)';
            ctx.fill();

            // ---- Main orb with wobble (layered circles) ----
            const wobble = Math.sin(p.elapsed * 12) * 0.12 + 1;
            const rx = orb_r * wobble;
            const ry = orb_r * (2 - wobble) * 0.52 + orb_r * 0.48;
            const mr = Math.max(rx, ry);

            ctx.fillStyle = 'rgba(0, 100, 20, 0.5)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx, ry, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0, 160, 40, 0.8)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.75, ry * 0.75, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(40, 220, 60, 0.9)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.4, ry * 0.4, p.elapsed * 3, 0, Math.PI * 2);
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(220, 255, 220, 0.45)';
            ctx.beginPath();
            ctx.arc(ground_px - orb_r * 0.2, orb_py - orb_r * 0.25, orb_r * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    clear() {
        this.projectiles = [];
        this.pools = [];
        this.last_fire = 0;
    }
}
