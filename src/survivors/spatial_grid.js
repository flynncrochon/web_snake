// Flat spatial hash grid for O(1) cell lookup enemy queries.
// Rebuilt every frame after enemy positions are updated.
// Cell size 4 balances query radius vs enemies-per-cell for this game's parameters.

export class SpatialGrid {
    constructor(arena_size, cell_size = 4) {
        this.cell_size = cell_size;
        this.inv_cell = 1 / cell_size;
        this.cols = Math.ceil(arena_size / cell_size);
        this.rows = this.cols;
        this.cell_count = this.cols * this.rows;

        this.counts = new Int32Array(this.cell_count);
        this.offsets = new Int32Array(this.cell_count);
        this.cursors = new Int32Array(this.cell_count);
        this.sorted = [];
        this.alive_count = 0;
    }

    // Call once per frame after enemy positions are finalized.
    rebuild(enemies) {
        const counts = this.counts;
        const offsets = this.offsets;
        const cursors = this.cursors;
        const inv = this.inv_cell;
        const cols = this.cols;
        const rows = this.rows;
        const cell_count = this.cell_count;

        // Clear counts
        counts.fill(0);

        // Count pass
        let alive = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            const cx = (e.x * inv) | 0;
            const cy = (e.y * inv) | 0;
            if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                counts[cy * cols + cx]++;
                alive++;
            }
        }

        // Prefix sum
        offsets[0] = 0;
        for (let i = 1; i < cell_count; i++) {
            offsets[i] = offsets[i - 1] + counts[i - 1];
        }

        // Ensure sorted array capacity
        if (this.sorted.length < alive) {
            this.sorted = new Array(alive);
        }
        this.alive_count = alive;

        // Copy offsets to cursors for scatter pass
        cursors.set(offsets);

        // Scatter pass
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            const cx = (e.x * inv) | 0;
            const cy = (e.y * inv) | 0;
            if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                const idx = cy * cols + cx;
                this.sorted[cursors[idx]++] = e;
            }
        }
    }

    // Query all alive enemies within radius of (qx, qy). Calls callback(enemy) for each.
    query_radius(qx, qy, radius, callback) {
        const inv = this.inv_cell;
        const cols = this.cols;
        const rows = this.rows;
        const r_sq = radius * radius;

        const min_cx = Math.max(0, ((qx - radius) * inv) | 0);
        const max_cx = Math.min(cols - 1, ((qx + radius) * inv) | 0);
        const min_cy = Math.max(0, ((qy - radius) * inv) | 0);
        const max_cy = Math.min(rows - 1, ((qy + radius) * inv) | 0);

        const counts = this.counts;
        const offsets = this.offsets;
        const sorted = this.sorted;

        for (let cy = min_cy; cy <= max_cy; cy++) {
            const row_off = cy * cols;
            for (let cx = min_cx; cx <= max_cx; cx++) {
                const cell = row_off + cx;
                const start = offsets[cell];
                const end = start + counts[cell];
                for (let i = start; i < end; i++) {
                    const e = sorted[i];
                    if (!e.alive) continue;
                    const dx = e.x - qx;
                    const dy = e.y - qy;
                    if (dx * dx + dy * dy <= r_sq) {
                        callback(e);
                    }
                }
            }
        }
    }

    // Returns an array of enemies within radius.
    query_radius_array(qx, qy, radius) {
        const results = [];
        this.query_radius(qx, qy, radius, e => results.push(e));
        return results;
    }

    // Find nearest alive enemy within radius, optionally excluding a Set.
    query_nearest(qx, qy, radius, exclude_set) {
        const inv = this.inv_cell;
        const cols = this.cols;
        const rows = this.rows;
        let best_dist_sq = radius * radius;

        const min_cx = Math.max(0, ((qx - radius) * inv) | 0);
        const max_cx = Math.min(cols - 1, ((qx + radius) * inv) | 0);
        const min_cy = Math.max(0, ((qy - radius) * inv) | 0);
        const max_cy = Math.min(rows - 1, ((qy + radius) * inv) | 0);

        const counts = this.counts;
        const offsets = this.offsets;
        const sorted = this.sorted;

        let best = null;

        for (let cy = min_cy; cy <= max_cy; cy++) {
            const row_off = cy * cols;
            for (let cx = min_cx; cx <= max_cx; cx++) {
                const cell = row_off + cx;
                const start = offsets[cell];
                const end = start + counts[cell];
                for (let i = start; i < end; i++) {
                    const e = sorted[i];
                    if (!e.alive) continue;
                    if (exclude_set && exclude_set.has(e)) continue;
                    const dx = e.x - qx;
                    const dy = e.y - qy;
                    const d_sq = dx * dx + dy * dy;
                    if (d_sq < best_dist_sq) {
                        best_dist_sq = d_sq;
                        best = e;
                    }
                }
            }
        }
        return best;
    }

    // Count alive enemies within radius of (qx, qy), optionally excluding one.
    query_count(qx, qy, radius, exclude) {
        let count = 0;
        this.query_radius(qx, qy, radius, e => {
            if (e !== exclude) count++;
        });
        return count;
    }
}
