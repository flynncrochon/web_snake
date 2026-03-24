import { play_miasma_pulse } from '../audio/sound.js';

const TICK_INTERVAL = 0.5;
const BASE_RADIUS = 8.0;
const BREATH_SPEED = 1.5;
const BREATH_AMPLITUDE = 0.1;
const DAMAGE = 300; // matches Venom Nova max rank

export class Miasma {
    constructor() {
        this.active = false;
        this.tick_timer = 0;
        this.breath_phase = 0;
        this.gorger_dmg_mult = 1;
        this.radius_mult = 1;
        this.crit_chance = 0;
    }

    get_breathing_radius() {
        const breath = 1 + Math.sin(this.breath_phase) * BREATH_AMPLITUDE;
        return BASE_RADIUS * this.radius_mult * breath;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        if (!this.active) return;

        this.breath_phase += dt * BREATH_SPEED;
        this.tick_timer += dt;

        if (this.tick_timer < TICK_INTERVAL) return;
        this.tick_timer -= TICK_INTERVAL;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;
        const radius = this.get_breathing_radius();

        play_miasma_pulse();
        enemy_manager.query_radius(hx, hy, radius, (e) => {
            const dx = e.x - hx;
            const dy = e.y - hy;
            const dist_sq = dx * dx + dy * dy;

            // Repel: push enemy 1 cell away from snake head
            const dist = Math.sqrt(dist_sq);
            if (dist > 0.1) {
                let pdx, pdy;
                if (Math.abs(dx) >= Math.abs(dy)) {
                    pdx = Math.sign(dx);
                    pdy = 0;
                } else {
                    pdx = 0;
                    pdy = Math.sign(dy);
                }
                const seg = e.segments[0];
                const nx = seg.x + pdx;
                const ny = seg.y + pdy;
                if (nx >= 0 && nx < arena.size && ny >= 0 && ny < arena.size) {
                    seg.prev_x = seg.x;
                    seg.prev_y = seg.y;
                    seg.x = nx;
                    seg.y = ny;
                    e.x = nx + 0.5;
                    e.y = ny + 0.5;
                }
            }

            // Damage
            const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
            const miasma_dmg = Math.round(DAMAGE * (is_crit ? 2 : 1) * this.gorger_dmg_mult);
            const dead = e.take_damage(miasma_dmg);

            if (damage_numbers) {
                damage_numbers.emit(e.x, e.y - e.radius, miasma_dmg, is_crit);
            }
            if (particles) {
                particles.emit(e.x * cell_size, e.y * cell_size, 3, '#44ff88', 2);
            }
            if (dead) {
                const fx = Math.floor(e.x);
                const fy = Math.floor(e.y);
                if (fx >= 0 && fx < arena.size && fy >= 0 && fy < arena.size) {
                    arena.food.push({ x: fx, y: fy });
                    enemy_manager._try_drop_heart(fx, fy);
                }
                enemy_manager.total_kills++;
                if (particles) {
                    particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                }
            }
        });
    }

    render(ctx, cell_size, interp_x, interp_y) {
        if (!this.active) return;

        const hx = interp_x * cell_size;
        const hy = interp_y * cell_size;
        const radius = this.get_breathing_radius() * cell_size;
        const breath = Math.sin(this.breath_phase);

        // Main fog (concentric circles)
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 80, 30, 0.03)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, hy, radius * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 100, 40, 0.04)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, hy, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 130, 50, 0.06)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, hy, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40, 160, 60, 0.1)';
        ctx.fill();

        // Inner toxic core glow (concentric circles)
        const inner_r = radius * 0.25;
        const core_alpha = 0.15 + breath * 0.05;
        ctx.beginPath();
        ctx.arc(hx, hy, inner_r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(40, 180, 60, ${core_alpha * 0.3})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, hy, inner_r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(80, 255, 120, ${core_alpha * 0.7})`;
        ctx.fill();

        // Dashed boundary ring — transparent wider ring for glow effect
        const ring_alpha = 0.12 + breath * 0.04;
        ctx.strokeStyle = `rgba(60, 255, 100, ${ring_alpha * 0.2})`;
        ctx.lineWidth = cell_size * 0.35;
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = `rgba(60, 255, 100, ${ring_alpha})`;
        ctx.lineWidth = cell_size * 0.12;
        ctx.setLineDash([cell_size * 0.3, cell_size * 0.2]);
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    clear() {
        this.tick_timer = 0;
        this.breath_phase = 0;
    }
}
