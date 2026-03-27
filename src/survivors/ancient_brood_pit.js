import { play_mortar_launch, play_beam_start, play_beam_tick } from '../audio/sound.js';

// --- Pit throwing ---
const PIT_RANGE = 14;
const ANCIENT_COOLDOWN = 6000;
const FLIGHT_DURATION = 0.85;
const ARC_HEIGHT = 7;
const MAX_TRAIL = 20;

// --- Mega Leviathan ---
const LEVIATHAN_RISE_DURATION = 1.5;
const LEVIATHAN_BASE_SCALE = 1.5;       // visual scale at growth 0
const LEVIATHAN_GROWTH_PER_PIT = 0.2;   // scale added per absorbed pit
const LEVIATHAN_MAX_GROWTH = 10;         // max absorbed pits
const SEG_COUNT = 10;                    // spine segments (more than normal cobra)
const ABSORB_FLASH_DURATION = 0.6;
const LEVIATHAN_LEASH_RANGE = 22;       // despawn if player walks this far away

// --- Laser beam ---
const LASER_RANGE = 12;
const LASER_RANGE_PER_GROWTH = 1.0;      // +1 cell range per absorbed pit
const LASER_TICK_INTERVAL = 0.2;         // seconds between damage ticks
const LASER_BASE_DAMAGE = 180;
const LASER_DAMAGE_PER_GROWTH = 45;
const LASER_BASE_HALF_WIDTH = 0.5;       // half-width in cells
const LASER_WIDTH_PER_GROWTH = 0.08;
const LASER_SWEEP_SPEED = 18.0;          // beam tracking speed (snappy)

export class AncientBroodPit {
    constructor() {
        this.active = false;
        this.projectiles = [];
        this.leviathan = null;
        this.beams = [];
        this.last_fire = 0;
        this.duration_mult = 1;
        this.extra_projectiles = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.radius_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
        this._spine_x = new Float64Array(SEG_COUNT + 1);
        this._spine_y = new Float64Array(SEG_COUNT + 1);
        this._head_px = 0;
        this._head_py = 0;
        this._head_valid = false;
    }

    get_laser_damage() {
        const g = this.leviathan ? this.leviathan.growth : 0;
        return Math.round((LASER_BASE_DAMAGE + g * LASER_DAMAGE_PER_GROWTH) * this.gorger_dmg_mult);
    }

    get_laser_half_width() {
        const g = this.leviathan ? this.leviathan.growth : 0;
        return (LASER_BASE_HALF_WIDTH + g * LASER_WIDTH_PER_GROWTH) * this.radius_mult;
    }

    get_laser_range() {
        const g = this.leviathan ? this.leviathan.growth : 0;
        return (LASER_RANGE + g * LASER_RANGE_PER_GROWTH) * this.range_mult;
    }
    get_beam_count() { return 1 + this.extra_projectiles; }

    get_scale() {
        if (!this.leviathan) return LEVIATHAN_BASE_SCALE;
        return LEVIATHAN_BASE_SCALE + this.leviathan.growth * LEVIATHAN_GROWTH_PER_PIT;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;
        const head = snake.head;
        const hx = head.x + 0.5, hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire pit on cooldown ---
        if (now - this.last_fire >= ANCIENT_COOLDOWN * this.fire_cooldown_mult) {
            let tx, ty;

            if (this.leviathan) {
                // Throw at the leviathan to grow it
                tx = this.leviathan.x;
                ty = this.leviathan.y;
            } else {
                // First throw — target densest enemy cluster
                let best = null, best_score = -1;
                const cands = enemy_manager.query_radius_array(hx, hy, PIT_RANGE * this.range_mult);
                const sample = cands.length <= 8 ? cands : cands.slice(0, 8);
                for (const e of sample) {
                    const score = 1 + enemy_manager.query_count(e.x, e.y, 4, e);
                    if (score > best_score) { best_score = score; best = e; }
                }
                if (best) { tx = best.x; ty = best.y; }
                else { tx = hx + snake.direction.dx * 6; ty = hy + snake.direction.dy * 6; }
            }

            play_mortar_launch();
            this.projectiles.push({
                start_x: hx, start_y: hy, target_x: tx, target_y: ty,
                elapsed: 0, duration: FLIGHT_DURATION, trail: [], sparks: [],
            });
            for (let ei = 0; ei < this.extra_projectiles; ei++) {
                const a = (ei / this.extra_projectiles) * Math.PI * 2 + Math.random() * 0.5;
                const off = this.leviathan ? 0.5 : 3.5;
                this.projectiles.push({
                    start_x: hx, start_y: hy,
                    target_x: tx + Math.cos(a) * off,
                    target_y: ty + Math.sin(a) * off,
                    elapsed: 0, duration: FLIGHT_DURATION + ei * 0.1, trail: [], sparks: [],
                });
            }
            this.last_fire = now;
        }

        // --- Projectiles ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.elapsed += dt;
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const h = ARC_HEIGHT * 4 * t * (1 - t);
            p.trail.push({ x: gx, y: gy - h });
            if (p.trail.length > MAX_TRAIL) p.trail.shift();
            if (Math.random() < dt * 6 && h > 0.5 && p.sparks.length < 8) {
                p.sparks.push({
                    x: gx + (Math.random() - 0.5) * 0.25,
                    y: gy - h + (Math.random() - 0.5) * 0.25,
                    vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
                    life: 0.35 + Math.random() * 0.15, size: 0.02 + Math.random() * 0.03,
                });
            }
            for (let j = p.sparks.length - 1; j >= 0; j--) {
                const s = p.sparks[j]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
                if (s.life <= 0) { p.sparks[j] = p.sparks[p.sparks.length - 1]; p.sparks.length--; }
            }
            if (t >= 1) {
                if (this.leviathan) {
                    // Absorb into leviathan — grow it
                    this.leviathan.growth = Math.min(LEVIATHAN_MAX_GROWTH, this.leviathan.growth + 1);
                    this.leviathan.absorb_flash = ABSORB_FLASH_DURATION;
                    if (particles) {
                        const px = this.leviathan.x * cell_size, py = this.leviathan.y * cell_size;
                        particles.emit(px, py, 20, '#ffcc44', 6);
                        particles.emit(px, py, 10, '#ff8800', 4);
                    }
                } else {
                    // Spawn the Mega Leviathan
                    this.leviathan = {
                        x: p.target_x, y: p.target_y, growth: 0,
                        elapsed: 0, sway_offset: Math.random() * Math.PI * 2,
                        absorb_flash: 0, mouth_open: 0,
                    };
                    this.beams = [];
                    if (particles) {
                        const px = p.target_x * cell_size, py = p.target_y * cell_size;
                        particles.emit(px, py, 25, '#cc8822', 8);
                        particles.emit(px, py, 12, '#ffaa33', 5);
                    }
                    play_beam_start();
                }
                this.projectiles.splice(i, 1);
            }
        }

        // --- Leviathan laser ---
        if (!this.leviathan) return;
        const lev = this.leviathan;
        lev.elapsed += dt;
        if (lev.absorb_flash > 0) lev.absorb_flash -= dt;

        // Despawn if player pathed too far away — next pit throw spawns a fresh one
        const ldx = lev.x - hx, ldy = lev.y - hy;
        if (ldx * ldx + ldy * ldy > LEVIATHAN_LEASH_RANGE * LEVIATHAN_LEASH_RANGE) {
            if (particles) {
                const px = lev.x * cell_size, py = lev.y * cell_size;
                particles.emit(px, py, 12, '#cc8822', 4);
            }
            this.leviathan = null;
            this.beams = [];
            return;
        }

        if (lev.elapsed < LEVIATHAN_RISE_DURATION) return;

        const range = this.get_laser_range();
        const half_w = this.get_laser_half_width();
        const dmg = this.get_laser_damage();
        const beam_count = this.get_beam_count();
        const tick_iv = LASER_TICK_INTERVAL / Math.max(0.5, this.duration_mult);

        // Remove dead/out-of-range targets
        for (const b of this.beams) {
            if (b.target && !b.target.alive) b.target = null;
            if (b.target) {
                const dx = b.target.x - lev.x, dy = b.target.y - lev.y;
                if (dx * dx + dy * dy > range * range * 1.5) b.target = null;
            }
        }

        // Build targeted set and retarget beams without targets
        const targeted = new Set();
        for (const b of this.beams) { if (b.target) targeted.add(b.target); }

        const _find_untargeted = () => {
            let best = null, bd = Infinity;
            enemy_manager.query_radius(lev.x, lev.y, range, (e) => {
                if (targeted.has(e)) return;
                const dx = e.x - lev.x, dy = e.y - lev.y;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = e; }
            });
            return best;
        };

        for (const b of this.beams) {
            if (!b.target) {
                const t = _find_untargeted();
                if (t) { b.target = t; targeted.add(t); b.render_tx = t.x; b.render_ty = t.y; }
            }
        }

        // Ensure correct beam count
        while (this.beams.length < beam_count) {
            const t = _find_untargeted();
            const b = {
                target: t, tick_timer: 0, phase: Math.random() * Math.PI * 2,
                render_tx: t ? t.x : lev.x, render_ty: t ? t.y : lev.y - 3,
            };
            if (t) targeted.add(t);
            this.beams.push(b);
        }
        while (this.beams.length > beam_count) this.beams.pop();

        // Update each beam
        for (const b of this.beams) {
            if (!b.target) continue;

            // Snap render position to actual target (tight tracking)
            const lerp = Math.min(1, LASER_SWEEP_SPEED * dt);
            b.render_tx += (b.target.x - b.render_tx) * lerp;
            b.render_ty += (b.target.y - b.render_ty) * lerp;

            // Damage tick — use actual target position for beam direction (precise)
            b.tick_timer += dt;
            if (b.tick_timer >= tick_iv) {
                b.tick_timer -= tick_iv;

                const bx = lev.x, by = lev.y;
                const tdx = b.target.x - bx, tdy = b.target.y - by;
                const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
                if (tlen < 0.1) continue;

                // Beam extends from leviathan to full range
                const ndx = tdx / tlen, ndy = tdy / tlen;
                const end_x = bx + ndx * range, end_y = by + ndy * range;
                const mid_x = (bx + end_x) * 0.5, mid_y = (by + end_y) * 0.5;

                play_beam_tick();
                // Query enemies near the beam line, then line-segment distance check
                enemy_manager.query_radius(mid_x, mid_y, range * 0.5 + half_w + 1, (e) => {
                    const ex = e.x - bx, ey = e.y - by;
                    const lx = end_x - bx, ly = end_y - by;
                    const len_sq = lx * lx + ly * ly;
                    // Project enemy onto beam line
                    let t = (ex * lx + ey * ly) / len_sq;
                    t = Math.max(0, Math.min(1, t));
                    const px = lx * t, py = ly * t;
                    const dsq = (ex - px) * (ex - px) + (ey - py) * (ey - py);
                    const hr = half_w + e.radius;

                    if (dsq < hr * hr) {
                        const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                        const fd = Math.round(dmg * (is_crit ? 2 : 1));
                        const dead = e.take_damage(fd);
                        if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, fd, is_crit);
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 2, '#ffcc44', 1.5);
                            if (is_crit) particles.emit(e.x * cell_size, e.y * cell_size, 3, '#ffff88', 2);
                        }
                        if (dead) {
                            const fx = Math.floor(e.x), fy = Math.floor(e.y);
                            if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                                arena.food.push({ x: fx, y: fy });
                                enemy_manager._try_drop_heart(fx, fy);
                            }
                            enemy_manager.total_kills++;
                            if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 6, e.color, 3);
                        }
                    }
                });
            }
        }

        // Animate mouth — open when any beam has a live target
        const has_target = this.beams.some(b => b.target && b.target.alive);
        if (has_target) {
            lev.mouth_open = Math.min(1, lev.mouth_open + dt * 6); // snap open
        } else {
            lev.mouth_open = Math.max(0, lev.mouth_open - dt * 3); // ease closed
        }
    }

    // ========== RENDERING (optimized — no gradients, no shadowBlur) ==========

    render_pits(ctx, cell_size) {
        // Ground pit under the leviathan
        if (!this.leviathan) return;
        const lev = this.leviathan;
        const scale = this.get_scale();
        const px = lev.x * cell_size, py = lev.y * cell_size;
        const rise_t = Math.min(lev.elapsed / LEVIATHAN_RISE_DURATION, 1);
        const r = cell_size * 1.2 * scale;

        // Absorb flash ring
        if (lev.absorb_flash > 0) {
            const af = lev.absorb_flash / ABSORB_FLASH_DURATION;
            ctx.strokeStyle = `rgba(255,200,60,${(af * 0.7).toFixed(2)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, r * (1 + (1 - af) * 0.5), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Pit layers
        ctx.fillStyle = `rgba(120,80,25,${(0.15 * rise_t).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(px, py, r * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(80,55,20,${(0.35 * rise_t).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(px, py, r * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(40,28,10,${(0.6 * rise_t).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(px, py, r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(15,10,3,${(0.85 * rise_t).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(px, py, r * 0.25, 0, Math.PI * 2); ctx.fill();

        // Cracks
        ctx.strokeStyle = `rgba(200,140,40,${(0.35 * rise_t).toFixed(2)})`;
        ctx.lineWidth = 1.5 + scale * 0.3;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ca = i * 0.785 + lev.elapsed * 0.15;
            const len = r * (0.6 + Math.sin(ca * 3 + lev.elapsed) * 0.2);
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(ca) * len, py + Math.sin(ca) * len);
        }
        ctx.stroke();

        // Rune ring
        const rune_count = 6 + Math.floor(scale * 2);
        ctx.fillStyle = `rgba(255,200,80,${(0.35 * rise_t).toFixed(2)})`;
        const rune_r = r * 0.9;
        for (let i = 0; i < rune_count; i++) {
            const ra = (i / rune_count) * Math.PI * 2 + lev.elapsed * 0.2;
            ctx.beginPath();
            ctx.arc(px + Math.cos(ra) * rune_r, py + Math.sin(ra) * rune_r, cell_size * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    render_cobras(ctx, cell_size) {
        // Render the Mega Leviathan (method name kept for API compat)
        this._head_valid = false;
        if (!this.leviathan) return;
        const lev = this.leviathan;
        const rise_t = Math.min(lev.elapsed / LEVIATHAN_RISE_DURATION, 1);
        if (rise_t <= 0) return;

        const scale = this.get_scale();
        const bx = lev.x * cell_size, by = lev.y * cell_size;
        const height_frac = 1 - (1 - rise_t) * (1 - rise_t);
        const total_h = cell_size * 2.5 * scale * height_frac;
        const sway_px = Math.sin(lev.elapsed * 1.5 + lev.sway_offset) * cell_size * 0.2 * scale;
        const absorb_glow = lev.absorb_flash > 0 ? lev.absorb_flash / ABSORB_FLASH_DURATION : 0;

        ctx.globalAlpha = Math.min(1, rise_t);

        // Ground hole
        ctx.fillStyle = '#1e1405';
        ctx.beginPath();
        ctx.ellipse(bx, by, cell_size * 0.4 * scale, cell_size * 0.15 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Build spine
        const sx = this._spine_x, sy = this._spine_y;
        const inv_seg = 1 / SEG_COUNT;
        for (let i = 0; i <= SEG_COUNT; i++) {
            const t = i * inv_seg;
            const cd = 1 - t * t;
            sx[i] = bx + Math.sin(t * 4.712 + lev.sway_offset * 0.5) * cell_size * 0.35 * scale * height_frac * cd
                   + sway_px * Math.sin(t * Math.PI);
            sy[i] = by - t * total_h;
        }

        const body_w = cell_size * 0.18 * scale;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        // Outline
        ctx.strokeStyle = absorb_glow > 0
            ? `rgba(255,180,40,${(0.5 + absorb_glow * 0.5).toFixed(2)})` : '#6b4400';
        ctx.lineWidth = body_w * 2 + 3;
        ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
        for (let i = 1; i <= SEG_COUNT; i++) ctx.lineTo(sx[i], sy[i]);
        ctx.stroke();

        // Body
        ctx.strokeStyle = absorb_glow > 0
            ? `rgba(255,220,80,${(0.7 + absorb_glow * 0.3).toFixed(2)})` : '#cc8822';
        ctx.lineWidth = body_w * 2;
        ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
        for (let i = 1; i <= SEG_COUNT; i++) ctx.lineTo(sx[i], sy[i]);
        ctx.stroke();

        // Body pattern (diamond marks at larger sizes)
        if (scale > 1.8) {
            ctx.fillStyle = 'rgba(180,120,30,0.3)';
            for (let i = 2; i < SEG_COUNT; i += 2) {
                const mx = (sx[i] + sx[i - 1]) * 0.5;
                const my = (sy[i] + sy[i - 1]) * 0.5;
                const ds = body_w * 0.35;
                ctx.beginPath();
                ctx.moveTo(mx, my - ds); ctx.lineTo(mx + ds, my);
                ctx.lineTo(mx, my + ds); ctx.lineTo(mx - ds, my);
                ctx.closePath(); ctx.fill();
            }
        }

        // Head — hooded cobra with opening mouth
        const hx_pos = sx[SEG_COUNT], hy_pos = sy[SEG_COUNT];
        const head_len = cell_size * 0.35 * scale;
        const head_w = cell_size * 0.3 * scale;
        const hood_w = head_w * 1.6;
        const mo = lev.mouth_open; // 0 = closed, 1 = fully open
        const jaw_gap = head_len * 0.55 * mo; // how far jaws separate

        // --- Mouth interior (dark cavity + energy glow, drawn first behind jaws) ---
        if (mo > 0.05) {
            const mouth_cx = hx_pos;
            const mouth_cy = hy_pos - head_len * 0.3;
            const mouth_w = head_w * 0.6 * mo;
            const mouth_h = jaw_gap * 0.8;

            // Dark throat
            ctx.fillStyle = `rgba(15,5,0,${(0.9 * mo).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(mouth_cx, mouth_cy, mouth_w, mouth_h, 0, 0, Math.PI * 2);
            ctx.fill();

            // Energy glow building inside mouth
            const pulse = 0.7 + Math.sin(lev.elapsed * 12) * 0.3;
            const glow_a = mo * 0.6 * pulse;
            ctx.fillStyle = `rgba(255,180,40,${(glow_a * 0.3).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(mouth_cx, mouth_cy, mouth_w * 1.4, mouth_h * 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,220,80,${(glow_a * 0.6).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(mouth_cx, mouth_cy, mouth_w * 0.7, mouth_h * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,250,200,${(glow_a * 0.8).toFixed(2)})`;
            ctx.beginPath();
            ctx.ellipse(mouth_cx, mouth_cy, mouth_w * 0.25, mouth_h * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Upper jaw (snout — tilts upward when mouth opens) ---
        const upper_shift = -jaw_gap * 0.7; // moves up
        ctx.fillStyle = absorb_glow > 0 ? '#ffcc44' : '#dd9922';
        ctx.beginPath();
        ctx.moveTo(hx_pos, hy_pos - head_len + upper_shift);           // snout tip
        ctx.lineTo(hx_pos + hood_w, hy_pos + head_len * 0.2);          // right hood (stays)
        ctx.lineTo(hx_pos + head_w * 0.5, hy_pos - head_len * 0.05);   // right mouth edge
        ctx.lineTo(hx_pos - head_w * 0.5, hy_pos - head_len * 0.05);   // left mouth edge
        ctx.lineTo(hx_pos - hood_w, hy_pos + head_len * 0.2);          // left hood (stays)
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6b4400'; ctx.lineWidth = 1.5; ctx.stroke();

        // --- Lower jaw (chin — drops down when mouth opens) ---
        const lower_shift = jaw_gap * 0.3; // moves down
        ctx.fillStyle = absorb_glow > 0 ? '#eebb33' : '#c07718';
        ctx.beginPath();
        ctx.moveTo(hx_pos + head_w * 0.5, hy_pos - head_len * 0.05);   // right mouth edge
        ctx.lineTo(hx_pos + head_w * 0.8, hy_pos + head_len * 0.5 + lower_shift);
        ctx.lineTo(hx_pos, hy_pos + head_len * 0.3 + lower_shift);     // chin tip
        ctx.lineTo(hx_pos - head_w * 0.8, hy_pos + head_len * 0.5 + lower_shift);
        ctx.lineTo(hx_pos - head_w * 0.5, hy_pos - head_len * 0.05);   // left mouth edge
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6b4400'; ctx.lineWidth = 1; ctx.stroke();

        // --- Fangs (visible when mouth opens) ---
        if (mo > 0.15) {
            const fang_a = Math.min(1, (mo - 0.15) / 0.3);
            const fang_len = head_len * 0.35 * fang_a;
            const fang_w = head_w * 0.08;
            const fang_y = hy_pos - head_len * 0.05;
            ctx.fillStyle = `rgba(255,240,220,${(0.9 * fang_a).toFixed(2)})`;
            // Left fang
            ctx.beginPath();
            ctx.moveTo(hx_pos - head_w * 0.3, fang_y);
            ctx.lineTo(hx_pos - head_w * 0.3 - fang_w, fang_y + fang_len);
            ctx.lineTo(hx_pos - head_w * 0.3 + fang_w, fang_y + fang_len * 0.7);
            ctx.closePath(); ctx.fill();
            // Right fang
            ctx.beginPath();
            ctx.moveTo(hx_pos + head_w * 0.3, fang_y);
            ctx.lineTo(hx_pos + head_w * 0.3 + fang_w, fang_y + fang_len);
            ctx.lineTo(hx_pos + head_w * 0.3 - fang_w, fang_y + fang_len * 0.7);
            ctx.closePath(); ctx.fill();
        }

        // Eyes — large, glowing (on upper jaw, shift with it)
        const eye_s = head_w * 0.6;
        const eye_y = hy_pos - head_len * 0.1 + upper_shift * 0.3;
        const eye_r = cell_size * 0.08 * scale;

        // Eye glow intensifies when mouth is open
        const eye_glow = 0.3 + mo * 0.4;
        ctx.fillStyle = `rgba(255,150,0,${eye_glow.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(hx_pos - eye_s, eye_y, eye_r * 2.5, 0, Math.PI * 2);
        ctx.arc(hx_pos + eye_s, eye_y, eye_r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(hx_pos - eye_s, eye_y, eye_r, 0, Math.PI * 2);
        ctx.arc(hx_pos + eye_s, eye_y, eye_r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#220000';
        ctx.beginPath();
        ctx.ellipse(hx_pos - eye_s, eye_y, eye_r * 0.3, eye_r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx_pos + eye_s, eye_y, eye_r * 0.3, eye_r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Growth indicators — orbiting amber diamonds
        if (lev.growth > 0) {
            ctx.fillStyle = 'rgba(255,200,60,0.6)';
            const ind_y = by - total_h * 0.15;
            for (let i = 0; i < Math.min(lev.growth, 10); i++) {
                const ia = (i / 10) * Math.PI * 2 + lev.elapsed * 0.3;
                const ir = cell_size * 0.6 * scale;
                const ix = bx + Math.cos(ia) * ir;
                const iy = ind_y + Math.sin(ia) * ir * 0.3;
                const ds = cell_size * 0.04;
                ctx.fillRect(ix - ds, iy - ds, ds * 2, ds * 2);
            }
        }

        ctx.globalAlpha = 1;

        // Store mouth center as laser beam origin (beam comes from inside the mouth)
        this._head_px = hx_pos;
        this._head_py = hy_pos - head_len * 0.3 + upper_shift * 0.5;
        this._head_valid = true;
    }

    render_spits(ctx, cell_size) {
        // Render laser beams (method name kept for API compat)
        if (!this.leviathan || !this._head_valid) return;
        if (this.leviathan.elapsed < LEVIATHAN_RISE_DURATION) return;

        const now = performance.now();
        const range_px = this.get_laser_range() * cell_size;
        const half_w_px = this.get_laser_half_width() * cell_size;
        const ox = this._head_px, oy = this._head_py;

        for (const b of this.beams) {
            if (!b.target || !b.target.alive) continue;

            // Use actual target position for beam direction (precise aiming at enemy head)
            const tx = b.target.x * cell_size, ty = b.target.y * cell_size;
            const dx = tx - ox, dy = ty - oy;
            const beam_len = Math.sqrt(dx * dx + dy * dy);
            if (beam_len < 1) continue;

            // Extend beam to full range past the target
            const ndx = dx / beam_len, ndy = dy / beam_len;
            const ex = ox + ndx * range_px;
            const ey = oy + ndy * range_px;

            const shimmer = 0.85 + Math.sin(now * 0.015 + b.phase) * 0.15;

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Outer glow
            ctx.globalAlpha = 0.08 * shimmer;
            ctx.strokeStyle = '#cc8822';
            ctx.lineWidth = half_w_px * 5;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();

            // Mid glow
            ctx.globalAlpha = 0.15 * shimmer;
            ctx.strokeStyle = '#ffaa33';
            ctx.lineWidth = half_w_px * 3;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();

            // Main beam
            ctx.globalAlpha = 0.6 * shimmer;
            ctx.strokeStyle = '#ffcc44';
            ctx.lineWidth = half_w_px * 2;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();

            // Bright core
            ctx.globalAlpha = 0.85 * shimmer;
            ctx.strokeStyle = '#fff8e0';
            ctx.lineWidth = Math.max(1, half_w_px * 0.5);
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();

            // Impact glow at primary target
            const pulse = 0.6 + Math.sin(now * 0.012 + b.phase) * 0.4;
            const glow_r = half_w_px * 2 * pulse;
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = 'rgba(255,200,60,0.15)';
            ctx.beginPath(); ctx.arc(tx, ty, glow_r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,100,0.3)';
            ctx.beginPath(); ctx.arc(tx, ty, glow_r * 0.4, 0, Math.PI * 2); ctx.fill();

            // Source glow at head
            const src_r = half_w_px * 1.5 * pulse;
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = 'rgba(255,200,60,0.2)';
            ctx.beginPath(); ctx.arc(ox, oy, src_r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    render_projectiles(ctx, cell_size) {
        // Arcing pit projectiles — same visual as before
        ctx.lineCap = 'round';
        const proj_bands = [
            { frac: 0.3, a: 0.036, w_mult: 0.054 },
            { frac: 0.6, a: 0.144, w_mult: 0.108 },
            { frac: 0.9, a: 0.324, w_mult: 0.162 },
        ];
        for (const band of proj_bands) {
            ctx.strokeStyle = `rgba(200,140,40,${band.a.toFixed(3)})`;
            ctx.lineWidth = Math.max(0.5, band.w_mult * cell_size);
            ctx.beginPath();
            for (const p of this.projectiles) {
                if (p.trail.length < 2) continue;
                const tlen = p.trail.length - 1;
                const lo = Math.max(1, Math.floor(band.frac * tlen * 0.4));
                const hi = Math.min(tlen + 1, Math.ceil(band.frac * tlen * 1.4));
                for (let i = lo; i < hi; i++) {
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                }
            }
            ctx.stroke();
        }

        for (const p of this.projectiles) {
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const h = ARC_HEIGHT * 4 * t * (1 - t);
            const gpx = gx * cell_size, gpy = gy * cell_size, opy = (gy - h) * cell_size;

            ctx.fillStyle = `rgba(120,80,20,${(0.1 + (1 - h / ARC_HEIGHT) * 0.15).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(gpx, gpy, cell_size * 0.4, 0, Math.PI * 2); ctx.fill();

            for (const sp of p.sparks) {
                ctx.fillStyle = `rgba(255,180,50,${(Math.max(0, sp.life / 0.6) * 0.6).toFixed(2)})`;
                const sr = sp.size * cell_size;
                ctx.fillRect(sp.x * cell_size - sr, sp.y * cell_size - sr, sr * 2, sr * 2);
            }

            const orb_r = cell_size * 0.3;
            ctx.fillStyle = 'rgba(220,160,40,0.2)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r * 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(220,160,60,0.8)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,230,160,0.5)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r * 0.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    clear() {
        this.projectiles = [];
        this.leviathan = null;
        this.beams = [];
        this.last_fire = 0;
    }
}
