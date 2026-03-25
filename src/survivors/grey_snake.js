const GREY_TICK_RATE = 60;         // ms per grid move — twice as fast as player
const GREY_LIFETIME = 10000;       // 10 seconds alive
const GREY_FIRST_SPAWN = 90000;    // 90 seconds before first spawn
const GREY_SPAWN_INTERVAL = 90000; // every 1:30 after that
const WALL_LENGTH = 12;            // ticks spent sweeping = cells of wall

export class GreySnakeManager {
    constructor(arena_size) {
        this.arena_size = arena_size;
        this.snakes = [];
        this.barriers = new Set();
        this.dead_trails = [];
        this.spawn_accum = GREY_SPAWN_INTERVAL;
        this.game_start_time = performance.now();
    }

    update(dt, player_snake) {
        const now = performance.now();
        if (now - this.game_start_time < GREY_FIRST_SPAWN) return;

        this.spawn_accum += dt * 1000;
        let active = 0;
        for (let i = 0; i < this.snakes.length; i++) { if (this.snakes[i].alive) active++; }
        if (this.spawn_accum >= GREY_SPAWN_INTERVAL && active < 1) {
            this.spawn_accum = 0;
            this._spawn(player_snake);
        }

        for (const gs of this.snakes) {
            if (!gs.alive) continue;

            if (now - gs.spawn_time >= gs.lifetime) {
                gs.alive = false;
                const trail = gs.segments.map(s => ({ x: s.x, y: s.y }));
                gs._dead_ref = trail;
                this.dead_trails.push(trail);
                continue;
            }

            gs.fade_in = Math.min(1, (now - gs.spawn_time) / 500);

            if (now - gs.last_tick_time >= GREY_TICK_RATE) {
                gs.last_tick_time += GREY_TICK_RATE;
                if (now - gs.last_tick_time > GREY_TICK_RATE) {
                    gs.last_tick_time = now;
                }
                this._tick(gs, player_snake);
            }
        }

        // Clean up dead snakes
        for (let i = this.snakes.length - 1; i >= 0; i--) {
            const gs = this.snakes[i];
            if (!gs.alive) {
                if (!gs._dead_ref) {
                    const trail = gs.segments.map(s => ({ x: s.x, y: s.y }));
                    gs._dead_ref = trail;
                    this.dead_trails.push(trail);
                }
                this.snakes.splice(i, 1);
            }
        }
    }

    _spawn(player_snake) {
        const head = player_snake.head;
        const dir = player_snake.direction;

        // Spawn far ahead of the player on their current path
        const ahead = 25 + Math.random() * 10;

        let sx = Math.round(head.x + dir.dx * ahead);
        let sy = Math.round(head.y + dir.dy * ahead);
        sx = Math.max(1, Math.min(this.arena_size - 2, sx));
        sy = Math.max(1, Math.min(this.arena_size - 2, sy));

        const now = performance.now();

        // Find a spawn position that doesn't overlap with existing barriers
        const temp_gs = { own_barriers: new Set() };
        if (this._would_overlap_other(temp_gs, sx, sy)) {
            let found = false;
            const offsets = [];
            for (let r = 2; r <= 10; r += 2) {
                offsets.push([r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]);
            }
            for (const [ox, oy] of offsets) {
                const nx = sx + ox;
                const ny = sy + oy;
                if (nx >= 1 && nx <= this.arena_size - 2 && ny >= 1 && ny <= this.arena_size - 2 &&
                    !this._would_overlap_other(temp_gs, nx, ny)) {
                    sx = nx;
                    sy = ny;
                    found = true;
                    break;
                }
            }
            if (!found) return; // no valid spawn position, skip this spawn
        }

        const own_barriers = new Set();
        const spawn_key = sx + ',' + sy;
        own_barriers.add(spawn_key);

        this.snakes.push({
            segments: [{ x: sx, y: sy, prev_x: sx, prev_y: sy }],
            direction: { dx: 0, dy: 1 },
            alive: true,
            spawn_time: now,
            last_tick_time: now,
            lifetime: GREY_LIFETIME,
            fade_in: 0,
            // AI state
            phase: 'intercept',     // 'intercept' or 'wall'
            target_x: 0,
            target_y: 0,
            wall_dx: 0,            // perpendicular sweep direction
            wall_dy: 0,
            wall_ticks: 0,         // ticks spent building current wall
            own_barriers,          // barriers placed by THIS snake
        });

        if (!this.barriers.has(spawn_key)) this.barriers.add(spawn_key);

        // Immediately calculate first intercept target
        this._plan_intercept(this.snakes[this.snakes.length - 1], player_snake);
    }

    /** Pick a new intercept point far ahead of the player's current path. */
    _plan_intercept(gs, player_snake) {
        const head = player_snake.head;
        const dir = player_snake.direction;
        const look = 15 + Math.floor(Math.random() * 10); // 15-24 cells ahead

        gs.target_x = Math.max(2, Math.min(this.arena_size - 3, head.x + dir.dx * look));
        gs.target_y = Math.max(2, Math.min(this.arena_size - 3, head.y + dir.dy * look));
        gs.phase = 'intercept';

        // Pre-compute the wall direction (perpendicular to player's current heading)
        if (dir.dx !== 0 || dir.dy !== 0) {
            gs.wall_dx = -dir.dy;
            gs.wall_dy = dir.dx;
        } else {
            gs.wall_dx = 1;
            gs.wall_dy = 0;
        }
        // Random side
        if (Math.random() < 0.5) {
            gs.wall_dx = -gs.wall_dx;
            gs.wall_dy = -gs.wall_dy;
        }
        gs.wall_ticks = 0;
    }

    _tick(gs, player_snake) {
        const head = gs.segments[0];
        const px = player_snake.head.x;
        const py = player_snake.head.y;
        let dir;

        // Keep away from the player — minimum 8 cells distance
        const dist_to_player = Math.abs(head.x - px) + Math.abs(head.y - py);
        if (dist_to_player < 8) {
            // Flee: move away from the player
            dir = this._dir_away(head, px, py);
            // If building a wall too close, abort and re-plan further out
            if (gs.phase === 'wall') {
                this._plan_intercept(gs, player_snake);
            }
        } else if (gs.phase === 'intercept') {
            // Rush to intercept point
            const dx = gs.target_x - head.x;
            const dy = gs.target_y - head.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            if (dist <= 1) {
                // Arrived — start building a wall
                gs.phase = 'wall';
                gs.wall_ticks = 0;
                dir = { dx: gs.wall_dx, dy: gs.wall_dy };
            } else {
                dir = this._dir_toward(head, gs.target_x, gs.target_y);
            }
        } else if (gs.phase === 'wall') {
            gs.wall_ticks++;
            dir = { dx: gs.wall_dx, dy: gs.wall_dy };

            if (gs.wall_ticks >= WALL_LENGTH) {
                this._plan_intercept(gs, player_snake);
                dir = this._dir_toward(head, gs.target_x, gs.target_y);
            }
        }

        if (!dir || (dir.dx === 0 && dir.dy === 0)) return;

        // Arena bounds — never enter the outermost boundary row/column
        const MIN = 1;
        const MAX = this.arena_size - 2;
        let nx = head.x + dir.dx;
        let ny = head.y + dir.dy;
        if (nx < MIN || nx > MAX || ny < MIN || ny > MAX) {
            if (gs.phase === 'wall') {
                // Reverse wall sweep direction
                gs.wall_dx = -gs.wall_dx;
                gs.wall_dy = -gs.wall_dy;
                dir = { dx: gs.wall_dx, dy: gs.wall_dy };
            } else {
                // Try perpendicular
                const dx = gs.target_x - head.x;
                const dy = gs.target_y - head.y;
                if (dir.dx !== 0) {
                    dir = { dx: 0, dy: Math.sign(dy) || 1 };
                } else {
                    dir = { dx: Math.sign(dx) || 1, dy: 0 };
                }
            }
            nx = head.x + dir.dx;
            ny = head.y + dir.dy;
            if (nx < MIN || nx > MAX || ny < MIN || ny > MAX) return;
        }

        // Ensure we don't overlap or get adjacent to another snake's barriers
        if (this._would_overlap_other(gs, nx, ny)) {
            const perp1 = { dx: -dir.dy, dy: dir.dx };
            const perp2 = { dx: dir.dy, dy: -dir.dx };
            let found = false;
            for (const alt of [perp1, perp2]) {
                const ax = head.x + alt.dx;
                const ay = head.y + alt.dy;
                if (ax >= MIN && ax <= MAX && ay >= MIN && ay <= MAX &&
                    !this._would_overlap_other(gs, ax, ay)) {
                    dir = alt;
                    nx = ax;
                    ny = ay;
                    found = true;
                    break;
                }
            }
            if (!found) {
                if (gs.phase === 'wall') {
                    this._plan_intercept(gs, player_snake);
                }
                return;
            }
        }

        gs.direction = dir;

        // Grow — tail never disappears
        for (const seg of gs.segments) {
            seg.prev_x = seg.x;
            seg.prev_y = seg.y;
        }
        gs.segments.splice(1, 0, { x: head.x, y: head.y, prev_x: head.x, prev_y: head.y });

        head.prev_x = head.x;
        head.prev_y = head.y;
        head.x = nx;
        head.y = ny;

        const key = nx + ',' + ny;
        if (!this.barriers.has(key)) this.barriers.add(key);
        gs.own_barriers.add(key);
    }

    _dir_away(from, px, py) {
        const dx = from.x - px;
        const dy = from.y - py;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const total = adx + ady;
        if (total === 0) return { dx: 1, dy: 0 };
        if (Math.random() < adx / total) {
            return { dx: Math.sign(dx), dy: 0 };
        }
        return { dx: 0, dy: Math.sign(dy) };
    }

    _dir_toward(from, tx, ty) {
        const dx = tx - from.x;
        const dy = ty - from.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const total = adx + ady;
        if (total === 0) return null;
        if (Math.random() < adx / total) {
            return { dx: Math.sign(dx), dy: 0 };
        }
        return { dx: 0, dy: Math.sign(dy) };
    }



    /** Check if placing a barrier at (nx,ny) would overlap or be adjacent to another snake's barriers */
    _would_overlap_other(gs, nx, ny) {
        const neighbors = [
            [nx, ny],
            [nx + 1, ny], [nx - 1, ny],
            [nx, ny + 1], [nx, ny - 1],
        ];
        for (const [cx, cy] of neighbors) {
            const key = cx + ',' + cy;
            if (this.barriers.has(key) && !gs.own_barriers.has(key)) {
                return true;
            }
        }
        return false;
    }

    check_collision(px, py) {
        if (this.barriers.has(px + ',' + py)) return true;
        for (const gs of this.snakes) {
            if (!gs.alive) continue;
            if (gs.segments[0].x === px && gs.segments[0].y === py) return true;
        }
        return false;
    }

    pause_adjust(duration) {
        this.game_start_time += duration;
        for (const gs of this.snakes) {
            gs.spawn_time += duration;
            gs.last_tick_time += duration;
        }
    }
}
