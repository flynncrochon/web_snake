import { play_eat_sound } from '../audio/sound.js';

export class SnakeController {

    tick_all(snakes, arena) {
        const died = [];

        const snapshot = new Map();
        for (const snake of snakes) {
            if (!snake.alive) continue;
            const head = snake.head;
            snapshot.set(snake.id, {
                segments: snake.segments.map(s => ({ x: s.x, y: s.y })),
                next_x: head.x + snake.direction.dx,
                next_y: head.y + snake.direction.dy,
                growing: snake.grow_pending > 0,
            });
        }

        const body_map = new Map();
        for (const [id, snap] of snapshot) {
            const skip_tail = !snap.growing;
            const end = skip_tail ? snap.segments.length - 1 : snap.segments.length;
            for (let i = 0; i < end; i++) {
                const key = snap.segments[i].x + ',' + snap.segments[i].y;
                body_map.set(key, id);
            }
        }

        const dead = new Set();
        const killed_by = new Map();

        for (const snake of snakes) {
            if (!snake.alive) continue;
            const snap = snapshot.get(snake.id);
            if (!snap) continue;
            const { next_x, next_y } = snap;

            if (!arena.is_in_bounds(next_x, next_y)) {
                dead.add(snake.id);
                arena.add_kill_feed_entry(`#${snake.id} hit the wall`);
                continue;
            }

            if (!arena.is_in_safe_zone(next_x, next_y)) {
                dead.add(snake.id);
                arena.add_kill_feed_entry(`#${snake.id} caught in the zone`);
                continue;
            }

            const next_key = next_x + ',' + next_y;
            const body_owner = body_map.get(next_key);
            if (body_owner !== undefined) {
                if (body_owner === snake.id) {
                    const own_snap = snap.segments;
                    const tail_idx = snap.growing ? -1 : own_snap.length - 1;
                    const hit_seg = own_snap.findIndex(s => s.x === next_x && s.y === next_y);
                    if (hit_seg !== tail_idx && hit_seg !== 0) {
                        dead.add(snake.id);
                        arena.add_kill_feed_entry(`#${snake.id} eliminated`);
                        continue;
                    }
                } else {
                    dead.add(snake.id);
                    killed_by.set(snake.id, body_owner);
                    arena.add_kill_feed_entry(`#${snake.id} eliminated by #${body_owner}`);
                    continue;
                }
            }
        }

        const next_positions = new Map();
        for (const [id, snap] of snapshot) {
            if (dead.has(id)) continue;
            const key = snap.next_x + ',' + snap.next_y;
            if (!next_positions.has(key)) next_positions.set(key, []);
            next_positions.get(key).push(id);
        }
        for (const [, ids] of next_positions) {
            if (ids.length > 1) {
                for (const id of ids) {
                    dead.add(id);
                    arena.add_kill_feed_entry(`#${id} head-on collision`);
                }
            }
        }

        const alive_snaps = [...snapshot.entries()].filter(([id]) => !dead.has(id));
        for (let i = 0; i < alive_snaps.length; i++) {
            for (let j = i + 1; j < alive_snaps.length; j++) {
                const [id_a, snap_a] = alive_snaps[i];
                const [id_b, snap_b] = alive_snaps[j];
                if (snap_a.next_x === snap_b.segments[0].x && snap_a.next_y === snap_b.segments[0].y &&
                    snap_b.next_x === snap_a.segments[0].x && snap_b.next_y === snap_a.segments[0].y) {
                    dead.add(id_a);
                    dead.add(id_b);
                    arena.add_kill_feed_entry(`#${id_a} and #${id_b} head-on collision`);
                }
            }
        }

        for (const snake of snakes) {
            if (!snake.alive) continue;
            if (dead.has(snake.id)) {
                snake.alive = false;
                arena.add_remains(snake.segments);
                const killer_id = killed_by.get(snake.id);
                if (killer_id !== undefined) {
                    const killer = snakes.find(s => s.id === killer_id && s.alive);
                    if (killer) killer.kills++;
                }
                died.push(snake);
            }
        }

        for (const snake of snakes) {
            if (!snake.alive) continue;
            const snap = snapshot.get(snake.id);
            if (!snap) continue;

            for (let i = snake.segments.length - 1; i >= 1; i--) {
                const seg = snake.segments[i];
                seg.prev_x = seg.x;
                seg.prev_y = seg.y;
                seg.x = snake.segments[i - 1].x;
                seg.y = snake.segments[i - 1].y;
            }
            const head = snake.head;
            head.prev_x = head.x;
            head.prev_y = head.y;
            head.x = snap.next_x;
            head.y = snap.next_y;

            const food_idx = arena.food.findIndex(f => f.x === head.x && f.y === head.y);
            if (food_idx !== -1) {
                arena.food.splice(food_idx, 1);
                snake.grow_pending++;
                if (snake.is_player) play_eat_sound();
            }

            const remain_idx = arena.remains.findIndex(r => r.x === head.x && r.y === head.y);
            if (remain_idx !== -1) {
                arena.remains.splice(remain_idx, 1);
                snake.grow_pending += 2;
                if (snake.is_player) play_eat_sound();
            }

            if (snake.grow_pending > 0) {
                const tail = snake.segments[snake.segments.length - 1];
                snake.segments.push({
                    x: tail.prev_x, y: tail.prev_y,
                    prev_x: tail.prev_x, prev_y: tail.prev_y,
                });
                snake.grow_pending--;
            }
        }

        return died;
    }

    check_encirclements(arena, all_snakes) {
        const kills = [];

        for (const snake of all_snakes) {
            if (!snake.alive) continue;

            const walls = new Set();
            for (const other of all_snakes) {
                if (!other.alive || other === snake) continue;
                for (const seg of other.segments) {
                    walls.add(seg.x + ',' + seg.y);
                }
            }

            const head = snake.head;
            const visited = new Set();
            const queue = [{ x: head.x, y: head.y }];
            visited.add(head.x + ',' + head.y);
            let escaped = false;
            let steps = 0;

            while (queue.length > 0 && !escaped && steps < 600) {
                const { x, y } = queue.shift();
                steps++;

                if (x === arena.safe_zone.x1 || x === arena.safe_zone.x2 ||
                    y === arena.safe_zone.y1 || y === arena.safe_zone.y2) {
                    escaped = true;
                    break;
                }

                for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const key = nx + ',' + ny;
                    if (!arena.is_in_bounds(nx, ny)) continue;
                    if (!arena.is_in_safe_zone(nx, ny)) continue;
                    if (visited.has(key) || walls.has(key)) continue;
                    let is_own_body = false;
                    for (let i = 1; i < snake.segments.length; i++) {
                        if (snake.segments[i].x === nx && snake.segments[i].y === ny) {
                            is_own_body = true;
                            break;
                        }
                    }
                    if (is_own_body) continue;
                    visited.add(key);
                    queue.push({ x: nx, y: ny });
                }
            }

            if (!escaped && steps < 600) {
                let killer = null;
                for (const other of all_snakes) {
                    if (!other.alive || other === snake) continue;
                    let touch_count = 0;
                    for (const seg of other.segments) {
                        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                            if (visited.has((seg.x + dx) + ',' + (seg.y + dy))) {
                                touch_count++;
                                break;
                            }
                        }
                    }
                    if (touch_count > 0 && (!killer || touch_count > killer.count)) {
                        killer = { snake: other, count: touch_count };
                    }
                }

                kills.push({
                    victim: snake,
                    killer: killer ? killer.snake : null,
                });
            }
        }

        for (const { victim, killer } of kills) {
            if (!victim.alive) continue;
            victim.alive = false;
            arena.add_remains(victim.segments);
            if (killer) {
                killer.kills++;
                arena.add_kill_feed_entry(`#${victim.id} encircled by #${killer.id}`);
            } else {
                arena.add_kill_feed_entry(`#${victim.id} trapped`);
            }
        }

        return kills.length;
    }
}
