export class SurvivorsRenderer {

    render_enemies(ctx, enemies, cell_size) {
        const now = performance.now();
        const seg_size = Math.ceil(cell_size * 0.55);
        const half = seg_size / 2;
        const pad = 1;

        for (const e of enemies) {
            if (!e.alive) continue;

            const e_seg_size = e.is_boss ? Math.ceil(cell_size * 0.75) : seg_size;
            const e_half = e_seg_size / 2;
            const e_pad = e.is_boss ? 2 : pad;

            // Per-enemy interpolation t
            const elapsed = now - e.last_tick_time;
            const t = Math.min(elapsed / e.tick_rate, 1);

            const segs = e.segments;

            // Compute interpolated positions
            const positions = [];
            for (const seg of segs) {
                const px = (seg.prev_x + (seg.x - seg.prev_x) * t + 0.5) * cell_size;
                const py = (seg.prev_y + (seg.y - seg.prev_y) * t + 0.5) * cell_size;
                positions.push({ x: px, y: py });
            }

            // Draw body connections through prev positions (L-shaped corners)
            ctx.fillStyle = e.is_boss ? e.body_color : e.color;
            for (let k = 0; k < segs.length - 1; k++) {
                const a = positions[k];
                const b = positions[k + 1];
                const cx_pos = (segs[k].prev_x + 0.5) * cell_size;
                const cy_pos = (segs[k].prev_y + 0.5) * cell_size;

                const x1 = Math.min(a.x, cx_pos) - e_half - e_pad;
                const y1 = Math.min(a.y, cy_pos) - e_half - e_pad;
                const w1 = Math.max(a.x, cx_pos) - Math.min(a.x, cx_pos) + e_seg_size + e_pad * 2;
                const h1 = Math.max(a.y, cy_pos) - Math.min(a.y, cy_pos) + e_seg_size + e_pad * 2;
                ctx.fillRect(x1, y1, w1, h1);

                const x2 = Math.min(b.x, cx_pos) - e_half - e_pad;
                const y2 = Math.min(b.y, cy_pos) - e_half - e_pad;
                const w2 = Math.max(b.x, cx_pos) - Math.min(b.x, cx_pos) + e_seg_size + e_pad * 2;
                const h2 = Math.max(b.y, cy_pos) - Math.min(b.y, cy_pos) + e_seg_size + e_pad * 2;
                ctx.fillRect(x2, y2, w2, h2);
            }

            // Body segment squares
            for (let i = 1; i < positions.length; i++) {
                ctx.fillRect(positions[i].x - e_half, positions[i].y - e_half, e_seg_size, e_seg_size);
            }

            // Head (brighter)
            ctx.fillStyle = e.color;
            ctx.fillRect(positions[0].x - e_half, positions[0].y - e_half, e_seg_size, e_seg_size);

            // Eyes on head
            const hpos = positions[0];
            let dx = e.direction.dx, dy = e.direction.dy;
            if (dx === 0 && dy === 0) { dy = 1; }
            const eye_off = e_seg_size * 0.25;
            const eye_r = e_seg_size * 0.12;
            const fwd_x = dx * e_seg_size * 0.15;
            const fwd_y = dy * e_seg_size * 0.15;
            const perp_x = -dy * eye_off;
            const perp_y = dx * eye_off;

            ctx.fillStyle = e.is_boss ? '#ff0' : '#fff';
            ctx.beginPath();
            ctx.arc(hpos.x + fwd_x + perp_x, hpos.y + fwd_y + perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hpos.x + fwd_x - perp_x, hpos.y + fwd_y - perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();

            // Boss HP bar
            if (e.is_boss) {
                const bar_w = e_seg_size * 2;
                const bar_h = 4;
                const bar_x = hpos.x - bar_w / 2;
                const bar_y = hpos.y - e_half - 8;
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

    render_bullets(ctx, bullets, cell_size) {
        for (const b of bullets) {
            if (!b.alive) continue;

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

            // --- Thin tapered trail from stored positions ---
            if (b.trail.length >= 2) {
                ctx.lineCap = 'round';
                for (let i = 1; i < b.trail.length; i++) {
                    const frac = i / b.trail.length;
                    const alpha = frac * frac * 0.4 * fade;
                    const width = frac * base_r * 1.2;
                    ctx.strokeStyle = `rgba(0, 200, 50, ${alpha})`;
                    ctx.lineWidth = Math.max(0.3, width);
                    ctx.beginPath();
                    ctx.moveTo(b.trail[i - 1].x * cell_size, b.trail[i - 1].y * cell_size);
                    ctx.lineTo(b.trail[i].x * cell_size, b.trail[i].y * cell_size);
                    ctx.stroke();
                }
            }

            // --- Tiny green glow ---
            ctx.shadowColor = 'rgba(0, 255, 80, 0.5)';
            ctx.shadowBlur = base_r * 3;

            ctx.translate(px, py);
            ctx.rotate(angle);

            // --- Tiny fang: sleek curved tooth ---
            const fl = base_r * 2.8;  // fang length
            const fw = base_r * 0.7;  // fang width

            ctx.fillStyle = '#00cc33';
            ctx.beginPath();
            ctx.moveTo(fl, 0);
            ctx.bezierCurveTo(fl * 0.45, -fw * 0.7, -fl * 0.1, -fw, -fl * 0.3, -fw * 0.3);
            ctx.quadraticCurveTo(-fl * 0.38, 0, -fl * 0.3, fw * 0.3);
            ctx.bezierCurveTo(-fl * 0.1, fw, fl * 0.45, fw * 0.7, fl, 0);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;

            // --- Inner highlight ---
            ctx.fillStyle = 'rgba(120, 255, 140, 0.5)';
            ctx.beginPath();
            ctx.moveTo(fl * 0.8, 0);
            ctx.bezierCurveTo(fl * 0.35, -fw * 0.3, -fl * 0.05, -fw * 0.35, -fl * 0.15, 0);
            ctx.bezierCurveTo(-fl * 0.05, fw * 0.35, fl * 0.35, fw * 0.3, fl * 0.8, 0);
            ctx.closePath();
            ctx.fill();

            // --- Tiny venom drip at tip ---
            const pulse = 0.5 + Math.sin(b.age * 22 + b.wobble) * 0.5;
            ctx.fillStyle = `rgba(0, 255, 80, ${0.4 * pulse})`;
            ctx.beginPath();
            ctx.arc(fl + base_r * 0.15, 0, base_r * 0.2 * pulse, 0, Math.PI * 2);
            ctx.fill();

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
        for (const h of heart_drops) {
            if (!camera.is_visible(h.x, h.y)) continue;
            const cx = (h.x + 0.5) * cell_size;
            const cy = (h.y + 0.5) * cell_size;
            const s = size * (0.9 + pulse * 0.1);

            ctx.save();
            // Black background circle
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.78, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#ff2244';
            ctx.shadowBlur = 4 + pulse * 6;
            ctx.fillStyle = '#ff2244';
            ctx.beginPath();
            // Heart shape
            const top = cy - s * 0.3;
            ctx.moveTo(cx, cy + s * 0.5);
            ctx.bezierCurveTo(cx - s * 0.6, cy + s * 0.1, cx - s * 0.6, top - s * 0.2, cx - s * 0.3, top - s * 0.2);
            ctx.bezierCurveTo(cx - s * 0.05, top - s * 0.2, cx, top, cx, top + s * 0.15);
            ctx.bezierCurveTo(cx, top, cx + s * 0.05, top - s * 0.2, cx + s * 0.3, top - s * 0.2);
            ctx.bezierCurveTo(cx + s * 0.6, top - s * 0.2, cx + s * 0.6, cy + s * 0.1, cx, cy + s * 0.5);
            ctx.fill();
            ctx.restore();
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
        const dpr = window.devicePixelRatio || 1;
        const TICK = 60;

        // Same size as player: cell_size * 0.7
        const seg_px = Math.round(cell_size * 0.7 * dpr);
        const half_px = seg_px >> 1;

        // Helper: compute pixel position from grid coords
        const to_px = (gx, gy) => ({
            x: Math.round(((gx + 0.5) * cell_size + cam_offset_x) * dpr),
            y: Math.round(((gy + 0.5) * cell_size + cam_offset_y) * dpr),
        });

        // Helper: draw connected square segments (same as SnakeRenderer)
        const draw_segs = (positions, segs_data, color) => {
            if (positions.length === 0) return;
            ctx.fillStyle = color;

            // Connections
            for (let i = 0; i < positions.length - 1; i++) {
                const a = positions[i];
                const b = positions[i + 1];
                const adx = Math.abs(a.x - b.x);
                const ady = Math.abs(a.y - b.y);

                if (adx <= dpr || ady <= dpr) {
                    if (ady >= adx) {
                        ctx.fillRect(a.x - half_px, Math.min(a.y, b.y) - half_px, seg_px, ady + seg_px);
                    } else {
                        ctx.fillRect(Math.min(a.x, b.x) - half_px, a.y - half_px, adx + seg_px, seg_px);
                    }
                } else if (segs_data && segs_data[i]) {
                    // L-shaped corner via prev position
                    const s = segs_data[i];
                    const cx = Math.round(((s.prev_x + 0.5) * cell_size + cam_offset_x) * dpr);
                    const cy = Math.round(((s.prev_y + 0.5) * cell_size + cam_offset_y) * dpr);
                    ctx.fillRect(Math.min(a.x, cx) - half_px, Math.min(a.y, cy) - half_px,
                                 Math.abs(a.x - cx) + seg_px, Math.abs(a.y - cy) + seg_px);
                    ctx.fillRect(Math.min(b.x, cx) - half_px, Math.min(b.y, cy) - half_px,
                                 Math.abs(b.x - cx) + seg_px, Math.abs(b.y - cy) + seg_px);
                }
            }

            // Segment squares
            for (const p of positions) {
                ctx.fillRect(p.x - half_px, p.y - half_px, seg_px, seg_px);
            }
        };

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Dead trails — solid dark grey, no interpolation
        for (const trail of grey_snake.dead_trails) {
            const positions = trail.map(s => to_px(s.x, s.y));
            draw_segs(positions, null, '#555');
        }

        // Active snakes — interpolated
        for (const gs of grey_snake.snakes) {
            if (!gs.alive) continue;
            const segs = gs.segments;
            if (segs.length === 0) continue;

            const elapsed = now - gs.last_tick_time;
            const t = Math.min(elapsed / TICK, 1);

            // Build interpolated positions (head interpolates, body is static)
            const positions = [];
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                if (i === 0) {
                    // Head: interpolate
                    const lx = (s.prev_x + (s.x - s.prev_x) * t + 0.5) * cell_size;
                    const ly = (s.prev_y + (s.y - s.prev_y) * t + 0.5) * cell_size;
                    positions.push({
                        x: Math.round((lx + cam_offset_x) * dpr),
                        y: Math.round((ly + cam_offset_y) * dpr),
                    });
                } else {
                    positions.push(to_px(s.x, s.y));
                }
            }

            // Body
            draw_segs(positions, segs, '#666');

            // Head square (same as body)
            ctx.fillStyle = '#666';
            ctx.fillRect(positions[0].x - half_px, positions[0].y - half_px, seg_px, seg_px);

            // Eyes
            const dir = gs.direction;
            let ddx = dir.dx, ddy = dir.dy;
            if (ddx === 0 && ddy === 0) ddy = 1;
            const eye_off = seg_px * 0.25;
            const eye_r = seg_px * 0.12;
            const fwd_x = ddx * seg_px * 0.15;
            const fwd_y = ddy * seg_px * 0.15;
            const perp_x = -ddy * eye_off;
            const perp_y = ddx * eye_off;
            const hpx = positions[0].x;
            const hpy = positions[0].y;

            ctx.fillStyle = '#eee';
            ctx.beginPath();
            ctx.arc(hpx + fwd_x + perp_x, hpy + fwd_y + perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hpx + fwd_x - perp_x, hpy + fwd_y - perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#111';
            const pr = eye_r * 0.5;
            ctx.beginPath();
            ctx.arc(hpx + fwd_x + perp_x, hpy + fwd_y + perp_y, pr, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hpx + fwd_x - perp_x, hpy + fwd_y - perp_y, pr, 0, Math.PI * 2);
            ctx.fill();
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

        for (const e of enemies) {
            if (!e.alive) continue;
            if (e.is_boss) {
                ctx.fillStyle = 'rgba(187, 68, 255, 0.9)';
                const dot = 5;
                ctx.fillRect(mx + e.x * scale - dot / 2, my + e.y * scale - dot / 2, dot, dot);
            } else {
                ctx.fillStyle = e.is_splitter ? 'rgba(60, 130, 220, 0.8)' : 'rgba(200, 0, 0, 0.6)';
                const dot = e.is_splitter ? 3 : 2;
                ctx.fillRect(mx + e.x * scale - dot / 2, my + e.y * scale - dot / 2, dot, dot);
            }
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
