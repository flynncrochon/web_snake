export class Enemy {
    constructor(x, y, speed = 1.5, hp = 1, length = 1) {
        const gx = Math.round(x);
        const gy = Math.round(y);

        this.speed = speed;
        this.hp = hp;
        this.max_hp = hp;
        this.alive = true;
        this.radius = hp > 100 ? 0.45 : 0.35;

        // External position (head center) for collision compat
        this.x = gx + 0.5;
        this.y = gy + 0.5;

        this.seg_count = length;

        // Direction (cardinal)
        this.direction = { dx: 0, dy: 1 };

        // Segments on grid: [0] = head
        this.segments = [];
        for (let i = 0; i < this.seg_count; i++) {
            this.segments.push({ x: gx, y: gy, prev_x: gx, prev_y: gy });
        }

        // Tick timing
        this.tick_rate = 1000 / speed;
        this.last_tick_time = performance.now() - Math.random() * this.tick_rate;
    }

    get color() {
        if (this.max_hp >= 300) return '#a00';
        if (this.max_hp >= 200) return '#c22';
        return '#c00';
    }

    get body_color() {
        if (this.max_hp >= 300) return '#700';
        if (this.max_hp >= 200) return '#911';
        return '#900';
    }

    update(now, target_x, target_y, arena_size) {
        if (now - this.last_tick_time < this.tick_rate) return;
        this.last_tick_time += this.tick_rate;
        if (now - this.last_tick_time > this.tick_rate) {
            this.last_tick_time = now;
        }

        const head = this.segments[0];

        // AI: pick direction toward target (target coords are center, i.e. N+0.5)
        const dx = target_x - (head.x + 0.5);
        const dy = target_y - (head.y + 0.5);
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const total = adx + ady;

        if (total < 0.5) return;

        // Probabilistic axis choice for natural diagonal-ish movement
        let dir;
        if (Math.random() < adx / total) {
            dir = { dx: Math.sign(dx), dy: 0 };
        } else {
            dir = { dx: 0, dy: Math.sign(dy) };
        }

        // Don't reverse into own neck
        if (this.segments.length > 1) {
            const neck = this.segments[1];
            if (head.x + dir.dx === neck.x && head.y + dir.dy === neck.y) {
                if (dir.dx !== 0) {
                    dir = { dx: 0, dy: Math.sign(dy) || (Math.random() < 0.5 ? 1 : -1) };
                } else {
                    dir = { dx: Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1), dy: 0 };
                }
            }
        }

        // Arena bounds
        let nx = head.x + dir.dx;
        let ny = head.y + dir.dy;
        if (nx < 0 || nx >= arena_size || ny < 0 || ny >= arena_size) {
            if (dir.dx !== 0) {
                dir = { dx: 0, dy: Math.sign(dy) || (Math.random() < 0.5 ? 1 : -1) };
            } else {
                dir = { dx: Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1), dy: 0 };
            }
            nx = head.x + dir.dx;
            ny = head.y + dir.dy;
            if (nx < 0 || nx >= arena_size || ny < 0 || ny >= arena_size) return;
        }

        this.direction = dir;

        // Move body: each segment follows the one ahead
        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg = this.segments[i];
            seg.prev_x = seg.x;
            seg.prev_y = seg.y;
            seg.x = this.segments[i - 1].x;
            seg.y = this.segments[i - 1].y;
        }

        // Move head
        head.prev_x = head.x;
        head.prev_y = head.y;
        head.x = nx;
        head.y = ny;

        // Sync external position
        this.x = head.x + 0.5;
        this.y = head.y + 0.5;
    }

    take_damage(amount = 100) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.alive = false;
            return true;
        }
        return false;
    }
}
