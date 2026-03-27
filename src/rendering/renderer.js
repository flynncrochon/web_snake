import { ARENA_SIZE } from '../constants.js';
import { is_mobile } from '../input/mobile_detect.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: !is_mobile() });

        // HUD overlay canvas — renders text at native DPR for crisp text
        this.hud_canvas = document.getElementById('hud');
        this.hud_ctx = this.hud_canvas
            ? this.hud_canvas.getContext('2d', { alpha: true })
            : null;

        this._current_dpr = window.devicePixelRatio || 1;
        this._square_mode = true;
        this._square_arena_size = ARENA_SIZE;
        this._force_dpr = 0; // 0 = auto (game=1, hud=native), nonzero = override both

        this._setup_dpr_listener();
        this.reset_to_square();
    }

    _setup_dpr_listener() {
        const check_dpr = () => {
            const new_dpr = window.devicePixelRatio || 1;
            if (new_dpr !== this._current_dpr) {
                this._current_dpr = new_dpr;
                this._apply_size(this.logical_width, this.logical_height);
            }
            this._dpr_mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            this._dpr_mql.addEventListener('change', check_dpr, { once: true });
        };
        this._dpr_mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        this._dpr_mql.addEventListener('change', check_dpr, { once: true });
    }

    _handle_lowres() {
        this._apply_size(this.logical_width, this.logical_height);
    }

    _apply_size(w, h) {
        const native_dpr = window.devicePixelRatio || 1;
        // Game canvas always renders at DPR=1 for performance (unless force_dpr overrides)
        const game_dpr = this._force_dpr || 1;
        // HUD canvas renders at native DPR for crisp text
        const hud_dpr = native_dpr;

        this._current_dpr = game_dpr;

        // Game canvas — low res for fast rasterization
        this.canvas.width = Math.round(w * game_dpr);
        this.canvas.height = Math.round(h * game_dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(game_dpr, 0, 0, game_dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.canvas.style.transform = 'translateZ(0)';

        // HUD canvas — native res for crisp text
        if (this.hud_canvas) {
            this.hud_canvas.width = Math.round(w * hud_dpr);
            this.hud_canvas.height = Math.round(h * hud_dpr);
            this.hud_canvas.style.width = w + 'px';
            this.hud_canvas.style.height = h + 'px';
            this.hud_ctx.setTransform(hud_dpr, 0, 0, hud_dpr, 0, 0);
        }

        this.logical_width = w;
        this.logical_height = h;
    }

    _compute_square_size() {
        return Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.9);
    }

    set_cell_size(arena_size) {
        this._square_arena_size = arena_size;
        this.cell_size = this.logical_size / arena_size;
    }

    set_fullscreen(cell_size) {
        this._square_mode = false;
        const w = window.innerWidth;
        const h = window.innerHeight;
        this._apply_size(w, h);
        this.cell_size = cell_size;
    }

    reset_to_square(arena_size) {
        this._square_mode = true;
        this._square_arena_size = arena_size || ARENA_SIZE;
        const size = this._compute_square_size();
        this._apply_size(size, size);
        this.logical_size = size;
        this.cell_size = size / this._square_arena_size;
    }

    handle_resize() {
        if (this._square_mode) {
            const size = this._compute_square_size();
            this._apply_size(size, size);
            this.logical_size = size;
            this.cell_size = size / this._square_arena_size;
        }
    }

    clear() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.logical_width, this.logical_height);
    }

    clear_hud() {
        if (this.hud_ctx) {
            this.hud_ctx.clearRect(0, 0, this.logical_width, this.logical_height);
        }
    }
}
