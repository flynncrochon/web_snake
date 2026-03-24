import { play_mortar_launch, play_summon, play_summon_hit } from '../audio/sound.js';

const NEST_RANGE = 12;
const NEST_RANGE_SQ = NEST_RANGE * NEST_RANGE;
const HYDRA_COOLDOWN = 5500;
const FLIGHT_DURATION = 0.75;
const ARC_HEIGHT = 6;
const MAX_TRAIL = 30;
const HATCH_DURATION = 0.5;

// Two-headed hydra snakes
const HYDRA_LENGTH = 5;
const HYDRA_TICK_RATE = 80;
const HYDRA_MAX_TICKS = 70;
const HYDRA_SPAWN_COUNT = 3;
const HYDRA_DAMAGE = 100;

// Headless brood snakes (from split)
const BROOD_LENGTH = 3;
const BROOD_TICK_RATE = 70;
const BROOD_MAX_TICKS = 50;
const BROOD_DAMAGE = 60;

const HEAD_FORK_ANGLE = 0.4;
const HEAD_FORK_DIST = 0.35;
const MAX_HYDRA_SNAKES = 20;
const MAX_BROOD_SNAKES = 30;

export class HydraBrood {
    constructor() {
        this.active = false;
        this.projectiles = [];
        this.nests = [];
        this.hydra_snakes = [];
        this.brood_snakes = [];
        this.last_fire = 0;
        this.duration_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire egg at densest cluster ---
        if (now - this.last_fire >= HYDRA_COOLDOWN * this.fire_cooldown_mult) {
            const hydra_range = NEST_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, hydra_range);

            let best = null;
            let best_score = -1;
            // Fisher-Yates partial shuffle: O(12) instead of O(n log n) sort
            const sample_count = Math.min(12, candidates.length);
            for (let i = 0; i < sample_count; i++) {
                const j = i + Math.floor(Math.random() * (candidates.length - i));
                const tmp = candidates[i];
                candidates[i] = candidates[j];
                candidates[j] = tmp;
            }
            const sample = candidates.length <= 12 ? candidates
                : candidates.slice(0, 12);

            for (const e of sample) {
                const score = 1 + enemy_manager.query_count(e.x, e.y, 4, e);
                if (score > best_score) {
                    best_score = score;
                    best = e;
                }
            }

            if (best) {
                this.projectiles.push({
                    start_x: hx, start_y: hy,
                    target_x: best.x, target_y: best.y,
                    elapsed: 0, duration: FLIGHT_DURATION,
                    trail: [], sparks: [],
                });
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
            const height = ARC_HEIGHT * 4 * t * (1 - t);

            p.trail.push({ x: gx, y: gy - height });
            if (p.trail.length > MAX_TRAIL) p.trail.shift();

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
                if (s.life <= 0) {
                    p.sparks[j] = p.sparks[p.sparks.length - 1];
                    p.sparks.length--;
                }
            }

            if (t >= 1) {
                this.nests.push({
                    x: p.target_x, y: p.target_y,
                    elapsed: 0, hatched: false,
                    ring_alpha: 1.0, ring_radius: 0,
                });
                if (particles) {
                    const px = p.target_x * cell_size;
                    const py = p.target_y * cell_size;
                    particles.emit(px, py, 15, '#aa66ff', 5);
                    particles.emit(px, py, 10, '#66ff88', 3);
                }
                this.projectiles.splice(i, 1);
            }
        }

        // --- Update nests (hatching) ---
        for (let i = this.nests.length - 1; i >= 0; i--) {
            const nest = this.nests[i];
            nest.elapsed += dt;
            nest.ring_radius += dt * 6;
            nest.ring_alpha = Math.max(0, 1 - nest.elapsed / 0.8);

            if (!nest.hatched && nest.elapsed >= HATCH_DURATION) {
                nest.hatched = true;
                const grid_x = Math.floor(nest.x);
                const grid_y = Math.floor(nest.y);
                const dirs = [
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
                ];

                for (let j = 0; j < HYDRA_SPAWN_COUNT && this.hydra_snakes.length < MAX_HYDRA_SNAKES; j++) {
                    const dir = dirs[j % dirs.length];
                    const sx = Math.max(0, Math.min(arena.size - 1, grid_x + dir.dx * (Math.floor(j / 4) + 1)));
                    const sy = Math.max(0, Math.min(arena.size - 1, grid_y + dir.dy * (Math.floor(j / 4) + 1)));
                    const segments = [];
                    for (let k = 0; k < HYDRA_LENGTH; k++) {
                        segments.push({ x: sx, y: sy, prev_x: sx, prev_y: sy });
                    }
                    this.hydra_snakes.push({
                        segments, direction: { ...dir },
                        alive: true, damage: HYDRA_DAMAGE,
                        ticks_lived: 0, last_tick_time: now,
                        wander_ticks: 3 + Math.floor(Math.random() * 5),
                    });
                }

                play_summon();
                if (particles) {
                    const px = nest.x * cell_size;
                    const py = nest.y * cell_size;
                    particles.emit(px, py, 20, '#9955dd', 4);
                    particles.emit(px, py, 12, '#44ee66', 3);
                }
            }

            if (nest.elapsed > 1.2) this.nests.splice(i, 1);
        }

        // --- Tick hydra snakes ---
        for (let i = this.hydra_snakes.length - 1; i >= 0; i--) {
            const ms = this.hydra_snakes[i];
            if (!ms.alive) continue;

            if (ms.ticks_lived >= Math.round(HYDRA_MAX_TICKS * this.duration_mult)) {
                // Split into 2 brood snakes
                const hd = ms.segments[0];
                const perp1 = { dx: ms.direction.dy || 1, dy: -ms.direction.dx };
                const perp2 = { dx: -(ms.direction.dy || 1), dy: ms.direction.dx };

                for (const dir of [perp1, perp2]) {
                    if (this.brood_snakes.length >= MAX_BROOD_SNAKES) break;
                    const bx = Math.max(0, Math.min(arena.size - 1, hd.x));
                    const by = Math.max(0, Math.min(arena.size - 1, hd.y));
                    const segs = [];
                    for (let k = 0; k < BROOD_LENGTH; k++) {
                        segs.push({ x: bx, y: by, prev_x: bx, prev_y: by });
                    }
                    this.brood_snakes.push({
                        segments: segs, direction: { ...dir },
                        alive: true, damage: BROOD_DAMAGE,
                        ticks_lived: 0, last_tick_time: now,
                        wander_ticks: 2 + Math.floor(Math.random() * 4),
                    });
                }

                if (particles) {
                    const px = (hd.x + 0.5) * cell_size;
                    const py = (hd.y + 0.5) * cell_size;
                    particles.emit(px, py, 10, '#aa66ff', 3);
                    particles.emit(px, py, 6, '#66ff88', 2);
                }
                ms.alive = false;
                continue;
            }

            this._tick_snake(ms, HYDRA_TICK_RATE, enemy_manager, arena, particles, cell_size, damage_numbers, now);
        }
        // Compact dead hydra snakes
        { let w = 0; for (let r = 0; r < this.hydra_snakes.length; r++) { if (this.hydra_snakes[r].alive) this.hydra_snakes[w++] = this.hydra_snakes[r]; } this.hydra_snakes.length = w; }

        // --- Tick brood snakes ---
        for (let i = this.brood_snakes.length - 1; i >= 0; i--) {
            const ms = this.brood_snakes[i];
            if (!ms.alive) continue;

            if (ms.ticks_lived >= Math.round(BROOD_MAX_TICKS * this.duration_mult)) {
                if (particles) {
                    for (const seg of ms.segments) {
                        particles.emit((seg.x + 0.5) * cell_size, (seg.y + 0.5) * cell_size, 2, '#8855bb', 2);
                    }
                }
                ms.alive = false;
                continue;
            }

            this._tick_snake(ms, BROOD_TICK_RATE, enemy_manager, arena, particles, cell_size, damage_numbers, now);
        }
        // Compact dead brood snakes
        { let w = 0; for (let r = 0; r < this.brood_snakes.length; r++) { if (this.brood_snakes[r].alive) this.brood_snakes[w++] = this.brood_snakes[r]; } this.brood_snakes.length = w; }
    }

    _tick_snake(ms, tick_rate, enemy_manager, arena, particles, cell_size, damage_numbers, now) {
        if (now - ms.last_tick_time < tick_rate) return;
        ms.last_tick_time += tick_rate;
        if (now - ms.last_tick_time > tick_rate) {
            ms.last_tick_time = now;
        }
        ms.ticks_lived++;

        const hd = ms.segments[0];

        // Early ticks: wander in spawn direction to spread out, then pure pathfinding
        if (ms.ticks_lived > ms.wander_ticks) {
            // Pure pathfinding — chase nearest enemy
            const nearest = enemy_manager.query_nearest(hd.x + 0.5, hd.y + 0.5, 30);

            if (nearest) {
                const dx = nearest.x - (hd.x + 0.5);
                const dy = nearest.y - (hd.y + 0.5);
                if (Math.abs(dx) >= Math.abs(dy)) {
                    const want = { dx: Math.sign(dx) || 1, dy: 0 };
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
        }
        // else: keep initial spawn direction during wander phase

        const next_x = hd.x + ms.direction.dx;
        const next_y = hd.y + ms.direction.dy;

        if (next_x < 0 || next_x >= arena.size || next_y < 0 || next_y >= arena.size) {
            ms.direction.dx = -ms.direction.dx;
            ms.direction.dy = -ms.direction.dy;
            return;
        }

        for (let k = ms.segments.length - 1; k >= 1; k--) {
            const seg = ms.segments[k];
            seg.prev_x = seg.x; seg.prev_y = seg.y;
            seg.x = ms.segments[k - 1].x; seg.y = ms.segments[k - 1].y;
        }
        hd.prev_x = hd.x; hd.prev_y = hd.y;
        hd.x = next_x; hd.y = next_y;

        // Collision with enemies
        const head_cx = next_x + 0.5;
        const head_cy = next_y + 0.5;
        enemy_manager.query_radius(head_cx, head_cy, 1.0, (e) => {
            const edx = e.x - head_cx;
            const edy = e.y - head_cy;
            const dist = Math.sqrt(edx * edx + edy * edy);
            if (dist < e.radius + 0.45) {
                const dead = e.take_damage(ms.damage);
                play_summon_hit();
                if (damage_numbers) damage_numbers.emit(e.x, e.y - e.radius, ms.damage, false);
                if (particles) {
                    const px = e.x * cell_size;
                    const py = e.y * cell_size;
                    particles.emit(px, py, 5, '#9955dd', 3);
                    particles.emit(px, py, 3, '#66ff88', 2);
                }
                if (dead) {
                    const fx = Math.floor(e.x);
                    const fy = Math.floor(e.y);
                    if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                        arena.food.push({ x: fx, y: fy });
                        enemy_manager._try_drop_heart(fx, fy);
                    }
                    enemy_manager.total_kills++;
                    if (particles) particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                } else {
                    const k_dist = Math.max(0.01, dist);
                    e.x += (edx / k_dist) * 1.5;
                    e.y += (edy / k_dist) * 1.5;
                }
            }
        });
    }

    // --- Render nests (hatching animation) ---
    render_nests(ctx, cell_size) {
        for (const nest of this.nests) {
            const px = nest.x * cell_size;
            const py = nest.y * cell_size;

            if (nest.ring_alpha > 0) {
                ctx.strokeStyle = `rgba(160, 100, 255, ${nest.ring_alpha * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, py, nest.ring_radius * cell_size, 0, Math.PI * 2);
                ctx.stroke();
            }

            const hatch_t = Math.min(nest.elapsed / HATCH_DURATION, 1);

            if (hatch_t < 1) {
                const pulse = 1 + Math.sin(nest.elapsed * 20) * 0.15;
                const r = cell_size * 0.4 * pulse;

                // Glow (layered circles)
                const glow_a = 0.4 * (1 - hatch_t);
                ctx.beginPath();
                ctx.arc(px, py, r * 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(130, 160, 193, ${(glow_a * 0.25).toFixed(3)})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, r * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(160, 120, 255, ${(glow_a * 0.5).toFixed(3)})`;
                ctx.fill();

                // Egg orb (layered ellipses)
                ctx.fillStyle = 'rgba(60, 160, 80, 0.7)';
                ctx.beginPath();
                ctx.ellipse(px, py, r * 0.8, r, nest.elapsed * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(140, 80, 220, 0.9)';
                ctx.beginPath();
                ctx.ellipse(px, py, r * 0.5, r * 0.6, nest.elapsed * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(220, 200, 255, 0.95)';
                ctx.beginPath();
                ctx.ellipse(px, py, r * 0.2, r * 0.25, nest.elapsed * 2, 0, Math.PI * 2);
                ctx.fill();

                if (hatch_t > 0.3) {
                    const crack_alpha = (hatch_t - 0.3) / 0.7;
                    ctx.strokeStyle = `rgba(160, 100, 255, ${crack_alpha})`;
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

            } else {
                const fade = Math.max(0, 1 - (nest.elapsed - HATCH_DURATION) / 0.7);
                if (fade > 0) {
                    ctx.strokeStyle = `rgba(160, 100, 255, ${fade * 0.4})`;
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
            const height = ARC_HEIGHT * 4 * t * (1 - t);

            const ground_px = gx * cell_size;
            const ground_py = gy * cell_size;
            const orb_py = (gy - height) * cell_size;

            // Shadow
            const height_ratio = height / ARC_HEIGHT;
            const shadow_scale = 1 - height_ratio * 0.5;
            const shadow_alpha = 0.1 + (1 - height_ratio) * 0.15;
            ctx.fillStyle = `rgba(120, 80, 200, ${shadow_alpha})`;
            ctx.beginPath();
            ctx.ellipse(ground_px, ground_py,
                cell_size * 0.6 * shadow_scale,
                cell_size * 0.3 * shadow_scale,
                0, 0, Math.PI * 2);
            ctx.fill();

            // Trail
            if (p.trail.length >= 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < p.trail.length; i++) {
                    const frac = i / (p.trail.length - 1);
                    const a = frac * frac * 0.5;
                    const w = frac * cell_size * 0.22;
                    ctx.strokeStyle = `rgba(160, 100, 255, ${a})`;
                    ctx.lineWidth = Math.max(0.5, w);
                    ctx.beginPath();
                    ctx.moveTo(p.trail[i - 1].x * cell_size, p.trail[i - 1].y * cell_size);
                    ctx.lineTo(p.trail[i].x * cell_size, p.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // Sparks
            for (const s of p.sparks) {
                const s_alpha = Math.max(0, s.life / 0.6);
                ctx.fillStyle = `rgba(180, 140, 255, ${s_alpha * 0.7})`;
                const sr = s.size * cell_size;
                ctx.fillRect(s.x * cell_size - sr, s.y * cell_size - sr, sr * 2, sr * 2);
            }

            // Egg orb — purple-green (layered circles)
            const orb_r = cell_size * 0.28;

            // Glow halo
            ctx.fillStyle = 'rgba(140, 80, 255, 0.15)';
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(160, 120, 255, 0.08)';
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(160, 120, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(ground_px, orb_py, orb_r * 1.2, 0, Math.PI * 2);
            ctx.fill();

            const wobble = Math.sin(p.elapsed * 14) * 0.1 + 1;
            const rx = orb_r * 0.75 * wobble;
            const ry = orb_r * (2 - wobble) * 0.55 + orb_r * 0.45;

            // Egg body (layered ellipses)
            ctx.fillStyle = 'rgba(40, 120, 60, 0.6)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx, ry, p.elapsed * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(80, 180, 100, 0.85)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.7, ry * 0.7, p.elapsed * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(160, 100, 220, 0.9)';
            ctx.beginPath();
            ctx.ellipse(ground_px, orb_py, rx * 0.4, ry * 0.4, p.elapsed * 4, 0, Math.PI * 2);
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(ground_px - orb_r * 0.15, orb_py - orb_r * 0.2, orb_r * 0.18, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Render both hydra snakes and brood snakes ---
    render_snakes(ctx, cell_size) {
        // Hydra snakes (two-headed, purple-green gradient)
        this._render_hydra_snakes(ctx, cell_size);

        // Brood snakes (headless, muted purple)
        this._render_brood_snakes(ctx, cell_size);
    }

    _render_hydra_snakes(ctx, cell_size) {
        const seg_size = Math.ceil(cell_size * 0.38);
        const half = seg_size / 2;
        const pad = 1;
        const now = performance.now();

        for (const ms of this.hydra_snakes) {
            if (!ms.alive) continue;

            const segs = ms.segments;
            const ms_elapsed = now - ms.last_tick_time;
            const ms_raw = Math.min(ms_elapsed / HYDRA_TICK_RATE, 1);
            const ms_t = ms_raw;

            // Fade
            const remaining = Math.round(HYDRA_MAX_TICKS * this.duration_mult) - ms.ticks_lived;
            let alpha = 1;
            if (remaining < 8) alpha = remaining / 8;
            if (ms.ticks_lived < 3) alpha = Math.min(alpha, (ms.ticks_lived + ms_raw) / 3);

            ctx.globalAlpha = alpha;

            // Compute interpolated positions
            const positions = [];
            for (const seg of segs) {
                const px = (seg.prev_x + (seg.x - seg.prev_x) * ms_t + 0.5) * cell_size;
                const py = (seg.prev_y + (seg.y - seg.prev_y) * ms_t + 0.5) * cell_size;
                positions.push({ x: px, y: py });
            }

            // Draw body segments — solid purple
            ctx.fillStyle = '#9944dd';

            for (let k = 0; k < segs.length - 1; k++) {
                const a = positions[k];
                const b_pos = positions[k + 1];
                const cx = (segs[k].prev_x + 0.5) * cell_size;
                const cy = (segs[k].prev_y + 0.5) * cell_size;
                const x1 = Math.min(a.x, cx) - half - pad;
                const y1 = Math.min(a.y, cy) - half - pad;
                ctx.fillRect(x1, y1,
                    Math.max(a.x, cx) - Math.min(a.x, cx) + seg_size + pad * 2,
                    Math.max(a.y, cy) - Math.min(a.y, cy) + seg_size + pad * 2);

                const x2 = Math.min(b_pos.x, cx) - half - pad;
                const y2 = Math.min(b_pos.y, cy) - half - pad;
                ctx.fillRect(x2, y2,
                    Math.max(b_pos.x, cx) - Math.min(b_pos.x, cx) + seg_size + pad * 2,
                    Math.max(b_pos.y, cy) - Math.min(b_pos.y, cy) + seg_size + pad * 2);
            }

            for (const pos of positions) {
                ctx.fillRect(pos.x - half, pos.y - half, seg_size, seg_size);
            }

            // Draw two forked heads — bigger and further out so they're visible
            const head_pos = positions[0];
            const move_angle = Math.atan2(ms.direction.dy, ms.direction.dx);
            const fork_dist = cell_size * 0.55;
            const head_r = cell_size * 0.24;

            for (const sign of [-1, 1]) {
                const fork_angle = move_angle + 0.55 * sign;
                const hx = head_pos.x + Math.cos(fork_angle) * fork_dist;
                const hy = head_pos.y + Math.sin(fork_angle) * fork_dist;

                // Neck line
                ctx.strokeStyle = '#bb66ee';
                ctx.lineWidth = cell_size * 0.16;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(head_pos.x, head_pos.y);
                ctx.lineTo(hx, hy);
                ctx.stroke();

                // Diamond snake head — pointed forward
                const perp = fork_angle + Math.PI / 2;
                const tip = head_r * 1.3;   // front point length
                const side = head_r * 0.7;  // side width
                const back = head_r * 0.5;  // rear taper

                ctx.fillStyle = '#9944dd';
                ctx.beginPath();
                ctx.moveTo(hx + Math.cos(fork_angle) * tip, hy + Math.sin(fork_angle) * tip);           // front tip
                ctx.lineTo(hx + Math.cos(perp) * side, hy + Math.sin(perp) * side);                     // left wide
                ctx.lineTo(hx - Math.cos(fork_angle) * back, hy - Math.sin(fork_angle) * back);         // rear
                ctx.lineTo(hx - Math.cos(perp) * side, hy - Math.sin(perp) * side);                     // right wide
                ctx.closePath();
                ctx.fill();

                // Eyes — set back from the tip
                const eye_back = head_r * 0.15;
                const eye_off = head_r * 0.35;
                const eye_cx = hx + Math.cos(fork_angle) * eye_back;
                const eye_cy = hy + Math.sin(fork_angle) * eye_back;
                const eye_r = head_r * 0.2;
                ctx.fillStyle = '#44ff88';
                ctx.beginPath();
                ctx.arc(eye_cx + Math.cos(perp) * eye_off, eye_cy + Math.sin(perp) * eye_off, eye_r, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(eye_cx - Math.cos(perp) * eye_off, eye_cy - Math.sin(perp) * eye_off, eye_r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
    }

    _render_brood_snakes(ctx, cell_size) {
        const seg_size = Math.ceil(cell_size * 0.3);
        const half = seg_size / 2;
        const pad = 1;
        const color = '#8855bb';
        const now = performance.now();

        for (const ms of this.brood_snakes) {
            if (!ms.alive) continue;

            const segs = ms.segments;
            const ms_elapsed = now - ms.last_tick_time;
            const ms_raw = Math.min(ms_elapsed / BROOD_TICK_RATE, 1);
            const ms_t = ms_raw;

            const remaining = Math.round(BROOD_MAX_TICKS * this.duration_mult) - ms.ticks_lived;
            let alpha = 1;
            if (remaining < 8) alpha = remaining / 8;
            if (ms.ticks_lived < 3) alpha = Math.min(alpha, (ms.ticks_lived + ms_raw) / 3);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;

            const positions = [];
            for (const seg of segs) {
                const px = (seg.prev_x + (seg.x - seg.prev_x) * ms_t + 0.5) * cell_size;
                const py = (seg.prev_y + (seg.y - seg.prev_y) * ms_t + 0.5) * cell_size;
                positions.push({ x: px, y: py });
            }

            // Connections
            for (let k = 0; k < segs.length - 1; k++) {
                const a = positions[k];
                const b = positions[k + 1];
                const cx = (segs[k].prev_x + 0.5) * cell_size;
                const cy = (segs[k].prev_y + 0.5) * cell_size;
                const x1 = Math.min(a.x, cx) - half - pad;
                const y1 = Math.min(a.y, cy) - half - pad;
                ctx.fillRect(x1, y1,
                    Math.max(a.x, cx) - Math.min(a.x, cx) + seg_size + pad * 2,
                    Math.max(a.y, cy) - Math.min(a.y, cy) + seg_size + pad * 2);

                const x2 = Math.min(b.x, cx) - half - pad;
                const y2 = Math.min(b.y, cy) - half - pad;
                ctx.fillRect(x2, y2,
                    Math.max(b.x, cx) - Math.min(b.x, cx) + seg_size + pad * 2,
                    Math.max(b.y, cy) - Math.min(b.y, cy) + seg_size + pad * 2);
            }

            // Segments (no special head — just uniform body)
            for (const pos of positions) {
                ctx.fillRect(pos.x - half, pos.y - half, seg_size, seg_size);
            }
        }

        ctx.globalAlpha = 1;
    }

    clear() {
        this.projectiles = [];
        this.nests = [];
        this.hydra_snakes = [];
        this.brood_snakes = [];
        this.last_fire = 0;
    }
}
