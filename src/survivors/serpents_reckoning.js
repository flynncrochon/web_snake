import { play_grapple, play_devour, play_explosion } from '../audio/sound.js';

// Serpent's Reckoning — Evolution of Tongue Lash + Serpent's Reach
// Fires a long-range grapple tongue that latches onto a distant enemy,
// yanks it back toward the snake head, dealing damage to everything
// in the drag path. Pulled enemies pile up at the head, stunned briefly.

const GRAPPLE_RANGE = 14;
const COOLDOWN = 2200;
const GRAPPLE_DMG = 400;
const DRAG_DMG = 250;
const DRAG_WIDTH = 1.5;
const TONGUE_SPEED = 40;          // cells/sec — tongue fires out
const DRAG_PATH_SLOW = 1.0;
const PULL_TICK_INTERVAL = 0.10;  // seconds between grid-step pulls
const BITE_AOE_RADIUS = 3;        // cells — explosion radius around bite
const BITE_AOE_DMG = 500;
const BITE_ANIM_DURATION = 0.55;  // seconds — long enough to see the snap

export class SerpentsReckoning {
    constructor() {
        this.active = false;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.range_mult = 1;
        this.radius_mult = 1;
        this.extra_projectiles = 0;
        this.duration_mult = 1;
        this.fire_cooldown_mult = 1;
        this.last_fire = 0;
        this._curve_x = new Float64Array(128);
        this._curve_y = new Float64Array(128);
        this.pending_xp = 0;       // consumed XP for main loop to pick up
        this.tongues = [];
        this.bites = [];           // bite animations at head
    }

    get_tongue_count() {
        return 1 + this.extra_projectiles;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();
        const eff_range = GRAPPLE_RANGE * this.range_mult;

        // --- Fire new tongues ---
        if (now - this.last_fire >= COOLDOWN * this.fire_cooldown_mult) {
            const count = this.get_tongue_count();
            const targeted = new Set();

            // Cache query once for all tongues instead of querying per-tongue
            const enemies = enemy_manager.query_radius_array(hx, hy, eff_range);
            for (let i = 0; i < count; i++) {
                let best = null;
                let best_dist = 0;
                for (const e of enemies) {
                    if (targeted.has(e)) continue;
                    if (e._reckoning_stun > 0) continue;
                    const dx = e.x - hx;
                    const dy = e.y - hy;
                    const d = dx * dx + dy * dy;
                    if (d > best_dist) {
                        best_dist = d;
                        best = e;
                    }
                }

                if (best) {
                    targeted.add(best);
                    const tx = best.x;
                    const ty = best.y;
                    const dx = tx - hx;
                    const dy = ty - hy;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    this.tongues.push({
                        snake: snake,
                        phase: 'extend',
                        // Tip flies in absolute world coordinates
                        tip_x: hx,
                        tip_y: hy,
                        dir_x: dx / dist,
                        dir_y: dy / dist,
                        max_dist: dist,
                        traveled: 0,
                        target: best,
                        grabbed: false,
                        pull_accum: 0,
                        drag_hit_set: new Set(),
                        birth: now,
                    });
                }
            }

            if (targeted.size > 0) {
                play_grapple();
                this.last_fire = now;
                if (particles) {
                    const px = hx * cell_size;
                    const py = hy * cell_size;
                    particles.emit(px, py, 10, '#ff2266', 4);
                    particles.emit(px, py, 6, '#cc44ff', 3);
                }
            }
        }

        // --- Update active tongues ---
        const pull_tick_ms = PULL_TICK_INTERVAL * 1000;

        for (let i = this.tongues.length - 1; i >= 0; i--) {
            const t = this.tongues[i];
            const sh = t.snake.head;
            const shx = sh.x + 0.5;
            const shy = sh.y + 0.5;

            if (t.phase === 'extend') {
                // Tip advances in absolute world space — not relative to head
                t.traveled += TONGUE_SPEED * dt;
                t.tip_x += t.dir_x * TONGUE_SPEED * dt;
                t.tip_y += t.dir_y * TONGUE_SPEED * dt;

                if (t.target && t.target.alive) {
                    const dx = t.target.x - t.tip_x;
                    const dy = t.target.y - t.tip_y;
                    if (dx * dx + dy * dy < 1.5 * 1.5 || t.traveled >= t.max_dist + 2) {
                        t.phase = 'retract';
                        t.grabbed = true;
                        t.pull_accum = 0;
                        t.tip_x = t.target.x;
                        t.tip_y = t.target.y;

                        // Make grabbed enemy immune to all other damage during pull
                        t.target._reckoning_immune = true;

                        if (particles) {
                            const sx = t.target.x * cell_size;
                            const sy = t.target.y * cell_size;
                            particles.emit(sx, sy, 8, '#ff2266', 3);
                            particles.emit(sx, sy, 5, '#cc44ff', 2);
                        }
                    }
                } else {
                    t.phase = 'done';
                }

                if (t.traveled > eff_range + 3) {
                    t.phase = 'done';
                }

            } else if (t.phase === 'retract') {
                if (!t.target || !t.target.alive || !t.grabbed) {
                    if (t.target) t.target._reckoning_immune = false;
                    t.phase = 'done';
                    continue;
                }

                const e = t.target;

                // Suppress normal enemy movement
                e.pulled_until = now + pull_tick_ms * 2;

                // Grid-step pull toward snake head — cardinal only, like singularity mortar
                t.pull_accum += dt;
                if (t.pull_accum >= PULL_TICK_INTERVAL) {
                    t.pull_accum -= PULL_TICK_INTERVAL;

                    const eHead = e.segments[0];
                    const gdx = sh.x - eHead.x;
                    const gdy = sh.y - eHead.y;
                    const adx = Math.abs(gdx);
                    const ady = Math.abs(gdy);

                    // Close enough — arrived at snake head: DEVOUR
                    if (adx < 1.5 && ady < 1.5) {
                        // Remove immunity and devour — instakill + consume
                        e._reckoning_immune = false;
                        e.take_damage(Infinity);
                        play_devour();
                        this._handle_devour(e, t.snake, enemy_manager, particles, cell_size);

                        // Spawn bite animation
                        const bite_angle = Math.atan2(e.y - shy, e.x - shx);
                        this.bites.push({
                            x: shx,
                            y: shy,
                            angle: bite_angle,
                            elapsed: 0,
                            duration: BITE_ANIM_DURATION,
                        });

                        // AoE explosion around the bite — damage nearby enemies
                        play_explosion();
                        const aoe_r = BITE_AOE_RADIUS * this.radius_mult;
                        enemy_manager.query_radius(shx, shy, aoe_r, (other) => {
                            if (other === e) return;
                            const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                            const dmg = Math.round((is_crit ? BITE_AOE_DMG * 2 : BITE_AOE_DMG) * this.gorger_dmg_mult);
                            const dead = other.take_damage(dmg);

                            if (damage_numbers) {
                                damage_numbers.emit(other.x, other.y - other.radius, dmg, is_crit);
                            }
                            if (particles) {
                                const sx = other.x * cell_size;
                                const sy = other.y * cell_size;
                                particles.emit(sx, sy, 5, '#ff2266', 2);
                            }
                            if (dead) {
                                this._handle_kill(other, enemy_manager, arena, particles, cell_size);
                            }
                        });

                        // Big bite particles
                        if (particles) {
                            const sx = shx * cell_size;
                            const sy = shy * cell_size;
                            particles.emit(sx, sy, 15, '#ff2266', 5);
                            particles.emit(sx, sy, 10, '#cc44ff', 4);
                            particles.emit(sx, sy, 8, '#ffffff', 3);
                        }

                        t.phase = 'done';
                    } else {
                        // Compute visual interpolation for seamless blend
                        const elapsed_ms = now - e.last_tick_time;
                        const t_vis = Math.min(elapsed_ms / e.tick_rate, 1);

                        // Cardinal-only step (one axis at a time) — exactly like singularity mortar
                        let step_x = 0, step_y = 0;
                        if (adx > ady) {
                            step_x = Math.sign(gdx);
                        } else if (ady > adx) {
                            step_y = Math.sign(gdy);
                        } else {
                            if (Math.random() < 0.5) step_x = Math.sign(gdx);
                            else step_y = Math.sign(gdy);
                        }

                        const nx = eHead.x + step_x;
                        const ny = eHead.y + step_y;
                        if (nx < 0 || nx >= arena.size || ny < 0 || ny >= arena.size) {
                            e._reckoning_immune = false;
                            t.phase = 'done';
                        } else {
                            // Move body segments (back to front) — blend from current visual position
                            for (let si = e.segments.length - 1; si >= 1; si--) {
                                const seg = e.segments[si];
                                seg.prev_x = seg.prev_x + (seg.x - seg.prev_x) * t_vis;
                                seg.prev_y = seg.prev_y + (seg.y - seg.prev_y) * t_vis;
                                seg.x = e.segments[si - 1].x;
                                seg.y = e.segments[si - 1].y;
                            }

                            // Move head — blend from visual position
                            eHead.prev_x = eHead.prev_x + (eHead.x - eHead.prev_x) * t_vis;
                            eHead.prev_y = eHead.prev_y + (eHead.y - eHead.prev_y) * t_vis;
                            eHead.x = nx;
                            eHead.y = ny;

                            e.x = nx + 0.5;
                            e.y = ny + 0.5;
                            e.last_tick_time = now;
                            e.tick_rate = pull_tick_ms;

                            // Drag-path collision: damage enemies near current position
                            const drag_w = DRAG_WIDTH * this.radius_mult;
                            const drag_w_sq = drag_w * drag_w;
                            enemy_manager.query_radius(e.x, e.y, drag_w + 1, (other) => {
                                if (other === e) return;
                                if (t.drag_hit_set.has(other)) return;
                                const ox = other.x - e.x;
                                const oy = other.y - e.y;
                                if (ox * ox + oy * oy > drag_w_sq) return;

                                t.drag_hit_set.add(other);

                                const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                                const dmg = Math.round((is_crit ? DRAG_DMG * 2 : DRAG_DMG) * this.gorger_dmg_mult);
                                const dead = other.take_damage(dmg);

                                other._tongue_slow = DRAG_PATH_SLOW * this.duration_mult;
                                other._tongue_slow_factor = 0.3;

                                if (damage_numbers) {
                                    damage_numbers.emit(other.x, other.y - other.radius, dmg, is_crit);
                                }
                                if (particles) {
                                    const sx = other.x * cell_size;
                                    const sy = other.y * cell_size;
                                    particles.emit(sx, sy, 4, '#ff5588', 2);
                                    particles.emit(sx, sy, 3, '#cc44ff', 1.5);
                                }
                                if (dead) {
                                    this._handle_kill(other, enemy_manager, arena, particles, cell_size);
                                }
                            });

                            if (particles && Math.random() < 0.3) {
                                const sx = e.x * cell_size;
                                const sy = e.y * cell_size;
                                particles.emit(sx, sy, 2, '#ff88aa', 1.5);
                            }
                        }
                    }
                }
            }
        }

        // --- Update bite animations ---
        for (const b of this.bites) {
            b.elapsed += dt;
        }
        // In-place compaction
        {
            let w = 0;
            for (let r = 0; r < this.bites.length; r++) {
                if (this.bites[r].elapsed < this.bites[r].duration) this.bites[w++] = this.bites[r];
            }
            this.bites.length = w;
        }

        // --- Update stun timers ---
        for (const e of enemy_manager.enemies) {
            if (e._reckoning_stun > 0) {
                e._reckoning_stun -= dt;
                if (e._reckoning_stun <= 0) {
                    e._reckoning_stun = 0;
                }
            }
        }

        // In-place compaction
        {
            let w = 0;
            for (let r = 0; r < this.tongues.length; r++) {
                if (this.tongues[r].phase !== 'done') this.tongues[w++] = this.tongues[r];
            }
            this.tongues.length = w;
        }
    }

    // Devour: instakill at the head — directly consume fruit + XP, prevent splitter splitting
    _handle_devour(e, snake, enemy_manager, particles, cell_size) {
        // Prevent blue splitters from splitting
        e._split_done = true;

        // Directly feed the snake — growth + XP without dropping food on the ground
        snake.grow_pending++;
        // Store pending XP so the main loop picks it up (same pattern as consumption_beam)
        this.pending_xp = (this.pending_xp || 0) + 1;

        enemy_manager._try_drop_heart(Math.floor(e.x), Math.floor(e.y));
        enemy_manager.total_kills++;
        if (particles) {
            particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
        }
    }

    // Normal kill for AoE splash — drops food on ground, splitters still split
    _handle_kill(e, enemy_manager, arena, particles, cell_size) {
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

    render_with_head(ctx, cell_size, interp_hx, interp_hy) {
        if (!this.active) return;
        const now = performance.now();

        // Interpolated snake head in pixel space
        const head_px = interp_hx * cell_size;
        const head_py = interp_hy * cell_size;

        for (const t of this.tongues) {
            // Tongue tip — interpolated visual position
            let tx, ty;
            if (t.phase === 'retract' && t.target && t.target.alive) {
                // Use the enemy's interpolated visual position
                const e = t.target;
                const eHead = e.segments[0];
                const elapsed = now - e.last_tick_time;
                const t_vis = Math.min(elapsed / e.tick_rate, 1);
                const vis_x = eHead.prev_x + (eHead.x - eHead.prev_x) * t_vis + 0.5;
                const vis_y = eHead.prev_y + (eHead.y - eHead.prev_y) * t_vis + 0.5;
                tx = vis_x * cell_size;
                ty = vis_y * cell_size;
            } else {
                tx = t.tip_x * cell_size;
                ty = t.tip_y * cell_size;
            }

            const dx = tx - head_px;
            const dy = ty - head_py;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;

            const ndx = dx / len;
            const ndy = dy / len;
            const perp_x = -ndy;
            const perp_y = ndx;

            // --- Build S-curve tongue path ---
            const segments = Math.max(10, Math.floor(len / (cell_size * 0.3)));
            const wave_amp = cell_size * 0.15;
            const wave_freq = 4;
            const phase = now * 0.008 + (t.birth * 0.001);

            const crx = this._curve_x, cry = this._curve_y;
            for (let i = 0; i <= segments; i++) {
                const frac = i / segments;
                const bx = head_px + dx * frac;
                const by = head_py + dy * frac;
                const taper = Math.sin(frac * Math.PI);
                const wave = Math.sin(frac * wave_freq * Math.PI + phase) * wave_amp * taper;
                crx[i] = bx + perp_x * wave;
                cry[i] = by + perp_y * wave;
            }
            const seg_count = segments + 1;

            const _tracePath = () => {
                ctx.beginPath();
                ctx.moveTo(crx[0], cry[0]);
                for (let i = 1; i < seg_count; i++) ctx.lineTo(crx[i], cry[i]);
            };

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // --- Outer glow (layered transparency instead of shadowBlur) ---
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = 'rgba(200, 50, 120, 0.3)';
            ctx.lineWidth = cell_size * 0.6;
            _tracePath(); ctx.stroke();

            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = '#aa2266';
            ctx.lineWidth = cell_size * 0.4;
            _tracePath(); ctx.stroke();

            // --- Main tongue body (red-pink) ---
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = '#dd3366';
            ctx.lineWidth = cell_size * 0.18;
            _tracePath(); ctx.stroke();

            // --- Bright core ---
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#ffaacc';
            ctx.lineWidth = cell_size * 0.05;
            _tracePath(); ctx.stroke();

            // --- Forked tip ---
            const tip_x = crx[seg_count - 1], tip_y = cry[seg_count - 1];
            const pretip_idx = Math.max(0, seg_count - 3);
            const pretip_x = crx[pretip_idx], pretip_y = cry[pretip_idx];
            const tip_angle = Math.atan2(tip_y - pretip_y, tip_x - pretip_x);
            const fork_len = cell_size * 0.5;
            const fork_spread = 0.4;

            ctx.lineCap = 'round';

            // Glow layer for fork
            ctx.strokeStyle = 'rgba(255, 50, 100, 0.2)';
            ctx.lineWidth = cell_size * 0.2;
            ctx.beginPath();
            ctx.moveTo(tip_x, tip_y);
            ctx.lineTo(
                tip_x + Math.cos(tip_angle - fork_spread) * fork_len,
                tip_y + Math.sin(tip_angle - fork_spread) * fork_len
            );
            ctx.moveTo(tip_x, tip_y);
            ctx.lineTo(
                tip_x + Math.cos(tip_angle + fork_spread) * fork_len,
                tip_y + Math.sin(tip_angle + fork_spread) * fork_len
            );
            ctx.stroke();

            // Main fork
            ctx.strokeStyle = '#dd3366';
            ctx.lineWidth = cell_size * 0.1;
            ctx.beginPath();
            ctx.moveTo(tip_x, tip_y);
            ctx.lineTo(
                tip_x + Math.cos(tip_angle - fork_spread) * fork_len,
                tip_y + Math.sin(tip_angle - fork_spread) * fork_len
            );
            ctx.moveTo(tip_x, tip_y);
            ctx.lineTo(
                tip_x + Math.cos(tip_angle + fork_spread) * fork_len,
                tip_y + Math.sin(tip_angle + fork_spread) * fork_len
            );
            ctx.stroke();

            // --- Glow on grabbed target (concentric circles) ---
            if (t.grabbed && t.target && t.target.alive) {
                const pulse = 0.5 + Math.sin(now * 0.012) * 0.5;
                const glow_r = cell_size * 0.6 * (0.7 + pulse * 0.3);
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                ctx.arc(tx, ty, glow_r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 50, 100, 0.08)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tx, ty, glow_r * 0.55, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(221, 51, 102, 0.18)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tx, ty, glow_r * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 170, 204, 0.45)';
                ctx.fill();
            }

            // --- Impact glow at head during retract (concentric circles) ---
            if (t.phase === 'retract') {
                const pulse = 0.5 + Math.sin(now * 0.015) * 0.5;
                const r = cell_size * 0.35 * (0.6 + pulse * 0.4);
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(head_px, head_py, r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 50, 100, 0.1)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(head_px, head_py, r * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 136, 187, 0.4)';
                ctx.fill();
            }
        }

        // --- Render bite animations ---
        for (const b of this.bites) {
            const t = b.elapsed / b.duration;
            if (t >= 1) continue;

            const bx = b.x * cell_size;
            const by = b.y * cell_size;

            // --- Shockwave ring ---
            const ring_r = BITE_AOE_RADIUS * cell_size * t;
            const ring_alpha = (1 - t) * 0.5;
            // Glow ring layer
            ctx.strokeStyle = `rgba(255, 255, 255, ${ring_alpha * 0.2})`;
            ctx.lineWidth = cell_size * 0.3 * (1 - t);
            ctx.beginPath();
            ctx.arc(bx, by, ring_r, 0, Math.PI * 2);
            ctx.stroke();
            // Main ring
            ctx.strokeStyle = `rgba(255, 255, 255, ${ring_alpha})`;
            ctx.lineWidth = cell_size * 0.12 * (1 - t);
            ctx.beginPath();
            ctx.arc(bx, by, ring_r, 0, Math.PI * 2);
            ctx.stroke();

            // --- White flash on impact (concentric circles) ---
            if (t < 0.25) {
                const flash_t = t / 0.25;
                const flash_alpha = (1 - flash_t) * 0.7;
                const flash_r = cell_size * 3.5 * flash_t;
                ctx.beginPath();
                ctx.arc(bx, by, flash_r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${flash_alpha * 0.06})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(bx, by, flash_r * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 240, 245, ${flash_alpha * 0.2})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(bx, by, flash_r * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${flash_alpha * 0.5})`;
                ctx.fill();
            }

            // --- Big white jaws snapping shut (top & bottom) ---
            // Jaw opens wide then clamps down hard
            const jaw_len = cell_size * 3.0;       // long fangs
            const jaw_thick = cell_size * 0.9;      // jaw height/thickness
            let jaw_open;                            // radians — half-angle each jaw rotates
            if (t < 0.15) {
                // Snap shut — fast ease-out
                const st = t / 0.15;
                jaw_open = (1 - st * st) * 1.1;     // starts ~63° open each side
            } else if (t < 0.45) {
                // Clamped shut — tiny overshoot bounce
                const bt = (t - 0.15) / 0.3;
                jaw_open = -0.05 * Math.sin(bt * Math.PI); // slight clench past closed
            } else {
                // Slowly drift open as it fades
                const ot = (t - 0.45) / 0.55;
                jaw_open = ot * ot * 0.4;
            }
            const jaw_alpha = t < 0.45 ? 0.95 : 0.95 * Math.max(0, 1 - (t - 0.45) / 0.55);

            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(b.angle);

            // --- Upper jaw (curves upward then tapers to a fang point) ---
            ctx.save();
            ctx.rotate(-jaw_open);
            ctx.fillStyle = `rgba(255, 255, 255, ${jaw_alpha})`;
            ctx.beginPath();
            ctx.moveTo(-cell_size * 0.4, 0);                               // hinge (back of jaw)
            ctx.quadraticCurveTo(jaw_len * 0.3, -jaw_thick * 0.8,          // curves up
                                 jaw_len * 0.6, -jaw_thick);               // widest point
            ctx.quadraticCurveTo(jaw_len * 0.85, -jaw_thick * 0.6,         // tapers toward tip
                                 jaw_len, 0);                              // sharp fang tip
            ctx.closePath();
            ctx.fill();
            // Edge highlight
            ctx.strokeStyle = `rgba(200, 200, 210, ${jaw_alpha * 0.5})`;
            ctx.lineWidth = cell_size * 0.04;
            ctx.stroke();
            ctx.restore();

            // --- Lower jaw (mirror of upper) ---
            ctx.save();
            ctx.rotate(jaw_open);
            ctx.fillStyle = `rgba(255, 255, 255, ${jaw_alpha})`;
            ctx.beginPath();
            ctx.moveTo(-cell_size * 0.4, 0);                               // hinge
            ctx.quadraticCurveTo(jaw_len * 0.3, jaw_thick * 0.8,           // curves down
                                 jaw_len * 0.6, jaw_thick);                // widest
            ctx.quadraticCurveTo(jaw_len * 0.85, jaw_thick * 0.6,          // tapers
                                 jaw_len, 0);                              // fang tip
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = `rgba(200, 200, 210, ${jaw_alpha * 0.5})`;
            ctx.lineWidth = cell_size * 0.04;
            ctx.stroke();
            ctx.restore();

            // --- Teeth along the inner edge of each jaw ---
            if (jaw_alpha > 0.1) {
                const tooth_count = 5;
                ctx.fillStyle = `rgba(255, 255, 255, ${jaw_alpha * 0.9})`;
                for (let ti = 0; ti < tooth_count; ti++) {
                    const frac = 0.15 + (ti / tooth_count) * 0.65;
                    const tooth_x = jaw_len * frac;
                    const tooth_h = cell_size * 0.25 * (1 - frac * 0.5);
                    // Upper teeth (pointing down)
                    ctx.save();
                    ctx.rotate(-jaw_open);
                    ctx.beginPath();
                    ctx.moveTo(tooth_x - tooth_h * 0.4, 0);
                    ctx.lineTo(tooth_x, tooth_h);
                    ctx.lineTo(tooth_x + tooth_h * 0.4, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    // Lower teeth (pointing up)
                    ctx.save();
                    ctx.rotate(jaw_open);
                    ctx.beginPath();
                    ctx.moveTo(tooth_x - tooth_h * 0.4, 0);
                    ctx.lineTo(tooth_x, -tooth_h);
                    ctx.lineTo(tooth_x + tooth_h * 0.4, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }

            // --- Impact sparks burst outward when jaws clamp ---
            if (t > 0.1 && t < 0.35) {
                const spark_alpha = (1 - (t - 0.1) / 0.25) * 0.9;
                const spark_count = 10;
                ctx.fillStyle = `rgba(255, 255, 255, ${spark_alpha})`;
                for (let s = 0; s < spark_count; s++) {
                    const sa = (s / spark_count) * Math.PI * 2 + b.elapsed * 6;
                    const sr = cell_size * (0.5 + (t - 0.1) * 6);
                    const sx = Math.cos(sa) * sr + jaw_len * 0.4;
                    const sy = Math.sin(sa) * sr;
                    ctx.beginPath();
                    ctx.arc(sx, sy, cell_size * 0.08, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    clear() {
        this.tongues = [];
        this.bites = [];
        this.last_fire = 0;
    }
}
