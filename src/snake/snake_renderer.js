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

    render_face(ctx, cx, cy, seg_size, direction, face_type, use_pixel_space = false) {
        if (use_pixel_space) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        const dx = direction.dx;
        const dy = direction.dy;
        const perp_x = -dy;
        const perp_y = dx;
        const half = seg_size / 2;

        const eye_off = seg_size * 0.25;
        const fwd_off = seg_size * 0.12;

        const lex = cx + perp_x * eye_off + dx * fwd_off;
        const ley = cy + perp_y * eye_off + dy * fwd_off;
        const rex = cx - perp_x * eye_off + dx * fwd_off;
        const rey = cy - perp_y * eye_off + dy * fwd_off;

        switch (face_type) {
            case 'cobra': {
                // Round white eyes with black pupils
                const eye_sz = Math.max(2, Math.round(seg_size * 0.24));
                const pupil_sz = Math.max(1, Math.round(seg_size * 0.12));
                const ehalf = eye_sz >> 1;
                const phalf = pupil_sz >> 1;
                const poff = seg_size * 0.04;

                ctx.fillStyle = '#fff';
                ctx.fillRect(lex - ehalf, ley - ehalf, eye_sz, eye_sz);
                ctx.fillRect(rex - ehalf, rey - ehalf, eye_sz, eye_sz);

                ctx.fillStyle = '#111';
                ctx.fillRect(lex + dx * poff - phalf, ley + dy * poff - phalf, pupil_sz, pupil_sz);
                ctx.fillRect(rex + dx * poff - phalf, rey + dy * poff - phalf, pupil_sz, pupil_sz);
                break;
            }
            case 'viper': {
                // Yellow-orange slit eyes with white fangs
                const eye_w = Math.max(2, Math.round(seg_size * 0.1));
                const eye_h = Math.max(3, Math.round(seg_size * 0.26));
                const slit_w = Math.max(1, Math.round(seg_size * 0.04));
                const slit_h = Math.max(2, Math.round(seg_size * 0.22));

                ctx.fillStyle = '#ffaa00';
                if (dx !== 0) {
                    ctx.fillRect(lex - eye_w / 2, ley - eye_h / 2, eye_w, eye_h);
                    ctx.fillRect(rex - eye_w / 2, rey - eye_h / 2, eye_w, eye_h);
                } else {
                    ctx.fillRect(lex - eye_h / 2, ley - eye_w / 2, eye_h, eye_w);
                    ctx.fillRect(rex - eye_h / 2, rey - eye_w / 2, eye_h, eye_w);
                }

                ctx.fillStyle = '#111';
                if (dx !== 0) {
                    ctx.fillRect(lex - slit_w / 2, ley - slit_h / 2, slit_w, slit_h);
                    ctx.fillRect(rex - slit_w / 2, rey - slit_h / 2, slit_w, slit_h);
                } else {
                    ctx.fillRect(lex - slit_h / 2, ley - slit_w / 2, slit_h, slit_w);
                    ctx.fillRect(rex - slit_h / 2, rey - slit_w / 2, slit_h, slit_w);
                }

                // Fangs extending forward
                const fang_sz = Math.max(1, Math.round(seg_size * 0.08));
                const fang_fwd = half * 0.85;
                const fang_spread = seg_size * 0.14;
                const fx = cx + dx * fang_fwd;
                const fy = cy + dy * fang_fwd;
                ctx.fillStyle = '#fff';
                ctx.fillRect(fx + perp_x * fang_spread - fang_sz / 2, fy + perp_y * fang_spread - fang_sz / 2, fang_sz, fang_sz);
                ctx.fillRect(fx - perp_x * fang_spread - fang_sz / 2, fy - perp_y * fang_spread - fang_sz / 2, fang_sz, fang_sz);
                break;
            }
            case 'asp': {
                // Small red eyes + forked red tongue
                const eye_sz = Math.max(2, Math.round(seg_size * 0.16));
                const ehalf = eye_sz >> 1;

                ctx.fillStyle = '#ff3333';
                ctx.fillRect(lex - ehalf, ley - ehalf, eye_sz, eye_sz);
                ctx.fillRect(rex - ehalf, rey - ehalf, eye_sz, eye_sz);

                // Forked tongue extending forward
                const tongue_start_x = cx + dx * half * 0.5;
                const tongue_start_y = cy + dy * half * 0.5;
                const tongue_len = seg_size * 0.55;
                const fork_len = seg_size * 0.2;
                const fork_spread = seg_size * 0.14;

                const tend_x = tongue_start_x + dx * tongue_len;
                const tend_y = tongue_start_y + dy * tongue_len;

                ctx.strokeStyle = '#ff2222';
                ctx.lineWidth = Math.max(1, seg_size * 0.06);
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(tongue_start_x, tongue_start_y);
                ctx.lineTo(tend_x, tend_y);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tend_x, tend_y);
                ctx.lineTo(tend_x + dx * fork_len + perp_x * fork_spread,
                          tend_y + dy * fork_len + perp_y * fork_spread);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(tend_x, tend_y);
                ctx.lineTo(tend_x + dx * fork_len - perp_x * fork_spread,
                          tend_y + dy * fork_len - perp_y * fork_spread);
                ctx.stroke();
                break;
            }
            case 'basilisk': {
                // Green diamond eyes with dark slit + toxic drip
                const eye_sz = Math.max(2, Math.round(seg_size * 0.16));

                ctx.fillStyle = '#44ff44';
                ctx.beginPath();
                ctx.moveTo(lex + dx * eye_sz, ley + dy * eye_sz);
                ctx.lineTo(lex + perp_x * eye_sz, ley + perp_y * eye_sz);
                ctx.lineTo(lex - dx * eye_sz, ley - dy * eye_sz);
                ctx.lineTo(lex - perp_x * eye_sz, ley - perp_y * eye_sz);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(rex + dx * eye_sz, rey + dy * eye_sz);
                ctx.lineTo(rex + perp_x * eye_sz, rey + perp_y * eye_sz);
                ctx.lineTo(rex - dx * eye_sz, rey - dy * eye_sz);
                ctx.lineTo(rex - perp_x * eye_sz, rey - perp_y * eye_sz);
                ctx.closePath();
                ctx.fill();

                // Dark slit pupils
                const slit_sz = eye_sz * 0.35;
                ctx.fillStyle = '#003300';
                ctx.beginPath();
                ctx.moveTo(lex + dx * eye_sz * 0.7, ley + dy * eye_sz * 0.7);
                ctx.lineTo(lex + perp_x * slit_sz, ley + perp_y * slit_sz);
                ctx.lineTo(lex - dx * eye_sz * 0.7, ley - dy * eye_sz * 0.7);
                ctx.lineTo(lex - perp_x * slit_sz, ley - perp_y * slit_sz);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(rex + dx * eye_sz * 0.7, rey + dy * eye_sz * 0.7);
                ctx.lineTo(rex + perp_x * slit_sz, rey + perp_y * slit_sz);
                ctx.lineTo(rex - dx * eye_sz * 0.7, rey - dy * eye_sz * 0.7);
                ctx.lineTo(rex - perp_x * slit_sz, rey - perp_y * slit_sz);
                ctx.closePath();
                ctx.fill();

                // Toxic drip from front of head
                const drip_sz = Math.max(1, Math.round(seg_size * 0.08));
                const drip_x = cx + dx * half * 0.9 - drip_sz / 2;
                const drip_y = cy + dy * half * 0.9 - drip_sz / 2;
                ctx.fillStyle = '#00ff00';
                ctx.globalAlpha = 0.7;
                ctx.fillRect(drip_x, drip_y, drip_sz, drip_sz);
                ctx.globalAlpha = 1;
                break;
            }
        }
        if (use_pixel_space) {
            ctx.restore();
        }
    }
}
