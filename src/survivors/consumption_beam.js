import { play_beam_start, play_beam_tick } from '../audio/sound.js';

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
        this._curve_x = new Float64Array(128);
        this._curve_y = new Float64Array(128);
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
                        // Swap-and-pop: O(1) removal instead of O(n) splice
                        arena.food[i] = arena.food[arena.food.length - 1];
                        arena.food.length--;
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
                    play_beam_start();
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
                play_beam_tick();
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
        const TWO_PI = Math.PI * 2;

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

            const pulse = 0.5 + Math.sin(now * 0.015 + b.phase) * 0.5;

            // --- Central tether line (thin, straight) ---
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = 'rgba(255, 100, 68, 0.4)';
            ctx.lineWidth = cell_size * 0.35;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = '#aa3322';
            ctx.lineWidth = cell_size * 0.08;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // --- Double helix spiral strands ---
            const helix_segments = Math.max(20, Math.floor(beam_len / (cell_size * 0.15)));
            const helix_amp = cell_size * 0.3;
            const helix_freq = 4;       // full rotations along the beam
            const helix_phase = now * 0.006 + b.phase;

            for (let strand = 0; strand < 2; strand++) {
                const strand_offset = strand * Math.PI; // 180° apart

                ctx.beginPath();
                for (let i = 0; i <= helix_segments; i++) {
                    const frac = i / helix_segments;
                    const bx = ox + (tx - ox) * frac;
                    const by = oy + (ty - oy) * frac;
                    // Taper amplitude at endpoints
                    const taper = Math.sin(frac * Math.PI);
                    const angle = frac * helix_freq * TWO_PI + helix_phase + strand_offset;
                    const offset = Math.sin(angle) * helix_amp * taper;
                    const px = bx + perp_x * offset;
                    const py = by + perp_y * offset;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }

                // Each strand has slightly different styling
                ctx.globalAlpha = strand === 0 ? 0.6 : 0.45;
                ctx.strokeStyle = strand === 0 ? '#ff6644' : '#ff8844';
                ctx.lineWidth = cell_size * 0.07;
                ctx.stroke();
            }

            // --- Bright core strand (thinner, faster spin) ---
            ctx.beginPath();
            for (let i = 0; i <= helix_segments; i++) {
                const frac = i / helix_segments;
                const bx = ox + (tx - ox) * frac;
                const by = oy + (ty - oy) * frac;
                const taper = Math.sin(frac * Math.PI);
                const angle = frac * helix_freq * TWO_PI + helix_phase * 1.5;
                const offset = Math.sin(angle) * helix_amp * 0.4 * taper;
                const px = bx + perp_x * offset;
                const py = by + perp_y * offset;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = '#ffdd88';
            ctx.lineWidth = cell_size * 0.03;
            ctx.stroke();

            // --- Energy orbs flowing from target to head (siphon effect) ---
            const orb_count = 5;
            const orb_speed = 0.0008; // orbs per ms cycle
            for (let i = 0; i < orb_count; i++) {
                // Each orb at a different phase, flowing target→head
                const orb_frac = 1 - ((now * orb_speed + i / orb_count + b.phase * 0.1) % 1);
                const orb_bx = ox + (tx - ox) * orb_frac;
                const orb_by = oy + (ty - oy) * orb_frac;
                // Orbs spiral along the helix path
                const orb_taper = Math.sin(orb_frac * Math.PI);
                const orb_angle = orb_frac * helix_freq * TWO_PI + helix_phase;
                const orb_offset = Math.sin(orb_angle) * helix_amp * 0.5 * orb_taper;
                const orb_px = orb_bx + perp_x * orb_offset;
                const orb_py = orb_by + perp_y * orb_offset;

                const orb_r = cell_size * (0.08 + 0.04 * orb_taper);
                // Outer glow
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = 'rgba(255, 100, 68, 0.5)';
                ctx.beginPath();
                ctx.arc(orb_px, orb_py, orb_r * 2.5, 0, TWO_PI);
                ctx.fill();
                // Core
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = '#ffcc66';
                ctx.beginPath();
                ctx.arc(orb_px, orb_py, orb_r, 0, TWO_PI);
                ctx.fill();
            }

            // --- Drain vortex on target (spinning ring + spokes) ---
            const vortex_r = cell_size * 0.5 * (0.6 + pulse * 0.4);
            const vortex_rot = now * 0.004 + b.phase;
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = 'rgba(255, 100, 68, 0.5)';
            ctx.lineWidth = cell_size * 0.06;
            ctx.beginPath();
            ctx.arc(tx, ty, vortex_r, 0, TWO_PI);
            ctx.stroke();
            // Inner ring
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = 'rgba(255, 136, 68, 0.6)';
            ctx.lineWidth = cell_size * 0.04;
            ctx.beginPath();
            ctx.arc(tx, ty, vortex_r * 0.5, 0, TWO_PI);
            ctx.stroke();
            // Spinning spokes
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = '#ff8844';
            ctx.lineWidth = cell_size * 0.025;
            for (let s = 0; s < 4; s++) {
                const spoke_a = vortex_rot + s * Math.PI * 0.5;
                ctx.beginPath();
                ctx.moveTo(tx + Math.cos(spoke_a) * vortex_r * 0.15, ty + Math.sin(spoke_a) * vortex_r * 0.15);
                ctx.lineTo(tx + Math.cos(spoke_a) * vortex_r, ty + Math.sin(spoke_a) * vortex_r);
                ctx.stroke();
            }
            // Bright center dot
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#ffeecc';
            ctx.beginPath();
            ctx.arc(tx, ty, cell_size * 0.06, 0, TWO_PI);
            ctx.fill();

            // --- Absorption glow at head (pulsing ring) ---
            const src_r = cell_size * 0.3 * (0.7 + pulse * 0.3);
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = 'rgba(255, 170, 68, 0.4)';
            ctx.lineWidth = cell_size * 0.05;
            ctx.beginPath();
            ctx.arc(ox, oy, src_r, 0, TWO_PI);
            ctx.stroke();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'rgba(255, 204, 68, 0.3)';
            ctx.beginPath();
            ctx.arc(ox, oy, src_r * 0.2, 0, TWO_PI);
            ctx.fill();
        }
    }

    clear() {
        this.beams = [];
        this.pending_xp = 0;
    }
}
