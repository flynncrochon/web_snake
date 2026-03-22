import { SOLO_ARENA_SIZE } from '../constants.js';

const DEFAULT_AUTOPILOT_DURATION = 8000;

export class SoloAutopilot {
    constructor(arena_size = SOLO_ARENA_SIZE) {
        this.active = false;
        this.start_time = 0;
        this.duration = DEFAULT_AUTOPILOT_DURATION;
        this.sz = arena_size;
        this.cycle = null;
        this.cycle_index = null;
    }

    activate(duration = DEFAULT_AUTOPILOT_DURATION) {
        this.active = true;
        this.duration = duration;
        this.start_time = performance.now();
        if (!this.cycle) this.build_cycle();
    }

    deactivate() { this.active = false; }

    get time_remaining() {
        if (!this.active) return 0;
        return Math.max(0, this.duration - (performance.now() - this.start_time));
    }

    get expired() {
        return this.active && performance.now() - this.start_time >= this.duration;
    }

    build_cycle() {
        const W = this.sz, H = this.sz;
        const c = [];

        if (W % 2 === 0) {
            for (let x = 0; x < W; x++) c.push({ x, y: 0 });
            for (let row = 1; row <= H - 2; row++) {
                if (row % 2 === 1) { for (let x = W - 1; x >= 1; x--) c.push({ x, y: row }); }
                else { for (let x = 1; x < W; x++) c.push({ x, y: row }); }
            }
            for (let x = W - 1; x >= 0; x--) c.push({ x, y: H - 1 });
            for (let row = H - 2; row >= 1; row--) c.push({ x: 0, y: row });
        } else {
            for (let y = 0; y < H; y++) c.push({ x: 0, y });
            for (let col = 1; col <= W - 2; col++) {
                if (col % 2 === 1) { for (let y = H - 1; y >= 1; y--) c.push({ x: col, y }); }
                else { for (let y = 1; y < H; y++) c.push({ x: col, y }); }
            }
            for (let y = H - 1; y >= 0; y--) c.push({ x: W - 1, y });
            for (let col = W - 2; col >= 1; col--) c.push({ x: col, y: 0 });
        }

        this.cycle_index = new Map();
        for (let i = 0; i < c.length; i++) {
            this.cycle_index.set(c[i].x + ',' + c[i].y, i);
        }
        this.cycle = c;
    }

    get_cycle_direction(head) {
        if (!this.cycle || !this.cycle_index) return null;
        const idx = this.cycle_index.get(head.x + ',' + head.y);
        if (idx === undefined) return null;
        const next = this.cycle[(idx + 1) % this.cycle.length];
        const dx = next.x - head.x, dy = next.y - head.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
        return { dx, dy };
    }

    bfs(start, goal, blocked) {
        const sz = this.sz;
        const gk = goal.x + ',' + goal.y;
        if (blocked.has(gk)) return null;
        const visited = new Set();
        visited.add(start.x + ',' + start.y);
        const queue = [{ x: start.x, y: start.y, first_dir: null }];
        let steps = 0;
        while (queue.length > 0 && steps < 2000) {
            const node = queue.shift();
            steps++;
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nx = node.x + dx, ny = node.y + dy;
                if (nx < 0 || nx >= sz || ny < 0 || ny >= sz) continue;
                const k = nx + ',' + ny;
                if (visited.has(k) || blocked.has(k)) continue;
                visited.add(k);
                const dir = node.first_dir || { dx, dy };
                if (nx === goal.x && ny === goal.y) return dir;
                queue.push({ x: nx, y: ny, first_dir: dir });
            }
        }
        return null;
    }

    is_safe_move(dir, snake) {
        const sz = this.sz;
        const head = snake.head;
        const nx = head.x + dir.dx, ny = head.y + dir.dy;

        if (nx < 0 || nx >= sz || ny < 0 || ny >= sz) return false;

        const will_grow = snake.grow_pending > 0;
        const end_idx = will_grow ? snake.segments.length : snake.segments.length - 1;

        for (let i = 0; i < end_idx; i++) {
            if (snake.segments[i].x === nx && snake.segments[i].y === ny) return false;
        }

        const new_body = new Set();
        new_body.add(nx + ',' + ny);
        for (let i = 0; i < end_idx; i++) {
            new_body.add(snake.segments[i].x + ',' + snake.segments[i].y);
        }

        const tail = snake.segments[snake.segments.length - 1];

        if (will_grow) {
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const tx = tail.x + dx, ty = tail.y + dy;
                if (tx < 0 || tx >= sz || ty < 0 || ty >= sz) continue;
                if (new_body.has(tx + ',' + ty)) continue;
                if (this.bfs({ x: nx, y: ny }, { x: tx, y: ty }, new_body) !== null) return true;
            }
            return false;
        }

        return this.bfs({ x: nx, y: ny }, tail, new_body) !== null;
    }

    get_direction(snake, food) {
        if (!this.active) return null;
        if (this.expired) { this.deactivate(); return null; }
        if (!this.cycle) this.build_cycle();

        const head = snake.head;
        const sz = this.sz;

        const will_grow = snake.grow_pending > 0;
        const end_idx = will_grow ? snake.segments.length : snake.segments.length - 1;
        const body_set = new Set();
        for (let i = 0; i < end_idx; i++) {
            body_set.add(snake.segments[i].x + ',' + snake.segments[i].y);
        }

        const valid_moves = [];
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = head.x + dx, ny = head.y + dy;
            if (nx < 0 || nx >= sz || ny < 0 || ny >= sz) continue;
            if (body_set.has(nx + ',' + ny)) continue;
            valid_moves.push({ dx, dy });
        }

        if (valid_moves.length === 0) { this.deactivate(); return null; }

        const safe_moves = valid_moves.filter(d => this.is_safe_move(d, snake));

        if (safe_moves.length > 0) {
            let nearest = null;
            let best_dist = Infinity;
            for (const f of food) {
                const dist = Math.abs(f.x - head.x) + Math.abs(f.y - head.y);
                if (dist < best_dist) { best_dist = dist; nearest = f; }
            }
            if (nearest) {
                const bfs_dir = this.bfs(head, nearest, body_set);
                if (bfs_dir && safe_moves.some(d => d.dx === bfs_dir.dx && d.dy === bfs_dir.dy)) {
                    return bfs_dir;
                }
            }

            const cycle_dir = this.get_cycle_direction(head);
            if (cycle_dir && safe_moves.some(d => d.dx === cycle_dir.dx && d.dy === cycle_dir.dy)) {
                return cycle_dir;
            }

            return safe_moves[0];
        }

        const cycle_dir = this.get_cycle_direction(head);
        if (cycle_dir && valid_moves.some(d => d.dx === cycle_dir.dx && d.dy === cycle_dir.dy)) {
            return cycle_dir;
        }
        return valid_moves[0];
    }
}
