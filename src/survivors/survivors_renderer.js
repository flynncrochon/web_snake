export class SurvivorsRenderer {
    constructor() {
        // Reusable position buffers — avoids allocating {x,y} per segment per enemy per frame
        this._pos_x = new Float64Array(64);
        this._pos_y = new Float64Array(64);
    }

    render_enemies(ctx, enemies, cell_size, camera) {
        const now = performance.now();
        const seg_size = Math.ceil(cell_size * 0.55);
        const half = seg_size / 2;
        const pad = 1;
        const bounds = camera ? camera.get_visible_bounds(2) : null;
        const px_buf = this._pos_x;
        const py_buf = this._pos_y;

        for (const e of enemies) {
            if (!e.alive) continue;
            if (bounds) {
                const hx = e.segments[0].x;
                const hy = e.segments[0].y;
                if (hx < bounds.minX || hx > bounds.maxX || hy < bounds.minY || hy > bounds.maxY) continue;
            }

            const e_seg_size = e.is_boss ? Math.ceil(cell_size * 0.75) : seg_size;
            const e_half = e_seg_size / 2;
            const e_pad = e.is_boss ? 2 : pad;

            // Per-enemy interpolation t
            const elapsed = now - e.last_tick_time;
            const t = Math.min(elapsed / e.tick_rate, 1);

            const segs = e.segments;
            const seg_len = segs.length;

            // Compute interpolated positions into reusable buffers
            for (let si = 0; si < seg_len; si++) {
                const seg = segs[si];
                px_buf[si] = (seg.prev_x + (seg.x - seg.prev_x) * t + 0.5) * cell_size;
                py_buf[si] = (seg.prev_y + (seg.y - seg.prev_y) * t + 0.5) * cell_size;
            }

            // Draw body connections through prev positions (L-shaped corners)
            ctx.fillStyle = e.is_boss ? e.body_color : e.color;
            for (let k = 0; k < seg_len - 1; k++) {
                const ax = px_buf[k], ay = py_buf[k];
                const bx = px_buf[k + 1], by = py_buf[k + 1];
                const cx_pos = (segs[k].prev_x + 0.5) * cell_size;
                const cy_pos = (segs[k].prev_y + 0.5) * cell_size;

                const x1 = Math.min(ax, cx_pos) - e_half - e_pad;
                const y1 = Math.min(ay, cy_pos) - e_half - e_pad;
                const w1 = Math.max(ax, cx_pos) - Math.min(ax, cx_pos) + e_seg_size + e_pad * 2;
                const h1 = Math.max(ay, cy_pos) - Math.min(ay, cy_pos) + e_seg_size + e_pad * 2;
                ctx.fillRect(x1, y1, w1, h1);

                const x2 = Math.min(bx, cx_pos) - e_half - e_pad;
                const y2 = Math.min(by, cy_pos) - e_half - e_pad;
                const w2 = Math.max(bx, cx_pos) - Math.min(bx, cx_pos) + e_seg_size + e_pad * 2;
                const h2 = Math.max(by, cy_pos) - Math.min(by, cy_pos) + e_seg_size + e_pad * 2;
                ctx.fillRect(x2, y2, w2, h2);
            }

            // Body segment squares
            for (let i = 1; i < seg_len; i++) {
                ctx.fillRect(px_buf[i] - e_half, py_buf[i] - e_half, e_seg_size, e_seg_size);
            }

            // Head (brighter)
            ctx.fillStyle = e.color;
            ctx.fillRect(px_buf[0] - e_half, py_buf[0] - e_half, e_seg_size, e_seg_size);

            // Eyes on head
            const hpos_x = px_buf[0], hpos_y = py_buf[0];
            let dx = e.direction.dx, dy = e.direction.dy;
            if (dx === 0 && dy === 0) { dy = 1; }
            const eye_off = e_seg_size * 0.25;
            const eye_r = e_seg_size * 0.12;
            const fwd_x = dx * e_seg_size * 0.15;
            const fwd_y = dy * e_seg_size * 0.15;
            const perp_x = -dy * eye_off;
            const perp_y = dx * eye_off;

            ctx.fillStyle = e.is_boss ? '#ff0' : '#fff';
            const eye_sz = Math.round(e_seg_size * 0.22);
            const ehalf = eye_sz >> 1;
            ctx.fillRect(hpos_x + fwd_x + perp_x - ehalf, hpos_y + fwd_y + perp_y - ehalf, eye_sz, eye_sz);
            ctx.fillRect(hpos_x + fwd_x - perp_x - ehalf, hpos_y + fwd_y - perp_y - ehalf, eye_sz, eye_sz);

            // Boss HP bar
            if (e.is_boss) {
                const bar_w = e_seg_size * 2;
                const bar_h = 4;
                const bar_x = hpos_x - bar_w / 2;
                const bar_y = hpos_y - e_half - 8;
                const hp_ratio = Math.max(0, e.hp / e.max_hp);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(bar_x - 1, bar_y - 1, bar_w + 2, bar_h + 2);
                ctx.fillStyle = '#440066';
                ctx.fillRect(bar_x, bar_y, bar_w, bar_h);
                ctx.fillStyle = '#bb44ff';
                ctx.fillRect(bar_x, bar_y, bar_w * hp_ratio, bar_h);
            }
        }
    }

    render_bullets(ctx, bullets, cell_size, camera) {
        const bounds = camera ? camera.get_visible_bounds(3) : null;

        // --- Batch all bullet trails first (before per-bullet translate/rotate) ---
        // Draw trails in 3 bands (tail/mid/tip) to reduce stroke calls from ~400 to ~3
        ctx.lineCap = 'round';
        const bands = [
            { frac: 0.25, alpha_mult: 0.025, width_mult: 0.3 },
            { frac: 0.55, alpha_mult: 0.12,  width_mult: 0.66 },
            { frac: 0.85, alpha_mult: 0.29,  width_mult: 1.0 },
        ];
        for (const band of bands) {
            ctx.strokeStyle = `rgba(0, 200, 50, ${band.alpha_mult})`;
            ctx.lineWidth = Math.max(0.3, band.width_mult * cell_size * 0.15);
            ctx.beginPath();
            for (const b of bullets) {
                if (!b.alive || b.trail.length < 2) continue;
                if (bounds && (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY)) continue;
                const tlen = b.trail.length;
                const lo = Math.floor(band.frac * tlen * 0.5);
                const hi = Math.min(tlen, Math.ceil(band.frac * tlen * 1.5));
                for (let i = Math.max(1, lo); i < hi; i++) {
                    ctx.moveTo(b.trail[i - 1].x * cell_size, b.trail[i - 1].y * cell_size);
                    ctx.lineTo(b.trail[i].x * cell_size, b.trail[i].y * cell_size);
                }
            }
            ctx.stroke();
        }

        // --- Render each bullet's fang shape ---
        for (const b of bullets) {
            if (!b.alive) continue;
            if (bounds && (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY)) continue;

            const build_time = 0.05;
            const t = Math.min(1, b.age / build_time);
            const growth = 1 - (1 - t) * (1 - t) * (1 - t);

            const base_r = b.radius * cell_size * growth;
            if (base_r < 0.2) continue;

            const px = b.x * cell_size;
            const py = b.y * cell_size;
            const angle = Math.atan2(b.dy, b.dx);

            const life_ratio = b.life / b.max_life;
            const fade = life_ratio < 0.15 ? life_ratio / 0.15 : 1;

            ctx.save();
            ctx.globalAlpha = fade;

            ctx.translate(px, py);
            ctx.rotate(angle);

            // --- Tiny fang (diamond shape — no bezier curves) ---
            const fl = base_r * 2.8;
            const fw = base_r * 0.7;

            ctx.fillStyle = '#00cc33';
            ctx.beginPath();
            ctx.moveTo(fl, 0);
            ctx.lineTo(0, -fw);
            ctx.lineTo(-fl * 0.3, 0);
            ctx.lineTo(0, fw);
            ctx.closePath();
            ctx.fill();

            // --- Inner highlight ---
            ctx.fillStyle = 'rgba(120, 255, 140, 0.5)';
            ctx.beginPath();
            ctx.moveTo(fl * 0.75, 0);
            ctx.lineTo(fl * 0.1, -fw * 0.35);
            ctx.lineTo(-fl * 0.1, 0);
            ctx.lineTo(fl * 0.1, fw * 0.35);
            ctx.closePath();
            ctx.fill();

            // --- Venom drip at tip ---
            const dr = base_r * 0.2;
            ctx.fillStyle = `rgba(0, 255, 80, 0.5)`;
            ctx.fillRect(fl - dr, -dr, dr * 2, dr * 2);

            ctx.restore();
        }
    }

    render_food(ctx, food, cell_size, camera) {
        ctx.fillStyle = '#fff';
        const food_size = cell_size * 0.4;
        const half = food_size / 2;
        for (const f of food) {
            if (!camera.is_visible(f.x, f.y)) continue;
            ctx.fillRect(
                (f.x + 0.5) * cell_size - half,
                (f.y + 0.5) * cell_size - half,
                food_size, food_size
            );
        }
    }

    render_hearts(ctx, heart_drops, cell_size, camera) {
        const size = cell_size * 0.45;
        const pulse = (Math.sin(performance.now() / 400) + 1) / 2;
        const TWO_PI = Math.PI * 2;
        for (const h of heart_drops) {
            if (!camera.is_visible(h.x, h.y)) continue;
            const cx = (h.x + 0.5) * cell_size;
            const cy = (h.y + 0.5) * cell_size;
            const s = size * (0.9 + pulse * 0.1);

            // Black background circle
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.78, 0, TWO_PI);
            ctx.fill();

            // Semi-transparent red glow circle
            ctx.fillStyle = 'rgba(255, 34, 68, 0.25)';
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.9, 0, TWO_PI);
            ctx.fill();

            ctx.fillStyle = '#ff2244';
            ctx.beginPath();
            const top = cy - s * 0.3;
            ctx.moveTo(cx, cy + s * 0.5);
            ctx.bezierCurveTo(cx - s * 0.6, cy + s * 0.1, cx - s * 0.6, top - s * 0.2, cx - s * 0.3, top - s * 0.2);
            ctx.bezierCurveTo(cx - s * 0.05, top - s * 0.2, cx, top, cx, top + s * 0.15);
            ctx.bezierCurveTo(cx, top, cx + s * 0.05, top - s * 0.2, cx + s * 0.3, top - s * 0.2);
            ctx.bezierCurveTo(cx + s * 0.6, top - s * 0.2, cx + s * 0.6, cy + s * 0.1, cx, cy + s * 0.5);
            ctx.fill();
        }
    }

    render_arena_border(ctx, arena_size, cell_size) {
        const total = arena_size * cell_size;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, total, total);
    }

    render_grey_snakes(ctx, grey_snake, cell_size, cam_offset_x, cam_offset_y) {
        if (!grey_snake) return;
        const now = performance.now();
        // Use 1 for DPR — game canvas renders at DPR=1 for performance
        const dpr = 1;
        const TICK = 60;

        const seg_px = Math.round(cell_size * 0.7 * dpr);
        const half_px = seg_px >> 1;

        // Reuse position buffers — avoid allocating {x,y} objects per segment per frame
        const gx_buf = this._gs_px || (this._gs_px = new Float64Array(128));
        const gy_buf = this._gs_py || (this._gs_py = new Float64Array(128));

        // Inline draw_segs using buffers instead of positions[] array
        const _draw_segs_buf = (count, segs_data, color) => {
            if (count === 0) return;
            ctx.fillStyle = color;
            for (let i = 0; i < count - 1; i++) {
                const ax = gx_buf[i], ay = gy_buf[i];
                const bx = gx_buf[i + 1], by = gy_buf[i + 1];
                const adx = Math.abs(ax - bx);
                const ady = Math.abs(ay - by);
                if (adx <= dpr || ady <= dpr) {
                    if (ady >= adx) {
                        ctx.fillRect(ax - half_px, Math.min(ay, by) - half_px, seg_px, ady + seg_px);
                    } else {
                        ctx.fillRect(Math.min(ax, bx) - half_px, ay - half_px, adx + seg_px, seg_px);
                    }
                } else if (segs_data && segs_data[i]) {
                    const s = segs_data[i];
                    const cx = Math.round(((s.prev_x + 0.5) * cell_size + cam_offset_x) * dpr);
                    const cy = Math.round(((s.prev_y + 0.5) * cell_size + cam_offset_y) * dpr);
                    ctx.fillRect(Math.min(ax, cx) - half_px, Math.min(ay, cy) - half_px,
                                 Math.abs(ax - cx) + seg_px, Math.abs(ay - cy) + seg_px);
                    ctx.fillRect(Math.min(bx, cx) - half_px, Math.min(by, cy) - half_px,
                                 Math.abs(bx - cx) + seg_px, Math.abs(by - cy) + seg_px);
                }
            }
            for (let i = 0; i < count; i++) {
                ctx.fillRect(gx_buf[i] - half_px, gy_buf[i] - half_px, seg_px, seg_px);
            }
        };

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Dead trails — write positions into buffer, no .map() allocation
        for (const trail of grey_snake.dead_trails) {
            const len = trail.length;
            for (let i = 0; i < len; i++) {
                const s = trail[i];
                gx_buf[i] = Math.round(((s.x + 0.5) * cell_size + cam_offset_x) * dpr);
                gy_buf[i] = Math.round(((s.y + 0.5) * cell_size + cam_offset_y) * dpr);
            }
            _draw_segs_buf(len, null, '#555');
        }

        // Active snakes — interpolated
        const eye_sz = Math.round(seg_px * 0.24);
        const eye_half = eye_sz >> 1;
        const pupil_sz = Math.round(eye_sz * 0.5);
        const pupil_half = pupil_sz >> 1;

        for (const gs of grey_snake.snakes) {
            if (!gs.alive) continue;
            const segs = gs.segments;
            if (segs.length === 0) continue;

            const elapsed = now - gs.last_tick_time;
            const t = Math.min(elapsed / TICK, 1);

            // Build interpolated positions into buffer
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                if (i === 0) {
                    const lx = (s.prev_x + (s.x - s.prev_x) * t + 0.5) * cell_size;
                    const ly = (s.prev_y + (s.y - s.prev_y) * t + 0.5) * cell_size;
                    gx_buf[0] = Math.round((lx + cam_offset_x) * dpr);
                    gy_buf[0] = Math.round((ly + cam_offset_y) * dpr);
                } else {
                    gx_buf[i] = Math.round(((s.x + 0.5) * cell_size + cam_offset_x) * dpr);
                    gy_buf[i] = Math.round(((s.y + 0.5) * cell_size + cam_offset_y) * dpr);
                }
            }

            _draw_segs_buf(segs.length, segs, '#666');

            // Head square
            ctx.fillStyle = '#666';
            ctx.fillRect(gx_buf[0] - half_px, gy_buf[0] - half_px, seg_px, seg_px);

            // Eyes — use fillRect instead of arc() for small squares
            const dir = gs.direction;
            let ddx = dir.dx, ddy = dir.dy;
            if (ddx === 0 && ddy === 0) ddy = 1;
            const eye_off = seg_px * 0.25;
            const fwd_x = ddx * seg_px * 0.15;
            const fwd_y = ddy * seg_px * 0.15;
            const perp_x = -ddy * eye_off;
            const perp_y = ddx * eye_off;
            const hpx = gx_buf[0], hpy = gy_buf[0];

            ctx.fillStyle = '#eee';
            ctx.fillRect(hpx + fwd_x + perp_x - eye_half, hpy + fwd_y + perp_y - eye_half, eye_sz, eye_sz);
            ctx.fillRect(hpx + fwd_x - perp_x - eye_half, hpy + fwd_y - perp_y - eye_half, eye_sz, eye_sz);

            ctx.fillStyle = '#111';
            ctx.fillRect(hpx + fwd_x + perp_x - pupil_half, hpy + fwd_y + perp_y - pupil_half, pupil_sz, pupil_sz);
            ctx.fillRect(hpx + fwd_x - perp_x - pupil_half, hpy + fwd_y - perp_y - pupil_half, pupil_sz, pupil_sz);
        }

        ctx.restore();
    }

    render_minimap(ctx, player_snake, enemies, arena_size, view_width, view_height, chests, grey_snake) {
        const map_size = 110;
        const padding = 10;
        const mx = view_width - map_size - padding;
        const my = view_height - map_size - padding;
        const scale = map_size / arena_size;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(mx, my, map_size, map_size);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, map_size, map_size);

        // Batch enemies by type to minimize fillStyle changes
        ctx.fillStyle = 'rgba(200, 0, 0, 0.6)';
        for (const e of enemies) {
            if (!e.alive || e.is_boss || e.is_splitter) continue;
            ctx.fillRect(mx + e.x * scale - 1, my + e.y * scale - 1, 2, 2);
        }
        ctx.fillStyle = 'rgba(60, 130, 220, 0.8)';
        for (const e of enemies) {
            if (!e.alive || !e.is_splitter) continue;
            ctx.fillRect(mx + e.x * scale - 1.5, my + e.y * scale - 1.5, 3, 3);
        }
        ctx.fillStyle = 'rgba(187, 68, 255, 0.9)';
        for (const e of enemies) {
            if (!e.alive || !e.is_boss) continue;
            ctx.fillRect(mx + e.x * scale - 2.5, my + e.y * scale - 2.5, 5, 5);
        }

        // Chests on minimap (gold dots)
        if (chests) {
            ctx.fillStyle = '#FFD700';
            for (const c of chests) {
                ctx.fillRect(mx + c.x * scale - 1, my + c.y * scale - 1, 4, 4);
            }
        }

        // Grey snake barriers on minimap
        if (grey_snake) {
            ctx.fillStyle = 'rgba(160, 160, 160, 0.6)';
            for (const trail of grey_snake.dead_trails) {
                for (const s of trail) {
                    ctx.fillRect(mx + s.x * scale, my + s.y * scale, 1.5, 1.5);
                }
            }
            for (const gs of grey_snake.snakes) {
                if (!gs.alive) continue;
                for (const s of gs.segments) {
                    ctx.fillRect(mx + s.x * scale, my + s.y * scale, 1.5, 1.5);
                }
                // Active head — brighter
                const gh = gs.segments[0];
                ctx.fillStyle = 'rgba(220, 220, 220, 0.9)';
                ctx.fillRect(mx + gh.x * scale - 1, my + gh.y * scale - 1, 3, 3);
                ctx.fillStyle = 'rgba(160, 160, 160, 0.6)';
            }
        }

        ctx.fillStyle = '#fff';
        for (const seg of player_snake.segments) {
            ctx.fillRect(mx + seg.x * scale, my + seg.y * scale, 2, 2);
        }

        const head = player_snake.head;
        ctx.fillStyle = '#0ff';
        ctx.fillRect(mx + head.x * scale - 1, my + head.y * scale - 1, 3, 3);
    }
}
