const GRID_W = 20;
const GRID_H = 20;
const TICK_RATE = 125; // ms per tick (~8 ticks/sec)

const Game = {
    snake: [],
    direction: { dx: 1, dy: 0 },
    food: { x: 0, y: 0 },
    score: 0,
    state: "waiting", // "waiting" | "playing" | "dead"
    lastTickTime: 0,
    growPending: 0,

    reset() {
        const midX = Math.floor(GRID_W / 2);
        const midY = Math.floor(GRID_H / 2);
        this.snake = [
            { x: midX, y: midY, prevX: midX - 2, prevY: midY },
            { x: midX - 1, y: midY, prevX: midX - 3, prevY: midY },
            { x: midX - 2, y: midY, prevX: midX - 4, prevY: midY },
        ];
        this.direction = { dx: 1, dy: 0 };
        this.score = 0;
        this.state = "waiting";
        this.lastTickTime = 0;
        this.growPending = 0;
        this.placeFood();
    },

    placeFood() {
        const occupied = new Set();
        for (const seg of this.snake) {
            occupied.add(seg.x + "," + seg.y);
        }
        const free = [];
        for (let x = 0; x < GRID_W; x++) {
            for (let y = 0; y < GRID_H; y++) {
                if (!occupied.has(x + "," + y)) {
                    free.push({ x, y });
                }
            }
        }
        if (free.length === 0) return;
        const pick = free[Math.floor(Math.random() * free.length)];
        this.food.x = pick.x;
        this.food.y = pick.y;
    },

    tick() {
        if (this.state !== "playing") return;

        // Apply buffered direction from input
        const next = Input.dequeue();
        if (next) {
            // Prevent 180-degree reversal
            if (next.dx !== -this.direction.dx || next.dy !== -this.direction.dy) {
                this.direction = next;
            }
        }

        // Shift body: each segment takes the position of the one ahead
        for (let i = this.snake.length - 1; i >= 1; i--) {
            const seg = this.snake[i];
            seg.prevX = seg.x;
            seg.prevY = seg.y;
            seg.x = this.snake[i - 1].x;
            seg.y = this.snake[i - 1].y;
        }

        // Move head
        const head = this.snake[0];
        head.prevX = head.x;
        head.prevY = head.y;
        head.x += this.direction.dx;
        head.y += this.direction.dy;

        // Wall collision
        if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) {
            this.state = "dead";
            return;
        }

        // Self collision
        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                this.state = "dead";
                return;
            }
        }

        // Food
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score++;
            this.growPending++;
            this.placeFood();
        }

        // Growth
        if (this.growPending > 0) {
            const tail = this.snake[this.snake.length - 1];
            this.snake.push({
                x: tail.prevX,
                y: tail.prevY,
                prevX: tail.prevX,
                prevY: tail.prevY,
            });
            this.growPending--;
        }

        this.lastTickTime = performance.now();
    },
};
