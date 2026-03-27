import { get_powerup_icon, ICON_SIZE } from './powerup_icons.js';

export class UIRenderer {
    draw_overlay(ctx, text, w, h) {
        if (h === undefined) { h = w; }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, h / 2 - 30, w, 60);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2);
    }

    draw_menu(ctx, title, options, selected_index, logical_size) {
        const size = logical_size;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, size - 4, size - 4);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, size / 2, size * 0.2);

        ctx.font = 'bold 18px monospace';
        const start_y = size * 0.4;
        const line_height = 40;

        for (let i = 0; i < options.length; i++) {
            const y = start_y + i * line_height;
            if (i === selected_index) {
                ctx.fillStyle = '#0ff';
                ctx.fillText('> ' + options[i].label + ' <', size / 2, y);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillText(options[i].label, size / 2, y);
            }

            if (options[i].description) {
                ctx.font = '12px monospace';
                ctx.fillStyle = '#666';
                ctx.fillText(options[i].description, size / 2, y + 18);
                ctx.font = 'bold 18px monospace';
            }
        }
    }

    draw_item_picker(ctx, items, selected_index, w, h, mobile) {
        if (h === undefined) { h = w; }

        // Scale factor: on mobile, size cards relative to screen; on desktop use fixed sizes
        const s = mobile ? Math.min(w, h) / 520 : 1;
        const card_width = Math.floor(160 * s);
        const card_height = Math.floor(290 * s);
        const gap = Math.floor(20 * s);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(22 * s)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHOOSE AN ITEM', w / 2, Math.floor(60 * s));

        const total_width = items.length * card_width + (items.length - 1) * gap;
        const start_x = (w - total_width) / 2;
        const card_y = (h - card_height) / 2 - Math.floor(20 * s);

        const name_font = Math.floor(13 * s);
        const small_font = Math.floor(10 * s);
        const label_font = Math.floor(14 * s);
        const icon_draw_size = Math.floor(48 * s);
        const line_h = Math.floor(12 * s);
        const max_chars = Math.max(12, Math.floor(20 * s));

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const x = start_x + i * (card_width + gap);
            const y = card_y;

            ctx.strokeStyle = i === selected_index ? '#0ff' : '#555';
            ctx.lineWidth = i === selected_index ? 3 : 1;
            ctx.strokeRect(x, y, card_width, card_height);

            ctx.fillStyle = item.type === 'curse' ? 'rgba(80, 0, 0, 0.5)' : 'rgba(30, 30, 30, 0.8)';
            ctx.fillRect(x + 1, y + 1, card_width - 2, card_height - 2);

            ctx.fillStyle = item.type === 'curse' ? '#f44' : '#fff';
            ctx.font = `bold ${name_font}px monospace`;
            ctx.fillText(item.name, x + card_width / 2, y + Math.floor(30 * s));

            // "NEW" badge for powerups the player doesn't own yet
            if (item.is_new) {
                const bw = Math.floor(36 * s), bh = Math.floor(16 * s);
                const bx = x + card_width - bw - Math.floor(6 * s);
                const by = y + Math.floor(6 * s);
                ctx.fillStyle = '#0f0';
                ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = '#000';
                ctx.font = `bold ${small_font}px monospace`;
                ctx.fillText('NEW', bx + bw / 2, by + bh / 2);
            }

            // Level pips and label
            if (item.max_rank != null && item.current_level != null) {
                const cur = item.current_level;
                const next = cur + 1;
                const max = item.max_rank;

                if (max > 1) {
                    const pip_w = Math.floor(8 * s), pip_h = Math.floor(5 * s), pip_gap = Math.floor(3 * s);
                    const pips_total_w = max * pip_w + (max - 1) * pip_gap;
                    const pips_x = x + (card_width - pips_total_w) / 2;
                    const pips_y = y + Math.floor(46 * s);
                    for (let p = 0; p < max; p++) {
                        const px = pips_x + p * (pip_w + pip_gap);
                        if (p < cur) {
                            ctx.fillStyle = '#0ff';
                        } else if (p === cur) {
                            ctx.fillStyle = '#fff';
                        } else {
                            ctx.fillStyle = '#333';
                        }
                        ctx.fillRect(px, pips_y, pip_w, pip_h);
                    }

                    ctx.fillStyle = '#888';
                    ctx.font = `${small_font}px monospace`;
                    ctx.fillText('Lv ' + cur + ' \u2192 ' + next, x + card_width / 2, pips_y + pip_h + Math.floor(10 * s));
                }
            }

            // Draw SVG icon
            const icon = item.id ? get_powerup_icon(item.id) : null;
            if (icon) {
                const icon_x = x + (card_width - icon_draw_size) / 2;
                const icon_y = y + Math.floor(68 * s);
                ctx.drawImage(icon, icon_x, icon_y, icon_draw_size, icon_draw_size);
            }

            // Description (flavor text)
            ctx.fillStyle = '#aaa';
            ctx.font = `${small_font}px monospace`;
            const desc_words = item.description.split(' ');
            let desc_line = '';
            let desc_y = y + Math.floor(130 * s);
            for (const word of desc_words) {
                const test = desc_line + word + ' ';
                if (test.length > max_chars) {
                    ctx.fillText(desc_line.trim(), x + card_width / 2, desc_y);
                    desc_line = word + ' ';
                    desc_y += line_h;
                } else {
                    desc_line = test;
                }
            }
            if (desc_line.trim()) ctx.fillText(desc_line.trim(), x + card_width / 2, desc_y);

            // Stats (what it buffs)
            if (item.stats) {
                desc_y += Math.floor(16 * s);
                ctx.fillStyle = '#0ff';
                ctx.font = `bold ${small_font}px monospace`;
                const stat_parts = item.stats.split(' | ');
                for (const part of stat_parts) {
                    const stat_words = part.split(' ');
                    let stat_line = '';
                    for (const word of stat_words) {
                        const test = stat_line + word + ' ';
                        if (test.length > max_chars) {
                            ctx.fillText(stat_line.trim(), x + card_width / 2, desc_y);
                            stat_line = word + ' ';
                            desc_y += line_h;
                        } else {
                            stat_line = test;
                        }
                    }
                    if (stat_line.trim()) ctx.fillText(stat_line.trim(), x + card_width / 2, desc_y);
                    desc_y += line_h;
                }
            }

            ctx.fillStyle = '#555';
            ctx.font = `bold ${label_font}px monospace`;
            ctx.fillText(mobile ? 'TAP' : '[' + (i + 1) + ']', x + card_width / 2, y + card_height - Math.floor(15 * s));
        }
    }
}
