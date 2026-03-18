const Renderer = {
    canvas: null,
    ctx: null,
    cellSize: 0,
    logicalSize: 0,

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.logicalSize = 600;
        this.cellSize = this.logicalSize / GRID_W;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = this.logicalSize * dpr;
        canvas.height = this.logicalSize * dpr;
        canvas.style.width = this.logicalSize + "px";
        canvas.style.height = this.logicalSize + "px";
        this.ctx.scale(dpr, dpr);
    },

    render() {
        const ctx = this.ctx;
        const size = this.logicalSize;
        const cell = this.cellSize;

        // Clear — black background
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);

        // Border / walls — white
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, size - 4, size - 4);

        // Interpolation factor
        let t = 1;
        if (Game.state === "playing" && Game.lastTickTime > 0) {
            t = Math.min((performance.now() - Game.lastTickTime) / TICK_RATE, 1);
        }

        // Draw food — white square
        const foodSize = cell * 0.5;
        const foodX = (Game.food.x + 0.5) * cell - foodSize / 2;
        const foodY = (Game.food.y + 0.5) * cell - foodSize / 2;
        ctx.fillStyle = "#fff";
        ctx.fillRect(foodX, foodY, foodSize, foodSize);

        // Draw snake segments as connected squares — white
        const segSize = cell * 0.7;
        ctx.fillStyle = "#fff";

        for (const seg of Game.snake) {
            const drawX = (seg.prevX + (seg.x - seg.prevX) * t + 0.5) * cell;
            const drawY = (seg.prevY + (seg.y - seg.prevY) * t + 0.5) * cell;
            ctx.fillRect(drawX - segSize / 2, drawY - segSize / 2, segSize, segSize);
        }

        // Fill gaps between consecutive segments via corner point
        // For segments a (closer to head) and b (closer to tail):
        //   b.current == a.prev (b moved to where a was)
        // The corner point is that shared grid cell. We draw two
        // axis-aligned rects: a→corner and b→corner, forming an L-shape.
        const half = segSize / 2;
        for (let i = 0; i < Game.snake.length - 1; i++) {
            const a = Game.snake[i];
            const b = Game.snake[i + 1];
            const ax = (a.prevX + (a.x - a.prevX) * t + 0.5) * cell;
            const ay = (a.prevY + (a.y - a.prevY) * t + 0.5) * cell;
            const bx = (b.prevX + (b.x - b.prevX) * t + 0.5) * cell;
            const by = (b.prevY + (b.y - b.prevY) * t + 0.5) * cell;
            // Corner point: where a came from = where b is going
            const cx = (a.prevX + 0.5) * cell;
            const cy = (a.prevY + 0.5) * cell;

            // Rect from a's interpolated position to corner
            const minX1 = Math.min(ax, cx) - half;
            const minY1 = Math.min(ay, cy) - half;
            const maxX1 = Math.max(ax, cx) + half;
            const maxY1 = Math.max(ay, cy) + half;
            ctx.fillRect(minX1, minY1, maxX1 - minX1, maxY1 - minY1);

            // Rect from b's interpolated position to corner
            const minX2 = Math.min(bx, cx) - half;
            const minY2 = Math.min(by, cy) - half;
            const maxX2 = Math.max(bx, cx) + half;
            const maxY2 = Math.max(by, cy) + half;
            ctx.fillRect(minX2, minY2, maxX2 - minX2, maxY2 - minY2);
        }

        // Score — white
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("Score: " + Game.score, 12, 10);

        // Overlays
        if (Game.state === "waiting") {
            this.drawOverlay("Press arrow key to start");
        } else if (Game.state === "dead") {
            this.drawOverlay("Game Over — Press Space to restart");
        }
    },

    drawOverlay(text) {
        const ctx = this.ctx;
        const size = this.logicalSize;

        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(0, size / 2 - 30, size, 60);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, size / 2, size / 2);
    },
};
