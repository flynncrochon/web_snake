export class SurvivorsRenderer {

    render_enemies(ctx, enemies, cell_size) {
        const now = performance.now();
        const seg_size = Math.ceil(cell_size * 0.55);
        const half = seg_size / 2;
        const pad = 1;

        for (const e of enemies) {
            if (!e.alive) continue;

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
            ctx.fillStyle = e.body_color;
            for (let k = 0; k < segs.length - 1; k++) {
                const a = positions[k];
                const b = positions[k + 1];
                const cx = (segs[k].prev_x + 0.5) * cell_size;
                const cy = (segs[k].prev_y + 0.5) * cell_size;

                // a -> prev
                const x1 = Math.min(a.x, cx) - half - pad;
                const y1 = Math.min(a.y, cy) - half - pad;
                const w1 = Math.max(a.x, cx) - Math.min(a.x, cx) + seg_size + pad * 2;
                const h1 = Math.max(a.y, cy) - Math.min(a.y, cy) + seg_size + pad * 2;
                ctx.fillRect(x1, y1, w1, h1);

                // prev -> b
                const x2 = Math.min(b.x, cx) - half - pad;
                const y2 = Math.min(b.y, cy) - half - pad;
                const w2 = Math.max(b.x, cx) - Math.min(b.x, cx) + seg_size + pad * 2;
                const h2 = Math.max(b.y, cy) - Math.min(b.y, cy) + seg_size + pad * 2;
                ctx.fillRect(x2, y2, w2, h2);
            }

            // Body segment squares
            for (let i = 1; i < positions.length; i++) {
                ctx.fillRect(positions[i].x - half, positions[i].y - half, seg_size, seg_size);
            }

            // Head (brighter)
            ctx.fillStyle = e.color;
            ctx.fillRect(positions[0].x - half, positions[0].y - half, seg_size, seg_size);

            // Eyes on head
            const hpos = positions[0];
            let dx = e.direction.dx, dy = e.direction.dy;
            if (dx === 0 && dy === 0) { dy = 1; }
            const eye_off = seg_size * 0.25;
            const eye_r = seg_size * 0.12;
            const fwd_x = dx * seg_size * 0.15;
            const fwd_y = dy * seg_size * 0.15;
            const perp_x = -dy * eye_off;
            const perp_y = dx * eye_off;

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(hpos.x + fwd_x + perp_x, hpos.y + fwd_y + perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hpos.x + fwd_x - perp_x, hpos.y + fwd_y - perp_y, eye_r, 0, Math.PI * 2);
            ctx.fill();
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

    render_arena_border(ctx, arena_size, cell_size) {
        const total = arena_size * cell_size;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, total, total);
    }

    render_minimap(ctx, player_snake, enemies, arena_size, view_width, view_height) {
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

        ctx.fillStyle = 'rgba(200, 0, 0, 0.6)';
        for (const e of enemies) {
            if (!e.alive) continue;
            ctx.fillRect(mx + e.x * scale - 0.5, my + e.y * scale - 0.5, 2, 2);
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
