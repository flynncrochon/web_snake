export class SnakeRenderer {
    render(ctx, snake, cell_size, t, color = '#fff', size_multiplier = 1.0, cam_offset_x = null, cam_offset_y = null) {
        const seg_size = Math.ceil(cell_size * 0.7 * size_multiplier);
        const half = seg_size / 2;
        const use_snap = cam_offset_x !== null;
        ctx.fillStyle = color;

        const positions = [];
        for (const seg of snake) {
            let px = (seg.prev_x + (seg.x - seg.prev_x) * t + 0.5) * cell_size;
            let py = (seg.prev_y + (seg.y - seg.prev_y) * t + 0.5) * cell_size;
            if (use_snap) {
                px = Math.round(px + cam_offset_x) - cam_offset_x;
                py = Math.round(py + cam_offset_y) - cam_offset_y;
            }
            positions.push({ x: px, y: py });
        }

        for (let i = 0; i < positions.length - 1; i++) {
            const a = positions[i];
            const b = positions[i + 1];

            if (Math.abs(a.x - b.x) < 1) {
                const cx = (a.x + b.x) / 2;
                ctx.fillRect(cx - half, Math.min(a.y, b.y) - half, seg_size, Math.abs(a.y - b.y) + seg_size);
            } else if (Math.abs(a.y - b.y) < 1) {
                const cy = (a.y + b.y) / 2;
                ctx.fillRect(Math.min(a.x, b.x) - half, cy - half, Math.abs(a.x - b.x) + seg_size, seg_size);
            } else {
                // Corner: compute the grid corner where the turn happens
                let cx = (snake[i].prev_x + 0.5) * cell_size;
                let cy = (snake[i].prev_y + 0.5) * cell_size;
                if (use_snap) {
                    cx = Math.round(cx + cam_offset_x) - cam_offset_x;
                    cy = Math.round(cy + cam_offset_y) - cam_offset_y;
                }
                // Connect a to corner
                ctx.fillRect(Math.min(a.x, cx) - half, Math.min(a.y, cy) - half,
                    Math.abs(a.x - cx) + seg_size, Math.abs(a.y - cy) + seg_size);
                // Connect b to corner
                ctx.fillRect(Math.min(b.x, cx) - half, Math.min(b.y, cy) - half,
                    Math.abs(b.x - cx) + seg_size, Math.abs(b.y - cy) + seg_size);
            }
        }

        for (const pos of positions) {
            ctx.fillRect(pos.x - half, pos.y - half, seg_size, seg_size);
        }
    }
}
