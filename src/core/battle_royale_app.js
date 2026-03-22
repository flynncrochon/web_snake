import { ARENA_SIZE, SOLO_ARENA_SIZE, LOGICAL_SIZE, CELL_SIZE, TICK_RATE, AI_COUNT, FOOD_RESPAWN_INTERVAL, FOOD_COUNT, VS_ARENA_SIZE, VS_VIEWPORT_CELLS, VS_TICK_RATE, VS_FOOD_COUNT } from '../constants.js';
import { StateMachine } from './state_machine.js';
import { GameLoop } from './game_loop.js';
import { Renderer } from '../rendering/renderer.js';
import { ArenaRenderer } from '../rendering/arena_renderer.js';
import { HUDRenderer } from '../rendering/hud_renderer.js';
import { UIRenderer } from '../rendering/ui_renderer.js';
import { ParticleSystem } from '../rendering/particle_system.js';
import { SnakeRenderer } from '../snake/snake_renderer.js';
import { SnakeController } from '../snake/snake_controller.js';
import { Snake, reset_snake_ids } from '../snake/snake.js';
import { AIController } from '../snake/ai_controller.js';
import { SoloAutopilot } from '../snake/solo_autopilot.js';
import { Arena } from '../arena/arena.js';
import { ZoneShrinker } from '../arena/zone_shrinker.js';
import { Input } from '../input/input.js';
import { Camera } from '../survivors/camera.js';
import { EnemyManager } from '../survivors/enemy_manager.js';
import { SurvivorsRenderer } from '../survivors/survivors_renderer.js';
import { BulletManager } from '../survivors/bullet_manager.js';
import { DamageNumberSystem } from '../survivors/damage_numbers.js';
import { PoisonMortar } from '../survivors/poison_mortar.js';
import { SnakeNest } from '../survivors/snake_nest.js';
import { get_powerup_icon } from '../rendering/powerup_icons.js';

const AI_COLORS = [
    '#888', '#668', '#686', '#866', '#586', '#658', '#856',
    '#778', '#787', '#877', '#567', '#576', '#675', '#765',
    '#556', '#655',
];

const SOLO_FOOD_COUNT = 5;
const SOLO_TICK_RATE = 130;
const SOLO_BOOST_TICK_RATE = 40;
const GREEN_BOOST_BASE_MS = 1000;
const GREEN_BOOST_SCALE_MS = 190;
const SOLO_CELL_SIZE = LOGICAL_SIZE / SOLO_ARENA_SIZE;
const INVULN_DURATION = 2000;
const VS_INVULN_DURATION = 3000;

const VS_POWERUP_DEFS = [
    { id: 'magnet',      name: 'Graviton',    description: '+1 fruit pickup radius',       rarity: 'common' },
    { id: 'atk_speed',   name: 'Rapid Fire',   description: '+15% attack speed',            rarity: 'uncommon' },
    { id: 'crit',        name: 'Dead Eye',     description: '+10% crit chance (2\u00d7 dmg)', rarity: 'rare' },
    { id: 'gorger',      name: 'Gorger',       description: '+1 bullet dmg, +1 tail growth', rarity: 'legendary' },
    { id: 'plague',      name: 'Plague Mortar', description: 'Lob toxic bombs that leave poison zones', rarity: 'rare' },
    { id: 'constrictor', name: 'Constrictor',  description: 'Encircle enemies with your body to crush them all and collect fruit inside', rarity: 'ultra', one_time: true },
    { id: 'snake_nest',  name: 'Snake Nest',   description: 'Lob an egg that hatches mini snakes to hunt enemies', rarity: 'rare' },
    { id: 'chronofield', name: 'Chronofield',  description: '+25% duration on all timed effects', rarity: 'uncommon' },
    { id: 'multishot',   name: 'Hydra Fangs',  description: '+1 extra projectile to all weapons',  rarity: 'rare', max_rank: 3 },
];

export class BattleRoyaleApp {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.arena_renderer = new ArenaRenderer();
        this.hud_renderer = new HUDRenderer();
        this.ui_renderer = new UIRenderer();
        this.particles = new ParticleSystem();
        this.snake_renderer = new SnakeRenderer();
        this.snake_controller = new SnakeController();
        this.input = new Input();

        this.fsm = new StateMachine();
        this.arena = null;
        this.snakes = [];
        this.player_snake = null;
        this.ai_controllers = [];
        this.zone_shrinker = null;
        this.last_tick_time = 0;
        this.last_food_spawn = 0;
        this.countdown_start = 0;
        this.game_started = false;

        this.mode = null;
        this.menu_index = 0;
        this.menu_options = [
            { label: 'SOLO', description: 'Classic snake. Eat, grow, survive.', mode: 'solo' },
            { label: 'BATTLE ROYALE', description: `${AI_COUNT + 1} snakes. Last one standing.`, mode: 'battle_royale' },
            { label: 'SURVIVORS', description: 'Slay hordes. Collect fruit. Survive.', mode: 'survivors' },
        ];

        this.solo_score = 0;
        this.solo_high_score = parseInt(localStorage.getItem('snake_solo_high') || '0', 10);

        this.normal_fruits_eaten = 0;
        this.green_food = null;
        this.solo_autopilot = new SoloAutopilot();
        this.solo_boosted = false;
        this.invulnerable = false;
        this.invuln_start = 0;

        this.camera = null;
        this.enemy_manager = null;
        this.survivors_renderer = new SurvivorsRenderer();
        this.bullet_manager = null;
        this.survivors_start_time = 0;
        this.vs_last_frame_time = 0;
        this.survivors_high_score = parseInt(localStorage.getItem('snake_vs_high') || '0', 10);

        this.vs_xp = 0;
        this.vs_level = 1;
        this.vs_xp_for_next = 5;

        this.vs_level_up_active = false;
        this.vs_level_up_choices = [];
        this.vs_level_up_index = 0;
        this.vs_powerups = { magnet: 0, atk_speed: 0, crit: 0, gorger: 0, plague: 0, constrictor: 0, snake_nest: 0, chronofield: 0, multishot: 0 };
        this.vs_invuln_start = 0;
        this.poison_mortar = null;
        this.snake_nest = null;
        this.snake_nest = null;

        this.paused = false;
        this.pause_start = 0;

        this._on_resize = () => this._handle_resize();

        this.register_states();
        this.setup_input();
        this.fsm.transition('MAIN_MENU');

        this.game_loop = new GameLoop(
            () => this.update(),
            () => this.render()
        );
        this.game_loop.start();
    }

    register_states() {
        const self = this;

        this.fsm.register('MAIN_MENU', {
            enter() {
                self.menu_index = 0;
                self.paused = false;
                window.removeEventListener('resize', self._on_resize);
                self.renderer.reset_to_square();
            },
            render() { self.render_main_menu(); },
        });

        this.fsm.register('COUNTDOWN', {
            enter() {
                self.init_game();
                self.countdown_start = performance.now();
            },
            render() { self.render_countdown(); },
            update() {
                const wait = self.mode === 'battle_royale' ? 3000 : 1500;
                if (performance.now() - self.countdown_start >= wait) {
                    self.game_started = true;
                    self.last_tick_time = performance.now();
                    self.last_food_spawn = performance.now();
                    if (self.zone_shrinker) self.zone_shrinker.start();
                    self.fsm.transition('PLAYING');
                }
            },
        });

        this.fsm.register('PLAYING', {
            update() { self.update_playing(); },
            render() {
                self.render_playing();
                if (self.paused) {
                    self.render_pause_overlay();
                }
            },
        });

        this.fsm.register('VICTORY', {
            update() { self.particles.update(); },
            render() {
                self.render_playing();
                if (self.mode !== 'survivors') self.particles.render(self.renderer.ctx);
                self.ui_renderer.draw_overlay(
                    self.renderer.ctx,
                    'VICTORY! #1 — Press Space',
                    self.renderer.logical_width,
                    self.renderer.logical_height
                );
            },
        });

        this.fsm.register('DEATH', {
            update() {
                if (self.mode === 'battle_royale') self.update_playing();
                self.particles.update();
            },
            render() {
                self.render_playing();
                if (self.mode !== 'survivors') self.particles.render(self.renderer.ctx);
                let msg;
                if (self.mode === 'solo') {
                    msg = `GAME OVER — Score: ${self.solo_score} — Press Space`;
                } else if (self.mode === 'survivors') {
                    const kills = self.enemy_manager ? self.enemy_manager.total_kills : 0;
                    const elapsed = self.survivors_final_elapsed || 0;
                    const mins = Math.floor(elapsed / 60);
                    const secs = elapsed % 60;
                    msg = `DEAD — ${kills} kills — ${mins}:${secs.toString().padStart(2, '0')} — Space`;
                } else {
                    const alive = self.snakes.filter(s => s.alive).length;
                    msg = `ELIMINATED — #${alive + 1} place — Press Space`;
                }
                self.ui_renderer.draw_overlay(
                    self.renderer.ctx,
                    msg,
                    self.renderer.logical_width,
                    self.renderer.logical_height
                );
            },
        });
    }

    setup_input() {
        this.input.init();
        this.input.on_action = (action, data) => {
            const state = this.fsm.current;

            if (state === 'MAIN_MENU') {
                if (action === 'menu_up') {
                    this.menu_index = (this.menu_index - 1 + this.menu_options.length) % this.menu_options.length;
                } else if (action === 'menu_down') {
                    this.menu_index = (this.menu_index + 1) % this.menu_options.length;
                } else if (action === 'enter' || action === 'space') {
                    this.mode = this.menu_options[this.menu_index].mode;
                    this.fsm.transition('COUNTDOWN');
                }
                return;
            }

            if (state === 'PLAYING') {
                if (this.vs_level_up_active) {
                    if (action === 'menu_left') {
                        this.vs_level_up_index = (this.vs_level_up_index - 1 + this.vs_level_up_choices.length) % this.vs_level_up_choices.length;
                    } else if (action === 'menu_right') {
                        this.vs_level_up_index = (this.vs_level_up_index + 1) % this.vs_level_up_choices.length;
                    } else if (action === 'enter' || action === 'space') {
                        this.select_level_up_choice(this.vs_level_up_index);
                    } else if (action === 'number' && data >= 1 && data <= this.vs_level_up_choices.length) {
                        this.select_level_up_choice(data - 1);
                    }
                    return;
                }
                if (action === 'space' || action === 'escape') {
                    this.toggle_pause();
                    return;
                }
                if (this.paused) return;
                if (action === 'direction') {
                    this.input.queue_direction(data, this.player_snake?.direction, false);
                }
                return;
            }

            if (state === 'VICTORY' || state === 'DEATH') {
                if (action === 'space' || action === 'enter') {
                    this.fsm.transition('MAIN_MENU');
                }
                return;
            }
        };
    }

    init_game() {
        reset_snake_ids();
        this.arena = new Arena();
        this.snakes = [];
        this.ai_controllers = [];
        this.particles.clear();
        this.solo_score = 0;
        this.normal_fruits_eaten = 0;
        this.green_food = null;
        this.solo_autopilot.deactivate();
        this.solo_boosted = false;
        this.invulnerable = false;
        this.invuln_start = 0;
        if (this.bullet_manager) this.bullet_manager.clear();
        if (this.damage_numbers) this.damage_numbers.clear();
        if (this.poison_mortar) this.poison_mortar.clear();
        if (this.snake_nest) this.snake_nest.clear();

        if (this.mode === 'solo') {
            this.init_solo();
        } else if (this.mode === 'survivors') {
            this.init_survivors();
        } else {
            this.init_battle_royale();
        }
    }

    init_solo() {
        this.arena = new Arena(SOLO_ARENA_SIZE);
        this.renderer.set_cell_size(SOLO_ARENA_SIZE);
        this.solo_autopilot = new SoloAutopilot(SOLO_ARENA_SIZE);
        const cx = Math.floor(SOLO_ARENA_SIZE / 2);
        const cy = Math.floor(SOLO_ARENA_SIZE / 2);
        this.player_snake = new Snake(cx, cy, '#fff', true);
        this.snakes.push(this.player_snake);
        this.zone_shrinker = null;
        this.arena.spawn_food_count(this.snakes, SOLO_FOOD_COUNT);
    }

    init_battle_royale() {
        this.renderer.set_cell_size(ARENA_SIZE);
        const positions = this.generate_spawn_positions(AI_COUNT + 1);

        const player_pos = positions[0];
        this.player_snake = new Snake(player_pos.x, player_pos.y, '#fff', true);
        this.snakes.push(this.player_snake);

        for (let i = 0; i < AI_COUNT; i++) {
            const pos = positions[i + 1];
            const color = AI_COLORS[i % AI_COLORS.length];
            const angle = ((i + 1) / (AI_COUNT + 1)) * Math.PI * 2;
            const tx = -Math.sin(angle);
            const ty = Math.cos(angle);
            let dir;
            if (Math.abs(tx) > Math.abs(ty)) {
                dir = { dx: Math.sign(tx), dy: 0 };
            } else {
                dir = { dx: 0, dy: Math.sign(ty) || 1 };
            }
            const ai_snake = new Snake(pos.x, pos.y, color, false, dir);
            this.snakes.push(ai_snake);
            this.ai_controllers.push(new AIController(ai_snake));
        }

        this.zone_shrinker = new ZoneShrinker(this.arena);
        this.arena.spawn_food(this.snakes);

        for (const ai of this.ai_controllers) {
            const dir = ai.get_direction(this.arena, this.snakes);
            if (dir) ai.snake.direction = dir;
        }
    }

    init_survivors() {
        this.arena = new Arena(VS_ARENA_SIZE);

        const vs_cell_size = Math.min(window.innerWidth, window.innerHeight) / VS_VIEWPORT_CELLS;
        this.renderer.set_fullscreen(vs_cell_size);
        window.addEventListener('resize', this._on_resize);

        this.camera = new Camera(VS_ARENA_SIZE, vs_cell_size,
            this.renderer.logical_width, this.renderer.logical_height);
        this.enemy_manager = new EnemyManager(VS_ARENA_SIZE);
        this.bullet_manager = new BulletManager();
        this.damage_numbers = new DamageNumberSystem();
        this.poison_mortar = new PoisonMortar();
        this.snake_nest = new SnakeNest();

        const cx = Math.floor(VS_ARENA_SIZE / 2);
        const cy = Math.floor(VS_ARENA_SIZE / 2);
        this.player_snake = new Snake(cx, cy, '#fff', true);
        this.snakes.push(this.player_snake);

        this.camera.snap_to(cx + 0.5, cy + 0.5);
        this.zone_shrinker = null;
        this.survivors_start_time = performance.now();
        this.vs_last_frame_time = performance.now();

        this.vs_xp = 0;
        this.vs_level = 1;
        this.vs_xp_for_next = 5;
        this.vs_level_up_active = false;
        this.vs_level_up_choices = [];
        this.vs_level_up_index = 0;
        this.vs_powerups = { magnet: 0, atk_speed: 0, crit: 0, gorger: 0, plague: 0, constrictor: 0, snake_nest: 0, chronofield: 0, multishot: 0 };
        this.vs_invuln_start = 0;

        this.arena.spawn_food_count(this.snakes, VS_FOOD_COUNT);
    }

    _handle_resize() {
        if (this.mode !== 'survivors') return;
        const vs_cell_size = Math.min(window.innerWidth, window.innerHeight) / VS_VIEWPORT_CELLS;
        this.renderer.set_fullscreen(vs_cell_size);
        if (this.camera) {
            this.camera.cell_size = vs_cell_size;
            this.camera.resize(this.renderer.logical_width, this.renderer.logical_height);
        }
    }

    toggle_pause() {
        if (!this.paused) {
            this.paused = true;
            this.pause_start = performance.now();
        } else {
            const pause_duration = performance.now() - this.pause_start;
            this.paused = false;
            this.last_tick_time += pause_duration;
            this.last_food_spawn += pause_duration;
            if (this.mode === 'survivors') {
                this.vs_last_frame_time += pause_duration;
                this.survivors_start_time += pause_duration;
                if (this.vs_invuln_start > 0) this.vs_invuln_start += pause_duration;
                if (this.enemy_manager) this.enemy_manager.pause_adjust(pause_duration);
                if (this.bullet_manager && this.bullet_manager.last_fire_time > 0) {
                    this.bullet_manager.last_fire_time += pause_duration;
                }
                if (this.poison_mortar && this.poison_mortar.last_fire > 0) {
                    this.poison_mortar.last_fire += pause_duration;
                }
                if (this.snake_nest && this.snake_nest.last_fire > 0) {
                    this.snake_nest.last_fire += pause_duration;
                }
            }
            if (this.mode === 'solo') {
                if (this.invuln_start > 0) this.invuln_start += pause_duration;
                if (this.solo_autopilot.active && this.solo_autopilot.start_time) {
                    this.solo_autopilot.start_time += pause_duration;
                }
            }
            if (this.zone_shrinker && this.zone_shrinker.last_shrink_time) {
                this.zone_shrinker.last_shrink_time += pause_duration;
            }
        }
    }

    generate_spawn_positions(count) {
        const positions = [];
        const margin = 8;
        const radius = (ARENA_SIZE / 2) - margin;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.floor(ARENA_SIZE / 2 + Math.cos(angle) * radius);
            const y = Math.floor(ARENA_SIZE / 2 + Math.sin(angle) * radius);
            positions.push({
                x: Math.max(margin, Math.min(ARENA_SIZE - margin - 4, x)),
                y: Math.max(margin, Math.min(ARENA_SIZE - margin - 4, y)),
            });
        }
        return positions;
    }

    place_green_food() {
        if (this.green_food || !this.player_snake || !this.player_snake.alive) return;

        const head = this.player_snake.head;
        const occupied = new Set();
        for (const s of this.player_snake.segments) occupied.add(s.x + ',' + s.y);
        for (const f of this.arena.food) occupied.add(f.x + ',' + f.y);

        const a_size = this.arena.size;
        const candidates = [];
        for (let x = 0; x < a_size; x++) {
            for (let y = 0; y < a_size; y++) {
                if (occupied.has(x + ',' + y)) continue;
                const dist = Math.abs(x - head.x) + Math.abs(y - head.y);
                if (dist > 5) candidates.push({ x, y, weight: dist * dist });
            }
        }
        if (candidates.length === 0) return;

        const total_weight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let r = Math.random() * total_weight;
        for (const c of candidates) {
            r -= c.weight;
            if (r <= 0) {
                this.green_food = { x: c.x, y: c.y };
                return;
            }
        }
        this.green_food = candidates[candidates.length - 1];
    }

    update_playing() {
        if (this.paused) return;
        if (this.mode === 'solo') {
            this.update_solo();
        } else if (this.mode === 'survivors') {
            this.update_survivors();
        } else {
            this.update_battle_royale();
        }
    }

    update_survivors() {
        if (this.vs_level_up_active) return;

        const now = performance.now();
        const dt = Math.min((now - this.vs_last_frame_time) / 1000, 0.1);
        this.vs_last_frame_time = now;

        const snake = this.player_snake;
        if (!snake || !snake.alive) return;

        const cell = this.renderer.cell_size;
        this.enemy_manager.update(dt, snake, this.arena, this.particles, cell, this.damage_numbers);

        this.bullet_manager.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);

        if (this.poison_mortar) {
            this.poison_mortar.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
        }

        if (this.snake_nest) {
            this.snake_nest.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
        }

        this.damage_numbers.update(dt);

        if (this.enemy_manager.player_hp <= 0 && snake.alive) {
            snake.alive = false;
            this.survivors_final_elapsed = Math.floor((performance.now() - this.survivors_start_time) / 1000);
            const cx = (snake.head.x + 0.5) * cell;
            const cy = (snake.head.y + 0.5) * cell;
            this.particles.emit(cx, cy, 25, '#f00', 5);
            const kills = this.enemy_manager.total_kills;
            if (kills > this.survivors_high_score) {
                this.survivors_high_score = kills;
                localStorage.setItem('snake_vs_high', String(kills));
            }
            this.fsm.transition('DEATH');
            return;
        }

        const vs_invuln_dur = VS_INVULN_DURATION * (1 + this.vs_powerups.chronofield * 0.25);
        const vs_immune = this.vs_invuln_start > 0 && now - this.vs_invuln_start < vs_invuln_dur;

        if (now - this.last_tick_time >= VS_TICK_RATE) {
            const dir = this.input.dequeue();
            if (dir) {
                if (dir.dx !== -snake.direction.dx || dir.dy !== -snake.direction.dy) {
                    snake.direction = dir;
                }
            }

            if (vs_immune) {
                const next_x = snake.head.x + snake.direction.dx;
                const next_y = snake.head.y + snake.direction.dy;
                const growing = snake.grow_pending > 0;
                const end = growing ? snake.segments.length : snake.segments.length - 1;
                let hits_own_body = false;
                for (let i = 1; i < end; i++) {
                    if (snake.segments[i].x === next_x && snake.segments[i].y === next_y) {
                        hits_own_body = true;
                        break;
                    }
                }
                if (hits_own_body) {
                    for (const seg of snake.segments) {
                        seg.prev_x = seg.x;
                        seg.prev_y = seg.y;
                    }
                    this.last_tick_time = now;
                    this.particles.update();
                    if (now - this.last_food_spawn >= 3000) {
                        this.arena.spawn_food_count(this.snakes, VS_FOOD_COUNT);
                        this.last_food_spawn = now;
                    }
                    return;
                }
            }

            const grow_before = snake.segments.length + snake.grow_pending;

            const died = this.snake_controller.tick_all(this.snakes, this.arena);

            if (this.vs_powerups.constrictor && snake.alive) {
                this.check_constrictor_enclosure(snake);
            }

            if (this.vs_powerups.magnet > 0 && snake.alive) {
                const hx = snake.head.x;
                const hy = snake.head.y;
                const r = this.vs_powerups.magnet;
                for (let i = this.arena.food.length - 1; i >= 0; i--) {
                    const f = this.arena.food[i];
                    if (Math.abs(f.x - hx) <= r && Math.abs(f.y - hy) <= r && (f.x !== hx || f.y !== hy)) {
                        this.arena.food.splice(i, 1);
                        snake.grow_pending++;
                    }
                }
            }

            const grow_after = snake.segments.length + snake.grow_pending;
            const gained = grow_after - grow_before;
            if (gained > 0) {
                if (this.vs_powerups.gorger > 0) {
                    snake.grow_pending += gained * this.vs_powerups.gorger;
                }
                this.vs_xp += gained;
                while (this.vs_xp >= this.vs_xp_for_next) {
                    this.vs_xp -= this.vs_xp_for_next;
                    this.vs_level++;
                    this.vs_xp_for_next = this.vs_level * 5;
                    this.vs_level_up_active = true;
                    const pool = VS_POWERUP_DEFS.filter(p => {
                        if (p.one_time && this.vs_powerups[p.id]) return false;
                        if (p.max_rank && this.vs_powerups[p.id] >= p.max_rank) return false;
                        return true;
                    });
                    const normal_pool = pool.filter(p => p.rarity !== 'ultra');
                    const ultra_pool = pool.filter(p => p.rarity === 'ultra');
                    const shuffled = [...normal_pool].sort(() => Math.random() - 0.5);
                    const choices = shuffled.slice(0, 3);
                    if (ultra_pool.length > 0 && Math.random() < 0.12) {
                        choices[Math.floor(Math.random() * choices.length)] = ultra_pool[Math.floor(Math.random() * ultra_pool.length)];
                    }
                    this.vs_level_up_choices = choices.map(p => ({
                        ...p,
                        description: this.get_powerup_desc(p.id),
                    }));
                    this.vs_level_up_index = 0;
                }
            }

            for (const s of died) {
                if (s.is_player) {
                    this.survivors_final_elapsed = Math.floor((performance.now() - this.survivors_start_time) / 1000);
                    const cx = (s.head.x + 0.5) * cell;
                    const cy = (s.head.y + 0.5) * cell;
                    this.particles.emit(cx, cy, 20, '#fff', 5);

                    const kills = this.enemy_manager.total_kills;
                    if (kills > this.survivors_high_score) {
                        this.survivors_high_score = kills;
                        localStorage.setItem('snake_vs_high', String(kills));
                    }

                    this.fsm.transition('DEATH');
                }
            }

            this.last_tick_time = now;
        }

        if (now - this.last_food_spawn >= 3000) {
            this.arena.spawn_food_count(this.snakes, VS_FOOD_COUNT);
            this.last_food_spawn = now;
        }

        this.particles.update();
    }

    update_solo() {
        const now = performance.now();
        const tick_rate = this.solo_boosted ? SOLO_BOOST_TICK_RATE : SOLO_TICK_RATE;

        if (this.invulnerable && now - this.invuln_start >= INVULN_DURATION) {
            this.invulnerable = false;
        }

        if (this.solo_autopilot.active && this.solo_autopilot.expired) {
            this.solo_autopilot.deactivate();
            this.solo_boosted = false;
            this.invulnerable = true;
            this.invuln_start = now;
        }

        if (now - this.last_tick_time >= tick_rate) {
            const snake = this.player_snake;
            if (!snake || !snake.alive) return;

            if (this.solo_autopilot.active) {
                const dir = this.solo_autopilot.get_direction(snake, this.arena.food);
                if (dir) {
                    snake.direction = dir;
                } else {
                    this.solo_autopilot.deactivate();
                    this.solo_boosted = false;
                    this.invulnerable = true;
                    this.invuln_start = now;
                }
            } else {
                const dir = this.input.dequeue();
                if (dir) {
                    if (dir.dx !== -snake.direction.dx || dir.dy !== -snake.direction.dy) {
                        snake.direction = dir;
                    }
                }
            }

            if (this.invulnerable && snake.alive) {
                const arena_size = this.arena.size;
                const nx = snake.head.x + snake.direction.dx;
                const ny = snake.head.y + snake.direction.dy;
                const hits_wall = nx < 0 || nx >= arena_size || ny < 0 || ny >= arena_size;
                let hits_self = false;
                if (!hits_wall) {
                    for (let i = 1; i < snake.segments.length; i++) {
                        if (snake.segments[i].x === nx && snake.segments[i].y === ny) {
                            hits_self = true;
                            break;
                        }
                    }
                }
                if (hits_wall || hits_self) {
                    for (const seg of snake.segments) {
                        seg.prev_x = seg.x;
                        seg.prev_y = seg.y;
                    }
                    this.last_tick_time = now;
                    this.particles.update();
                    return;
                }
            }

            const food_before = this.arena.food.length;

            const died = this.snake_controller.tick_all(this.snakes, this.arena);

            const food_after = this.arena.food.length;
            if (food_after < food_before) {
                this.normal_fruits_eaten += (food_before - food_after);
            }

            if (this.green_food && snake.alive) {
                if (snake.head.x === this.green_food.x && snake.head.y === this.green_food.y) {
                    const boost_duration = GREEN_BOOST_BASE_MS + GREEN_BOOST_SCALE_MS * this.normal_fruits_eaten * this.normal_fruits_eaten;
                    this.green_food = null;
                    this.normal_fruits_eaten = 0;
                    snake.grow_pending += 2;
                    this.solo_boosted = true;
                    this.invulnerable = false;
                    this.solo_autopilot.activate(boost_duration);
                }
            }

            for (const s of died) {
                if (s.is_player) {
                    const cell_sz = this.renderer.cell_size;
                    const cx = (s.head.x + 0.5) * cell_sz;
                    const cy = (s.head.y + 0.5) * cell_sz;
                    this.particles.emit(cx, cy, 15, '#fff', 4);
                    if (this.solo_score > this.solo_high_score) {
                        this.solo_high_score = this.solo_score;
                        localStorage.setItem('snake_solo_high', String(this.solo_high_score));
                    }
                    this.fsm.transition('DEATH');
                }
            }

            if (snake.alive) {
                this.solo_score = snake.length - 3;
            }

            if (!this.green_food && !this.solo_autopilot.active && !this.invulnerable) {
                this.place_green_food();
            }

            this.last_tick_time = now;
        }

        if (now - this.last_food_spawn >= 2000) {
            this.arena.spawn_food_count(this.snakes, SOLO_FOOD_COUNT);
            this.last_food_spawn = now;
        }

        this.particles.update();
    }

    update_battle_royale() {
        const now = performance.now();

        if (now - this.last_tick_time >= TICK_RATE) {
            AIController.reset_claims();
            for (const ai of this.ai_controllers) {
                if (!ai.snake.alive) continue;
                const dir = ai.get_direction(this.arena, this.snakes);
                if (dir) ai.snake.direction = dir;
            }

            if (this.player_snake && this.player_snake.alive) {
                const dir = this.input.dequeue();
                if (dir) {
                    if (dir.dx !== -this.player_snake.direction.dx ||
                        dir.dy !== -this.player_snake.direction.dy) {
                        this.player_snake.direction = dir;
                    }
                }
            }

            const died = this.snake_controller.tick_all(this.snakes, this.arena);
            for (const snake of died) {
                const cx = (snake.head.x + 0.5) * CELL_SIZE;
                const cy = (snake.head.y + 0.5) * CELL_SIZE;
                this.particles.emit(cx, cy, 15, snake.color, 4);
                if (snake.is_player && this.fsm.current === 'PLAYING') {
                    this.fsm.transition('DEATH');
                }
            }

            this.snake_controller.check_encirclements(this.arena, this.snakes);
            if (this.zone_shrinker) this.zone_shrinker.update(this.snakes);

            if (this.player_snake && !this.player_snake.alive && this.fsm.current === 'PLAYING') {
                const cx = (this.player_snake.head.x + 0.5) * CELL_SIZE;
                const cy = (this.player_snake.head.y + 0.5) * CELL_SIZE;
                this.particles.emit(cx, cy, 15, '#fff', 4);
                this.fsm.transition('DEATH');
            }

            const alive = this.snakes.filter(s => s.alive);
            if (alive.length === 1 && alive[0].is_player) {
                this.particles.emit(350, 350, 30, '#ff0', 5);
                this.fsm.transition('VICTORY');
            } else if (alive.length === 0 || (alive.length === 1 && !alive[0].is_player)) {
                if (this.fsm.current === 'PLAYING') {
                    this.fsm.transition('DEATH');
                }
            }

            this.last_tick_time = now;
        }

        if (now - this.last_food_spawn >= FOOD_RESPAWN_INTERVAL) {
            this.arena.spawn_food(this.snakes);
            this.last_food_spawn = now;
        }

        this.particles.update();
    }

    update() {
        this.fsm.update();
    }

    render() {
        this.fsm.render();
    }

    render_main_menu() {
        const ctx = this.renderer.ctx;
        const size = this.renderer.logical_size;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, size - 4, size - 4);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SNAKE', size / 2, size * 0.18);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#555';
        ctx.fillText('Select a game mode', size / 2, size * 0.27);

        const start_y = size * 0.35;
        const gap = 65;

        for (let i = 0; i < this.menu_options.length; i++) {
            const opt = this.menu_options[i];
            const y = start_y + i * gap;
            const selected = i === this.menu_index;

            if (selected) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(size * 0.15, y - 22, size * 0.7, 55);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(size * 0.15, y - 22, size * 0.7, 55);
            }

            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = selected ? '#fff' : '#555';
            const prefix = selected ? '> ' : '  ';
            ctx.fillText(prefix + opt.label, size / 2, y);

            ctx.font = '12px monospace';
            ctx.fillStyle = selected ? '#888' : '#444';
            ctx.fillText(opt.description, size / 2, y + 22);
        }

        ctx.font = '12px monospace';
        ctx.fillStyle = '#444';
        ctx.fillText('Arrow keys to select, Space to start', size / 2, size * 0.75);
        ctx.fillText('WASD / Arrows to move in-game', size / 2, size * 0.8);

        if (this.solo_high_score > 0) {
            ctx.fillStyle = '#555';
            ctx.font = '12px monospace';
            ctx.fillText(`Solo high score: ${this.solo_high_score}`, size / 2, size * 0.9);
        }
    }

    render_countdown() {
        this.render_playing();
        const ctx = this.renderer.ctx;
        const w = this.renderer.logical_width;
        const h = this.renderer.logical_height;
        const elapsed = performance.now() - this.countdown_start;
        const total_sec = this.mode === 'battle_royale' ? 3 : 1;
        const count = total_sec - Math.floor(elapsed / 1000);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 80px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 0 ? count.toString() : 'GO!', w / 2, h / 2);
    }

    render_playing() {
        if (this.mode === 'survivors') {
            this.render_survivors_playing();
            return;
        }

        const ctx = this.renderer.ctx;
        const cell = this.renderer.cell_size;
        const size = this.renderer.logical_size;

        this.renderer.clear();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);

        this.arena_renderer.render(ctx, this.arena, cell, size, this.zone_shrinker?.warning);

        if (this.green_food) {
            const gx = (this.green_food.x + 0.5) * cell;
            const gy = (this.green_food.y + 0.5) * cell;
            const g_size = cell * 0.4;
            ctx.fillStyle = '#0f0';
            ctx.fillRect(gx - g_size / 2, gy - g_size / 2, g_size, g_size);
        }

        let t = 1;
        const tick_rate = this.mode === 'solo'
            ? (this.solo_boosted ? SOLO_BOOST_TICK_RATE : SOLO_TICK_RATE)
            : TICK_RATE;
        if (this.last_tick_time > 0) {
            const raw = Math.min((performance.now() - this.last_tick_time) / tick_rate, 1);
            t = 1 - (1 - raw) * (1 - raw);
        }

        for (const snake of this.snakes) {
            if (!snake.alive) continue;
            let color = snake.color;
            if (snake.is_player && this.solo_autopilot.active) {
                color = '#0f0';
            } else if (snake.is_player && this.invulnerable) {
                color = Math.floor(performance.now() / 150) % 2 === 0 ? '#fff' : '#0ff';
            }
            this.snake_renderer.render(ctx, snake.segments, cell, t, color);
        }

        this.particles.render(ctx);

        if (this.mode === 'solo') {
            this.render_solo_hud(ctx, size);
        } else {
            this.hud_renderer.render(
                ctx, this.arena, this.snakes, this.player_snake,
                this.zone_shrinker ? this.zone_shrinker.get_time_until_shrink() : 0,
                size
            );
        }
    }

    render_solo_hud(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Score: ${this.solo_score}`, 12, 12);

        if (this.solo_high_score > 0) {
            ctx.fillStyle = '#555';
            ctx.font = '12px monospace';
            ctx.fillText(`Best: ${this.solo_high_score}`, 12, 34);
        }

        if (this.player_snake) {
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Length: ${this.player_snake.length}`, size - 12, 12);
        }

        if (!this.solo_autopilot.active && !this.invulnerable) {
            const boost_secs = ((GREEN_BOOST_BASE_MS + GREEN_BOOST_SCALE_MS * this.normal_fruits_eaten * this.normal_fruits_eaten) / 1000).toFixed(1);
            ctx.fillStyle = '#0f0';
            ctx.font = '11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Boost: ${boost_secs}s`, size - 12, 30);
        }

        if (this.solo_autopilot.active) {
            const secs = (this.solo_autopilot.time_remaining / 1000).toFixed(1);
            ctx.fillStyle = '#0f0';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`AUTOPILOT — ${secs}s`, size / 2, 12);
        }

        if (this.invulnerable) {
            const remaining = Math.max(0, INVULN_DURATION - (performance.now() - this.invuln_start));
            const secs = (remaining / 1000).toFixed(1);
            ctx.fillStyle = '#0ff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`INVULNERABLE — ${secs}s`, size / 2, 12);
        }
    }

    render_pause_overlay() {
        const ctx = this.renderer.ctx;
        const w = this.renderer.logical_width;
        const h = this.renderer.logical_height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', w / 2, h / 2 - 20);

        ctx.fillStyle = '#888';
        ctx.font = '14px monospace';
        ctx.fillText('Press Space to resume', w / 2, h / 2 + 20);
    }

    render_survivors_playing() {
        const ctx = this.renderer.ctx;
        const cell = this.renderer.cell_size;
        const w = this.renderer.logical_width;
        const h = this.renderer.logical_height;

        this.renderer.clear();

        let t = 1;
        if (this.last_tick_time > 0) {
            t = Math.min((performance.now() - this.last_tick_time) / VS_TICK_RATE, 1);
        }

        if (this.player_snake && this.camera) {
            const head = this.player_snake.head;
            const hx = head.prev_x + (head.x - head.prev_x) * t + 0.5;
            const hy = head.prev_y + (head.y - head.prev_y) * t + 0.5;
            this.camera.update(hx, hy);
        }

        ctx.save();
        this.camera.apply_transform(ctx);

        this.survivors_renderer.render_arena_border(ctx, VS_ARENA_SIZE, cell);

        this.survivors_renderer.render_food(ctx, this.arena.food, cell, this.camera);

        if (this.poison_mortar) {
            this.poison_mortar.render_pools(ctx, cell);
        }

        if (this.snake_nest) {
            this.snake_nest.render_nests(ctx, cell);
        }

        this.survivors_renderer.render_enemies(ctx, this.enemy_manager.enemies, cell);

        if (this.bullet_manager) {
            this.survivors_renderer.render_bullets(ctx, this.bullet_manager.bullets, cell);
        }

        if (this.player_snake && this.player_snake.alive) {
            let color = '#fff';
            const now = performance.now();
            const vs_invuln_dur = VS_INVULN_DURATION * (1 + this.vs_powerups.chronofield * 0.25);
            const vs_immune = this.vs_invuln_start > 0 && now - this.vs_invuln_start < vs_invuln_dur;
            if (vs_immune) {
                const pulse = (Math.sin(now / 200) + 1) / 2;
                const g = Math.round(255 - pulse * 55);
                color = `rgb(${Math.round(255 - pulse * 255)}, ${g}, 255)`;
            } else if (this.enemy_manager && this.enemy_manager.player_i_frames > 0) {
                color = Math.floor(now / 80) % 2 === 0 ? '#f44' : '#fff';
            }
            const cox = this.camera.half_view_x - this.camera.x;
            const coy = this.camera.half_view_y - this.camera.y;
            this.snake_renderer.render(ctx, this.player_snake.segments, cell, t, color, 1.0, cox, coy);
        }

        if (this.poison_mortar) {
            this.poison_mortar.render_projectiles(ctx, cell);
        }

        if (this.snake_nest) {
            this.snake_nest.render_projectiles(ctx, cell);
            const cox = this.camera.half_view_x - this.camera.x;
            const coy = this.camera.half_view_y - this.camera.y;
            this.snake_nest.render_mini_snakes(ctx, cell, t, cox, coy);
        }

        this.particles.render(ctx);

        this.damage_numbers.render(ctx, cell);

        ctx.restore();

        this.render_survivors_hud(ctx, w, h);

        if (this.player_snake && this.enemy_manager) {
            this.survivors_renderer.render_minimap(
                ctx, this.player_snake, this.enemy_manager.enemies,
                VS_ARENA_SIZE, w, h
            );
        }

        if (this.vs_level_up_active) {
            this.ui_renderer.draw_item_picker(ctx, this.vs_level_up_choices, this.vs_level_up_index, w, h);
        }
    }

    render_survivors_hud(ctx, w, h) {
        const kills = this.enemy_manager ? this.enemy_manager.total_kills : 0;
        const hp = this.enemy_manager ? this.enemy_manager.player_hp : 0;
        const max_hp = 5;
        const elapsed = Math.floor((performance.now() - this.survivors_start_time) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const time_str = `${mins}:${secs.toString().padStart(2, '0')}`;

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Kills: ${kills}`, 12, 12);

        ctx.font = '14px monospace';
        let hp_str = '';
        for (let i = 0; i < max_hp; i++) {
            hp_str += i < hp ? '\u2665 ' : '\u2661 ';
        }
        ctx.fillStyle = hp <= 1 ? '#f44' : '#fff';
        ctx.fillText(hp_str, 12, 50);

        const icon_size = 20;
        const icon_gap = 4;
        let icon_x = 12;
        const icon_y = 68;
        const rarity_colors = { common: '#888', uncommon: '#4a4', rare: '#44f', legendary: '#fa0', ultra: '#f22' };
        for (const def of VS_POWERUP_DEFS) {
            const lvl = this.vs_powerups[def.id];
            if (lvl > 0) {
                const icon = get_powerup_icon(def.id);
                if (icon) {
                    ctx.drawImage(icon, icon_x, icon_y, icon_size, icon_size);
                    if (!def.one_time && lvl > 1) {
                        ctx.fillStyle = rarity_colors[def.rarity] || '#fff';
                        ctx.font = 'bold 9px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.fillText(lvl, icon_x + icon_size / 2, icon_y + icon_size + 1);
                    }
                    icon_x += icon_size + icon_gap;
                }
            }
        }

        ctx.fillStyle = '#888';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(time_str, w / 2, 12);

        if (this.player_snake) {
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Length: ${this.player_snake.length}`, w - 12, 12);
        }

        if (this.survivors_high_score > 0) {
            ctx.fillStyle = '#444';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Best: ${this.survivors_high_score} kills`, 12, 34);
        }

        const bar_w = 160;
        const bar_h = 6;
        const bar_x = (w - bar_w) / 2;
        const bar_y = h - 18;
        const xp_ratio = Math.min(this.vs_xp / this.vs_xp_for_next, 1);

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bar_x, bar_y, bar_w, bar_h);

        ctx.fillStyle = '#0f8';
        ctx.fillRect(bar_x, bar_y, bar_w * xp_ratio, bar_h);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bar_x, bar_y, bar_w, bar_h);

        ctx.fillStyle = '#0f8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Lv ${this.vs_level}`, bar_x - 4, bar_y + bar_h / 2);
    }

    get_powerup_desc(id) {
        const lvl = this.vs_powerups[id];
        switch (id) {
            case 'magnet':
                return `Pickup radius: ${1 + lvl} \u2192 ${2 + lvl} cells`;
            case 'atk_speed': {
                const cur = Math.round((1 - Math.pow(0.85, lvl)) * 100);
                const next = Math.round((1 - Math.pow(0.85, lvl + 1)) * 100);
                return `Attack speed: +${cur}% \u2192 +${next}%`;
            }
            case 'crit': {
                return `Crit chance: ${lvl * 10}% \u2192 ${(lvl + 1) * 10}%`;
            }
            case 'gorger': {
                return `Bullet dmg: ${1 + lvl} \u2192 ${2 + lvl} | Growth: \u00d7${1 + lvl} \u2192 \u00d7${2 + lvl}`;
            }
            case 'plague': {
                if (lvl === 0) return 'Lob toxic bombs: 2.2 radius, 4.0s cooldown';
                const cur_cd = Math.max(1.5, 4 - (lvl - 1) * 0.4);
                const next_cd = Math.max(1.5, 4 - lvl * 0.4);
                const cur_r = (2.2 + (lvl - 1) * 0.35).toFixed(1);
                const next_r = (2.2 + lvl * 0.35).toFixed(1);
                return `CD: ${cur_cd}s\u2192${next_cd}s | Radius: ${cur_r}\u2192${next_r}`;
            }
            case 'constrictor': {
                return lvl ? 'ACTIVE — encircle enemies to crush them' : 'Encircle enemies with your body to annihilate them';
            }
            case 'snake_nest': {
                if (lvl === 0) return 'Hatch 3 mini snakes that hunt enemies';
                const cur_count = 3 + Math.floor((lvl - 1) / 2);
                const next_count = 3 + Math.floor(lvl / 2);
                const cur_cd = Math.max(2.5, 7 - (lvl - 1) * 0.6);
                const next_cd = Math.max(2.5, 7 - lvl * 0.6);
                return `Snakes: ${cur_count}→${next_count} | CD: ${cur_cd.toFixed(1)}s→${next_cd.toFixed(1)}s`;
            }
            case 'chronofield': {
                const cur_pct = lvl * 25;
                const next_pct = (lvl + 1) * 25;
                return `Duration bonus: +${cur_pct}% → +${next_pct}%`;
            }
            case 'multishot': {
                return `Extra projectiles on all weapons: +${lvl} → +${lvl + 1} (max +3)`;
            }
            default: return '';
        }
    }

    apply_powerup(id) {
        const def = VS_POWERUP_DEFS.find(p => p.id === id);
        if (def && def.one_time) {
            this.vs_powerups[id] = 1;
        } else {
            this.vs_powerups[id]++;
        }
        if (this.bullet_manager) {
            this.bullet_manager.fire_cooldown_mult = Math.pow(0.85, this.vs_powerups.atk_speed);
            this.bullet_manager.crit_chance = this.vs_powerups.crit * 0.10;
            this.bullet_manager.bonus_dmg = this.vs_powerups.gorger;
            this.bullet_manager.extra_projectiles = this.vs_powerups.multishot;
        }
        const dur_mult = 1 + this.vs_powerups.chronofield * 0.25;
        const extra = this.vs_powerups.multishot;
        if (this.poison_mortar) {
            this.poison_mortar.level = this.vs_powerups.plague;
            this.poison_mortar.duration_mult = dur_mult;
            this.poison_mortar.extra_projectiles = extra;
        }
        if (this.snake_nest) {
            this.snake_nest.level = this.vs_powerups.snake_nest;
            this.snake_nest.duration_mult = dur_mult;
            this.snake_nest.extra_projectiles = extra;
        }
    }

    check_constrictor_enclosure(snake) {
        const segs = snake.segments;
        if (segs.length < 8) return;

        const body_set = new Set();
        let min_x = Infinity, max_x = -Infinity, min_y = Infinity, max_y = -Infinity;
        for (const seg of segs) {
            body_set.add(seg.x + ',' + seg.y);
            if (seg.x < min_x) min_x = seg.x;
            if (seg.x > max_x) max_x = seg.x;
            if (seg.y < min_y) min_y = seg.y;
            if (seg.y > max_y) max_y = seg.y;
        }

        min_x--; max_x++; min_y--; max_y++;

        const outside = new Set();
        const queue = [];
        for (let x = min_x; x <= max_x; x++) {
            for (const y of [min_y, max_y]) {
                const key = x + ',' + y;
                if (!body_set.has(key) && !outside.has(key)) {
                    outside.add(key);
                    queue.push(x, y);
                }
            }
        }
        for (let y = min_y + 1; y < max_y; y++) {
            for (const x of [min_x, max_x]) {
                const key = x + ',' + y;
                if (!body_set.has(key) && !outside.has(key)) {
                    outside.add(key);
                    queue.push(x, y);
                }
            }
        }

        let qi = 0;
        while (qi < queue.length) {
            const qx = queue[qi++];
            const qy = queue[qi++];
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const nx = qx + dx;
                const ny = qy + dy;
                if (nx < min_x || nx > max_x || ny < min_y || ny > max_y) continue;
                const key = nx + ',' + ny;
                if (body_set.has(key) || outside.has(key)) continue;
                outside.add(key);
                queue.push(nx, ny);
            }
        }

        const interior = [];
        for (let x = min_x + 1; x < max_x; x++) {
            for (let y = min_y + 1; y < max_y; y++) {
                const key = x + ',' + y;
                if (!body_set.has(key) && !outside.has(key)) {
                    interior.push({ x, y });
                }
            }
        }

        if (interior.length === 0) return;

        const cell = this.renderer.cell_size;
        const interior_set = new Set(interior.map(p => p.x + ',' + p.y));

        let crushed = 0;
        for (const e of this.enemy_manager.enemies) {
            if (!e.alive) continue;
            const ex = Math.floor(e.x);
            const ey = Math.floor(e.y);
            if (interior_set.has(ex + ',' + ey)) {
                const dmg = e.hp;
                e.hp = 0;
                e.alive = false;
                crushed++;
                this.enemy_manager.total_kills++;

                if (ex >= 0 && ex < this.arena.size && ey >= 0 && ey < this.arena.size) {
                    this.arena.food.push({ x: ex, y: ey });
                }

                if (this.damage_numbers) {
                    this.damage_numbers.emit(e.x, e.y - e.radius, dmg, true);
                }

                this.particles.emit(e.x * cell, e.y * cell, 8, e.color, 3);
            }
        }

        let collected = 0;
        for (let i = this.arena.food.length - 1; i >= 0; i--) {
            const f = this.arena.food[i];
            if (interior_set.has(f.x + ',' + f.y)) {
                this.arena.food.splice(i, 1);
                snake.grow_pending++;
                collected++;
            }
        }

        if (crushed > 0 || collected > 0) {
            for (const seg of segs) {
                if (Math.random() < 0.3) {
                    this.particles.emit(seg.x * cell + cell / 2, seg.y * cell + cell / 2, 3, '#f22', 2);
                }
            }
            for (const p of interior) {
                if (Math.random() < 0.4) {
                    this.particles.emit((p.x + 0.5) * cell, (p.y + 0.5) * cell, 2, '#c00', 1.5);
                }
            }

            this.enemy_manager.enemies = this.enemy_manager.enemies.filter(e => e.alive);
        }
    }

    select_level_up_choice(index) {
        if (!this.vs_level_up_active || index < 0 || index >= this.vs_level_up_choices.length) return;
        this.apply_powerup(this.vs_level_up_choices[index].id);
        this.vs_level_up_active = false;
        this.vs_last_frame_time = performance.now();
        this.vs_invuln_start = performance.now();
    }
}
