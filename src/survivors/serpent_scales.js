/**
 * Serpent's Scales — shield effect power-up.
 *
 * Level 1-3: 1 shield charge
 * Level 4-5: 2 shield charges
 * Level 6-8: 3 shield charges
 *
 * Each consumed charge regenerates after a cooldown that decreases with level.
 * When an enemy touches the player head the shield absorbs the hit instead of
 * taking HP damage, consumes one charge, and puts that charge on cooldown.
 */

const BASE_COOLDOWN = 10;          // seconds at level 1
const MIN_COOLDOWN = 4;            // seconds at level 8
const CHARGES_BY_LEVEL = [0, 1, 1, 1, 2, 2, 3, 3, 3]; // index = level (0-8)

export class SerpentScales {
    constructor() {
        this.level = 0;
        this.max_charges = 0;
        this.charges = 0;           // current active charges
        this.cooldown_timer = 0;    // seconds remaining until next charge regenerates
        this.cooldown_duration = BASE_COOLDOWN;
    }

    /** Call when the powerup rank changes. */
    set_level(level) {
        const prev_max = this.max_charges;
        this.level = level;
        this.max_charges = CHARGES_BY_LEVEL[level] || 0;
        this.cooldown_duration = level > 0
            ? BASE_COOLDOWN - (BASE_COOLDOWN - MIN_COOLDOWN) * ((level - 1) / 7)
            : BASE_COOLDOWN;

        // Grant any newly-unlocked charges immediately
        if (this.max_charges > prev_max) {
            this.charges += this.max_charges - prev_max;
        }
    }

    /**
     * Try to absorb a hit. Returns true if the shield blocked it.
     */
    absorb_hit() {
        if (this.charges > 0) {
            this.charges--;
            // Start cooldown to regen a charge (only if not already ticking)
            if (this.cooldown_timer <= 0) {
                this.cooldown_timer = this.cooldown_duration;
            }
            return true;
        }
        return false;
    }

    update(dt) {
        if (this.level === 0) return;

        // Regenerate charges over time
        if (this.charges < this.max_charges) {
            this.cooldown_timer -= dt;
            if (this.cooldown_timer <= 0) {
                this.charges++;
                // If still missing charges, restart cooldown
                if (this.charges < this.max_charges) {
                    this.cooldown_timer = this.cooldown_duration;
                } else {
                    this.cooldown_timer = 0;
                }
            }
        }
    }

    /**
     * Render a clean blue outline on the OUTSIDE of the snake only.
     * Uses an offscreen canvas: draw expanded shape, cut out interior,
     * composite the remaining outer border onto the main canvas.
     */
    render(ctx, segments, cell_size, t, cam_offset_x, cam_offset_y, now) {
        if (this.charges <= 0) return;

        const dpr = 1;
        const seg_px = Math.round(cell_size * 0.7 * dpr);
        const half_px = seg_px >> 1;
        const outline = 2;

        const pulse = (Math.sin(now / 400) + 1) / 2;
        const alpha = 0.5 + pulse * 0.3;

        // Compute screen positions
        const positions = [];
        for (const s of segments) {
            const lx = s.x !== s.prev_x
                ? (s.prev_x + (s.x - s.prev_x) * t + 0.5) * cell_size
                : (s.x + 0.5) * cell_size;
            const ly = s.y !== s.prev_y
                ? (s.prev_y + (s.y - s.prev_y) * t + 0.5) * cell_size
                : (s.y + 0.5) * cell_size;
            positions.push({
                x: Math.round((lx + cam_offset_x) * dpr),
                y: Math.round((ly + cam_offset_y) * dpr),
            });
        }

        // Ensure offscreen canvas matches main canvas size
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        if (!this._oc || this._oc.width !== w || this._oc.height !== h) {
            this._oc = document.createElement('canvas');
            this._oc.width = w;
            this._oc.height = h;
            this._octx = this._oc.getContext('2d');
        }
        const oc = this._octx;
        oc.clearRect(0, 0, w, h);

        // Helper: draw the full snake body shape with an expand offset
        const draw_body = (expand) => {
            const hp = half_px + expand;
            const sp = seg_px + expand * 2;

            // Connections between adjacent segments
            for (let i = 0; i < positions.length - 1; i++) {
                const a = positions[i];
                const b = positions[i + 1];
                const dx = Math.abs(a.x - b.x);
                const dy = Math.abs(a.y - b.y);

                if (dx <= dpr || dy <= dpr) {
                    if (dy >= dx) {
                        oc.fillRect(a.x - hp, Math.min(a.y, b.y) - hp, sp, dy + sp);
                    } else {
                        oc.fillRect(Math.min(a.x, b.x) - hp, a.y - hp, dx + sp, sp);
                    }
                } else {
                    // Corner
                    const s = segments[i];
                    const cl = (s.prev_x + 0.5) * cell_size;
                    const ct = (s.prev_y + 0.5) * cell_size;
                    const cx = Math.round((cl + cam_offset_x) * dpr);
                    const cy = Math.round((ct + cam_offset_y) * dpr);

                    oc.fillRect(Math.min(a.x, cx) - hp, Math.min(a.y, cy) - hp,
                                Math.abs(a.x - cx) + sp, Math.abs(a.y - cy) + sp);
                    oc.fillRect(Math.min(b.x, cx) - hp, Math.min(b.y, cy) - hp,
                                Math.abs(b.x - cx) + sp, Math.abs(b.y - cy) + sp);
                }
            }
            // Segment caps
            for (const pos of positions) {
                oc.fillRect(pos.x - hp, pos.y - hp, sp, sp);
            }
        };

        // Pass 1: draw expanded snake shape in opaque blue
        oc.fillStyle = 'rgb(80, 180, 255)';
        draw_body(outline);

        // Pass 2: cut out the interior, leaving only the outer border
        oc.globalCompositeOperation = 'destination-out';
        oc.fillStyle = 'rgba(0,0,0,1)';
        draw_body(0);
        oc.globalCompositeOperation = 'source-over';

        // Composite onto main canvas with pulsing alpha
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this._oc, 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    clear() {
        this.charges = 0;
        this.cooldown_timer = 0;
    }
}
