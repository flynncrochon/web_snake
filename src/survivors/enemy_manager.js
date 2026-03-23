import { Enemy } from './enemy.js';
import { SpatialGrid } from './spatial_grid.js';

const MAX_ENEMIES = 400;

export class EnemyManager {
    constructor(arena_size) {
        this.arena_size = arena_size;
        this.enemies = [];
        this.spawn_accum = 0;
        this.splitter_accum = 0;
        this.boss_accum = 0;
        this.total_kills = 0;
        this.game_start_time = performance.now();
        this.player_hp = 5;
        this.player_i_frames = 0;
        this.excluded_region = null;
        this.boss_deaths = []; // { x, y } positions of dead bosses for chest spawning
        this.tail_cuts = []; // { x, y, count } for VFX
        this.heart_drops = []; // { x, y } red hearts that restore HP
        this.grid = new SpatialGrid(arena_size, 4);
    }

    get_difficulty() {
        const elapsed = (performance.now() - this.game_start_time) / 1000;
        const mins = elapsed / 60;

        const t = Math.min(mins / 20, 1); // 0..1 over 20 minutes
        const fast = Math.pow(t, 0.6);    // ramps up quicker early/mid-game
        return {
            spawn_interval: Math.max(300, 2000 - fast * 1700),
            spawn_count: Math.floor(2 + fast * 13),
            speed: 1.5 + fast * 6,
            hp: (3 + Math.floor(fast * 20)) * 100,
            length: Math.min(9, 1 + Math.floor(t * 8)),
        };
    }

    update(dt, player_snake, arena, particles, cell_size, damage_numbers, player_immune = false) {
        this.boss_deaths = [];
        this.tail_cuts = [];

        const head = player_snake.head;
        const diff = this.get_difficulty();

        this.spawn_accum += dt * 1000;
        if (this.spawn_accum >= diff.spawn_interval && this.enemies.length < MAX_ENEMIES) {
            this.spawn_accum = 0;
            this.spawn_wave(head.x + 0.5, head.y + 0.5, diff.spawn_count, diff.speed, diff.hp, diff.length, player_snake, arena.food);
        }

        // Spawn splitter enemies periodically (every ~20s, scaling down to ~12s)
        const splitter_interval = Math.max(12000, 20000 - diff.speed * 1500);
        this.splitter_accum += dt * 1000;
        if (this.splitter_accum >= splitter_interval && this.enemies.length < MAX_ENEMIES) {
            this.splitter_accum = 0;
            this.spawn_splitter(head.x + 0.5, head.y + 0.5, player_snake, arena.food);
        }

        // Spawn boss every 3 minutes, after 2 minutes of gameplay
        const elapsed_ms = performance.now() - this.game_start_time;
        this.boss_accum += dt * 1000;
        const has_boss = this.enemies.some(e => e.is_boss && e.alive);
        if (elapsed_ms >= 120000 && this.boss_accum >= 180000 && !has_boss && this.enemies.length < MAX_ENEMIES) {
            this.boss_accum = 0;
            this.spawn_boss(head.x + 0.5, head.y + 0.5, player_snake, arena.food);
        }

        const tx = head.x + 0.5;
        const ty = head.y + 0.5;
        const now = performance.now();
        for (const e of this.enemies) {
            e.update(now, tx, ty, this.arena_size);
        }

        // Kill enemies that moved into the enclosed region
        if (this.excluded_region) {
            for (const e of this.enemies) {
                if (!e.alive || e.is_boss) continue;
                const ex = e.segments[0].x;
                const ey = e.segments[0].y;
                if (this.excluded_region.has(ex + ',' + ey)) {
                    e.hp = 0;
                    e.alive = false;
                    this.total_kills++;
                    if (ex >= 0 && ex < this.arena_size && ey >= 0 && ey < this.arena_size) {
                        arena.food.push({ x: ex, y: ey });
                        this._try_drop_heart(ex, ey);
                    }
                    if (particles) {
                        particles.emit(e.x * cell_size, e.y * cell_size, 8, e.color, 3);
                    }
                }
            }
        }

        // Collision: grid-cell overlap between enemy segments and player segments
        if (player_immune) {
            // Still let player body damage enemies, but skip all player damage
            for (const e of this.enemies) {
                if (!e.alive) continue;
                for (let ei = 0; ei < e.segments.length; ei++) {
                    const eseg = e.segments[ei];
                    for (let si = 1; si < player_snake.segments.length; si++) {
                        const pseg = player_snake.segments[si];
                        if (eseg.x === pseg.x && eseg.y === pseg.y) {
                            const dead = e.take_damage();
                            if (damage_numbers) {
                                damage_numbers.emit(e.x, e.y - e.radius, 125, false);
                            }
                            if (dead) {
                                const fx = e.segments[0].x;
                                const fy = e.segments[0].y;
                                if (fx >= 0 && fx < this.arena_size && fy >= 0 && fy < this.arena_size) {
                                    arena.food.push({ x: fx, y: fy });
                                    this._try_drop_heart(fx, fy);
                                }
                                this.total_kills++;
                                if (e.is_boss) {
                                    e._boss_death_tracked = true;
                                    this.boss_deaths.push({ x: fx, y: fy });
                                }
                                if (particles) {
                                    particles.emit(e.x * cell_size, e.y * cell_size, e.is_boss ? 20 : 8, e.color, e.is_boss ? 5 : 3);
                                }
                            }
                            break;
                        }
                    }
                }
            }
        } else
        for (const e of this.enemies) {
            if (!e.alive) continue;
            // Skip enemies being pulled by Serpent's Reckoning — they can't hurt the player
            if (e._reckoning_immune) continue;
            let hit = false;
            for (let ei = 0; ei < e.segments.length && !hit; ei++) {
                const eseg = e.segments[ei];
                for (let si = 0; si < player_snake.segments.length; si++) {
                    const pseg = player_snake.segments[si];
                    if (eseg.x === pseg.x && eseg.y === pseg.y) {
                        if (si === 0) {
                            // Boss or normal hitting player head: damage player
                            if (!this.player_i_frames) {
                                this.player_hp--;
                                this.player_i_frames = 30;
                                if (particles) {
                                    particles.emit((pseg.x + 0.5) * cell_size, (pseg.y + 0.5) * cell_size, 6, '#f00', 3);
                                }
                            }
                        } else if (e.is_boss && ei === 0) {
                            // Boss head hitting player body: CUT the tail
                            const cut_count = player_snake.segments.length - si;
                            if (cut_count > 0 && player_snake.segments.length > 3) {
                                // Emit particles at cut segments
                                for (let ci = si; ci < player_snake.segments.length; ci++) {
                                    const cseg = player_snake.segments[ci];
                                    if (particles && Math.random() < 0.5) {
                                        particles.emit((cseg.x + 0.5) * cell_size, (cseg.y + 0.5) * cell_size, 4, '#ff8800', 2);
                                    }
                                }
                                // Keep at least 3 segments
                                const keep = Math.max(3, si);
                                const actually_cut = player_snake.segments.length - keep;
                                if (actually_cut > 0) {
                                    player_snake.segments.splice(keep);
                                    player_snake.grow_pending = 0;
                                    this.tail_cuts.push({ x: pseg.x, y: pseg.y, count: actually_cut });
                                    if (damage_numbers) {
                                        damage_numbers.emit(pseg.x + 0.5, pseg.y, actually_cut, true);
                                    }
                                }
                            }
                        } else {
                            // Normal enemy or boss body hitting player body: enemy takes damage
                            const dead = e.take_damage();
                            if (damage_numbers) {
                                damage_numbers.emit(e.x, e.y - e.radius, 125, false);
                            }
                            if (dead) {
                                const fx = e.segments[0].x;
                                const fy = e.segments[0].y;
                                if (fx >= 0 && fx < this.arena_size && fy >= 0 && fy < this.arena_size) {
                                    arena.food.push({ x: fx, y: fy });
                                    this._try_drop_heart(fx, fy);
                                }
                                this.total_kills++;
                                if (e.is_boss) {
                                    e._boss_death_tracked = true;
                                    this.boss_deaths.push({ x: fx, y: fy });
                                }
                                if (particles) {
                                    particles.emit(e.x * cell_size, e.y * cell_size, e.is_boss ? 20 : 8, e.color, e.is_boss ? 5 : 3);
                                }
                            }
                        }
                        hit = true;
                        break;
                    }
                }
            }
        }

        if (this.player_i_frames > 0) this.player_i_frames--;

        this.enemies = this.enemies.filter(e => {
            if (!e.alive) {
                // Track boss deaths from weapon kills (body collision deaths already tracked above)
                if (e.is_boss && !e._boss_death_tracked) {
                    e._boss_death_tracked = true;
                    const fx = e.segments[0].x;
                    const fy = e.segments[0].y;
                    this.boss_deaths.push({ x: fx, y: fy });
                }
                return false;
            }
            const dx = e.x - tx;
            const dy = e.y - ty;
            const dist_sq = dx * dx + dy * dy;
            if (dist_sq >= 900) {
                if (e.is_boss) {
                    // Teleport boss back near player instead of despawning
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 14 + Math.random() * 4;
                    const nx = Math.round(tx + Math.cos(angle) * dist);
                    const ny = Math.round(ty + Math.sin(angle) * dist);
                    const gx = Math.max(1, Math.min(this.arena_size - 2, nx));
                    const gy = Math.max(1, Math.min(this.arena_size - 2, ny));
                    for (const seg of e.segments) {
                        seg.prev_x = gx;
                        seg.prev_y = gy;
                        seg.x = gx;
                        seg.y = gy;
                    }
                    e.x = gx + 0.5;
                    e.y = gy + 0.5;
                    e.last_tick_time = performance.now();
                    return true;
                }
                return false;
            }
            return true;
        });

        // Rebuild spatial grid after all position changes and filtering
        this.grid.rebuild(this.enemies);
    }

    // --- Spatial grid query API (used by all weapon systems) ---
    query_radius(x, y, radius, callback) {
        this.grid.query_radius(x, y, radius, callback);
    }

    query_radius_array(x, y, radius) {
        return this.grid.query_radius_array(x, y, radius);
    }

    query_nearest(x, y, radius, exclude_set) {
        return this.grid.query_nearest(x, y, radius, exclude_set);
    }

    query_count(x, y, radius, exclude) {
        return this.grid.query_count(x, y, radius, exclude);
    }

    _try_drop_heart(x, y) {
        if (Math.random() < 0.02) {
            this.heart_drops.push({ x, y });
        }
    }

    pause_adjust(duration) {
        this.game_start_time += duration;
        for (const e of this.enemies) {
            e.last_tick_time += duration;
        }
    }

    spawn_wave(px, py, count, speed, hp, length, player_snake, food) {
        // Build set of occupied cells (player segments + food)
        const occupied = new Set();
        if (player_snake) {
            for (const seg of player_snake.segments) {
                occupied.add(seg.x + ',' + seg.y);
            }
        }
        if (food) {
            for (const f of food) {
                occupied.add(f.x + ',' + f.y);
            }
        }

        for (let i = 0; i < count; i++) {
            if (this.enemies.length >= MAX_ENEMIES) break;

            let x, y, gx, gy;
            let valid = false;
            for (let attempt = 0; attempt < 10; attempt++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 20 + Math.random() * 6;
                x = px + Math.cos(angle) * dist;
                y = py + Math.sin(angle) * dist;

                x = Math.max(1, Math.min(this.arena_size - 2, x));
                y = Math.max(1, Math.min(this.arena_size - 2, y));

                gx = Math.round(x);
                gy = Math.round(y);
                const key = gx + ',' + gy;
                if (!occupied.has(key) && !(this.excluded_region && this.excluded_region.has(key))) {
                    valid = true;
                    break;
                }
            }

            if (valid) {
                this.enemies.push(new Enemy(x, y, speed, hp, length));
            }
        }
    }

    spawn_splitter(px, py, player_snake, food) {
        const occupied = new Set();
        if (player_snake) {
            for (const seg of player_snake.segments) {
                occupied.add(seg.x + ',' + seg.y);
            }
        }
        if (food) {
            for (const f of food) {
                occupied.add(f.x + ',' + f.y);
            }
        }

        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 6;
            let x = px + Math.cos(angle) * dist;
            let y = py + Math.sin(angle) * dist;
            x = Math.max(1, Math.min(this.arena_size - 2, x));
            y = Math.max(1, Math.min(this.arena_size - 2, y));
            const gx = Math.round(x);
            const gy = Math.round(y);
            const key = gx + ',' + gy;
            if (!occupied.has(key) && !(this.excluded_region && this.excluded_region.has(key))) {
                // Gen 1: big, slow, tanky, length 5
                this.enemies.push(new Enemy(x, y, 1.2, 600, 5, 1));
                return;
            }
        }
    }

    spawn_boss(px, py, player_snake, food) {
        const occupied = new Set();
        if (player_snake) {
            for (const seg of player_snake.segments) {
                occupied.add(seg.x + ',' + seg.y);
            }
        }
        if (food) {
            for (const f of food) {
                occupied.add(f.x + ',' + f.y);
            }
        }

        for (let attempt = 0; attempt < 20; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 5;
            let x = px + Math.cos(angle) * dist;
            let y = py + Math.sin(angle) * dist;
            x = Math.max(2, Math.min(this.arena_size - 3, x));
            y = Math.max(2, Math.min(this.arena_size - 3, y));
            const gx = Math.round(x);
            const gy = Math.round(y);
            const key = gx + ',' + gy;
            if (!occupied.has(key) && !(this.excluded_region && this.excluded_region.has(key))) {
                // Boss: slow, very tanky, 8 segments long
                this.enemies.push(new Enemy(x, y, 1.0, 5000, 8, 0, true));
                return;
            }
        }
    }

    // Call after all weapon updates to split dead splitters into children
    process_splits(particles, cell_size) {
        const new_enemies = [];
        for (const e of this.enemies) {
            if (e.alive || !e.is_splitter || e.splitter_gen >= 3 || e._split_done) continue;
            e._split_done = true; // prevent re-splitting on subsequent frames

            const next_gen = e.splitter_gen + 1;
            let hp, length, speed;
            if (next_gen === 2) {
                hp = 300; length = 3; speed = 1.5;
            } else {
                hp = 150; length = 1; speed = 1.8;
            }

            // Spawn 2 children offset from the parent's death position
            const hx = e.segments[0].x;
            const hy = e.segments[0].y;
            for (let i = 0; i < 2; i++) {
                const ox = (i === 0 ? -1 : 1) + (Math.random() - 0.5);
                const oy = (Math.random() - 0.5);
                let sx = hx + ox;
                let sy = hy + oy;
                sx = Math.max(1, Math.min(this.arena_size - 2, sx));
                sy = Math.max(1, Math.min(this.arena_size - 2, sy));
                new_enemies.push(new Enemy(sx, sy, speed, hp, length, next_gen));
            }

            if (particles) {
                particles.emit(e.x * cell_size, e.y * cell_size, 10, '#4499ff', 4);
            }
        }

        if (new_enemies.length > 0) {
            this.enemies.push(...new_enemies);
        }
    }
}
