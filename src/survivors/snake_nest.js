const NEST_RANGE = 12;
const NEST_RANGE_SQ = NEST_RANGE * NEST_RANGE;
const BASE_NEST_COOLDOWN = 7000;
const NEST_FLIGHT_DURATION = 0.75;
const NEST_ARC_HEIGHT = 6;
const MAX_NEST_TRAIL = 30;
const MINI_SNAKE_LENGTH = 3;
const MINI_SNAKE_TICK_RATE = 80; // ms per grid move — fast but readable
const MINI_SNAKE_MAX_TICKS = 70; // lifetime in ticks (~5.6s)
const HATCH_DURATION = 0.5;

export class SnakeNest {
    constructor() {
        this.projectiles = [];
        this.nests = [];
        this.mini_snakes = [];
        this.last_fire = 0;
        this.level = 0;
        this.duration_mult = 1;
        this.extra_projectiles = 0;
    }

    get_cooldown() {
        return Math.max(2500, BASE_NEST_COOLDOWN - (this.level - 1) * 600);
    }

    get_spawn_count() {
        return 3 + Math.floor((this.level - 1) / 2);
    }

    get_damage() {
        return (1 + Math.floor(this.level / 3)) * 100;
    }

    get_max_ticks() {
        return Math.round(MINI_SNAKE_MAX_TICKS * this.duration_mult);
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (this.level <= 0) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire at densest enemy cluster ---
        if (now - this.last_fire >= this.get_cooldown()) {
            const candidates = [];
            for (const e of enemy_manager.enemies) {
                if (!e.alive) continue;
                const dx = e.x - hx;
                const dy = e.y - hy;
                if (dx * dx + dy * dy <= NEST_RANGE_SQ) {
                    candidates.push(e);
                }
            }

            let best = null;
            let best_score = -1;
            const sample = candidates.length <= 12 ? candidates
                : candidates.sort(() => Math.random() - 0.5).slice(0, 12);

            const cluster_r_sq = 16;
            for (const e of sample) {
                let score = 1;
                for (const other of enemy_manager.enemies) {
                    if (!other.alive || other === e) continue;
                    const dx = other.x - e.x;
                    const dy = other.y - e.y;
                    if (dx * dx + dy * dy < cluster_r_sq) score++;
                }
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
                    duration: NEST_FLIGHT_DURATION,
                    trail: [],
                    sparks: [],
                });
                // Extra eggs from Hydra Fangs — offset around the main target
                for (let ei = 0; ei < this.extra_projectiles; ei++) {
                    const angle = (ei / this.extra_projectiles) * Math.PI * 2 + Math.random() * 0.5;
                    const spread = 2.5;
                    this.projectiles.push({
                        start_x: hx,
                        start_y: hy,
                        target_x: best.x + Math.cos(angle) * spread,
                        target_y: best.y + Math.sin(angle) * spread,
                        elapsed: 0,
                        duration: NEST_FLIGHT_DURATION + ei * 0.1,
                        trail: [],
                        sparks: [],
                    });
                }
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
            const height = NEST_ARC_HEIGHT * 4 * t * (1 - t);

            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_NEST_TRAIL) p.trail.shift();

            if (Math.random() < dt * 8 && height > 0.5) {
                p.sparks.push({
                    x: gx + (Math.random() - 0.5) * 0.25,
                    y: gy - height + (Math.random() - 0.5) * 0.25,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    life: 0.4 + Math.random() * 0.2,
                    size: 0.02 + Math.random() * 0.03,
                });
            }

            for (let j = p.sparks.length - 1; j >= 0; j--) {
                const s = p.sparks[j];
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.life -= dt;
                if (s.life <= 0) p.sparks.splice(j, 1);
            }

            if (t >= 1) {
                this.nests.push({
                    x: p.target_x,
                    y: p.target_y,
                    elapsed: 0,
                    hatched: false,
                    ring_alpha: 1.0,
                    ring_radius: 0,
                });

                if (particles) {
                    const px = p.target_x * cell_size;
                    const py = p.target_y * cell_size;
                    particles.emit(px, py, 15, '#ffa500', 5);
                    particles.emit(px, py, 10, '#ff6', 3);
                    particles.emit(px, py, 6, '#fff', 2);
                }

                this.projectiles.splice(i, 1);
            }
        }

        // --- Update nests (hatching animation) ---
        for (let i = this.nests.length - 1; i >= 0; i--) {
            const nest = this.nests[i];
            nest.elapsed += dt;

            nest.ring_radius += dt * 6;
            nest.ring_alpha = Math.max(0, 1 - nest.elapsed / 0.8);

            if (!nest.hatched && nest.elapsed >= HATCH_DURATION) {
                nest.hatched = true;
                const count = this.get_spawn_count();
                const dmg = this.get_damage();

                // Snap landing to grid
                const grid_x = Math.floor(nest.x);
                const grid_y = Math.floor(nest.y);

                for (let j = 0; j < count; j++) {
                    // Spread spawn positions around the landing cell
                    const dirs = [
                        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
                    ];
                    const dir = dirs[j % dirs.length];
                    const sx = Math.max(0, Math.min(arena.size - 1, grid_x + dir.dx * (Math.floor(j / 4) + 1)));
                    const sy = Math.max(0, Math.min(arena.size - 1, grid_y + dir.dy * (Math.floor(j / 4) + 1)));

                    // Build segments stacked at spawn point (they'll fan out naturally)
                    const segments = [];
                    for (let k = 0; k < MINI_SNAKE_LENGTH; k++) {
                        segments.push({
                            x: sx,
                            y: sy,
                            prev_x: sx,
                            prev_y: sy,
                        });
                    }

                    this.mini_snakes.push({
                        segments,
                        direction: { ...dir },
                        alive: true,
                        damage: dmg,
                        ticks_lived: 0,
                        last_tick_time: now,
                    });
                }

                if (particles) {
                    const px = nest.x * cell_size;
                    const py = nest.y * cell_size;
                    particles.emit(px, py, 20, '#0f0', 4);
                    particles.emit(px, py, 12, '#8f0', 3);
                }
            }

            if (nest.elapsed > 1.2) {
                this.nests.splice(i, 1);
            }
        }

        // --- Tick mini snakes on the grid ---
        for (let i = this.mini_snakes.length - 1; i >= 0; i--) {
            const ms = this.mini_snakes[i];
            if (!ms.alive) {
                this.mini_snakes.splice(i, 1);
                continue;
            }

            if (ms.ticks_lived >= this.get_max_ticks()) {
                // Death particles from each segment
                if (particles) {
                    for (const seg of ms.segments) {
                        particles.emit(
                            (seg.x + 0.5) * cell_size,
                            (seg.y + 0.5) * cell_size,
                            3, '#0f0', 2
                        );
                    }
                }
                ms.alive = false;
                this.mini_snakes.splice(i, 1);
                continue;
            }

            // Tick-based movement like the main snake
            if (now - ms.last_tick_time < MINI_SNAKE_TICK_RATE) continue;
            ms.last_tick_time = now;
            ms.ticks_lived++;

            const hd = ms.segments[0];

            // Find nearest alive enemy and pick best cardinal direction
            let nearest = null;
            let best_dist = Infinity;
            for (const e of enemy_manager.enemies) {
                if (!e.alive) continue;
                const dx = e.x - (hd.x + 0.5);
                const dy = e.y - (hd.y + 0.5);
                const d = dx * dx + dy * dy;
                if (d < best_dist) {
                    best_dist = d;
                    nearest = e;
                }
            }

            if (nearest) {
                const dx = nearest.x - (hd.x + 0.5);
                const dy = nearest.y - (hd.y + 0.5);

                // Pick the cardinal direction that closes the most distance
                // Prefer the axis with the larger gap, avoid reversing
                if (Math.abs(dx) >= Math.abs(dy)) {
                    const want = { dx: Math.sign(dx) || 1, dy: 0 };
                    // Don't reverse into own neck
                    if (ms.segments.length < 2 || want.dx !== -ms.direction.dx || want.dy !== -ms.direction.dy) {
                        ms.direction = want;
                    } else {
                        ms.direction = { dx: 0, dy: Math.sign(dy) || 1 };
                    }
                } else {
                    const want = { dx: 0, dy: Math.sign(dy) || 1 };
                    if (ms.segments.length < 2 || want.dx !== -ms.direction.dx || want.dy !== -ms.direction.dy) {
                        ms.direction = want;
                    } else {
                        ms.direction = { dx: Math.sign(dx) || 1, dy: 0 };
                    }
                }
            }

            const next_x = hd.x + ms.direction.dx;
            const next_y = hd.y + ms.direction.dy;

            // Bounce off arena walls
            if (next_x < 0 || next_x >= arena.size || next_y < 0 || next_y >= arena.size) {
                // Reverse direction
                ms.direction.dx = -ms.direction.dx;
                ms.direction.dy = -ms.direction.dy;
                // Skip this tick, will move next tick
                continue;
            }

            // Move segments: each takes the previous segment's position (just like main snake)
            for (let k = ms.segments.length - 1; k >= 1; k--) {
                const seg = ms.segments[k];
                seg.prev_x = seg.x;
                seg.prev_y = seg.y;
                seg.x = ms.segments[k - 1].x;
                seg.y = ms.segments[k - 1].y;
            }
            hd.prev_x = hd.x;
            hd.prev_y = hd.y;
            hd.x = next_x;
            hd.y = next_y;

            // Check collision with enemies — plow through, damaging all in the path
            const head_cx = next_x + 0.5;
            const head_cy = next_y + 0.5;
            for (const e of enemy_manager.enemies) {
                if (!e.alive) continue;
                const edx = e.x - head_cx;
                const edy = e.y - head_cy;
                const dist = Math.sqrt(edx * edx + edy * edy);
                if (dist < e.radius + 0.45) {
                    const dead = e.take_damage(ms.damage);

                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, ms.damage, false);
                    }

                    if (particles) {
                        const px = e.x * cell_size;
                        const py = e.y * cell_size;
                        particles.emit(px, py, 6, '#0f0', 3);
                        particles.emit(px, py, 3, '#fff', 2);
                    }

                    if (dead) {
                        const fx = Math.floor(e.x);
                        const fy = Math.floor(e.y);
                        if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                            arena.food.push({ x: fx, y: fy });
                        }
                        enemy_manager.total_kills++;
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                        }
                    } else {
                        const k_dist = Math.max(0.01, dist);
                        e.x += (edx / k_dist) * 1.5;
                        e.y += (edy / k_dist) * 1.5;
                    }
                }
            }
        }
    }

    // --- Render mini snakes exactly like the main snake, but green ---
    render_mini_snakes(ctx, cell_size, t, cam_offset_x, cam_offset_y) {
        const color = '#0f0';
        const seg_size = Math.ceil(cell_size * 0.35);
        const half = seg_size / 2;
        const use_snap = cam_offset_x !== null && cam_offset_x !== undefined;
        const pad = 1;

        for (const ms of this.mini_snakes) {
            if (!ms.alive) continue;

            const segs = ms.segments;

            // Compute per-snake interpolation t based on its own tick timing
            const ms_elapsed = performance.now() - ms.last_tick_time;
            const ms_raw = Math.min(ms_elapsed / MINI_SNAKE_TICK_RATE, 1);
            const ms_t = 1 - (1 - ms_raw) * (1 - ms_raw); // ease-out quad

            // Fade alpha near end of life
            const remaining = this.get_max_ticks() - ms.ticks_lived;
            let alpha = 1;
            if (remaining < 8) {
                alpha = remaining / 8;
            }
            // Fade in during first few ticks
            if (ms.ticks_lived < 3) {
                alpha = Math.min(alpha, (ms.ticks_lived + ms_raw) / 3);
            }

            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;

            // Compute interpolated positions (same logic as SnakeRenderer)
            const positions = [];
            for (const seg of segs) {
                let px = (seg.prev_x + (seg.x - seg.prev_x) * ms_t + 0.5) * cell_size;
                let py = (seg.prev_y + (seg.y - seg.prev_y) * ms_t + 0.5) * cell_size;
                if (use_snap) {
                    px = Math.round(px + cam_offset_x) - cam_offset_x;
                    py = Math.round(py + cam_offset_y) - cam_offset_y;
                }
                positions.push({ x: px, y: py });
            }

            // Draw connections between consecutive segments (fills the gap during movement)
            for (let k = 0; k < segs.length - 1; k++) {
                const a = positions[k];
                const b = positions[k + 1];
                // Also connect through the prev position to avoid gaps
                let cx = (segs[k].prev_x + 0.5) * cell_size;
                let cy = (segs[k].prev_y + 0.5) * cell_size;
                if (use_snap) {
                    cx = Math.round(cx + cam_offset_x) - cam_offset_x;
                    cy = Math.round(cy + cam_offset_y) - cam_offset_y;
                }

                const x1 = Math.min(a.x, cx) - half - pad;
                const y1 = Math.min(a.y, cy) - half - pad;
                const w1 = Math.max(a.x, cx) - Math.min(a.x, cx) + seg_size + pad * 2;
                const h1 = Math.max(a.y, cy) - Math.min(a.y, cy) + seg_size + pad * 2;
                ctx.fillRect(x1, y1, w1, h1);

                const x2 = Math.min(b.x, cx) - half - pad;
                const y2 = Math.min(b.y, cy) - half - pad;
                const w2 = Math.max(b.x, cx) - Math.min(b.x, cx) + seg_size + pad * 2;
                const h2 = Math.max(b.y, cy) - Math.min(b.y, cy) + seg_size + pad * 2;
                ctx.fillRect(x2, y2, w2, h2);
            }

            // Draw segment squares on top
            for (const pos of positions) {
                ctx.fillRect(pos.x - half, pos.y - half, seg_size, seg_size);
            }
        }

        ctx.globalAlpha = 1;
    }

    // --- Render nests on ground (before enemies) ---
    render_nests(ctx, cell_size) {
        for (const nest of this.nests) {
            const px = nest.x * cell_size;
            const py = nest.y * cell_size;

            // Expanding ring
            if (nest.ring_alpha > 0) {
                ctx.strokeStyle = `rgba(255, 200, 80, ${nest.ring_alpha * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, py, nest.ring_radius * cell_size, 0, Math.PI * 2);
                ctx.stroke();
            }

            const hatch_t = Math.min(nest.elapsed / HATCH_DURATION, 1);

            if (hatch_t < 1) {
                const pulse = 1 + Math.sin(nest.elapsed * 20) * 0.15;
                const r = cell_size * 0.4 * pulse;

                ctx.save();
                ctx.shadowColor = 'rgba(255, 200, 50, 0.8)';
                ctx.shadowBlur = cell_size * 0.6;

                const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
                glow.addColorStop(0, `rgba(255, 220, 80, ${0.4 * (1 - hatch_t)})`);
                glow.addColorStop(1, 'rgba(255, 200, 50, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(px, py, r * 2, 0, Math.PI * 2);
                ctx.fill();

                const egg_grad = ctx.createRadialGradient(
                    px - r * 0.2, py - r * 0.2, 0,
                    px, py, r
                );
                egg_grad.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
                egg_grad.addColorStop(0.5, 'rgba(255, 180, 50, 0.9)');
                egg_grad.addColorStop(1, 'rgba(200, 120, 20, 0.7)');
                ctx.fillStyle = egg_grad;
                ctx.beginPath();
                ctx.ellipse(px, py, r * 0.8, r, nest.elapsed * 2, 0, Math.PI * 2);
                ctx.fill();

                if (hatch_t > 0.3) {
                    const crack_alpha = (hatch_t - 0.3) / 0.7;
                    ctx.strokeStyle = `rgba(0, 255, 220, ${crack_alpha})`;
                    ctx.lineWidth = 1.5;
                    const crack_count = Math.floor(3 + hatch_t * 4);
                    for (let c = 0; c < crack_count; c++) {
                        const ca = (c / crack_count) * Math.PI * 2 + nest.elapsed * 3;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(
                            px + Math.cos(ca) * r * 0.7 * crack_alpha,
                            py + Math.sin(ca) * r * 0.7 * crack_alpha
                        );
                        ctx.stroke();
                    }
                }

                ctx.shadowBlur = 0;
                ctx.restore();
            } else {
                const fade = Math.max(0, 1 - (nest.elapsed - HATCH_DURATION) / 0.7);
                if (fade > 0) {
                    ctx.strokeStyle = `rgba(0, 255, 200, ${fade * 0.4})`;
                    ctx.lineWidth = 1.5;
                    const swirl_count = 6;
                    for (let s = 0; s < swirl_count; s++) {
                        const sa = (s / swirl_count) * Math.PI * 2 + nest.elapsed * 5;
                        const sr = cell_size * (0.3 + (nest.elapsed - HATCH_DURATION) * 2) * fade;
                        ctx.beginPath();
                        ctx.arc(
                            px + Math.cos(sa) * sr * 0.3,
                            py + Math.sin(sa) * sr * 0.3,
                            sr * 0.2, 0, Math.PI
                        );
                        ctx.stroke();
                    }
                }
            }
        }
    }

    // --- Render projectiles in flight ---
    render_projectiles(ctx, cell_size) {
        for (const p of this.projectiles) {
            const t = Math.min(p.elapsed / p.duration, 1);
            const gx = p.start_x + (p.target_x - p.start_x) * t;
            const gy = p.start_y + (p.target_y - p.start_y) * t;
            const height = NEST_ARC_HEIGHT * 4 * t * (1 - t);

            const ground_px = gx * cell_size;
            const ground_py = gy * cell_size;
            const orb_py = (gy - height) * cell_size;

            const height_ratio = height / NEST_ARC_HEIGHT;
            const shadow_scale = 1 - height_ratio * 0.5;
            const shadow_alpha = 0.1 + (1 - height_ratio) * 0.15;
            ctx.fillStyle = `rgba(200, 150, 30, ${shadow_alpha})`;
            ctx.beginPath();
            ctx.ellipse(ground_px, ground_py,
                cell_size * 0.6 * shadow_scale,
                cell_size * 0.3 * shadow_scale,
                0, 0, Math.PI * 2);
            ctx.fill();

            if (p.trail.length >= 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < p.trail.length; i++) {
                    const frac = i / (p.trail.length - 1);
                    const a = frac * frac * 0.5;
                    const w = frac * cell_size * 0.22;
                    ctx.strokeStyle = `rgba(255, 200, 80, ${a})`;
                    ctx.lineWidth = Math.max(0.5, w);
                    ctx.beginPath();
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            for (const s of p.sparks) {
                const s_alpha = Math.max(0, s.life / 0.6);
                ctx.fillStyle = `rgba(255, 220, 100, ${s_alpha * 0.7})`;
                ctx.beginPath();
                ctx.arc(s.x * cell_size, s.y * cell_size, s.size * cell_size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.save();
            ctx.shadowColor = 'rgba(255, 180, 50, 0.7)';
            ctx.shadowBlur = cell_size * 0.6;

            const orb_r = cell_size * 0.28;

            const glow_grad = ctx.createRadialGradient(
                ground_px, orb_py, orb_r * 0.3,
                ground_px, orb_py, orb_r * 2
            );
            glow_grad.addColorStop(0, 'rgba(255, 200, 80, 0.3)');
            glow_grad.addColorStop(1, 'rgba(255, 180, 50, 0)');
            ctx.fillStyle = glow_grad;
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 2, 0, Math.PI * 2);
            ctx.fill();

            const wobble = Math.sin(p.elapsed * 14) * 0.1 + 1;
            const rx = orb_r * 0.75 * wobble;
            const ry = orb_r * (2 - wobble) * 0.55 + orb_r * 0.45;

            const egg_grad = ctx.createRadialGradient(
                ground_px - rx * 0.15, orb_py - ry * 0.15, 0,
                ground_px, orb_py, Math.max(rx, ry)
            );
            egg_grad.addColorStop(0, 'rgba(255, 245, 220, 0.95)');
            egg_grad.addColorStop(0.35, 'rgba(255, 200, 80, 0.9)');
            egg_grad.addColorStop(0.7, 'rgba(220, 150, 40, 0.85)');
            egg_grad.addColorStop(1, 'rgba(180, 100, 20, 0.6)');

            ctx.fillStyle = egg_grad;
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx, ry, p.elapsed * 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255, 255, 240, 0.45)';
            ctx.beginPath();
            ctx.arc(ground_px - orb_r * 0.15, orb_py - orb_r * 0.2, orb_r * 0.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    clear() {
        this.projectiles = [];
        this.nests = [];
        this.mini_snakes = [];
        this.last_fire = 0;
    }
}
