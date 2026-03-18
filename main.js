function main() {
    const canvas = document.getElementById("game");
    Renderer.init(canvas);
    Input.init();
    Game.reset();

    function gameLoop() {
        // Run ticks (with catch-up, capped at 4)
        if (Game.state === "playing") {
            let ticksThisFrame = 0;
            while (performance.now() - Game.lastTickTime >= TICK_RATE && ticksThisFrame < 4) {
                Game.tick();
                ticksThisFrame++;
            }
        }

        Renderer.render();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

main();
