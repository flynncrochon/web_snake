const Input = {
    queue: [],
    maxQueue: 3,

    KEY_MAP: {
        ArrowUp:    { dx: 0, dy: -1 },
        ArrowDown:  { dx: 0, dy: 1 },
        ArrowLeft:  { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 },
        w: { dx: 0, dy: -1 },
        s: { dx: 0, dy: 1 },
        a: { dx: -1, dy: 0 },
        d: { dx: 1, dy: 0 },
    },

    init() {
        document.addEventListener("keydown", (e) => this.onKey(e));
    },

    onKey(e) {
        const dir = this.KEY_MAP[e.key];

        if (dir) {
            e.preventDefault();

            if (Game.state === "waiting") {
                Game.state = "playing";
                Game.lastTickTime = performance.now();
                // Set initial direction to match the key pressed
                // (only if it's not opposite to current direction)
                if (dir.dx !== -Game.direction.dx || dir.dy !== -Game.direction.dy) {
                    Game.direction = dir;
                }
            }

            if (Game.state === "playing" && this.queue.length < this.maxQueue) {
                this.queue.push(dir);
            }
            return;
        }

        if (e.key === " " || e.key === "Enter") {
            if (Game.state === "dead") {
                Game.reset();
                this.queue = [];
            }
        }
    },

    dequeue() {
        return this.queue.shift() || null;
    },

    clear() {
        this.queue = [];
    },
};
