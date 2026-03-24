export class GameLoop {
    constructor(update_fn, render_fn) {
        this.update_fn = update_fn;
        this.render_fn = render_fn;
        this.running = false;
        this.raf_id = null;
        // Frame-level timing for perf overlay
        this.perf_update_ms = 0;
        this.perf_render_ms = 0;
        this.perf_total_ms = 0;
    }

    start() {
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.raf_id = requestAnimationFrame(loop);
            const t0 = performance.now();
            this.update_fn();
            const t1 = performance.now();
            this.render_fn();
            const t2 = performance.now();
            this.perf_update_ms = t1 - t0;
            this.perf_render_ms = t2 - t1;
            this.perf_total_ms = t2 - t0;
        };
        this.raf_id = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        if (this.raf_id) cancelAnimationFrame(this.raf_id);
    }
}
