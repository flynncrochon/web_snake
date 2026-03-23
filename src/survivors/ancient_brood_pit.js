const PIT_RANGE = 14;
const PIT_RANGE_SQ = PIT_RANGE * PIT_RANGE;
const ANCIENT_COOLDOWN = 6000;
const FLIGHT_DURATION = 0.85;
const ARC_HEIGHT = 7;
const MAX_TRAIL = 20;

// Ancient pit — grows over time
const ANCIENT_PIT_DURATION = 10.0;
const COBRA_SPAWN_INTERVAL = 0.9;
const PIT_START_RADIUS = 1.0;
const PIT_GROWTH_RATE = 0.5;
const PIT_MAX_RADIUS = 6.0;
const MAX_TOTAL_COBRAS = 20; // hard cap across all pits

// Ancient cobra properties
const COBRA_LIFETIME = 6.0;
const COBRA_SPIT_COOLDOWN = 0.9;
const COBRA_SPIT_RANGE_SQ = 49; // 7^2
const COBRA_SPIT_SPEED = 14;
const COBRA_SPIT_LIFETIME = 1.0;
const COBRA_RISE_DURATION = 0.5;
const ANCIENT_SPIT_DAMAGE = 120;
const MAX_DRIPS = 3;
const MAX_SPIT_TRAIL = 6;
const SEG_COUNT = 6;

export class AncientBroodPit {
    constructor() {
        this.active = false;
        this.projectiles = [];
        this.pits = [];
        this.cobras = [];
        this.spits = [];
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
    }

    get_spit_damage() { return ANCIENT_SPIT_DAMAGE * this.gorger_dmg_mult; }
    get_pit_duration() { return ANCIENT_PIT_DURATION * this.duration_mult; }
    get_cobra_lifetime() { return COBRA_LIFETIME * this.duration_mult; }
    get_pit_radius(elapsed) {
        return Math.min(PIT_MAX_RADIUS, PIT_START_RADIUS + elapsed * PIT_GROWTH_RATE) * this.radius_mult;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;
        const head = snake.head;
        const hx = head.x + 0.5, hy = head.y + 0.5;
        const now = performance.now();
        // --- Fire at densest cluster ---
        if (now - this.last_fire >= ANCIENT_COOLDOWN * this.fire_cooldown_mult) {
            let best = null, best_score = -1;
            const pit_candidates = enemy_manager.query_radius_array(hx, hy, PIT_RANGE * this.range_mult);
            const sample = pit_candidates.length <= 8 ? pit_candidates : pit_candidates.slice(0, 8);
            for (const e of sample) {
                const score = 1 + enemy_manager.query_count(e.x, e.y, 4, e);
                if (score > best_score) { best_score = score; best = e; }
            }
            if (best) {
                this.projectiles.push({
                    start_x: hx, start_y: hy, target_x: best.x, target_y: best.y,
                    elapsed: 0, duration: FLIGHT_DURATION, trail: [], sparks: [],
                });
                for (let ei = 0; ei < this.extra_projectiles; ei++) {
                    const angle = (ei / this.extra_projectiles) * Math.PI * 2 + Math.random() * 0.5;
                    this.projectiles.push({
                        start_x: hx, start_y: hy,
                        target_x: best.x + Math.cos(angle) * 3.5,
                        target_y: best.y + Math.sin(angle) * 3.5,
                        elapsed: 0, duration: FLIGHT_DURATION + ei * 0.1, trail: [], sparks: [],
                    });
                }
                this.last_fire = now;
            }
        }

        // --- Projectiles ---
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.elapsed += dt;
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = ARC_HEIGHT * 4 * t * (1 - t);
            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_TRAIL) p.trail.shift();
            if (Math.random() < dt * 6 && height > 0.5 && p.sparks.length < 8) {
                p.sparks.push({
                    x: gx + (Math.random() - 0.5) * 0.25, y: gy - height + (Math.random() - 0.5) * 0.25,
                    vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
                    life: 0.35 + Math.random() * 0.15, size: 0.02 + Math.random() * 0.03,
                });
            }
            for (let j = p.sparks.length - 1; j >= 0; j--) {
                const s = p.sparks[j]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
                if (s.life <= 0) p.sparks.splice(j, 1);
            }
            if (t >= 1) {
                this.pits.push({
                    x: p.target_x, y: p.target_y, elapsed: 0, cobras_spawned: 0,
                    next_cobra_time: 0.15, ring_alpha: 1.0, ring_radius: 0,
                    crack_angles: Array.from({ length: 6 }, (_, ci) => ci * 1.047 + (Math.random() - 0.5) * 0.3),
                });
                if (particles) {
                    const px = p.target_x * cell_size, py = p.target_y * cell_size;
                    particles.emit(px, py, 15, '#cc8822', 5);
                    particles.emit(px, py, 8, '#ffaa33', 3);
                }
                this.projectiles.splice(i, 1);
            }
        }

        // --- Pits (growing, spawning cobras with global cap) ---
        const pit_dur = this.get_pit_duration();
        const spit_dmg = this.get_spit_damage();
        for (let i = this.pits.length - 1; i >= 0; i--) {
            const pit = this.pits[i];
            pit.elapsed += dt;
            pit.ring_radius += dt * 3;
            pit.ring_alpha = Math.max(0, 1 - pit.elapsed / 1.5);
            const current_radius = this.get_pit_radius(pit.elapsed);

            // Spawn cobras — respect global cap
            if (pit.elapsed >= pit.next_cobra_time && pit.elapsed < pit_dur) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 0.5 + Math.random() * current_radius;
                this.cobras.push({
                    x: pit.x + Math.cos(angle) * dist, y: pit.y + Math.sin(angle) * dist,
                    alive: true, life: this.get_cobra_lifetime(),
                    elapsed: 0, last_spit: 0, sway_offset: Math.random() * Math.PI * 2,
                });
                pit.cobras_spawned++;
                pit.next_cobra_time = pit.elapsed + COBRA_SPAWN_INTERVAL;
                if (particles) {
                    particles.emit((pit.x + Math.cos(angle) * dist) * cell_size,
                        (pit.y + Math.sin(angle) * dist) * cell_size, 4, '#cc8822', 2);
                }
            }
            if (pit.elapsed >= pit_dur + 2.0) this.pits.splice(i, 1);
        }

        // --- Cobras ---
        for (let i = this.cobras.length - 1; i >= 0; i--) {
            const c = this.cobras[i];
            if (!c.alive) { this.cobras.splice(i, 1); continue; }
            c.elapsed += dt;
            if (c.elapsed >= c.life) {
                if (particles) particles.emit(c.x * cell_size, c.y * cell_size, 3, '#cc8822', 2);
                c.alive = false; this.cobras.splice(i, 1); continue;
            }
            if (c.elapsed < COBRA_RISE_DURATION || c.elapsed - c.last_spit < COBRA_SPIT_COOLDOWN) continue;

            const nearest = enemy_manager.query_nearest(c.x, c.y, 7);
            if (nearest) {
                const dx = nearest.x - c.x, dy = nearest.y - c.y, dist = Math.sqrt(dx * dx + dy * dy);
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
                if (particles) particles.emit(c.x * cell_size, (c.y - 0.5) * cell_size, 3, '#ffaa33', 2);
            }
        }

        // --- Spits ---
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
                    if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, s.damage, s.is_crit);
                    if (particles) {
                        const px = e.x * cell_size, py = e.y * cell_size;
                        particles.emit(px, py, 6, '#ffaa33', 3);
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
            const age_frac = Math.min(pit.elapsed / pit_dur, 1);
            const fade = pit.elapsed < pit_dur ? 1 : Math.max(0, 1 - (pit.elapsed - pit_dur) / 2.0);
            if (fade <= 0) continue;
            const r = this.get_pit_radius(pit.elapsed) * cell_size;

            // Spawn ring
            if (pit.ring_alpha > 0) {
                ctx.strokeStyle = `rgba(200,150,50,${(pit.ring_alpha * 0.5).toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(px, py, pit.ring_radius * cell_size, 0, Math.PI * 2); ctx.stroke();
            }

            // Pit — layered circles (no gradients)
            ctx.fillStyle = `rgba(120,80,25,${(0.12 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, r * 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(80,55,20,${(0.3 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, r * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(40,28,10,${(0.55 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, r * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(15,10,3,${(0.8 * fade).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(px, py, r * 0.25, 0, Math.PI * 2); ctx.fill();

            // Cracks — batched path
            const cracks = pit.crack_angles;
            ctx.strokeStyle = `rgba(200,140,40,${(0.35 * fade).toFixed(2)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let ci = 0; ci < cracks.length; ci++) {
                const ca = cracks[ci];
                const len = r * (0.7 + Math.sin(ca * 3 + pit.elapsed) * 0.2);
                ctx.moveTo(px, py);
                ctx.lineTo(px + Math.cos(ca) * len, py + Math.sin(ca) * len);
                // Branch
                if (age_frac > 0.3 && len > cell_size * 0.5) {
                    const mid_x = px + Math.cos(ca) * len * 0.6;
                    const mid_y = py + Math.sin(ca) * len * 0.6;
                    const ba = ca + (ci % 2 === 0 ? 0.6 : -0.6);
                    const bl = len * 0.35 * Math.min(1, (age_frac - 0.3) / 0.3);
                    ctx.moveTo(mid_x, mid_y);
                    ctx.lineTo(mid_x + Math.cos(ba) * bl, mid_y + Math.sin(ba) * bl);
                }
            }
            ctx.stroke();

            // Rune dots — simple
            const rune_count = 4 + Math.floor(age_frac * 4);
            ctx.fillStyle = `rgba(255,200,80,${(0.3 * fade).toFixed(2)})`;
            const rune_r = r * 0.85;
            for (let ri = 0; ri < rune_count; ri++) {
                const ra = (ri / rune_count) * Math.PI * 2 + pit.elapsed * 0.3;
                ctx.beginPath();
                ctx.arc(px + Math.cos(ra) * rune_r, py + Math.sin(ra) * rune_r, cell_size * 0.04, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    render_cobras(ctx, cell_size) {
        const cobras = this.cobras;
        // In-place insertion sort by y
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
            ctx.globalAlpha = Math.min(rise_t < 1 ? rise_t : 1, remaining < 0.5 ? sink_t : 1);

            // Ground hole
            ctx.fillStyle = '#1e1405';
            ctx.beginPath(); ctx.ellipse(bx, by, cell_size * 0.28, cell_size * 0.1, 0, 0, Math.PI * 2); ctx.fill();

            // Build spine
            for (let i = 0; i <= SEG_COUNT; i++) {
                const t = i * inv_seg;
                const cd = 1 - t * t;
                sx[i] = bx + Math.sin(t * 4.712 + c.sway_offset * 0.5) * cell_size * 0.25 * height_frac * cd + sway_px * Math.sin(t * Math.PI);
                sy[i] = by - t * total_h;
            }

            const body_w = cell_size * 0.13;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            // Outline
            ctx.strokeStyle = '#6b4400'; ctx.lineWidth = body_w * 2 + 2;
            ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
            for (let i = 1; i < SEG_COUNT; i++) ctx.quadraticCurveTo(sx[i], sy[i], (sx[i] + sx[i + 1]) * 0.5, (sy[i] + sy[i + 1]) * 0.5);
            ctx.stroke();

            // Body — amber
            ctx.strokeStyle = '#cc8822'; ctx.lineWidth = body_w * 2;
            ctx.beginPath(); ctx.moveTo(sx[0], sy[0]);
            for (let i = 1; i < SEG_COUNT; i++) ctx.quadraticCurveTo(sx[i], sy[i], (sx[i] + sx[i + 1]) * 0.5, (sy[i] + sy[i + 1]) * 0.5);
            ctx.stroke();

            // Head
            const hx_pos = sx[SEG_COUNT], hy_pos = sy[SEG_COUNT];
            const head_len = cell_size * 0.24, head_w = cell_size * 0.2;
            ctx.fillStyle = '#dd9922';
            ctx.beginPath();
            ctx.moveTo(hx_pos, hy_pos - head_len);
            ctx.lineTo(hx_pos + head_w, hy_pos);
            ctx.lineTo(hx_pos, hy_pos + head_len * 0.4);
            ctx.lineTo(hx_pos - head_w, hy_pos);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#6b4400'; ctx.lineWidth = 1; ctx.stroke();

            // Eyes
            const eye_s = head_w * 0.55, eye_y = hy_pos - head_len * 0.15, eye_r = cell_size * 0.055;
            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(hx_pos - eye_s, eye_y, eye_r, 0, Math.PI * 2);
            ctx.arc(hx_pos + eye_s, eye_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#220000';
            ctx.beginPath();
            ctx.ellipse(hx_pos - eye_s, eye_y, eye_r * 0.3, eye_r * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(hx_pos + eye_s, eye_y, eye_r * 0.3, eye_r * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tongue
            const tp = (c.elapsed * 3 + c.sway_offset) % 2;
            if (tp < 0.3) {
                const tlen = cell_size * 0.2 * (tp / 0.3);
                const tip_y = hy_pos - head_len, ty = tip_y - tlen;
                ctx.strokeStyle = '#ff4422'; ctx.lineWidth = 1;
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
        for (let si = 0; si < this.spits.length; si++) {
            const s = this.spits[si];
            const spx = s.x * cell_size, spy = s.y * cell_size;
            const life_frac = s.life / s.max_life;
            const base_r = cell_size * 0.18;

            // Drips
            if (s.drips.length > 0) {
                ctx.fillStyle = s.is_crit ? 'rgba(255,240,80,0.6)' : 'rgba(230,170,40,0.6)';
                for (let di = 0; di < s.drips.length; di++) {
                    const d = s.drips[di];
                    ctx.beginPath(); ctx.arc(d.x * cell_size, d.y * cell_size, d.size * cell_size, 0, Math.PI * 2); ctx.fill();
                }
            }

            // Trail — single pass
            if (s.trail.length >= 2) {
                ctx.lineCap = 'round';
                const trail = s.trail, tlen = trail.length - 1;
                for (let i = 1; i <= tlen; i++) {
                    const frac = i / tlen, a = frac * frac * 0.5 * life_frac;
                    ctx.strokeStyle = s.is_crit ? `rgba(255,240,80,${a.toFixed(2)})` : `rgba(230,160,40,${a.toFixed(2)})`;
                    ctx.lineWidth = base_r * 2 * frac;
                    ctx.beginPath();
                    ctx.moveTo(trail[i - 1].x * cell_size, trail[i - 1].y * cell_size);
                    ctx.lineTo(trail[i].x * cell_size, trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // Glob — layered circles
            const r = base_r * (0.9 + Math.sin((now_s + s.wobble_phase) * 12) * 0.12);
            ctx.fillStyle = s.is_crit ? 'rgba(255,230,60,0.15)' : 'rgba(220,150,30,0.15)';
            ctx.beginPath(); ctx.arc(spx, spy, r * 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.is_crit ? 'rgba(255,240,80,0.8)' : 'rgba(230,170,40,0.8)';
            ctx.beginPath(); ctx.arc(spx, spy, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.is_crit ? 'rgba(255,255,200,0.6)' : 'rgba(255,220,120,0.6)';
            ctx.beginPath(); ctx.arc(spx, spy, r * 0.4, 0, Math.PI * 2); ctx.fill();
        }
    }

    render_projectiles(ctx, cell_size) {
        for (let pi = 0; pi < this.projectiles.length; pi++) {
            const p = this.projectiles[pi];
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = ARC_HEIGHT * 4 * t * (1 - t);
            const gpx = gx * cell_size, gpy = gy * cell_size, opy = (gy - height) * cell_size;

            // Shadow
            ctx.fillStyle = `rgba(120,80,20,${(0.1 + (1 - height / ARC_HEIGHT) * 0.15).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(gpx, gpy, cell_size * 0.4, 0, Math.PI * 2); ctx.fill();

            // Trail
            if (p.trail.length >= 2) {
                ctx.lineCap = 'round';
                const tlen = p.trail.length - 1;
                for (let i = 1; i <= tlen; i++) {
                    const frac = i / tlen;
                    ctx.strokeStyle = `rgba(200,140,40,${(frac * frac * 0.4).toFixed(2)})`;
                    ctx.lineWidth = Math.max(0.5, frac * cell_size * 0.18);
                    ctx.beginPath();
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // Sparks
            for (let si = 0; si < p.sparks.length; si++) {
                const sp = p.sparks[si];
                ctx.fillStyle = `rgba(255,180,50,${(Math.max(0, sp.life / 0.6) * 0.6).toFixed(2)})`;
                ctx.beginPath(); ctx.arc(sp.x * cell_size, sp.y * cell_size, sp.size * cell_size, 0, Math.PI * 2); ctx.fill();
            }

            // Orb — layered circles
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
        this.projectiles = []; this.pits = []; this.cobras = []; this.spits = []; this.last_fire = 0;
    }
}
