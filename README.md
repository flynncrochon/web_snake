# web_snake

A simple snake game that runs in the browser. No dependencies, no build step — just open `index.html` and play.

## How to play

- Arrow keys or WASD to move
- Eat the food to grow
- Don't hit the walls or yourself
- Space/Enter to restart after dying

## Files

- `index.html` — just loads everything
- `style.css` — minimal styling, black background
- `game.js` — game state, movement, collisions, food
- `input.js` — keyboard handling with a small direction queue so fast inputs around corners don't get dropped
- `renderer.js` — canvas drawing
- `main.js` — ties it all together, runs the loop
