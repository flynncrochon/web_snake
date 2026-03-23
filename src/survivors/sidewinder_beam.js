const BEAM_RANGE = 8;
const TICK_INTERVAL = 0.2;       // seconds between damage ticks
const BASE_TICK_DMG = 15;        // damage per tick
const BEAM_DURATION = 2.5;       // seconds the beam stays active
const BASE_COOLDOWN = 5000;      // ms between beam activations

export class SidewinderBeam {
    constructor() {
        this.level = 0;
        this.last_fire = 0;
        this.beams = [];          // active tracking beams
        this.crit_chance = 0;
        this.extra_projectiles = 0;
        this.duration_mult = 1;
        this.range_mult = 1;
        this.gorger_dmg_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_cooldown() {
        return Math.max(2000, BASE_COOLDOWN - (this.level - 1) * 400) * this.fire_cooldown_mult;
    }

    get_tick_damage() {
        return this.level * BASE_TICK_DMG;
    }

    get_range() {
        return (BEAM_RANGE + (this.level - 1) * 0.5) * this.range_mult;
    }

    get_beam_count() {
        return 1 + this.extra_projectiles;
    }

    get_duration() {
        return BEAM_DURATION * this.duration_mult;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();
        const range = this.get_range();
        const range_sq = range * range;

        // --- Spawn new beams on cooldown ---
        if (now - this.last_fire >= this.get_cooldown()) {
            const count = this.get_beam_count();

            // Gather enemies in range, sorted by distance
            const candidates = [];
            enemy_manager.query_radius(hx, hy, range, (e) => {
                const dx = e.x - hx;
                const dy = e.y - hy;
                candidates.push({ enemy: e, dist: dx * dx + dy * dy });
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.dist - b.dist);

                // Filter out enemies already being targeted
                const already_targeted = new Set();
                for (const b of this.beams) {
                    if (b.target) already_targeted.add(b.target);
                }

                for (let i = 0; i < count; i++) {
                    // Prefer un-targeted enemies, fall back to cycling
                    let pick = null;
                    for (const c of candidates) {
                        if (!already_targeted.has(c.enemy)) {
                            pick = c.enemy;
                            already_targeted.add(pick);
                            break;
                        }
                    }
                    if (!pick) pick = candidates[i % candidates.length].enemy;

                    this.beams.push({
                        target: pick,
                        elapsed: 0,
                        duration: this.get_duration(),
                        tick_timer: 0,
                        phase: Math.random() * Math.PI * 2,
                        render_x: pick.x,
                        render_y: pick.y,
                    });
                }

                this.last_fire = now;
            }
        }

        // --- Update active beams ---
        const dmg = Math.round(this.get_tick_damage() * this.gorger_dmg_mult);

        for (const b of this.beams) {
            b.elapsed += dt;

            // If target is dead or out of range, retarget nearest
            if (!b.target || !b.target.alive) {
                b.target = enemy_manager.query_nearest(hx, hy, range);
                if (b.target) {
                    b.render_x = b.target.x;
                    b.render_y = b.target.y;
                }
            }

            if (!b.target) continue;

            // Check range — drop target if too far
            const dx = b.target.x - hx;
            const dy = b.target.y - hy;
            if (dx * dx + dy * dy > range_sq * 1.5) {
                b.target = null;
                continue;
            }

            // Smooth tracking — lerp render position toward actual target
            const lerp_speed = 10;
            const t_lerp = Math.min(1, lerp_speed * dt);
            b.render_x += (b.target.x - b.render_x) * t_lerp;
            b.render_y += (b.target.y - b.render_y) * t_lerp;

            // Damage tick
            b.tick_timer += dt;
            if (b.tick_timer >= TICK_INTERVAL) {
                b.tick_timer -= TICK_INTERVAL;

                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                const final_dmg = is_crit ? dmg * 2 : dmg;
                const dead = b.target.take_damage(final_dmg);

                if (damage_numbers) {
                    damage_numbers.emit(b.target.x, b.target.y - b.target.radius, final_dmg, is_crit);
                }

                // Small sparks at impact
                if (particles) {
                    const sx = b.target.x * cell_size;
                    const sy = b.target.y * cell_size;
                    particles.emit(sx, sy, 2, '#44ddff', 1.5);
                }

                if (dead) {
                    const fx = Math.floor(b.target.x);
                    const fy = Math.floor(b.target.y);
                    if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                        arena.food.push({ x: fx, y: fy });
                        enemy_manager._try_drop_heart(fx, fy);
                    }
                    enemy_manager.total_kills++;
                    if (particles) {
                        particles.emit(b.target.x * cell_size, b.target.y * cell_size, 8, b.target.color, 3);
                    }
                    b.target = null;
                }
            }
        }

        // Remove expired beams
        this.beams = this.beams.filter(b => b.elapsed < b.duration);
    }

    render(ctx, cell_size) {
        const now = performance.now();

        for (const b of this.beams) {
            if (!b.target || !b.target.alive) continue;

            const t = b.elapsed / b.duration;
            // Fade in over first 10%, fade out over last 15%
            let alpha = 1;
            if (t < 0.1) alpha = t / 0.1;
            else if (t > 0.85) alpha = (1 - t) / 0.15;

            const sx = b.target.x * cell_size;  // will be overridden below
            const sy = b.target.y * cell_size;

            // We don't know head position in render, so store it — but we can
            // reconstruct from the beam's target. Actually we need head pos.
            // We'll render from 0,0 relative — the camera transform is already applied.
            // We need to pass head position. Let's use a workaround: store hx/hy each frame.
        }

        // The real render uses stored head position — see render_with_head below.
    }

    render_with_head(ctx, cell_size, hx, hy) {
        const now = performance.now();

        for (const b of this.beams) {
            if (!b.target || !b.target.alive) continue;

            const t = b.elapsed / b.duration;
            // Fade in over first 10%, fade out over last 15%
            let alpha = 1;
            if (t < 0.1) alpha = t / 0.1;
            else if (t > 0.85) alpha = (1 - t) / 0.15;

            const ox = hx * cell_size;
            const oy = hy * cell_size;
            const tx = b.render_x * cell_size;
            const ty = b.render_y * cell_size;

            const beam_len = Math.sqrt((tx - ox) ** 2 + (ty - oy) ** 2);
            if (beam_len < 1) continue;

            const ndx = (tx - ox) / beam_len;
            const ndy = (ty - oy) / beam_len;
            const perp_x = -ndy;
            const perp_y = ndx;

            // --- Sidewinder S-curve from head to target ---
            const segments = Math.max(8, Math.floor(beam_len / (cell_size * 0.35)));
            const wave_amp = cell_size * 0.2 * alpha;
            const wave_freq = 4 + this.level * 0.3;
            const phase = now * 0.008 + b.phase;

            // Build curve points
            const points = [];
            for (let i = 0; i <= segments; i++) {
                const frac = i / segments;
                const bx = ox + (tx - ox) * frac;
                const by = oy + (ty - oy) * frac;
                // Taper wave at endpoints
                const taper = Math.sin(frac * Math.PI);
                const wave = Math.sin(frac * wave_freq * Math.PI + phase) * wave_amp * taper;
                points.push({
                    x: bx + perp_x * wave,
                    y: by + perp_y * wave,
                });
            }

            // --- Outer glow ---
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = alpha * 0.25;
            ctx.strokeStyle = '#2288cc';
            ctx.lineWidth = cell_size * 0.4;
            ctx.shadowColor = 'rgba(68, 221, 255, 0.5)';
            ctx.shadowBlur = cell_size * 0.5;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // --- Main beam ---
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = '#44ddff';
            ctx.lineWidth = cell_size * 0.15;
            ctx.shadowColor = 'rgba(68, 221, 255, 0.6)';
            ctx.shadowBlur = cell_size * 0.3;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // --- Bright core ---
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = alpha * 0.9;
            ctx.strokeStyle = '#ccffff';
            ctx.lineWidth = cell_size * 0.04;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // --- Impact glow on target ---
            const pulse = 0.6 + Math.sin(now * 0.012 + b.phase) * 0.4;
            const glow_r = cell_size * 0.35 * pulse * alpha;
            ctx.save();
            ctx.globalAlpha = alpha * 0.5;
            const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, glow_r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, '#88eeff');
            grad.addColorStop(1, 'rgba(68, 221, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, glow_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // --- Source glow at head ---
            const src_r = cell_size * 0.2 * pulse * alpha;
            ctx.save();
            ctx.globalAlpha = alpha * 0.3;
            const sgrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, src_r);
            sgrad.addColorStop(0, '#ccffff');
            sgrad.addColorStop(1, 'rgba(68, 221, 255, 0)');
            ctx.fillStyle = sgrad;
            ctx.beginPath();
            ctx.arc(ox, oy, src_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    clear() {
        this.beams = [];
        this.last_fire = 0;
    }
}
