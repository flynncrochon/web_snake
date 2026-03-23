import { Bullet } from './bullet.js';

const MAX_BULLETS = 40;
const FIRE_COOLDOWN = 400;
const FANG_SPREAD = 0.3; // perpendicular offset for the two fangs
const FIRE_RANGE = 8;
const FIRE_RANGE_SQ = FIRE_RANGE * FIRE_RANGE;
const FANG_CONE_COS = Math.cos(Math.PI / 4); // 45° half-angle = 90° forward cone

export class BulletManager {
    constructor() {
        this.bullets = [];
        this.last_fire_time = 0;
        this.fire_cooldown_mult = 1.0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.extra_projectiles = 0;
        this.range_mult = 1;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;

        // Snake's facing direction (cardinal)
        const face_dx = snake.direction.dx;
        const face_dy = snake.direction.dy;

        const now = performance.now();
        const cooldown = FIRE_COOLDOWN * this.fire_cooldown_mult;
        const volley_size = 2 + this.extra_projectiles;
        const eff_range = FIRE_RANGE * this.range_mult;
        const eff_range_sq = eff_range * eff_range;
        if (now - this.last_fire_time >= cooldown && this.bullets.length + volley_size <= MAX_BULLETS) {
            let nearest = null;
            let best_dist = Infinity;
            enemy_manager.query_radius(hx, hy, eff_range, (e) => {
                const dx = e.x - hx;
                const dy = e.y - hy;
                const d = dx * dx + dy * dy;
                if (d < 0.01) return;
                const len = Math.sqrt(d);
                const dot = (dx * face_dx + dy * face_dy) / len;
                if (dot < FANG_CONE_COS) return;
                if (d < best_dist) {
                    best_dist = d;
                    nearest = e;
                }
            });
            if (nearest) {
                // Aim toward the enemy — both fangs will home in
                const dx = nearest.x - hx;
                const dy = nearest.y - hy;
                const len = Math.sqrt(dx * dx + dy * dy);
                const ndx = dx / len;
                const ndy = dy / len;
                // Perpendicular for spread offset
                const px = -ndy * FANG_SPREAD;
                const py = ndx * FANG_SPREAD;
                this.bullets.push(new Bullet(hx + px, hy + py, ndx, ndy, nearest));
                this.bullets.push(new Bullet(hx - px, hy - py, ndx, ndy, nearest));
                // Extra projectiles from Coiled Volley — spread evenly between the two base fangs
                for (let i = 0; i < this.extra_projectiles; i++) {
                    const t = (i + 1) / (this.extra_projectiles + 1);
                    const ox = px * (1 - 2 * t); // interpolate from +px to -px
                    const oy = py * (1 - 2 * t);
                    this.bullets.push(new Bullet(hx + ox, hy + oy, ndx, ndy, nearest));
                }
                this.last_fire_time = now;
            }
        }

        for (const b of this.bullets) {
            b.update(dt);
        }

        const size = arena.size;
        for (const b of this.bullets) {
            if (!b.alive) continue;
            if (b.x < 0 || b.x > size || b.y < 0 || b.y > size) {
                b.alive = false;
            }
        }

        for (const b of this.bullets) {
            if (!b.alive) continue;
            const hit_r = b.radius + 0.55;
            enemy_manager.query_radius(b.x, b.y, hit_r, (e) => {
                if (!b.alive) return;
                const dx = b.x - e.x;
                const dy = b.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < b.radius + e.radius) {
                    b.alive = false;
                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const dmg = Math.round((is_crit ? 2 : 1) * 125 * this.gorger_dmg_mult);
                    const dead = e.take_damage(dmg);
                    if (damage_numbers) {
                        damage_numbers.emit(e.x, e.y - e.radius, dmg, is_crit);
                    }
                    if (particles) {
                        const sx = e.x * cell_size;
                        const sy = e.y * cell_size;
                        particles.emit(sx, sy, 6, '#00cc33', 4);
                        particles.emit(sx, sy, 4, 'rgba(0,200,50,0.7)', 3);
                        particles.emit(sx, sy, 3, '#66ff66', 2);
                    }
                    if (dead) {
                        const fx = Math.floor(e.x);
                        const fy = Math.floor(e.y);
                        if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
                            arena.food.push({ x: fx, y: fy });
                            enemy_manager._try_drop_heart(fx, fy);
                        }
                        enemy_manager.total_kills++;
                        if (particles) {
                            particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                        }
                    } else {
                        e.x += b.dx * 0.4;
                        e.y += b.dy * 0.4;
                    }
                }
            });
        }

        this.bullets = this.bullets.filter(b => b.alive);
    }

    clear() {
        this.bullets = [];
        this.last_fire_time = 0;
    }
}
