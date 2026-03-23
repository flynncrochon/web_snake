export class Camera {
    constructor(arena_size, cell_size, view_width, view_height) {
        this.arena_size = arena_size;
        this.cell_size = cell_size;
        this.half_view_x = view_width / 2;
        this.half_view_y = view_height / 2;

        this.x = 0;
        this.y = 0;
    }

    resize(view_width, view_height) {
        this.half_view_x = view_width / 2;
        this.half_view_y = view_height / 2;
    }

    update(target_grid_x, target_grid_y, dt) {
        let tx = target_grid_x * this.cell_size;
        let ty = target_grid_y * this.cell_size;

        const max_world = this.arena_size * this.cell_size;
        tx = Math.max(this.half_view_x, Math.min(max_world - this.half_view_x, tx));
        ty = Math.max(this.half_view_y, Math.min(max_world - this.half_view_y, ty));

        this.x = tx;
        this.y = ty;
    }

    snap_to(grid_x, grid_y) {
        this.x = grid_x * this.cell_size;
        this.y = grid_y * this.cell_size;
        const max_world = this.arena_size * this.cell_size;
        this.x = Math.max(this.half_view_x, Math.min(max_world - this.half_view_x, this.x));
        this.y = Math.max(this.half_view_y, Math.min(max_world - this.half_view_y, this.y));
    }

    apply_transform(ctx) {
        ctx.translate(Math.round(this.half_view_x - this.x), Math.round(this.half_view_y - this.y));
    }

    is_visible(grid_x, grid_y, padding = 2) {
        const bounds = this.get_visible_bounds(padding);
        return grid_x >= bounds.minX && grid_x <= bounds.maxX &&
               grid_y >= bounds.minY && grid_y <= bounds.maxY;
    }

    get_visible_bounds(padding = 2) {
        const half_cells_x = this.half_view_x / this.cell_size + padding;
        const half_cells_y = this.half_view_y / this.cell_size + padding;
        const center_x = this.x / this.cell_size;
        const center_y = this.y / this.cell_size;
        return {
            minX: Math.floor(center_x - half_cells_x),
            maxX: Math.ceil(center_x + half_cells_x),
            minY: Math.floor(center_y - half_cells_y),
            maxY: Math.ceil(center_y + half_cells_y),
        };
    }
}
