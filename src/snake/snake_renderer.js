export class SnakeRenderer {
    render(ctx, snake, cell_size, t, color = '#fff', size_multiplier = 1.0, cam_offset_x = null, cam_offset_y = null) {
        // Use 1 for DPR — game canvas renders at DPR=1 for performance
        const dpr = 1;
        const use_cam = cam_offset_x !== null;

        const seg_px = Math.round(cell_size * 0.7 * size_multiplier * dpr);
        const half_px = seg_px >> 1;

        // Bypass DPR transform — draw directly in integer physical pixels
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = color;

        // Compute screen positions in physical pixels (integers)
        const positions = [];
        for (const s of snake) {
            let lx = s.x !== s.prev_x
                ? (s.prev_x + (s.x - s.prev_x) * t + 0.5) * cell_size
                : (s.x + 0.5) * cell_size;
            let ly = s.y !== s.prev_y
                ? (s.prev_y + (s.y - s.prev_y) * t + 0.5) * cell_size
                : (s.y + 0.5) * cell_size;

            positions.push({
                x: Math.round((lx + (use_cam ? cam_offset_x : 0)) * dpr),
                y: Math.round((ly + (use_cam ? cam_offset_y : 0)) * dpr),
            });
        }

        // Connect adjacent segments
        for (let i = 0; i < positions.length - 1; i++) {
            const a = positions[i];
            const b = positions[i + 1];
            const dx = Math.abs(a.x - b.x);
            const dy = Math.abs(a.y - b.y);

            if (dx <= dpr || dy <= dpr) {
                if (dy >= dx) {
                    ctx.fillRect(a.x - half_px, Math.min(a.y, b.y) - half_px,
                                 seg_px, dy + seg_px);
                } else {
                    ctx.fillRect(Math.min(a.x, b.x) - half_px, a.y - half_px,
                                 dx + seg_px, seg_px);
                }
            } else {
                // Corner
                const cl = (snake[i].prev_x + 0.5) * cell_size;
                const ct = (snake[i].prev_y + 0.5) * cell_size;
                const cx = Math.round((cl + (use_cam ? cam_offset_x : 0)) * dpr);
                const cy = Math.round((ct + (use_cam ? cam_offset_y : 0)) * dpr);

                ctx.fillRect(Math.min(a.x, cx) - half_px, Math.min(a.y, cy) - half_px,
                             Math.abs(a.x - cx) + seg_px, Math.abs(a.y - cy) + seg_px);
                ctx.fillRect(Math.min(b.x, cx) - half_px, Math.min(b.y, cy) - half_px,
                             Math.abs(b.x - cx) + seg_px, Math.abs(b.y - cy) + seg_px);
            }
        }

        // Segment caps
        for (const pos of positions) {
            ctx.fillRect(pos.x - half_px, pos.y - half_px, seg_px, seg_px);
        }

        ctx.restore();
    }
}
