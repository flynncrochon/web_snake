export class DamageNumberSystem {
    constructor() {
        this.numbers = [];
    }

    emit(x, y, amount, is_crit = false) {
        this.numbers.push({
            x,
            y,
            amount: Math.round(amount),
            is_crit,
            age: 0,
            max_age: 0.6,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -2.5 - Math.random() * 0.5,
        });
    }

    update(dt) {
        for (let i = this.numbers.length - 1; i >= 0; i--) {
            const n = this.numbers[i];
            n.age += dt;
            n.x += n.vx * dt;
            n.y += n.vy * dt;
            n.vy += 2.0 * dt;
            if (n.age >= n.max_age) {
                this.numbers.splice(i, 1);
            }
        }
    }

    render(ctx, cell_size) {
        for (const n of this.numbers) {
            const t = n.age / n.max_age;
            const alpha = 1 - t * t;
            const scale = n.is_crit ? 1.4 : 1.0;

            const px = n.x * cell_size;
            const py = n.y * cell_size;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.round(14 * scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(n.amount, px, py);

            ctx.fillStyle = n.is_crit ? '#ff0' : '#fff';
            ctx.fillText(n.amount, px, py);

            ctx.restore();
        }
    }

    clear() {
        this.numbers = [];
    }
}
