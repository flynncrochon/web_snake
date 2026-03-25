import { play_fang_fire, play_fang_hit } from '../audio/sound.js';
import { Bullet } from './bullet.js';

const MAX_BULLETS = 40;
const BASE_COOLDOWN = 400;
const FANG_SPREAD = 0.3; // perpendicular offset for the two fangs
const FANG_ANGLE = Math.PI / 4; // 45° offset from facing direction
const COS_FANG = Math.cos(FANG_ANGLE);
const SIN_FANG = Math.sin(FANG_ANGLE);
const FIRE_RANGE = 30;
const FIRE_RANGE_SQ = FIRE_RANGE * FIRE_RANGE;

export class BulletManager {
    constructor() {
        this.bullets = [];
        this.last_fire_time = 0;
        this.level = 0;
        this.fire_cooldown_mult = 1.0;
        this.crit_chance = 0;
        this.gorger_dmg_mult = 1;
        this.extra_projectiles = 0;
        this.range_mult = 1;
    }

    update(dt, snake, enemy_manager, arena, particles, cell_size, damage_numbers) {
        // Level-based scaling
        const level = this.level;
        const level_extra = level > 0 ? Math.floor((level - 1) / 3) : 0;

        const head = snake.head;
        const hx = head.x + 0.5;
        const hy = head.y + 0.5;

        // Snake's facing direction (cardinal)
        const face_dx = snake.direction.dx;
        const face_dy = snake.direction.dy;

        const now = performance.now();
        const base_cd = Math.max(180, BASE_COOLDOWN - (level - 1) * 30);
        const cooldown = base_cd * this.fire_cooldown_mult;
        const total_extra = level_extra + this.extra_projectiles;
        const volley_size = 3 + total_extra; // 3 base: left fang, right fang, center shot
        const eff_range = FIRE_RANGE * this.range_mult;
        const eff_range_sq = eff_range * eff_range;
        if (level > 0 && now - this.last_fire_time >= cooldown && this.bullets.length + volley_size <= MAX_BULLETS) {
            let nearest = null;
            let best_dist = Infinity;
            enemy_manager.query_radius(hx, hy, eff_range, (e) => {
                const dx = e.x - hx;
                const dy = e.y - hy;
                const d = dx * dx + dy * dy;
                if (d < 0.01) return;
                if (d < best_dist) {
                    best_dist = d;
                    nearest = e;
                }
            });
            if (nearest) {
                // +45° rotated facing direction (upper fang)
                const ldx = face_dx * COS_FANG - face_dy * SIN_FANG;
                const ldy = face_dx * SIN_FANG + face_dy * COS_FANG;
                // -45° rotated facing direction (lower fang)
                const rdx = face_dx * COS_FANG + face_dy * SIN_FANG;
                const rdy = -face_dx * SIN_FANG + face_dy * COS_FANG;
                // Perpendicular for spread offset
                const dx = nearest.x - hx;
                const dy = nearest.y - hy;
                const len = Math.sqrt(dx * dx + dy * dy);
                const ndx = dx / len;
                const ndy = dy / len;
                const px = -ndy * FANG_SPREAD;
                const py = ndx * FANG_SPREAD;
                // Upper fang
                this.bullets.push(new Bullet(hx + px, hy + py, ldx, ldy));
                // Lower fang
                this.bullets.push(new Bullet(hx - px, hy - py, rdx, rdy));
                // Center shot — fires straight at the facing direction
                this.bullets.push(new Bullet(hx, hy, face_dx, face_dy));
                // Extra projectiles from level + Coiled Volley — spread evenly between the two fang angles
                for (let i = 0; i < total_extra; i++) {
                    const t = (i + 1) / (total_extra + 1);
                    const ox = px * (1 - 2 * t);
                    const oy = py * (1 - 2 * t);
                    const edx = ldx + (rdx - ldx) * t;
                    const edy = ldy + (rdy - ldy) * t;
                    const elen = Math.sqrt(edx * edx + edy * edy);
                    this.bullets.push(new Bullet(hx + ox, hy + oy, edx / elen, edy / elen));
                }
                this.last_fire_time = now;
                play_fang_fire();
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
                    play_fang_hit();
                    const is_crit = this.crit_chance > 0 && Math.random() < this.crit_chance;
                    const base_dmg = 150 + (level - 1) * 30;
                    const dmg = Math.round((is_crit ? 2 : 1) * base_dmg * this.gorger_dmg_mult);
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

        // In-place compaction — avoids allocating a new array every frame
        let w = 0;
        for (let r = 0; r < this.bullets.length; r++) {
            if (this.bullets[r].alive) this.bullets[w++] = this.bullets[r];
        }
        this.bullets.length = w;
    }

    clear() {
        this.bullets = [];
        this.last_fire_time = 0;
    }
}
