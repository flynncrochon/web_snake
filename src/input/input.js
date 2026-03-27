export class Input {
    constructor() {
        this.queue = [];
        this.max_queue = 3;
        this.on_action = null;
        this._dpad = null;
        this._pause_btn = null;
        this._repeat_timers = [];

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

    init_touch(canvas) {
        this._create_dpad();
        this._create_pause_btn();
        this._init_canvas_touch(canvas);
    }

    _create_dpad() {
        const dpad = document.createElement('div');
        dpad.id = 'dpad';
        dpad.style.display = 'none';

        const dirs = [
            { cls: 'dpad-up',    label: '\u25B2', dx: 0,  dy: -1 },
            { cls: 'dpad-left',  label: '\u25C0', dx: -1, dy: 0  },
            { cls: 'dpad-right', label: '\u25B6', dx: 1,  dy: 0  },
            { cls: 'dpad-down',  label: '\u25BC', dx: 0,  dy: 1  },
        ];

        for (const d of dirs) {
            const btn = document.createElement('button');
            btn.className = d.cls;
            btn.textContent = d.label;
            btn.setAttribute('aria-label', d.cls.replace('dpad-', ''));

            const dir = { dx: d.dx, dy: d.dy };
            const fire = () => {
                if (!this.on_action) return;
                this.on_action('direction', dir);
                if (dir.dy === -1) this.on_action('menu_up');
                if (dir.dy === 1)  this.on_action('menu_down');
                if (dir.dx === -1) this.on_action('menu_left');
                if (dir.dx === 1)  this.on_action('menu_right');
            };

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                fire();
                const timer = setInterval(fire, 120);
                this._repeat_timers.push(timer);
                const stop = () => {
                    clearInterval(timer);
                    this._repeat_timers = this._repeat_timers.filter(t => t !== timer);
                    btn.removeEventListener('touchend', stop);
                    btn.removeEventListener('touchcancel', stop);
                };
                btn.addEventListener('touchend', stop);
                btn.addEventListener('touchcancel', stop);
            });

            dpad.appendChild(btn);
        }

        document.body.appendChild(dpad);
        this._dpad = dpad;
    }

    _create_pause_btn() {
        const btn = document.createElement('button');
        btn.id = 'mobile-pause';
        btn.textContent = '\u23F8';
        btn.style.display = 'none';

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.on_action) this.on_action('space');
        });

        document.body.appendChild(btn);
        this._pause_btn = btn;
    }

    _init_canvas_touch(canvas) {
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.on_action) return;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = (touch.clientX - rect.left) / rect.width;
            const y = (touch.clientY - rect.top) / rect.height;
            this.on_action('tap', { x, y });
        });
    }

    show_dpad() {
        if (this._dpad) this._dpad.style.display = 'grid';
        if (this._pause_btn) this._pause_btn.style.display = 'flex';
    }

    hide_dpad() {
        if (this._dpad) this._dpad.style.display = 'none';
        if (this._pause_btn) this._pause_btn.style.display = 'none';
        for (const t of this._repeat_timers) clearInterval(t);
        this._repeat_timers = [];
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
        if (e.key === 'F3') {
            e.preventDefault();
            this.on_action('perf_overlay');
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
