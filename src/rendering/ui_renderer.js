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

    draw_item_picker(ctx, items, selected_index, w, h) {
        if (h === undefined) { h = w; }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CHOOSE AN ITEM', w / 2, 60);

        const card_width = 160;
        const card_height = 290;
        const gap = 20;
        const total_width = items.length * card_width + (items.length - 1) * gap;
        const start_x = (w - total_width) / 2;
        const card_y = (h - card_height) / 2 - 20;

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
            ctx.font = 'bold 13px monospace';
            ctx.fillText(item.name, x + card_width / 2, y + 30);

            // "NEW" badge for powerups the player doesn't own yet
            if (item.is_new) {
                const bw = 36, bh = 16;
                const bx = x + card_width - bw - 6;
                const by = y + 6;
                ctx.fillStyle = '#0f0';
                ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px monospace';
                ctx.fillText('NEW', bx + bw / 2, by + bh / 2);
            }

            // Level pips and label
            if (item.max_rank != null && item.current_level != null) {
                const cur = item.current_level;
                const next = cur + 1;
                const max = item.max_rank;

                if (max > 1) {
                    // Draw level pips
                    const pip_w = 8, pip_h = 5, pip_gap = 3;
                    const pips_total_w = max * pip_w + (max - 1) * pip_gap;
                    const pips_x = x + (card_width - pips_total_w) / 2;
                    const pips_y = y + 46;
                    for (let p = 0; p < max; p++) {
                        const px = pips_x + p * (pip_w + pip_gap);
                        if (p < cur) {
                            ctx.fillStyle = '#0ff';           // owned levels
                        } else if (p === cur) {
                            ctx.fillStyle = '#fff';           // the level you're upgrading to
                        } else {
                            ctx.fillStyle = '#333';           // locked levels
                        }
                        ctx.fillRect(px, pips_y, pip_w, pip_h);
                    }

                    // "Lv X → Y" label
                    ctx.fillStyle = '#888';
                    ctx.font = '10px monospace';
                    ctx.fillText('Lv ' + cur + ' \u2192 ' + next, x + card_width / 2, pips_y + pip_h + 10);
                }
            }

            // Draw SVG icon
            const icon = item.id ? get_powerup_icon(item.id) : null;
            if (icon) {
                const icon_draw_size = 48;
                const icon_x = x + (card_width - icon_draw_size) / 2;
                const icon_y = y + 68;
                ctx.drawImage(icon, icon_x, icon_y, icon_draw_size, icon_draw_size);
            }

            // Description (flavor text)
            ctx.fillStyle = '#aaa';
            ctx.font = '10px monospace';
            const desc_words = item.description.split(' ');
            let desc_line = '';
            let desc_y = y + 130;
            for (const word of desc_words) {
                const test = desc_line + word + ' ';
                if (test.length > 20) {
                    ctx.fillText(desc_line.trim(), x + card_width / 2, desc_y);
                    desc_line = word + ' ';
                    desc_y += 12;
                } else {
                    desc_line = test;
                }
            }
            if (desc_line.trim()) ctx.fillText(desc_line.trim(), x + card_width / 2, desc_y);

            // Stats (what it buffs)
            if (item.stats) {
                desc_y += 16;
                ctx.fillStyle = '#0ff';
                ctx.font = 'bold 10px monospace';
                const stat_parts = item.stats.split(' | ');
                for (const part of stat_parts) {
                    const stat_words = part.split(' ');
                    let stat_line = '';
                    for (const word of stat_words) {
                        const test = stat_line + word + ' ';
                        if (test.length > 20) {
                            ctx.fillText(stat_line.trim(), x + card_width / 2, desc_y);
                            stat_line = word + ' ';
                            desc_y += 12;
                        } else {
                            stat_line = test;
                        }
                    }
                    if (stat_line.trim()) ctx.fillText(stat_line.trim(), x + card_width / 2, desc_y);
                    desc_y += 12;
                }
            }

            ctx.fillStyle = '#555';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('[' + (i + 1) + ']', x + card_width / 2, y + card_height - 15);
        }
    }
}
