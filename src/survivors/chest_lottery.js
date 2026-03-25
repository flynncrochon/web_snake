import { get_powerup_icon } from '../rendering/powerup_icons.js';
import { play_chest_open, play_roulette_tick, play_roulette_settle } from '../audio/sound.js';

// Smooth easing helpers
function ease_out_cubic(t) { return 1 - Math.pow(1 - t, 3); }
function ease_out_quart(t) { return 1 - Math.pow(1 - t, 4); }
function ease_in_out_cubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function lerp(a, b, t) { return a + (b - a) * t; }

export class ChestLottery {
    constructor() {
        this.chests = [];
        this.active = false;
        this.beams = [];
        this.phase = 'idle';
        this.start_time = 0;
        this.settle_time = 0;
        this.chest_wx = 0;
        this.chest_wy = 0;
        this.won_items = [];
        this.debris = [];
        this.all_item_defs = [];
        this.sparkles = [];
        this.beam_color_t = 0; // smooth color transition 0→1 when settling
        this.guaranteed_items = [];
        this.guaranteed_fulfilled = new Set();
    }

    clear() {
        this.chests = [];
        this.active = false;
        this.beams = [];
        this.phase = 'idle';
        this.won_items = [];
        this.debris = [];
        this.sparkles = [];
        this.guaranteed_items = [];
        this.guaranteed_fulfilled = new Set();
    }

    spawn_chest(x, y, player_segments = [], arena_size = 200, grey_barriers = null) {
        // Avoid spawning inside the player snake or grey snake tiles — find nearest free cell
        const occupied = new Set();
        for (const s of player_segments) {
            occupied.add(s.x + ',' + s.y);
        }
        if (grey_barriers) {
            for (const key of grey_barriers) occupied.add(key);
        }
        if (occupied.has(x + ',' + y)) {
            const pos = this._find_nearest_free(x, y, occupied, arena_size);
            x = pos.x;
            y = pos.y;
        }
        this.chests.push({ x, y, spawn_time: performance.now() });
    }

    _find_nearest_free(x, y, occupied, arena_size) {
        const visited = new Set([x + ',' + y]);
        const queue = [{ x, y }];
        while (queue.length > 0) {
            const curr = queue.shift();
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const nx = curr.x + dx;
                const ny = curr.y + dy;
                const nk = nx + ',' + ny;
                if (visited.has(nk)) continue;
                visited.add(nk);
                if (nx < 0 || nx >= arena_size || ny < 0 || ny >= arena_size) continue;
                if (!occupied.has(nk)) return { x: nx, y: ny };
                queue.push({ x: nx, y: ny });
            }
        }
        return { x, y };
    }

    check_pickup(head_x, head_y, powerup_defs, guaranteed_items = []) {
        for (let i = this.chests.length - 1; i >= 0; i--) {
            const c = this.chests[i];
            if (c.x === head_x && c.y === head_y) {
                this.chests.splice(i, 1);
                this.start_lottery(c.x, c.y, powerup_defs, guaranteed_items);
                return true;
            }
        }
        return false;
    }

    start_lottery(gx, gy, powerup_defs, guaranteed_items = []) {
        this.active = true;
        this.chest_wx = gx;
        this.chest_wy = gy;
        this.start_time = performance.now();
        this.phase = 'spinning';
        play_chest_open();
        this.all_item_defs = powerup_defs;
        this.won_items = [];
        this.beam_color_t = 0;
        this.guaranteed_items = [...guaranteed_items];
        this.guaranteed_fulfilled = new Set();
        this.won_ids = new Set();

        const roll = Math.random();
        const beam_count = roll < 0.60 ? 1 : roll < 0.90 ? 2 : 3;

        this.beams = [];
        for (let i = 0; i < beam_count; i++) {
            let angle;
            if (beam_count === 1) {
                angle = -Math.PI / 2;
            } else if (beam_count === 2) {
                angle = -Math.PI / 2 + (i === 0 ? -0.35 : 0.35);
            } else {
                angle = -Math.PI / 2 + (i - 1) * 0.4;
            }

            this.beams.push({
                angle,
                scroll_offset: Math.random() * powerup_defs.length,
                scroll_speed: 10 + Math.random() * 4,       // faster initial speed
                initial_speed: 10 + Math.random() * 4,
                settled: false,
                settled_item: null,
                settle_progress: 0, // 0→1 smooth settle animation
                decel_start: 1.8 + i * 0.4 + Math.random() * 0.3,
                opacity: 0,         // fade in
                prev_scroll: Math.random() * powerup_defs.length,
            });
        }

        // Floating debris — more varied, slower
        this.debris = [];
        for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 0.8 + Math.random() * 2.5;
            this.debris.push({
                x: 0, y: 0,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 1.0,
                icon_idx: Math.floor(Math.random() * powerup_defs.length),
                rotation: Math.random() * Math.PI * 2,
                rot_speed: (Math.random() - 0.5) * 3,
                alpha: 0,
                target_alpha: 0.4 + Math.random() * 0.35,
                size: 0.25 + Math.random() * 0.35,
                life: 0,
                max_life: 2.5 + Math.random() * 2.5,
                delay: Math.random() * 0.6, // stagger appearance
            });
        }

        // Sparkle particles along beams
        this.sparkles = [];
        for (let i = 0; i < 60; i++) {
            this.sparkles.push({
                beam_idx: Math.floor(Math.random() * beam_count),
                pos: Math.random(),   // 0-1 along beam
                speed: 0.3 + Math.random() * 0.6,
                size: 1 + Math.random() * 2.5,
                offset: (Math.random() - 0.5) * 30, // perpendicular offset
                phase: Math.random() * Math.PI * 2,
                alpha: 0.3 + Math.random() * 0.5,
            });
        }
    }

    update(dt) {
        if (!this.active) return null;

        const elapsed = (performance.now() - this.start_time) / 1000;

        // Update debris with smooth fade-in
        for (const d of this.debris) {
            d.life += dt;
            if (d.life < d.delay) continue;
            const active_life = d.life - d.delay;

            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.vy += 0.8 * dt; // gentler gravity
            d.vx *= Math.pow(0.97, dt * 60); // air resistance
            d.rotation += d.rot_speed * dt;
            d.rot_speed *= Math.pow(0.99, dt * 60); // slow rotation

            // Smooth fade in then out
            const fade_in = Math.min(1, active_life / 0.4);
            const life_ratio = active_life / d.max_life;
            const fade_out = life_ratio > 0.6 ? 1 - (life_ratio - 0.6) / 0.4 : 1;
            d.alpha = d.target_alpha * ease_out_cubic(fade_in) * Math.max(0, fade_out);
        }

        // Update sparkles
        for (const s of this.sparkles) {
            s.pos += s.speed * dt;
            if (s.pos > 1) s.pos -= 1;
            s.phase += dt * 4;
        }

        // Update beam scrolling with smooth deceleration
        let any_spinning = false;
        for (const beam of this.beams) {
            // Smooth beam fade-in
            beam.opacity = Math.min(1, beam.opacity + dt * 3);

            if (beam.settled) {
                beam.settle_progress = Math.min(1, beam.settle_progress + dt * 1.5);
                continue;
            }

            any_spinning = true;

            if (elapsed > beam.decel_start) {
                // Smooth exponential decay with frame-independent smoothing
                const decay_elapsed = elapsed - beam.decel_start;
                const target_speed = beam.initial_speed * Math.exp(-decay_elapsed * 1.2);
                beam.scroll_speed = lerp(beam.scroll_speed, target_speed, 1 - Math.exp(-8 * dt));

                if (beam.scroll_speed < 0.15) {
                    beam.settled = true;
                    beam.settle_progress = 0;
                    // Snap to nearest whole item
                    beam.scroll_offset = Math.round(beam.scroll_offset);
                    const idx = Math.abs(Math.floor(beam.scroll_offset)) % this.all_item_defs.length;
                    let item = this.all_item_defs[idx];
                    // Force guaranteed item on first available beam
                    for (const gi of this.guaranteed_items) {
                        if (!this.guaranteed_fulfilled.has(gi.id)) {
                            item = gi;
                            this.guaranteed_fulfilled.add(gi.id);
                            break;
                        }
                    }
                    // Avoid duplicate: pick a different item if this one was already won
                    if (this.won_ids.has(item.id)) {
                        const available = this.all_item_defs.filter(d => !this.won_ids.has(d.id));
                        if (available.length > 0) {
                            item = available[Math.floor(Math.random() * available.length)];
                        }
                    }
                    this.won_ids.add(item.id);
                    beam.settled_item = item;
                    this.won_items.push(beam.settled_item);
                    play_roulette_settle();
                }
            }

            // Tick sound when an item cycles past
            if (Math.floor(beam.scroll_offset) !== Math.floor(beam.prev_scroll)) {
                play_roulette_tick();
            }
            beam.prev_scroll = beam.scroll_offset;
            beam.scroll_offset += beam.scroll_speed * dt;
        }

        // Smooth color transition when settling
        if (!any_spinning && this.beams.length > 0) {
            this.beam_color_t = Math.min(1, this.beam_color_t + dt * 2);
        }

        // Check if all beams settled
        if (this.beams.length > 0 && this.beams.every(b => b.settled)) {
            if (this.phase === 'spinning') {
                this.phase = 'settled';
                this.settle_time = performance.now();
            }
        }

        return null;
    }

    skip_animation() {
        if (this.phase !== 'spinning') return;
        for (const beam of this.beams) {
            if (beam.settled) continue;
            beam.settled = true;
            beam.settle_progress = 1;
            beam.opacity = 1;
            beam.scroll_offset = Math.round(beam.scroll_offset);
            const idx = Math.abs(Math.floor(beam.scroll_offset)) % this.all_item_defs.length;
            let item = this.all_item_defs[idx];
            for (const gi of this.guaranteed_items) {
                if (!this.guaranteed_fulfilled.has(gi.id)) {
                    item = gi;
                    this.guaranteed_fulfilled.add(gi.id);
                    break;
                }
            }
            // Avoid duplicate: pick a different item if this one was already won
            if (this.won_ids.has(item.id)) {
                const available = this.all_item_defs.filter(d => !this.won_ids.has(d.id));
                if (available.length > 0) {
                    item = available[Math.floor(Math.random() * available.length)];
                }
            }
            this.won_ids.add(item.id);
            beam.settled_item = item;
            this.won_items.push(beam.settled_item);
            play_roulette_settle();
        }
        this.beam_color_t = 1;
        this.phase = 'settled';
        this.settle_time = performance.now();
    }

    dismiss() {
        if (this.phase !== 'settled') return null;
        this.phase = 'done';
        this.active = false;
        const items = [...this.won_items];
        this.won_items = [];
        this.beams = [];
        this.debris = [];
        this.sparkles = [];
        return items;
    }

    pause_adjust(duration) {
        if (this.start_time > 0) this.start_time += duration;
        if (this.settle_time > 0) this.settle_time += duration;
        for (const c of this.chests) c.spawn_time += duration;
    }

    // ---- Rendering ----

    render_chests(ctx, cell_size, camera) {
        for (const chest of this.chests) {
            if (!camera.is_visible(chest.x, chest.y)) continue;
            this._draw_chest(ctx, (chest.x + 0.5) * cell_size, (chest.y + 0.5) * cell_size, cell_size);
        }
    }

    _draw_chest(ctx, cx, cy, cell_size) {
        const u = cell_size / 10; // pixel unit

        // Bottom body
        ctx.fillStyle = '#7B4B2A';
        ctx.fillRect(cx - 4*u, cy - 1*u, 8*u, 5*u);
        // Bottom body highlight
        ctx.fillStyle = '#9B6B3A';
        ctx.fillRect(cx - 3*u, cy, 6*u, 3*u);

        // Lid
        ctx.fillStyle = '#6B3B1A';
        ctx.fillRect(cx - 4*u, cy - 4*u, 8*u, 3*u);
        // Lid highlight
        ctx.fillStyle = '#8B5B2A';
        ctx.fillRect(cx - 3*u, cy - 3*u, 6*u, 1*u);

        // Gold trim — horizontal bands
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 4*u, cy - 1*u, 8*u, u);
        // Gold trim — vertical clasp
        ctx.fillRect(cx - u, cy - 4*u, 2*u, 8*u);

        // Lock/gem
        ctx.fillStyle = '#FF3333';
        ctx.fillRect(cx - u, cy - u, 2*u, 2*u);

        // Corner rivets
        ctx.fillStyle = '#DDAA00';
        ctx.fillRect(cx - 4*u, cy - 4*u, u, u);
        ctx.fillRect(cx + 3*u, cy - 4*u, u, u);
        ctx.fillRect(cx - 4*u, cy + 3*u, u, u);
        ctx.fillRect(cx + 3*u, cy + 3*u, u, u);

        // Subtle glow
        const pulse = (Math.sin(performance.now() / 500) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.15 + pulse * 0.1;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 4*u, cy - 4*u, 8*u, 8*u);
        ctx.restore();
    }

    render_lottery(ctx, cell_size, w, h) {
        if (!this.active) return;

        const now = performance.now();
        const elapsed = (now - this.start_time) / 1000;
        const is_settled = this.phase === 'settled';

        // Smooth background darken
        const bg_alpha = ease_out_cubic(Math.min(1, elapsed / 0.8)) * 0.75;
        ctx.fillStyle = `rgba(0, 0, 0, ${bg_alpha})`;
        ctx.fillRect(0, 0, w, h);

        const chest_cx = w / 2;
        const chest_cy = h * 0.75;
        const beam_length = h * 0.6;

        // Smooth beam grow with ease-out
        const beam_grow = ease_out_quart(Math.min(1, elapsed / 0.7));

        // Draw beams (back to front: glow → core → sparkles → items)
        for (let bi = 0; bi < this.beams.length; bi++) {
            const beam = this.beams[bi];
            const cur_length = beam_length * beam_grow;

            const cos_a = Math.cos(beam.angle);
            const sin_a = Math.sin(beam.angle);
            const ex = chest_cx + cos_a * cur_length;
            const ey = chest_cy + sin_a * cur_length;

            // Smooth color interpolation
            let r, g, b_c;
            if (this.beams.length === 1) {
                r = lerp(80, 255, this.beam_color_t);
                g = lerp(130, 200, this.beam_color_t);
                b_c = lerp(255, 80, this.beam_color_t);
            } else {
                r = lerp(200, 255, this.beam_color_t);
                g = lerp(60, 200, this.beam_color_t);
                b_c = lerp(255, 80, this.beam_color_t);
            }

            const base_alpha = beam.opacity;

            // Beam breathing pulse
            const breath = 0.85 + Math.sin(now / 200 + bi * 1.5) * 0.15;

            // Outer glow (widest, most transparent) — solid stroke
            ctx.strokeStyle = `rgba(${r|0}, ${g|0}, ${b_c|0}, ${(0.1 * base_alpha * breath).toFixed(3)})`;
            ctx.lineWidth = 80;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(chest_cx, chest_cy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Mid glow — solid stroke
            ctx.strokeStyle = `rgba(${r|0}, ${g|0}, ${b_c|0}, ${(0.25 * base_alpha * breath).toFixed(3)})`;
            ctx.lineWidth = 30;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(chest_cx, chest_cy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Inner bright core — solid stroke
            const cr = Math.min(255, r + 30) | 0;
            const cg = Math.min(255, g + 30) | 0;
            const cb = Math.min(255, b_c + 30) | 0;
            ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${(0.4 * base_alpha * breath).toFixed(3)})`;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(chest_cx, chest_cy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Sparkles along this beam
            for (const s of this.sparkles) {
                if (s.beam_idx !== bi) continue;
                const sp = s.pos * cur_length;
                const sx = chest_cx + cos_a * sp + sin_a * s.offset;
                const sy = chest_cy + sin_a * sp - cos_a * s.offset;
                const flicker = (Math.sin(s.phase) + 1) / 2;
                const sa = s.alpha * flicker * base_alpha;
                if (sa < 0.02) continue;

                ctx.save();
                ctx.globalAlpha = sa;
                ctx.fillStyle = `rgb(${Math.min(255,r+80)|0}, ${Math.min(255,g+80)|0}, ${Math.min(255,b_c+80)|0})`;
                ctx.beginPath();
                ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Items along beam
            if (cur_length > 10) {
                this._render_beam_items(ctx, chest_cx, chest_cy, beam, cur_length, elapsed);
            }
        }

        // Debris
        this._render_debris(ctx, chest_cx, chest_cy, cell_size);

        // Chest at bottom
        this._draw_chest_large(ctx, chest_cx, chest_cy, Math.min(w, h) * 0.08);

        // Settled UI
        if (is_settled) {
            const settle_elapsed = (now - this.settle_time) / 1000;
            const text_fade = ease_out_cubic(Math.min(1, settle_elapsed / 0.5));

            // Won items text
            ctx.save();
            ctx.globalAlpha = text_fade;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const item_names = this.won_items.map(i => i.name).join('  +  ');
            ctx.fillText(item_names, w / 2, 50);
            ctx.restore();

            // "Press space" with smooth pulse
            const pulse = (Math.sin(now / 600) + 1) / 2;
            ctx.save();
            ctx.globalAlpha = text_fade * (0.5 + pulse * 0.5);
            ctx.fillStyle = '#fff';
            ctx.font = '15px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Press Space to continue', w / 2, h - 40);
            ctx.restore();
        }
    }

    _render_beam_items(ctx, ox, oy, beam, length, elapsed) {
        const item_count = this.all_item_defs.length;
        if (item_count === 0) return;

        const icon_size = 34;
        const spacing = 58;
        const visible_count = Math.ceil(length / spacing) + 1;
        const cos_a = Math.cos(beam.angle);
        const sin_a = Math.sin(beam.angle);
        const frac_offset = beam.scroll_offset % 1;

        // Midpoint slot position — the focal cycling display
        const mid_dist = length * 0.55;
        const mid_px = ox + cos_a * mid_dist;
        const mid_py = oy + sin_a * mid_dist;
        const slot_size = 52;
        const exclusion_zone = slot_size * 1.5;

        // --- Background scrolling items (dimmed, with exclusion zone around slot) ---
        for (let i = -1; i < visible_count; i++) {
            const dist = (i - frac_offset + 0.5) * spacing;
            if (dist < 0 || dist > length) continue;
            if (Math.abs(dist - mid_dist) < exclusion_zone) continue;

            const px = ox + cos_a * dist;
            const py = oy + sin_a * dist;

            const raw_idx = Math.floor(beam.scroll_offset) + i;
            const item_idx = ((raw_idx % item_count) + item_count) % item_count;
            const item_def = this.all_item_defs[item_idx];

            const edge_fade_start = spacing * 0.8;
            let edge_alpha = 1;
            if (dist < edge_fade_start) edge_alpha = dist / edge_fade_start;
            if (dist > length - edge_fade_start) edge_alpha = (length - dist) / edge_fade_start;
            edge_alpha = Math.max(0, Math.min(1, edge_alpha));

            let alpha = 0.45 * edge_alpha * beam.opacity;
            let draw_size = icon_size * 0.85;

            if (beam.settled) {
                const sp = ease_out_cubic(beam.settle_progress);
                alpha = lerp(0.45, 0.06, sp) * edge_alpha;
                draw_size = lerp(icon_size * 0.85, icon_size * 0.7, sp);
            }

            if (alpha < 0.01) continue;

            const bg_icon = get_powerup_icon(item_def.id);
            if (bg_icon) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(bg_icon, px - draw_size / 2, py - draw_size / 2, draw_size, draw_size);
                ctx.restore();
            }
        }

        // --- Central cycling slot (slot-machine style) ---
        const cycle_raw = Math.floor(beam.scroll_offset);
        const cycle_idx = ((cycle_raw % item_count) + item_count) % item_count;
        const display_item = beam.settled ? beam.settled_item : this.all_item_defs[cycle_idx];

        if (!display_item) return;
        const icon = get_powerup_icon(display_item.id);
        if (!icon) return;

        // Cross-fade between cycling items (only visible at lower speeds)
        const item_frac = ((beam.scroll_offset % 1) + 1) % 1;
        let cycle_alpha = 1;
        if (!beam.settled && beam.scroll_speed < 3) {
            if (item_frac < 0.15) cycle_alpha = item_frac / 0.15;
            else if (item_frac > 0.85) cycle_alpha = (1 - item_frac) / 0.15;
        }

        // --- Circle behind item ---
        if (beam.settled) {
            const sp = ease_out_cubic(beam.settle_progress);
            const circle_r = lerp(slot_size * 0.4, slot_size * 0.85, sp);
            const glow_alpha = lerp(0.1, 0.6, sp);

            // Outer glow ring
            ctx.save();
            ctx.globalAlpha = glow_alpha * 0.4 * beam.opacity;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.beginPath();
            ctx.arc(mid_px, mid_py, circle_r + 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Main golden circle
            ctx.save();
            ctx.globalAlpha = glow_alpha * beam.opacity;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(mid_px, mid_py, circle_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Inner bright highlight
            ctx.save();
            ctx.globalAlpha = glow_alpha * 0.5 * beam.opacity;
            ctx.fillStyle = '#FFF8DC';
            ctx.beginPath();
            ctx.arc(mid_px, mid_py, circle_r * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            // Subtle pulsing ring while spinning
            const pulse = (Math.sin(performance.now() / 200) + 1) / 2;
            ctx.save();
            ctx.globalAlpha = (0.12 + pulse * 0.08) * beam.opacity;
            ctx.strokeStyle = 'rgba(180, 200, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mid_px, mid_py, slot_size * 0.55, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // --- Draw the cycling icon ---
        let draw_s = slot_size;
        if (beam.settled) {
            draw_s = lerp(slot_size, slot_size * 1.4, ease_out_cubic(beam.settle_progress));
        }

        ctx.save();
        ctx.globalAlpha = cycle_alpha * beam.opacity;
        ctx.drawImage(icon, mid_px - draw_s / 2, mid_py - draw_s / 2, draw_s, draw_s);
        ctx.restore();

        // --- Item name below icon when settled ---
        if (beam.settled && beam.settle_progress > 0.5) {
            const name_alpha = ease_out_cubic((beam.settle_progress - 0.5) * 2);
            ctx.save();
            ctx.globalAlpha = name_alpha * beam.opacity;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(display_item.name, mid_px, mid_py + draw_s / 2 + 16);
            ctx.restore();
        }
    }

    _render_debris(ctx, cx, cy, cell_size) {
        for (const d of this.debris) {
            if (d.alpha <= 0.01 || d.life <= d.delay) continue;

            const item_def = this.all_item_defs[d.icon_idx % this.all_item_defs.length];
            if (!item_def) continue;
            const icon = get_powerup_icon(item_def.id);
            if (!icon) continue;

            const scale = cell_size * 0.5;
            const px = cx + d.x * scale;
            const py = cy + d.y * scale;
            const s = 16 * d.size;

            ctx.save();
            ctx.globalAlpha = d.alpha;
            ctx.translate(px, py);
            ctx.rotate(d.rotation);
            ctx.drawImage(icon, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
    }

            _draw_chest_large(ctx, cx, cy, size) {
                const u = size / 10;

                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.beginPath();
                ctx.ellipse(cx, cy + 5*u, 5*u, 1.2*u, 0, 0, Math.PI * 2);
                ctx.fill();

                // Bottom body
                ctx.fillStyle = '#7B4B2A';
                ctx.fillRect(cx - 4*u, cy - 1*u, 8*u, 5*u);
                ctx.fillStyle = '#9B6B3A';
                ctx.fillRect(cx - 3*u, cy, 6*u, 3*u);

                // Lid
                ctx.fillStyle = '#6B3B1A';
                ctx.fillRect(cx - 4*u, cy - 4*u, 8*u, 3*u);
                ctx.fillStyle = '#8B5B2A';
                ctx.fillRect(cx - 3*u, cy - 3*u, 6*u, 1*u);

                // Gold bands
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(cx - 4*u, cy - 1*u, 8*u, u);
                ctx.fillRect(cx - u, cy - 4*u, 2*u, 8*u);

                // Lock gem
                ctx.fillStyle = '#FF3333';
                ctx.fillRect(cx - u, cy - u, 2*u, 2*u);

                // Corner rivets
                ctx.fillStyle = '#DDAA00';
                ctx.fillRect(cx - 4*u, cy - 4*u, u, u);
                ctx.fillRect(cx + 3*u, cy - 4*u, u, u);
                ctx.fillRect(cx - 4*u, cy + 3*u, u, u);
                ctx.fillRect(cx + 3*u, cy + 3*u, u, u);

                // Glow
                const pulse = (Math.sin(performance.now() / 300) + 1) / 2;
                ctx.save();
                ctx.globalAlpha = 0.08 + pulse * 0.06;
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(cx - 4*u, cy - 4*u, 8*u, 8*u);
                ctx.restore();
            }
}
