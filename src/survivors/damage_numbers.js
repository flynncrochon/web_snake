const MAX_NUMBERS = 500;
const FONT_NORMAL = 'bold 14px monospace';
const FONT_CRIT = 'bold 20px monospace';

export class DamageNumberSystem {
    constructor() {
        this._x = new Float64Array(MAX_NUMBERS);
        this._y = new Float64Array(MAX_NUMBERS);
        this._vx = new Float64Array(MAX_NUMBERS);
        this._vy = new Float64Array(MAX_NUMBERS);
        this._age = new Float64Array(MAX_NUMBERS);
        this._max_age = new Float64Array(MAX_NUMBERS);
        this._amount = new Int32Array(MAX_NUMBERS);
        this._is_crit = new Uint8Array(MAX_NUMBERS);
        this._count = 0;
    }

    emit(x, y, amount, is_crit = false) {
        if (this._count >= MAX_NUMBERS) return;
        const i = this._count++;
        this._x[i] = x;
        this._y[i] = y;
        this._amount[i] = Math.round(amount);
        this._is_crit[i] = is_crit ? 1 : 0;
        this._age[i] = 0;
        this._max_age[i] = 0.6;
        this._vx[i] = (Math.random() - 0.5) * 0.8;
        this._vy[i] = -2.5 - Math.random() * 0.5;
    }

    update(dt) {
        let w = 0;
        for (let r = 0; r < this._count; r++) {
            this._age[r] += dt;
            if (this._age[r] < this._max_age[r]) {
                this._x[r] += this._vx[r] * dt;
                this._y[r] += this._vy[r] * dt;
                this._vy[r] += 2.0 * dt;
                if (w !== r) {
                    this._x[w] = this._x[r];
                    this._y[w] = this._y[r];
                    this._vx[w] = this._vx[r];
                    this._vy[w] = this._vy[r];
                    this._age[w] = this._age[r];
                    this._max_age[w] = this._max_age[r];
                    this._amount[w] = this._amount[r];
                    this._is_crit[w] = this._is_crit[r];
                }
                w++;
            }
        }
        this._count = w;
    }

    render(ctx, cell_size) {
        if (this._count === 0) return;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;

        // Render normal numbers first, then crits — only 2 font changes total
        ctx.font = FONT_NORMAL;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < this._count; i++) {
            if (this._is_crit[i]) continue;
            const t = this._age[i] / this._max_age[i];
            ctx.globalAlpha = 1 - t * t;
            const px = this._x[i] * cell_size;
            const py = this._y[i] * cell_size;
            ctx.strokeText(this._amount[i], px, py);
            ctx.fillText(this._amount[i], px, py);
        }

        ctx.font = FONT_CRIT;
        ctx.fillStyle = '#ff0';
        for (let i = 0; i < this._count; i++) {
            if (!this._is_crit[i]) continue;
            const t = this._age[i] / this._max_age[i];
            ctx.globalAlpha = 1 - t * t;
            const px = this._x[i] * cell_size;
            const py = this._y[i] * cell_size;
            ctx.strokeText(this._amount[i], px, py);
            ctx.fillText(this._amount[i], px, py);
        }

        ctx.globalAlpha = 1;
    }

    clear() {
        this._count = 0;
    }
}
