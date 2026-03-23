export class Input {
    constructor() {
        this.queue = [];
        this.max_queue = 3;
        this.on_action = null;

        this.KEY_MAP = {
            ArrowUp: { dx: 0, dy: -1 },
            ArrowDown: { dx: 0, dy: 1 },
            ArrowLeft: { dx: -1, dy: 0 },
            ArrowRight: { dx: 1, dy: 0 },
            w: { dx: 0, dy: -1 },
            s: { dx: 0, dy: 1 },
            a: { dx: -1, dy: 0 },
            d: { dx: 1, dy: 0 },
        };
    }

    init() {
        document.addEventListener('keydown', (e) => this.on_key(e));
    }

    on_key(e) {
        if (!this.on_action) return;

        const dir = this.KEY_MAP[e.key];
        if (dir) {
            e.preventDefault();
            this.on_action('direction', dir);
            if (dir.dy === -1) this.on_action('menu_up');
            if (dir.dy === 1) this.on_action('menu_down');
            if (dir.dx === -1) this.on_action('menu_left');
            if (dir.dx === 1) this.on_action('menu_right');
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            this.on_action('space');
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            this.on_action('escape');
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            this.on_action('enter');
        }
        if (e.key >= '1' && e.key <= '9') {
            this.on_action('number', parseInt(e.key, 10));
        }
        if (e.key === 'F1') {
            e.preventDefault();
            this.on_action('debug_menu');
        }
        if (e.key === 'F2') {
            e.preventDefault();
            this.on_action('evolution_menu');
        }
    }

    queue_direction(dir) {
        if (this.queue.length >= this.max_queue) return;
        this.queue.push(dir);
    }

    dequeue() {
        return this.queue.shift() || null;
    }

    clear() {
        this.queue = [];
    }
}
