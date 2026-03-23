const SHATTER_RANGE = 12;
const SHATTER_RANGE_SQ = SHATTER_RANGE * SHATTER_RANGE;
const SHATTER_COOLDOWN = 3000;
const SHATTER_SPEED = 22;
const SHATTER_LIFETIME = 0.9;
const SHATTER_TURN_SPEED = 14;
const SHATTER_RADIUS = 0.2;
const SHATTER_DAMAGE = 250;
const SHATTER_BOUNCE_RADIUS = 6;
const SHATTER_MAX_BOUNCES = 6;

// Splinter constants
const SPLINTER_DAMAGE_MULT = 0.5;     // splinters deal 50% of parent damage
const SPLINTER_SPEED = 26;
const SPLINTER_LIFETIME = 0.6;
const SPLINTER_RADIUS = 0.14;
const SPLINTER_COUNT = 3;             // splinters per shatter
const MAX_GENERATION = 3;             // max depth of crit-splits (0=main, 1=splinter, 2=sub-splinter, 3=final)
const MAX_ACTIVE_FANGS = 60;          // hard cap to prevent lag

export class ShatterFang {
    constructor() {
        this.active = false;
        this.fangs = [];
        this.last_fire = 0;
        this.extra_projectiles = 0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.duration_mult = 1;
        this.radius_mult = 1;
        this.range_mult = 1;
        this.fire_cooldown_mult = 1;
    }

    get_fang_count() {
        return 1 + this.extra_projectiles;
    }

    get_bounce_radius() {
        return SHATTER_BOUNCE_RADIUS * this.radius_mult;
    }

    _find_nearest(x, y, enemy_manager, exclude_set, radius_sq) {
        return enemy_manager.query_nearest(x, y, Math.sqrt(radius_sq), exclude_set);
    }

    _spawn_splinters(parent, enemy_manager) {
        if (parent.generation >= MAX_GENERATION) return;
        if (this.fangs.length >= MAX_ACTIVE_FANGS) return;

        const br = this.get_bounce_radius();
        const br_sq = br * br;
        const count = Math.min(SPLINTER_COUNT, MAX_ACTIVE_FANGS - this.fangs.length);

        // Gather nearby targets for splinters
        const targets = [];
        enemy_manager.query_radius(parent.x, parent.y, br, (e) => {
            if (!parent.hit_ids.has(e)) targets.push(e);
        });
        targets.sort((a, b) => {
            const da = (a.x - parent.x) ** 2 + (a.y - parent.y) ** 2;
            const db = (b.x - parent.x) ** 2 + (b.y - parent.y) ** 2;
            return da - db;
        });

        for (let i = 0; i < count; i++) {
            const target = targets.length > 0 ? targets[i % targets.length] : null;

            // Spread splinters in a fan
            const base_angle = Math.atan2(parent.dy, parent.dx);
            const spread = count > 1
                ? (i / (count - 1) - 0.5) * Math.PI * 0.8
                : 0;
            const angle = base_angle + spread;
            const fdx = Math.cos(angle);
            const fdy = Math.sin(angle);

            this.fangs.push({
                x: parent.x,
                y: parent.y,
                dx: fdx,
                dy: fdy,
                target: target,
                life: SPLINTER_LIFETIME * this.duration_mult,
                alive: true,
                trail: [],
                wobble: Math.random() * Math.PI * 2,
                bounce_count: 0,
                max_bounces: Math.max(1, SHATTER_MAX_BOUNCES - parent.generation * 2),
                hit_ids: new Set(parent.hit_ids),
                generation: parent.generation + 1,
                is_splinter: true,
                base_dmg: parent.base_dmg * SPLINTER_DAMAGE_MULT,
            });
        }
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const now = performance.now();

        // --- Fire main fang ---
        if (now - this.last_fire >= SHATTER_COOLDOWN * this.fire_cooldown_mult) {
            const sht_range = SHATTER_RANGE * this.range_mult;
            const candidates = enemy_manager.query_radius_array(hx, hy, sht_range);

            if (candidates.length > 0) {
                const count = this.get_fang_count();
                candidates.sort((a, b) => {
                    const da = (a.x - hx) ** 2 + (a.y - hy) ** 2;
                    const db = (b.x - hx) ** 2 + (b.y - hy) ** 2;
                    return da - db;
                });

                for (let i = 0; i < count; i++) {
                    const target = candidates[i % candidates.length];
                    const dx = target.x - hx;
                    const dy = target.y - hy;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const ndx = len > 0.01 ? dx / len : 0;
                    const ndy = len > 0.01 ? dy / len : 1;

                    const offset_angle = count > 1
                        ? (i / (count - 1) - 0.5) * 0.6
                        : 0;
                    const cos_o = Math.cos(offset_angle);
                    const sin_o = Math.sin(offset_angle);
                    const fdx = ndx * cos_o - ndy * sin_o;
                    const fdy = ndx * sin_o + ndy * cos_o;

                    this.fangs.push({
                        x: hx,
                        y: hy,
                        dx: fdx,
                        dy: fdy,
                        target: target,
                        life: SHATTER_LIFETIME * this.duration_mult,
                        alive: true,
                        trail: [],
                        wobble: Math.random() * Math.PI * 2,
                        bounce_count: 0,
                        max_bounces: SHATTER_MAX_BOUNCES,
                        hit_ids: new Set(),
                        generation: 0,
                        is_splinter: false,
                        base_dmg: SHATTER_DAMAGE,
                    });
                }
                this.last_fire = now;
            }
        }

        // --- Update all fangs (main + splinters) ---
        const br = this.get_bounce_radius();
        const br_sq = br * br;

        for (const f of this.fangs) {
            if (!f.alive) continue;

            // Re-target if current target is dead
            if (!f.target || !f.target.alive) {
                f.target = this._find_nearest(f.x, f.y, enemy_manager, f.hit_ids, br_sq);
            }

            // Home toward target
            if (f.target && f.target.alive) {
                const tx = f.target.x - f.x;
                const ty = f.target.y - f.y;
                const len = Math.sqrt(tx * tx + ty * ty);
                if (len > 0.01) {
                    const cur_angle = Math.atan2(f.dy, f.dx);
                    let target_angle = Math.atan2(ty / len, tx / len);
                    let diff = target_angle - cur_angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const max_turn = SHATTER_TURN_SPEED * dt;
                    const turn = Math.max(-max_turn, Math.min(max_turn, diff));
                    const new_angle = cur_angle + turn;
                    f.dx = Math.cos(new_angle);
                    f.dy = Math.sin(new_angle);
                }
            }

            f.trail.push({ x: f.x, y: f.y });
            const max_trail = f.is_splinter ? 6 : 10;
            if (f.trail.length > max_trail) f.trail.shift();

            const speed = f.is_splinter ? SPLINTER_SPEED : SHATTER_SPEED;
            f.x += f.dx * speed * dt;
            f.y += f.dy * speed * dt;
            f.life -= dt;
            if (f.life <= 0) f.alive = false;

            if (f.x < 0 || f.x > arena.size || f.y < 0 || f.y > arena.size) {
                f.alive = false;
            }
        }

        // --- Collision — bounce + shatter on crit ---
        const new_splinters = [];
        for (const f of this.fangs) {
            if (!f.alive) continue;
            const hit_radius = f.is_splinter ? SPLINTER_RADIUS : SHATTER_RADIUS;
            const query_r = hit_radius + 0.55;
            enemy_manager.query_radius(f.x, f.y, query_r, (e) => {
                if (!f.alive || f.hit_ids.has(e)) return;
                const dx = f.x - e.x;
                const dy = f.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < hit_radius + e.radius) {
                    f.hit_ids.add(e);
                    f.bounce_count++;

                    // Damage ramps per bounce like ricochet
                    const bounce_mult = 1 + (f.bounce_count - 1) * 0.15;
                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const final_dmg = Math.round(f.base_dmg * bounce_mult * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
                    const dead = e.take_damage(final_dmg);

                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, final_dmg, is_crit);
                    }
                    if (particles) {
                        const sx = e.x * cell_size;
                        const sy = e.y * cell_size;
                        if (is_crit) {
                            // Shatter burst — red/orange explosion
                            particles.emit(sx, sy, 10, '#ff6644', 4);
                            particles.emit(sx, sy, 6, '#ffaa44', 3);
                            particles.emit(sx, sy, 4, '#ffddaa', 2);
                        } else {
                            particles.emit(sx, sy, 5, '#ff8866', 3);
                            particles.emit(sx, sy, 3, '#ffbb88', 2);
                        }
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
                    } else {
                        e.x += f.dx * 0.25;
                        e.y += f.dy * 0.25;
                    }

                    // --- SHATTER on crit: spawn splinter projectiles ---
                    if (is_crit) {
                        new_splinters.push(f);
                    }

                    if (f.bounce_count >= f.max_bounces) {
                        f.alive = false;
                    } else {
                        // Find next bounce target
                        f.target = this._find_nearest(f.x, f.y, enemy_manager, f.hit_ids, br_sq);
                        // Refresh lifetime on bounce
                        const max_life = (f.is_splinter ? SPLINTER_LIFETIME : SHATTER_LIFETIME) * this.duration_mult;
                        f.life = Math.min(f.life + 0.25 * this.duration_mult, max_life);
                    }
                }
            });
        }

        // Spawn splinters after collision pass to avoid modifying fangs mid-iteration
        for (const parent of new_splinters) {
            this._spawn_splinters(parent, enemy_manager);
        }

        this.fangs = this.fangs.filter(f => f.alive);
    }

    render(ctx, cell_size) {
        const now = performance.now();
        for (const f of this.fangs) {
            if (!f.alive) continue;

            const px = f.x * cell_size;
            const py = f.y * cell_size;
            const angle = Math.atan2(f.dy, f.dx);
            const is_splinter = f.is_splinter;

            // --- Trail: red-orange for main, orange-yellow for splinters ---
            if (f.trail.length >= 2) {
                ctx.lineCap = 'round';
                for (let i = 1; i < f.trail.length; i++) {
                    const frac = i / f.trail.length;
                    const x0 = f.trail[i - 1].x * cell_size;
                    const y0 = f.trail[i - 1].y * cell_size;
                    const x1 = f.trail[i].x * cell_size;
                    const y1 = f.trail[i].y * cell_size;

                    if (is_splinter) {
                        ctx.strokeStyle = `rgba(255, ${Math.round(150 + 80 * frac)}, 50, ${frac * 0.4})`;
                        ctx.lineWidth = frac * cell_size * 0.1;
                    } else {
                        const intensity = Math.min(1, 0.5 + f.bounce_count * 0.1);
                        ctx.strokeStyle = `rgba(255, ${Math.round(80 + 60 * frac)}, ${Math.round(40 + 30 * frac)}, ${frac * 0.5 * intensity})`;
                        ctx.lineWidth = frac * cell_size * 0.14;
                    }
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();

                    // Bright core
                    ctx.strokeStyle = `rgba(255, 240, 200, ${frac * 0.25})`;
                    ctx.lineWidth = frac * cell_size * 0.04;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();
                }
            }

            // --- Projectile shape ---
            const scale = is_splinter ? 0.65 : 1.0;
            const fl = cell_size * 0.5 * scale;
            const fw = cell_size * 0.2 * scale;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);

            // Fiery glow
            const glow_r = is_splinter ? 255 : Math.round(255 - f.generation * 30);
            const glow_g = is_splinter ? 150 : Math.round(100 + f.bounce_count * 10);
            ctx.shadowColor = `rgba(${glow_r}, ${glow_g}, 50, 0.6)`;
            ctx.shadowBlur = cell_size * (0.3 + f.bounce_count * 0.04) * scale;

            // Diamond body — red-orange tint
            const body_r = is_splinter ? '#ffe0b0' : '#ffd4b0';
            ctx.fillStyle = body_r;
            ctx.beginPath();
            ctx.moveTo(fl, 0);
            ctx.lineTo(0, -fw);
            ctx.lineTo(-fl * 0.4, 0);
            ctx.lineTo(0, fw);
            ctx.closePath();
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(fl * 0.8, 0);
            ctx.lineTo(fl * 0.1, -fw * 0.5);
            ctx.lineTo(-fl * 0.15, 0);
            ctx.lineTo(fl * 0.1, fw * 0.5);
            ctx.closePath();
            ctx.fill();

            // Crack lines on main fang (shows it's about to shatter)
            if (!is_splinter && f.bounce_count > 0) {
                ctx.strokeStyle = `rgba(255, 100, 50, ${Math.min(0.6, f.bounce_count * 0.15)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(fl * 0.3, -fw * 0.1);
                ctx.lineTo(fl * 0.1, -fw * 0.6);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(fl * 0.2, fw * 0.2);
                ctx.lineTo(-fl * 0.1, fw * 0.5);
                ctx.stroke();
            }

            ctx.shadowBlur = 0;

            // Fire sparkle at tip
            const pulse = 0.5 + Math.sin(f.wobble + now * 0.015) * 0.5;
            ctx.fillStyle = `rgba(255, ${is_splinter ? 200 : 150}, 50, ${0.6 + pulse * 0.4})`;
            ctx.beginPath();
            ctx.arc(fl + fl * 0.05, 0, fl * 0.08, 0, Math.PI * 2);
            ctx.fill();

            // Generation sparks for splinters
            if (is_splinter) {
                for (let s = 0; s < f.generation; s++) {
                    const sa = now * 0.01 + s * Math.PI * 2 / f.generation;
                    const sr = fl * 0.3;
                    ctx.fillStyle = `rgba(255, 180, 60, ${0.4 + pulse * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, fl * 0.035, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    clear() {
        this.fangs = [];
        this.last_fire = 0;
    }
}
