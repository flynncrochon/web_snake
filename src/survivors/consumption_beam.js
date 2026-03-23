const BEAM_RANGE = 10;
const TICK_INTERVAL = 0.1;        // faster ticks than base sidewinder
const TICK_DMG = 80;
const GROWTH_PER_KILL = 3;        // direct growth instead of food drop
const VACUUM_RADIUS = 5;          // collect fruit within this radius on kill

export class ConsumptionBeam {
    constructor() {
        this.active = false;
        this.beams = [];           // always-on tracking beams
        this.extra_projectiles = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.duration_mult = 1;
        this.range_mult = 1;
        this.pending_xp = 0;       // growth granted this frame, main loop collects for XP
    }

    get_beam_count() {
        return 1 + this.extra_projectiles;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const eff_range = BEAM_RANGE * this.range_mult;
        const range_sq = eff_range * eff_range;
        const count = this.get_beam_count();

        // Ensure we always have the right number of beams
        while (this.beams.length < count) {
            this.beams.push({
                target: null,
                tick_timer: 0,
                phase: Math.random() * Math.PI * 2,
                render_x: hx,
                render_y: hy,
            });
        }
        while (this.beams.length > count) {
            this.beams.pop();
        }

        // Collect already-targeted enemies to avoid duplicates
        const targeted = new Set();

        for (const b of this.beams) {
            // Detect tethered target dying from ANY source — vacuum fruit + xp
            if (b.target && !b.target.alive) {
                const kill_x = b.target.x;
                const kill_y = b.target.y;

                // Vacuum nearby fruit
                const vac_radius = VACUUM_RADIUS * this.duration_mult;
                const vr_sq = vac_radius * vac_radius;
                let vacuumed = 0;
                for (let i = arena.food.length - 1; i >= 0; i--) {
                    const f = arena.food[i];
                    const fdx = f.x + 0.5 - kill_x;
                    const fdy = f.y + 0.5 - kill_y;
                    if (fdx * fdx + fdy * fdy <= vr_sq) {
                        arena.food.splice(i, 1);
                        snake.grow_pending++;
                        vacuumed++;
                        if (particles) {
                            particles.emit((f.x + 0.5) * cell_size, (f.y + 0.5) * cell_size, 3, '#ffcc44', 2);
                        }
                    }
                }

                // Direct absorption growth
                snake.grow_pending += GROWTH_PER_KILL;
                this.pending_xp += GROWTH_PER_KILL + vacuumed;

                // Big absorption burst
                if (particles) {
                    const ex = kill_x * cell_size;
                    const ey = kill_y * cell_size;
                    particles.emit(ex, ey, 10, '#ff6644', 4);
                    particles.emit(ex, ey, 6, '#ffaa44', 3);
                    const shx = hx * cell_size;
                    const shy = hy * cell_size;
                    particles.emit(shx, shy, 5, '#ffcc44', 2);
                }

                b.target = null;
            }

            // Retarget if target is gone or out of range
            if (b.target && b.target.alive) {
                const dx = b.target.x - hx;
                const dy = b.target.y - hy;
                if (dx * dx + dy * dy > range_sq * 1.5) {
                    b.target = null;
                }
            }
            if (!b.target || !b.target.alive) {
                b.target = null;
                const best = enemy_manager.query_nearest(hx, hy, eff_range, targeted);
                if (best) {
                    b.target = best;
                    b.tick_timer = 0;
                    b.render_x = best.x;
                    b.render_y = best.y;
                }
            }

            if (b.target) targeted.add(b.target);
            if (!b.target) continue;

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
                const final_dmg = Math.round((is_crit ? TICK_DMG * 2 : TICK_DMG) * this.gorger_dmg_mult);
                b.target.take_damage(final_dmg);

                if (damage_numbers) {
                    damage_numbers.emit(b.target.x, b.target.y - b.target.radius, final_dmg, is_crit);
                }

                // Absorption sparks
                if (particles) {
                    const sx = b.target.x * cell_size;
                    const sy = b.target.y * cell_size;
                    particles.emit(sx, sy, 1, '#ff6644', 1.5);
                    particles.emit(sx, sy, 1, '#ffaa44', 1);
                }
            }
        }
    }

    render_with_head(ctx, cell_size, hx, hy) {
        if (!this.active) return;

        const now = performance.now();

        for (const b of this.beams) {
            if (!b.target || !b.target.alive) continue;

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
            const wave_amp = cell_size * 0.25;
            const wave_freq = 5;
            const phase = now * 0.01 + b.phase;

            // Build curve points
            const points = [];
            for (let i = 0; i <= segments; i++) {
                const frac = i / segments;
                const bx = ox + (tx - ox) * frac;
                const by = oy + (ty - oy) * frac;
                const taper = Math.sin(frac * Math.PI);
                const wave = Math.sin(frac * wave_freq * Math.PI + phase) * wave_amp * taper;
                points.push({
                    x: bx + perp_x * wave,
                    y: by + perp_y * wave,
                });
            }

            // --- Outer glow (red/orange hungry tone) ---
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#aa3322';
            ctx.lineWidth = cell_size * 0.45;
            ctx.shadowColor = 'rgba(255, 100, 68, 0.5)';
            ctx.shadowBlur = cell_size * 0.5;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // --- Main beam (orange-red gradient feel) ---
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#ff6644';
            ctx.lineWidth = cell_size * 0.18;
            ctx.shadowColor = 'rgba(255, 100, 68, 0.6)';
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
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#ffdd88';
            ctx.lineWidth = cell_size * 0.05;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // --- Drain glow on target (pulsing, shrinking feel) ---
            const pulse = 0.5 + Math.sin(now * 0.015 + b.phase) * 0.5;
            const glow_r = cell_size * 0.4 * pulse;
            ctx.save();
            ctx.globalAlpha = 0.5;
            const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, glow_r);
            grad.addColorStop(0, '#ffeecc');
            grad.addColorStop(0.3, '#ff8844');
            grad.addColorStop(1, 'rgba(255, 100, 68, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, glow_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // --- Absorption glow at head (warm pulse) ---
            const src_r = cell_size * 0.25 * (0.7 + pulse * 0.3);
            ctx.save();
            ctx.globalAlpha = 0.35;
            const sgrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, src_r);
            sgrad.addColorStop(0, '#ffcc44');
            sgrad.addColorStop(1, 'rgba(255, 170, 68, 0)');
            ctx.fillStyle = sgrad;
            ctx.beginPath();
            ctx.arc(ox, oy, src_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    clear() {
        this.beams = [];
        this.pending_xp = 0;
    }
}
