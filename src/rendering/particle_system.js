const MAX_PARTICLES = 500;

export class ParticleSystem {
    constructor() {
        this._x = new Float64Array(MAX_PARTICLES);
        this._y = new Float64Array(MAX_PARTICLES);
        this._vx = new Float64Array(MAX_PARTICLES);
        this._vy = new Float64Array(MAX_PARTICLES);
        this._life = new Float64Array(MAX_PARTICLES);
        this._max_life = new Float64Array(MAX_PARTICLES);
        this._size = new Float64Array(MAX_PARTICLES);
        this._color = new Array(MAX_PARTICLES);
        this._count = 0;
    }

    emit(x, y, count, color = '#fff', spread = 3) {
        for (let i = 0; i < count; i++) {
            if (this._count >= MAX_PARTICLES) return;
            const idx = this._count++;
            this._x[idx] = x;
            this._y[idx] = y;
            this._vx[idx] = (Math.random() - 0.5) * spread;
            this._vy[idx] = (Math.random() - 0.5) * spread;
            this._life[idx] = 30 + Math.random() * 20;
            this._max_life[idx] = 50;
            this._color[idx] = color;
            this._size[idx] = 2 + Math.random() * 3;
        }
    }

    update() {
        let w = 0;
        for (let r = 0; r < this._count; r++) {
            this._life[r]--;
            if (this._life[r] > 0) {
                this._x[r] += this._vx[r];
                this._y[r] += this._vy[r];
                this._vx[r] *= 0.95;
                this._vy[r] *= 0.95;
                if (w !== r) {
                    this._x[w] = this._x[r];
                    this._y[w] = this._y[r];
                    this._vx[w] = this._vx[r];
                    this._vy[w] = this._vy[r];
                    this._life[w] = this._life[r];
                    this._max_life[w] = this._max_life[r];
                    this._size[w] = this._size[r];
                    this._color[w] = this._color[r];
                }
                w++;
            }
        }
        this._count = w;
    }

    render(ctx) {
        if (this._count === 0) return;

        // Particles from the same emit() are adjacent and share color,
        // so just track last color to avoid redundant fillStyle changes.
        let cur_color = null;
        for (let i = 0; i < this._count; i++) {
            if (this._color[i] !== cur_color) {
                cur_color = this._color[i];
                ctx.fillStyle = cur_color;
            }
            ctx.globalAlpha = this._life[i] / this._max_life[i];
            const s = this._size[i];
            ctx.fillRect(this._x[i] - s * 0.5, this._y[i] - s * 0.5, s, s);
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        this._count = 0;
    }
}
