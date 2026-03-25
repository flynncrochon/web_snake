export class Bullet {
    constructor(x, y, dx, dy) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 40;
        this.radius = 0.15;
        this.life = 0.55;
        this.max_life = 0.55;
        this.age = 0;
        this.wobble = Math.random() * Math.PI * 2;
        this.alive = true;
        this.trail = [];      // smooth trail positions
    }

    update(dt) {
        // Store trail point before moving
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();

        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;
        this.age += dt;
        this.life -= dt;
        if (this.life <= 0) {
            this.alive = false;
        }
    }
}
