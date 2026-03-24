import { play_mortar_launch, play_summon_hit } from '../audio/sound.js';

const PIT_RANGE = 12;
const PIT_RANGE_SQ = PIT_RANGE * PIT_RANGE;
const BASE_PIT_COOLDOWN = 8000;
const PIT_FLIGHT_DURATION = 0.75;
const PIT_ARC_HEIGHT = 6;
const MAX_PIT_TRAIL = 20;

// Pit properties
const PIT_DURATION = 6.0;
const COBRA_SPAWN_INTERVAL = 0.55;
const MAX_COBRAS_PER_PIT = 6;
const MAX_TOTAL_COBRAS = 30; // global cap — excess spawns become damage buffs

// Cobra properties
const COBRA_LIFETIME = 5.0;
const COBRA_SPIT_COOLDOWN = 1.2;
const COBRA_SPIT_RANGE_SQ = 36; // 6^2
const COBRA_SPIT_SPEED = 12;
const COBRA_SPIT_LIFETIME = 1.0;
const COBRA_RISE_DURATION = 0.4;
const MAX_DRIPS = 3;
const MAX_SPIT_TRAIL = 6;
const SEG_COUNT = 6;

export class CobraPit {
    constructor() {
        this.projectiles = [];
        this.pits = [];
        this.cobras = [];
        this.spits = [];
        this.last_fire = 0;
        this.level = 0;
        this.duration_mult = 1;
        this.extra_projectiles = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.radius_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
        this._overflow_dmg_mult = 1; // bonus damage from cobras that couldn't spawn
        // Reusable spine arrays — avoids allocation per cobra per frame
        this._spine_x = new Float64Array(SEG_COUNT + 1);
        this._spine_y = new Float64Array(SEG_COUNT + 1);
    }

    get_cooldown() {
        return Math.max(3500, BASE_PIT_COOLDOWN - (this.level - 1) * 550) * this.fire_cooldown_mult;
    }

    get_spit_damage() {
        return (1 + Math.floor(this.level / 2)) * 60 * this.gorger_dmg_mult * this._overflow_dmg_mult;
    }

    get_max_cobras() {
        return MAX_COBRAS_PER_PIT + Math.floor((this.level - 1) / 3);
    }

    get_pit_duration() {
        return PIT_DURATION * this.duration_mult;
    }

    get_cobra_lifetime() {
        return COBRA_LIFETIME * this.duration_mult;
    }

    get_spit_cooldown() {
        return Math.max(0.5, COBRA_SPIT_COOLDOWN - (this.level - 1) * 0.08);
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();
        // --- Fire pit at densest cluster (capped sample) ---
        if (now - this.last_fire >= this.get_cooldown()) {
            let best = null;
            let best_score = -1;
            const pit_range = PIT_RANGE * this.range_mult;
            const pit_candidates = enemy_manager.query_radius_array(hx, hy, pit_range);
            const sample = pit_candidates.length <= 8 ? pit_candidates : pit_candidates.slice(0, 8);
            for (const e of sample) {
                const score = 1 + enemy_manager.query_count(e.x, e.y, 4, e);
                if (score > best_score) { best_score = score; best = e; }
            }

            if (best) {
                this.projectiles.push({
                    start_x: hx, start_y: hy,
                    target_x: best.x, target_y: best.y,
                    elapsed: 0, duration: PIT_FLIGHT_DURATION,
                    trail: [], sparks: [],
                });
                for (let ei = 0; ei < this.extra_projectiles; ei++) {
                    const angle = (ei / this.extra_projectiles) * Math.PI * 2 + Math.random() * 0.5;
                    this.projectiles.push({
                        start_x: hx, start_y: hy,
                        target_x: best.x + Math.cos(angle) * 3,
                        target_y: best.y + Math.sin(angle) * 3,
                        elapsed: 0, duration: PIT_FLIGHT_DURATION + ei * 0.1,
                        trail: [], sparks: [],
                    });
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
            const height = PIT_ARC_HEIGHT * 4 * t * (1 - t);

            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_PIT_TRAIL) p.trail.shift();

            if (Math.random() < dt * 6 && height > 0.5 && p.sparks.length < 8) {
                p.sparks.push({
                    x: gx + (Math.random() - 0.5) * 0.25,
                    y: gy - height + (Math.random() - 0.5) * 0.25,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    life: 0.35 + Math.random() * 0.15,
                    size: 0.02 + Math.random() * 0.03,
                });
            }

            for (let j = p.sparks.length - 1; j >= 0; j--) {
                const s = p.sparks[j];
                s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
                if (s.life <= 0) {
                    p.sparks[j] = p.sparks[p.sparks.length - 1];
                    p.sparks.length--;
                }
            }

            if (t >= 1) {
                this.pits.push({
                    x: p.target_x, y: p.target_y,
                    elapsed: 0, cobras_spawned: 0,
                    next_cobra_time: 0.2, ring_alpha: 1.0, ring_radius: 0,
                });
                if (particles) {
                    const px = p.target_x * cell_size, py = p.target_y * cell_size;
                    particles.emit(px, py, 12, '#886622', 4);
                    particles.emit(px, py, 6, '#44aa44', 3);
                }
                this.projectiles.splice(i, 1);
            }
        }

        // --- Update pits ---
        const pit_dur = this.get_pit_duration();
        const max_cobras = this.get_max_cobras();
        for (let i = this.pits.length - 1; i >= 0; i--) {
            const pit = this.pits[i];
            pit.elapsed += dt;
            pit.ring_radius += dt * 4;
            pit.ring_alpha = Math.max(0, 1 - pit.elapsed);
            if (pit.cobras_spawned < max_cobras && pit.elapsed >= pit.next_cobra_time) {
                const alive_count = this.cobras.reduce((n, c) => n + (c.alive ? 1 : 0), 0);
                if (alive_count < MAX_TOTAL_COBRAS) {
                    const angle = (pit.cobras_spawned / max_cobras) * Math.PI * 2 + Math.random() * 0.3;
                    const dist = 0.8 + Math.random() * 0.5;
                    this.cobras.push({
                        x: pit.x + Math.cos(angle) * dist,
                        y: pit.y + Math.sin(angle) * dist,
                        alive: true, life: this.get_cobra_lifetime(),
                        elapsed: 0, last_spit: 0,
                        sway_offset: Math.random() * Math.PI * 2,
                    });
                    if (particles) {
                        particles.emit((pit.x + Math.cos(angle) * dist) * cell_size,
                            (pit.y + Math.sin(angle) * dist) * cell_size, 6, '#886622', 2);
                    }
                } else {
                    // Cap reached — boost all existing cobras' damage instead
                    this._overflow_dmg_mult += 0.15;
                }
                pit.cobras_spawned++;
                pit.next_cobra_time = pit.elapsed + COBRA_SPAWN_INTERVAL;
            }
            if (pit.elapsed >= pit_dur) this.pits.splice(i, 1);
        }

        // --- Update cobras ---
        const spit_cd = this.get_spit_cooldown();
        const spit_dmg = this.get_spit_damage();
        for (let i = this.cobras.length - 1; i >= 0; i--) {
            const c = this.cobras[i];
            if (!c.alive) continue;
            c.elapsed += dt;
            if (c.elapsed >= c.life) {
                if (particles) particles.emit(c.x * cell_size, c.y * cell_size, 4, '#886622', 2);
                c.alive = false; continue;
            }
            if (c.elapsed < COBRA_RISE_DURATION || c.elapsed - c.last_spit < spit_cd) continue;

            const nearest = enemy_manager.query_nearest(c.x, c.y, 6);
            if (nearest) {
                const dx = nearest.x - c.x, dy = nearest.y - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const is_crit = Math.random() < this.crit_chance;
                this.spits.push({
                    x: c.x, y: c.y - 0.5,
                    vx: (dx / dist) * COBRA_SPIT_SPEED, vy: (dy / dist) * COBRA_SPIT_SPEED,
                    life: COBRA_SPIT_LIFETIME * this.duration_mult,
                    max_life: COBRA_SPIT_LIFETIME * this.duration_mult,
                    damage: is_crit ? spit_dmg * 2 : spit_dmg,
                    is_crit, trail: [], drips: [], wobble_phase: Math.random() * 6.28,
                });
                c.last_spit = c.elapsed;
                if (particles) particles.emit(c.x * cell_size, (c.y - 0.5) * cell_size, 3, '#88ee22', 2);
            }
        }
        // Compact dead cobras
        { let w = 0; for (let r = 0; r < this.cobras.length; r++) { if (this.cobras[r].alive) this.cobras[w++] = this.cobras[r]; } this.cobras.length = w; }

        // --- Update spits ---
        for (let i = this.spits.length - 1; i >= 0; i--) {
            const s = this.spits[i];
            s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            s.trail.push({ x: s.x, y: s.y });
            if (s.trail.length > MAX_SPIT_TRAIL) s.trail.shift();
            if (s.drips.length < MAX_DRIPS && Math.random() < dt * 12) {
                s.drips.push({ x: s.x, y: s.y, vy: 1 + Math.random() * 1.5, life: 0.3 + Math.random() * 0.3, size: 0.03 + Math.random() * 0.03 });
            }
            for (let j = s.drips.length - 1; j >= 0; j--) {
                const d = s.drips[j]; d.y += d.vy * dt; d.vy += 6 * dt; d.life -= dt;
                if (d.life <= 0) s.drips.splice(j, 1);
            }
            if (s.life <= 0) { this.spits.splice(i, 1); continue; }

            let spit_hit = false;
            enemy_manager.query_radius(s.x, s.y, 0.95, (e) => {
                if (spit_hit) return;
                const dx = e.x - s.x, dy = e.y - s.y, dsq = dx * dx + dy * dy;
                const hr = e.radius + 0.4;
                if (dsq < hr * hr) {
                    spit_hit = true;
                    const dead = e.take_damage(s.damage);
                    play_summon_hit();
                    if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, s.damage, s.is_crit);
                    if (particles) {
                        const px = e.x * cell_size, py = e.y * cell_size;
                        particles.emit(px, py, 6, '#88ee22', 3);
                        if (s.is_crit) particles.emit(px, py, 4, '#ffff44', 2);
                    }
                    if (dead) {
                        const fx = Math.floor(e.x), fy = Math.floor(e.y);
                        if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                            arena.food.push({ x: fx, y: fy }); enemy_manager._try_drop_heart(fx, fy);
                        }
                        enemy_manager.total_kills++;
                        if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 6, e.color, 3);
                    } else {
                        const k = Math.max(0.01, Math.sqrt(dsq));
                        e.x += (dx / k) * 0.5; e.y += (dy / k) * 0.5;
                    }
                }
            });
            if (spit_hit) { this.spits.splice(i, 1); }
        }
    }

    // ========== RENDERING (optimized — no gradients, no shadowBlur) ==========

    render_pits(ctx, cell_size) {
        const pit_dur = this.get_pit_duration();
        for (let pi = 0; pi < this.pits.length; pi++) {
            const pit = this.pits[pi];
            const px = pit.x * cell_size, py = pit.y * cell_size;
            const fade = Math.max(0, 1 - pit.elapsed / pit_dur);
            if (fade <= 0) continue;

            if (pit.ring_alpha > 0) {
                ctx.strokeStyle = `rgba(100,80,30,${(pit.ring_alpha * 0.5).toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, py, pit.ring_radius * cell_size, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Pit — layered solid circles (no createRadialGradient)
            const pit_r = cell_size * 1.2;
            ctx.fillStyle = `rgba(80,60,20,${(0.15 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, pit_r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(50,40,15,${(0.35 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, pit_r * 0.7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(20,15,5,${(0.7 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, pit_r * 0.4, 0, Math.PI * 2); ctx.fill();

            // Cracks — single batched path
            ctx.strokeStyle = `rgba(60,180,60,${(0.3 * fade).toFixed(2)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let c = 0; c < 5; c++) {
                const ca = c * 1.2566 + pit.elapsed * 0.5;
                const len = pit_r * (0.5 + Math.sin(ca * 3) * 0.3);
                ctx.moveTo(px, py);
                ctx.lineTo(px + Math.cos(ca) * len, py + Math.sin(ca) * len);
            }
            ctx.stroke();
        }
    }

    render_cobras(ctx, cell_size) {
        const cobras = this.cobras;
        // In-place insertion sort by y (fast for small, nearly-sorted arrays)
        for (let i = 1; i < cobras.length; i++) {
            const c = cobras[i]; let j = i - 1;
            while (j >= 0 && cobras[j].y > c.y) { cobras[j + 1] = cobras[j]; j--; }
            cobras[j + 1] = c;
        }

        const sx = this._spine_x, sy = this._spine_y;
        const inv_seg = 1 / SEG_COUNT;

        for (let ci = 0; ci < cobras.length; ci++) {
            const c = cobras[ci];
            if (!c.alive) continue;
            const bx = c.x * cell_size, by = c.y * cell_size;
            const rise_t = Math.min(c.elapsed / COBRA_RISE_DURATION, 1);
            const remaining = c.life - c.elapsed;
            const sink_t = remaining < 0.5 ? remaining / 0.5 : 1;
            const height_frac = (1 - (1 - rise_t) * (1 - rise_t)) * sink_t;
            if (height_frac <= 0) continue;

            const total_h = cell_size * 1.6 * height_frac;
            const sway_px = Math.sin(c.elapsed * 2.5 + c.sway_offset) * cell_size * 0.15;
            let alpha = Math.min(rise_t < 1 ? rise_t : 1, remaining < 0.5 ? sink_t : 1);
            ctx.globalAlpha = alpha;

            // Ground hole
            ctx.fillStyle = '#140f05';
            ctx.beginPath();
            ctx.ellipse(bx, by, cell_size * 0.28, cell_size * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();

            // Build spine into typed arrays (no object allocation)
            for (let i = 0; i <= SEG_COUNT; i++) {
                const t = i * inv_seg;
                const curve_dampen = 1 - t * t;
                sx[i] = bx + Math.sin(t * 4.712 + c.sway_offset * 0.5) * cell_size * 0.25 * height_frac * curve_dampen + sway_px * Math.sin(t * Math.PI);
                sy[i] = by - t * total_h;
            }

            const body_w = cell_size * 0.13;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            // Outline + body (lineTo instead of quadraticCurveTo — cheaper GPU path)
            ctx.strokeStyle = '#1a5a1a';
            ctx.lineWidth = body_w * 2 + 2;
            ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
            for (let i = 1; i <= SEG_COUNT; i++) ctx.lineTo(sx[i], sy[i]);
            ctx.stroke();

            ctx.strokeStyle = '#2a8a2a';
            ctx.lineWidth = body_w * 2;
            ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
            for (let i = 1; i <= SEG_COUNT; i++) ctx.lineTo(sx[i], sy[i]);
            ctx.stroke();

            // Head — diamond, precomputed for straight-up orientation
            const hx_pos = sx[SEG_COUNT], hy_pos = sy[SEG_COUNT];
            const head_len = cell_size * 0.22, head_w = cell_size * 0.18;

            ctx.fillStyle = '#33aa33';
            ctx.beginPath();
            ctx.moveTo(hx_pos, hy_pos - head_len);
            ctx.lineTo(hx_pos + head_w, hy_pos);
            ctx.lineTo(hx_pos, hy_pos + head_len * 0.4);
            ctx.lineTo(hx_pos - head_w, hy_pos);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#1a5a1a'; ctx.lineWidth = 1; ctx.stroke();

            // Eyes + pupils (batched)
            const eye_spread = head_w * 0.55, eye_y = hy_pos - head_len * 0.15, eye_r = cell_size * 0.05;
            ctx.fillStyle = '#ffee44';
            ctx.beginPath();
            ctx.arc(hx_pos - eye_spread, eye_y, eye_r, 0, Math.PI * 2);
            ctx.arc(hx_pos + eye_spread, eye_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.ellipse(hx_pos - eye_spread, eye_y, eye_r * 0.3, eye_r * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(hx_pos + eye_spread, eye_y, eye_r * 0.3, eye_r * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tongue
            const tongue_phase = (c.elapsed * 3 + c.sway_offset) % 2;
            if (tongue_phase < 0.3) {
                const tlen = cell_size * 0.18 * (tongue_phase / 0.3);
                const tip_y = hy_pos - head_len;
                const ty = tip_y - tlen;
                ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(hx_pos, tip_y); ctx.lineTo(hx_pos, ty);
                ctx.moveTo(hx_pos, ty); ctx.lineTo(hx_pos - tlen * 0.3, ty - tlen * 0.25);
                ctx.moveTo(hx_pos, ty); ctx.lineTo(hx_pos + tlen * 0.3, ty - tlen * 0.25);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    render_spits(ctx, cell_size) {
        const now_s = performance.now() * 0.001;

        // --- Batch all spit trails in 3 bands (normal + crit separately) ---
        ctx.lineCap = 'round';
        const base_r = cell_size * 0.18;
        const spit_bands = [
            { frac: 0.3, a: 0.045, w: 0.3 },
            { frac: 0.6, a: 0.18,  w: 0.6 },
            { frac: 0.9, a: 0.40,  w: 0.9 },
        ];
        for (const is_crit of [false, true]) {
            for (const band of spit_bands) {
                ctx.strokeStyle = is_crit ? `rgba(230,255,50,${band.a.toFixed(2)})` : `rgba(100,240,30,${band.a.toFixed(2)})`;
                ctx.lineWidth = base_r * 2 * band.frac;
                ctx.beginPath();
                for (let si = 0; si < this.spits.length; si++) {
                    const s = this.spits[si];
                    if (s.is_crit !== is_crit || s.trail.length < 2) continue;
                    const trail = s.trail, tlen = trail.length - 1;
                    const lo = Math.max(1, Math.floor(band.frac * tlen * 0.4));
                    const hi = Math.min(tlen + 1, Math.ceil(band.frac * tlen * 1.4));
                    for (let i = lo; i < hi; i++) {
                        ctx.moveTo(trail[i - 1].x * cell_size, trail[i - 1].y * cell_size);
                        ctx.lineTo(trail[i].x * cell_size, trail[i].y * cell_size);
                    }
                }
                ctx.stroke();
            }
        }

        for (let si = 0; si < this.spits.length; si++) {
            const s = this.spits[si];
            const spx = s.x * cell_size, spy = s.y * cell_size;

            // Drips — fillRect for tiny dots
            if (s.drips.length > 0) {
                ctx.fillStyle = s.is_crit ? 'rgba(220,255,40,0.6)' : 'rgba(100,230,30,0.6)';
                for (let di = 0; di < s.drips.length; di++) {
                    const d = s.drips[di];
                    const dr = d.size * cell_size;
                    ctx.fillRect(d.x * cell_size - dr, d.y * cell_size - dr, dr * 2, dr * 2);
                }
            }

            // Glob — layered circles (no createRadialGradient)
            const r = base_r * (0.9 + Math.sin((now_s + s.wobble_phase) * 12) * 0.12);
            ctx.fillStyle = s.is_crit ? 'rgba(255,255,60,0.15)' : 'rgba(80,240,20,0.15)';
            ctx.beginPath(); ctx.arc(spx, spy, r * 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.is_crit ? 'rgba(240,255,60,0.8)' : 'rgba(120,240,30,0.8)';
            ctx.beginPath(); ctx.arc(spx, spy, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.is_crit ? 'rgba(255,255,200,0.6)' : 'rgba(180,255,120,0.6)';
            ctx.beginPath(); ctx.arc(spx, spy, r * 0.4, 0, Math.PI * 2); ctx.fill();
        }
    }

    render_projectiles(ctx, cell_size) {
        // --- Batch all projectile trails in 3 bands ---
        ctx.lineCap = 'round';
        const proj_bands = [
            { frac: 0.3, a: 0.036, w_mult: 0.054 },
            { frac: 0.6, a: 0.144, w_mult: 0.108 },
            { frac: 0.9, a: 0.324, w_mult: 0.162 },
        ];
        for (const band of proj_bands) {
            ctx.strokeStyle = `rgba(100,180,50,${band.a.toFixed(3)})`;
            ctx.lineWidth = Math.max(0.5, band.w_mult * cell_size);
            ctx.beginPath();
            for (let pi = 0; pi < this.projectiles.length; pi++) {
                const p = this.projectiles[pi];
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

        for (let pi = 0; pi < this.projectiles.length; pi++) {
            const p = this.projectiles[pi];
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = PIT_ARC_HEIGHT * 4 * t * (1 - t);
            const gpx = gx * cell_size, gpy = gy * cell_size, opy = (gy - height) * cell_size;

            // Shadow
            ctx.fillStyle = `rgba(80,60,20,${(0.1 + (1 - height / PIT_ARC_HEIGHT) * 0.15).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(gpx, gpy, cell_size * 0.4, 0, Math.PI * 2); ctx.fill();

            // Sparks
            for (let si = 0; si < p.sparks.length; si++) {
                const sp = p.sparks[si];
                ctx.fillStyle = `rgba(140,200,60,${(Math.max(0, sp.life / 0.6) * 0.6).toFixed(2)})`;
                const sr = sp.size * cell_size;
                ctx.fillRect(sp.x * cell_size - sr, sp.y * cell_size - sr, sr * 2, sr * 2);
            }

            // Orb — layered circles (no gradients, no shadowBlur)
            const orb_r = cell_size * 0.28;
            ctx.fillStyle = 'rgba(80,160,40,0.2)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r * 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(100,140,50,0.8)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(180,200,140,0.5)';
            ctx.beginPath(); ctx.arc(gpx, opy, orb_r * 0.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    clear() {
        this.projectiles = [];
        this.pits = [];
        this.cobras = [];
        this.spits = [];
        this.last_fire = 0;
    }
}
