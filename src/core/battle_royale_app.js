import { ARENA_SIZE, SOLO_ARENA_SIZE, TICK_RATE, AI_COUNT, FOOD_RESPAWN_INTERVAL, VS_ARENA_SIZE, VS_VIEWPORT_CELLS, VS_TICK_RATE, VS_FOOD_COUNT } from '../constants.js';
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
import { play_eat_sound } from '../audio/sound.js';
import { Camera } from '../survivors/camera.js';
import { EnemyManager } from '../survivors/enemy_manager.js';
import { SurvivorsRenderer } from '../survivors/survivors_renderer.js';
import { BulletManager } from '../survivors/bullet_manager.js';
import { DamageNumberSystem } from '../survivors/damage_numbers.js';
import { PoisonMortar } from '../survivors/poison_mortar.js';
import { SnakeNest } from '../survivors/snake_nest.js';
import { FangBarrage } from '../survivors/fang_barrage.js';
import { VenomNova } from '../survivors/venom_nova.js';
import { Miasma } from '../survivors/miasma.js';
import { HydraBrood } from '../survivors/hydra_brood.js';
import { SerpentGatling } from '../survivors/serpent_gatling.js';
import { SidewinderBeam } from '../survivors/sidewinder_beam.js';
import { ConsumptionBeam } from '../survivors/consumption_beam.js';
import { SingularityMortar } from '../survivors/singularity_mortar.js';
import { RicochetFang } from '../survivors/ricochet_fang.js';
import { ShatterFang } from '../survivors/shatter_fang.js';
import { CobraPit } from '../survivors/cobra_pit.js';
import { AncientBroodPit } from '../survivors/ancient_brood_pit.js';
import { TongueLash } from '../survivors/tongue_lash.js';
import { SerpentsReckoning } from '../survivors/serpents_reckoning.js';
import { ChestLottery } from '../survivors/chest_lottery.js';
import { GreySnakeManager } from '../survivors/grey_snake.js';
import { get_powerup_icon } from '../rendering/powerup_icons.js';

const AI_COLORS = [
    '#888', '#668', '#686', '#866', '#586', '#658', '#856',
    '#778', '#787', '#877', '#567', '#576', '#675', '#765',
    '#556', '#655',
];

const SOLO_FOOD_COUNT = 5;
const SOLO_TICK_RATE = 130;
const SOLO_BOOST_TICK_RATE = 40;
const GREEN_BOOST_BASE_MS = 250;
const GREEN_BOOST_SCALE_MS = 120;
const INVULN_DURATION = 2000;
const VS_INVULN_DURATION = 3000;

const VS_POWERUP_DEFS = [
    { id: 'magnet',      name: 'Graviton',    description: '+1 fruit pickup radius', max_rank: 8, category: 'effect' },
    { id: 'atk_speed',   name: 'Rapid Fire',   description: '+15% attack speed', max_rank: 8, category: 'effect' },
    { id: 'crit',        name: 'Dead Eye',     description: '+12.5% crit chance (2× dmg)', max_rank: 8, category: 'effect' },
    { id: 'gorger',      name: 'Ravenous Maw', description: 'Insatiable hunger — more growth, more XP, direct weapons hit harder', max_rank: 8, category: 'effect' },
    { id: 'plague',      name: 'Plague Mortar', description: 'Lob toxic bombs that leave poison zones', max_rank: 8, category: 'weapon' },

    { id: 'snake_nest',  name: 'Snake Nest',   description: 'Lob an egg that hatches mini snakes to hunt enemies', max_rank: 8, category: 'weapon' },
    { id: 'chronofield', name: 'Chronofield',  description: '+25% duration on all timed effects', max_rank: 8, category: 'effect' },
    { id: 'multishot',   name: 'Coiled Volley', description: '+1 extra projectile to all weapons', max_rank: 2, category: 'effect' },
    { id: 'fangs',       name: 'Viper Fangs',  description: 'Fire homing fang projectiles at nearby enemies', max_rank: 8, category: 'weapon' },
    { id: 'venom_nova',  name: 'Venom Nova',   description: 'Pulse poison damage around your head', max_rank: 8, category: 'weapon' },
    { id: 'blast_radius', name: 'Toxic Expanse', description: 'Your poison spreads wider — +15% AOE radius on all effects', max_rank: 8, category: 'effect' },
    { id: 'weapon_range', name: "Serpent's Reach", description: '+12% weapon targeting range', max_rank: 8, category: 'effect' },
    { id: 'sidewinder',  name: 'Sidewinder Beam', description: 'Lock a tracking beam onto the nearest enemy', max_rank: 8, category: 'weapon' },
    { id: 'ricochet',   name: 'Ricochet Fang',  description: 'Bouncing fang that chains between enemies — damage ramps per bounce', max_rank: 8, category: 'weapon' },
    { id: 'cobra_pit',  name: 'Cobra Pit',      description: 'Lob a pit that spawns spitting cobras to guard an area', max_rank: 8, category: 'weapon' },
    { id: 'tongue_lash', name: 'Tongue Lash',   description: 'Quick forked tongue whip — hits enemies in a cone and slows them', max_rank: 8, category: 'weapon' },
];

const VS_EVOLUTION_DEFS = [
    { id: 'miasma', name: 'Miasma', description: 'Permanent toxic fog — repels enemies and deals 300 dmg', requires: ['venom_nova', 'blast_radius'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'hydra_brood', name: 'Hydra Brood', description: 'Two-headed mini snakes that split in two when they die', requires: ['snake_nest', 'multishot'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'serpent_gatling', name: "Serpent's Gatling", description: 'Rapid-fire piercing fangs that shred through multiple enemies', requires: ['fangs', 'atk_speed'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'consumption_beam', name: 'Consumption Beam', description: 'Always-on drain beam — absorbs enemies directly for 3× growth', requires: ['sidewinder', 'gorger'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'singularity_mortar', name: 'Singularity Mortar', description: 'Gravity well pulls enemies in then detonates for 2500 dmg', requires: ['plague', 'magnet'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'shatter_fang', name: 'Shatter Fang', description: 'Crits shatter the fang into splinters that chain and shatter again', requires: ['ricochet', 'crit'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'ancient_brood_pit', name: 'Ancient Brood Pit', description: 'Ever-expanding pit spawns ancient cobras across a growing territory', requires: ['cobra_pit', 'chronofield'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
    { id: 'serpents_reckoning', name: "Serpent's Reckoning", description: 'Grapple tongue latches onto distant enemies and drags them back through the crowd', requires: ['tongue_lash', 'weapon_range'], one_time: true, max_rank: 1, evolution: true, category: 'weapon' },
];

// Map: base weapon ID → evolution ID that replaces it
const WEAPON_TO_EVOLUTION = {};
for (const evo of VS_EVOLUTION_DEFS) {
    for (const req of evo.requires) {
        const def = VS_POWERUP_DEFS.find(p => p.id === req);
        if (def && def.category === 'weapon') {
            WEAPON_TO_EVOLUTION[req] = evo.id;
        }
    }
}

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
        this.vs_powerups = { magnet: 0, atk_speed: 0, crit: 0, gorger: 0, plague: 0, snake_nest: 0, chronofield: 0, multishot: 0, fangs: 0, venom_nova: 0, blast_radius: 0, weapon_range: 0, sidewinder: 0, ricochet: 0, cobra_pit: 0, tongue_lash: 0, miasma: 0, hydra_brood: 0, serpent_gatling: 0, consumption_beam: 0, singularity_mortar: 0, shatter_fang: 0, ancient_brood_pit: 0, serpents_reckoning: 0 };
        this.vs_invuln_start = 0;
        this.vs_self_collision_freeze = 0;
        this.poison_mortar = null;
        this.snake_nest = null;
        this.fang_barrage = null;
        this.sidewinder_beam = null;
        this.consumption_beam = null;
        this.singularity_mortar = null;
        this.ricochet_fang = null;
        this.shatter_fang = null;
        this.cobra_pit = null;
        this.ancient_brood_pit = null;
        this.chest_lottery = null;
        this.miasma = null;
        this.hydra_brood = null;
        this.serpent_gatling = null;
        this.grey_snake = null;
        this.vs_lottery_active = false;
        this.vs_debug_menu_active = false;
        this.vs_debug_menu_index = 0;
        this.vs_evo_menu_active = false;
        this.vs_evo_menu_scroll = 0;

        this.paused = false;
        this.pause_start = 0;

        // Performance overlay (F3)
        this._perf_overlay = false;
        this._perf_timings = {};
        this._perf_smoothed = {};
        this._perf_fps_samples = new Float64Array(60);
        this._perf_fps_idx = 0;
        this._perf_last_frame = 0;

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
                window.addEventListener('resize', self._on_resize);
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
                if (self.paused && !self.vs_evo_menu_active) {
                    self.render_pause_overlay();
                }
            },
        });

        this.fsm.register('VICTORY', {
            update() { self.particles.update(); },
            render() {
                self.render_playing();
                if (self.mode !== 'survivors') self.particles.render(self.renderer.ctx);
                let msg = 'VICTORY! #1 — Press Space';
                if (self.mode === 'survivors') {
                    const kills = self.enemy_manager ? self.enemy_manager.total_kills : 0;
                    msg = `YOU WON! 20:00 — ${kills} kills — Press Space`;
                }
                self.ui_renderer.draw_overlay(
                    self.renderer.hud_ctx || self.renderer.ctx,
                    msg,
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
                    self.renderer.hud_ctx || self.renderer.ctx,
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

            if (state === 'COUNTDOWN' && this.mode === 'survivors' && action === 'direction') {
                this.game_started = true;
                this.last_tick_time = performance.now();
                this.last_food_spawn = performance.now();
                if (this.zone_shrinker) this.zone_shrinker.start();
                this.fsm.transition('PLAYING');
                this.input.queue_direction(data, this.player_snake?.direction, false);
                return;
            }

            if (state === 'PLAYING') {
                // Lottery dismiss
                if (this.vs_lottery_active && this.chest_lottery) {
                    if (action === 'enter' || action === 'space') {
                        if (this.chest_lottery.phase === 'spinning') {
                            this.chest_lottery.skip_animation();
                        } else {
                            const won = this.chest_lottery.dismiss();
                            if (won) {
                                for (const item of won) {
                                    this.apply_powerup(item.id);
                                }
                                this.vs_lottery_active = false;
                                this.vs_last_frame_time = performance.now();
                                this.vs_resume_countdown_start = performance.now();
                            }
                        }
                    }
                    return;
                }
                // During resume countdown, arrow keys skip it and queue direction
                if (this.vs_resume_countdown_start > 0) {
                    if (action === 'direction') {
                        this.vs_resume_countdown_start = 0;
                        this.vs_invuln_start = performance.now();
                        this.vs_last_frame_time = performance.now();
                        this.input.queue_direction(data, this.player_snake?.direction, false);
                    }
                    return;
                }
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
                if (this.mode === 'survivors' && action === 'evolution_menu') {
                    this.vs_evo_menu_active = !this.vs_evo_menu_active;
                    this.vs_evo_menu_scroll = 0;
                    if (this.vs_evo_menu_active && !this.paused) {
                        this.toggle_pause();
                    } else if (!this.vs_evo_menu_active && this.paused) {
                        this.toggle_pause();
                    }
                    return;
                }
                if (this.vs_evo_menu_active) {
                    if (action === 'escape') {
                        this.vs_evo_menu_active = false;
                        if (this.paused) this.toggle_pause();
                    } else if (action === 'menu_up') {
                        this.vs_evo_menu_scroll = Math.max(0, this.vs_evo_menu_scroll - 1);
                    } else if (action === 'menu_down') {
                        this.vs_evo_menu_scroll = Math.min(VS_EVOLUTION_DEFS.length - 1, this.vs_evo_menu_scroll + 1);
                    }
                    return;
                }
                if (action === 'perf_overlay') {
                    this._perf_overlay = !this._perf_overlay;
                    return;
                }
                if (this.mode === 'survivors' && action === 'debug_menu') {
                    // TEMP DISABLED: debug menu
                    // this.vs_debug_menu_active = !this.vs_debug_menu_active;
                    // this.vs_debug_menu_index = 0;
                    return;
                }
                if (this.vs_debug_menu_active) {
                    const all_defs = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS];
                    if (action === 'menu_up') {
                        this.vs_debug_menu_index = (this.vs_debug_menu_index - 1 + all_defs.length) % all_defs.length;
                    } else if (action === 'menu_down') {
                        this.vs_debug_menu_index = (this.vs_debug_menu_index + 1) % all_defs.length;
                    } else if (action === 'enter' || action === 'space') {
                        const def = all_defs[this.vs_debug_menu_index];
                        this.apply_powerup(def.id);
                    } else if (action === 'escape') {
                        this.vs_debug_menu_active = false;
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
        if (this.venom_nova) this.venom_nova.clear();
        if (this.miasma) this.miasma.clear();
        if (this.hydra_brood) this.hydra_brood.clear();
        if (this.serpent_gatling) this.serpent_gatling.clear();
        if (this.sidewinder_beam) this.sidewinder_beam.clear();
        if (this.consumption_beam) this.consumption_beam.clear();
        if (this.singularity_mortar) this.singularity_mortar.clear();
        if (this.ricochet_fang) this.ricochet_fang.clear();
        if (this.shatter_fang) this.shatter_fang.clear();
        if (this.cobra_pit) this.cobra_pit.clear();
        if (this.ancient_brood_pit) this.ancient_brood_pit.clear();
        if (this.tongue_lash) this.tongue_lash.clear();
        if (this.serpents_reckoning) this.serpents_reckoning.clear();
        if (this.chest_lottery) this.chest_lottery.clear();

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
        this.fang_barrage = new FangBarrage();
        this.venom_nova = new VenomNova();
        this.chest_lottery = new ChestLottery();
        this.miasma = new Miasma();
        this.hydra_brood = new HydraBrood();
        this.serpent_gatling = new SerpentGatling();
        this.sidewinder_beam = new SidewinderBeam();
        this.consumption_beam = new ConsumptionBeam();
        this.singularity_mortar = new SingularityMortar();
        this.ricochet_fang = new RicochetFang();
        this.shatter_fang = new ShatterFang();
        this.cobra_pit = new CobraPit();
        this.ancient_brood_pit = new AncientBroodPit();
        this.tongue_lash = new TongueLash();
        this.serpents_reckoning = new SerpentsReckoning();
        this.grey_snake = new GreySnakeManager(VS_ARENA_SIZE);
        this.vs_lottery_active = false;

        const cx = Math.floor(VS_ARENA_SIZE / 2);
        const cy = Math.floor(VS_ARENA_SIZE / 2);
        this.player_snake = new Snake(cx, cy, '#fff', true);
        this.snakes.push(this.player_snake);

        this.camera.snap_to(cx + 0.5, cy + 0.5);
        this._last_frame_time = 0;
        this.zone_shrinker = null;
        this.survivors_start_time = performance.now();
        this.vs_last_frame_time = performance.now();

        this.vs_xp = 0;
        this.vs_level = 1;
        this.vs_xp_for_next = 5;
        this.vs_level_up_active = false;
        this.vs_level_up_choices = [];
        this.vs_level_up_index = 0;
        this.vs_powerups = { magnet: 0, atk_speed: 0, crit: 0, gorger: 0, plague: 0, snake_nest: 0, chronofield: 0, multishot: 0, fangs: 0, venom_nova: 0, blast_radius: 0, weapon_range: 0, sidewinder: 0, ricochet: 0, cobra_pit: 0, tongue_lash: 0, miasma: 0, hydra_brood: 0, serpent_gatling: 0, consumption_beam: 0, singularity_mortar: 0, shatter_fang: 0, ancient_brood_pit: 0, serpents_reckoning: 0 };
        this.vs_invuln_start = 0;
        this.vs_self_collision_freeze = 0;
        this.vs_resume_countdown_start = 0;

        this.enclosed_region = null;

        this.arena.spawn_food_count(this.snakes, VS_FOOD_COUNT);
    }

    _handle_resize() {
        if (this.mode === 'survivors') {
            const vs_cell_size = Math.min(window.innerWidth, window.innerHeight) / VS_VIEWPORT_CELLS;
            this.renderer.set_fullscreen(vs_cell_size);
            if (this.camera) {
                this.camera.cell_size = vs_cell_size;
                this.camera.resize(this.renderer.logical_width, this.renderer.logical_height);
            }
        } else {
            this.renderer.handle_resize();
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
                if (this.hydra_brood && this.hydra_brood.last_fire > 0) {
                    this.hydra_brood.last_fire += pause_duration;
                }
                if (this.serpent_gatling && this.serpent_gatling.last_fire > 0) {
                    this.serpent_gatling.last_fire += pause_duration;
                }
                if (this.sidewinder_beam && this.sidewinder_beam.last_fire > 0) {
                    this.sidewinder_beam.last_fire += pause_duration;
                }
                if (this.singularity_mortar && this.singularity_mortar.last_fire > 0) {
                    this.singularity_mortar.last_fire += pause_duration;
                }
                if (this.chest_lottery) {
                    this.chest_lottery.pause_adjust(pause_duration);
                }
                if (this.grey_snake) {
                    this.grey_snake.pause_adjust(pause_duration);
                }
                if (this.vs_self_collision_freeze > 0) {
                    this.vs_self_collision_freeze += pause_duration;
                }
                if (this.vs_resume_countdown_start > 0) {
                    this.vs_resume_countdown_start += pause_duration;
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
        if (this._perf_overlay) this._perf_timings = {};
        if (this.vs_level_up_active) return;
        if (this.vs_debug_menu_active) return;

        // Lottery animation runs even while game is "paused" for it
        if (this.vs_lottery_active && this.chest_lottery) {
            const dt = Math.min((performance.now() - this.vs_last_frame_time) / 1000, 0.1);
            this.vs_last_frame_time = performance.now();
            this.chest_lottery.update(dt);
            return;
        }

        // Resume countdown freezes gameplay
        if (this.vs_resume_countdown_start > 0) {
            const elapsed = performance.now() - this.vs_resume_countdown_start;
            if (elapsed >= 1500) {
                this.vs_resume_countdown_start = 0;
                this.vs_invuln_start = performance.now();
            }
            this.vs_last_frame_time = performance.now();
            return;
        }

        const now = performance.now();
        const dt = Math.min((now - this.vs_last_frame_time) / 1000, 0.1);
        this.vs_last_frame_time = now;

        const snake = this.player_snake;
        if (!snake || !snake.alive) return;

        const cell = this.renderer.cell_size;
        const vs_invuln_dur = VS_INVULN_DURATION * (1 + this.vs_powerups.chronofield * 0.25);
        const vs_immune = this.vs_invuln_start > 0 && now - this.vs_invuln_start < vs_invuln_dur;
        this.enemy_manager.excluded_region = this.enclosed_region;
        this.enemy_manager.player_level = this.vs_level;

        this._perf_time('U:enemies', () => this.enemy_manager.update(dt, snake, this.arena, this.particles, cell, this.damage_numbers, vs_immune));

        this._perf_time('U:bullets', () => this.bullet_manager.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers));

        this._perf_time('U:weapons1', () => {
            if (this.poison_mortar) this.poison_mortar.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.snake_nest) this.snake_nest.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.fang_barrage) this.fang_barrage.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.venom_nova) this.venom_nova.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.miasma) this.miasma.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
        });

        this._perf_time('U:weapons2', () => {
            if (this.hydra_brood) this.hydra_brood.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.serpent_gatling) this.serpent_gatling.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.sidewinder_beam) this.sidewinder_beam.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.consumption_beam) this.consumption_beam.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.singularity_mortar) this.singularity_mortar.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
        });

        this._perf_time('U:weapons3', () => {
            if (this.cobra_pit) this.cobra_pit.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.ancient_brood_pit) this.ancient_brood_pit.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.ricochet_fang) this.ricochet_fang.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.shatter_fang) this.shatter_fang.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.tongue_lash) this.tongue_lash.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
            if (this.serpents_reckoning) this.serpents_reckoning.update(dt, snake, this.enemy_manager, this.arena, this.particles, cell, this.damage_numbers);
        });

        this._perf_time('U:grey_snake', () => {
            if (this.grey_snake) {
                this.grey_snake.update(dt, snake);
            }
        });

        // Split dead splitter enemies into children
        this.enemy_manager.process_splits(this.particles, cell);

        // Spawn chests from boss deaths
        if (this.chest_lottery && this.enemy_manager.boss_deaths.length > 0) {
            for (const bd of this.enemy_manager.boss_deaths) {
                this.chest_lottery.spawn_chest(bd.x, bd.y);
            }
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

        if (now - this.last_tick_time >= VS_TICK_RATE) {
            const dir = this.input.dequeue();
            if (dir) {
                if (dir.dx !== -snake.direction.dx || dir.dy !== -snake.direction.dy) {
                    snake.direction = dir;
                }
            }

            // Check if next move would collide with own body or grey snake
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
            const hits_grey = this.grey_snake && this.grey_snake.check_collision(next_x, next_y);
            const hits_lethal = hits_own_body || hits_grey;

            if (vs_immune && hits_own_body) {
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

            // Collision grace period: freeze for 1 second before dying
            if (hits_lethal && !(vs_immune && hits_own_body)) {
                if (this.vs_self_collision_freeze === 0) {
                    this.vs_self_collision_freeze = now;
                }
                if (now - this.vs_self_collision_freeze < 1000) {
                    // Still in grace period — freeze movement but keep game running
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
                // Grace period expired — proceed to death
                this.vs_self_collision_freeze = 0;
            } else if (this.vs_self_collision_freeze > 0) {
                // Player changed direction and avoided collision — cancel freeze
                this.vs_self_collision_freeze = 0;
            }

            const grow_before = snake.segments.length + snake.grow_pending;

            const died = this.snake_controller.tick_all(this.snakes, this.arena);

            // Self-collision death via tick_all
            if (!snake.alive) {
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

            if (snake.alive) {
                this.check_constrictor_enclosure(snake);
            }

            // Check chest pickup — only level up powerups the player already owns
            if (snake.alive && this.chest_lottery && this.chest_lottery.chests.length > 0) {
                const owned_defs = VS_POWERUP_DEFS.filter(p =>
                    this.vs_powerups[p.id] > 0 &&
                    !(p.max_rank && this.vs_powerups[p.id] >= p.max_rank) &&
                    !(WEAPON_TO_EVOLUTION[p.id] && this.vs_powerups[WEAPON_TO_EVOLUTION[p.id]] > 0)
                );
                // Check for eligible evolutions
                const guaranteed = [];
                for (const evo of VS_EVOLUTION_DEFS) {
                    if (this.vs_powerups[evo.id]) continue;
                    if (evo.requires.every(req => {
                        const def = VS_POWERUP_DEFS.find(p => p.id === req);
                        return this.vs_powerups[req] >= (def ? def.max_rank : 8);
                    })) {
                        owned_defs.push(evo);
                        guaranteed.push(evo);
                    }
                }
                if (owned_defs.length > 0) {
                    const picked = this.chest_lottery.check_pickup(snake.head.x, snake.head.y, owned_defs, guaranteed);
                    if (picked) {
                        this.vs_lottery_active = true;
                        return;
                    }
                }
            }

            // Check heart pickup
            if (snake.alive && this.enemy_manager.heart_drops.length > 0) {
                const hx = snake.head.x;
                const hy = snake.head.y;
                for (let i = this.enemy_manager.heart_drops.length - 1; i >= 0; i--) {
                    const h = this.enemy_manager.heart_drops[i];
                    if (h.x === hx && h.y === hy) {
                        this.enemy_manager.heart_drops.splice(i, 1);
                        if (this.enemy_manager.player_hp < 5) {
                            this.enemy_manager.player_hp++;
                            if (this.particles) {
                                const px = (hx + 0.5) * cell;
                                const py = (hy + 0.5) * cell;
                                this.particles.emit(px, py, 6, '#ff4466', 3);
                            }
                        }
                    }
                }
            }

            if (this.vs_powerups.magnet > 0 && snake.alive) {
                const hx = snake.head.x;
                const hy = snake.head.y;
                const r = this.vs_powerups.magnet;
                let magnet_ate = false;
                for (let i = this.arena.food.length - 1; i >= 0; i--) {
                    const f = this.arena.food[i];
                    if (Math.abs(f.x - hx) <= r && Math.abs(f.y - hy) <= r && (f.x !== hx || f.y !== hy)) {
                        this.arena.food.splice(i, 1);
                        snake.grow_pending++;
                        magnet_ate = true;
                    }
                }
                if (magnet_ate) play_eat_sound();
            }

            const grow_after = snake.segments.length + snake.grow_pending;
            const beam_xp = this.consumption_beam ? this.consumption_beam.pending_xp : 0;
            if (this.consumption_beam) this.consumption_beam.pending_xp = 0;
            const reckoning_xp = this.serpents_reckoning ? this.serpents_reckoning.pending_xp : 0;
            if (this.serpents_reckoning) this.serpents_reckoning.pending_xp = 0;
            const gained = ((grow_after - grow_before) + beam_xp + reckoning_xp) * 1.2;
            if (gained > 0) {
                const gorger_lvl = this.vs_powerups.gorger;
                if (gorger_lvl > 0) {
                    snake.grow_pending += gained * gorger_lvl;
                }
                // Gorger XP boost: +25% per rank (rank 8 = 3× XP)
                const xp_gained = gorger_lvl > 0 ? gained * (1 + gorger_lvl * 0.25) : gained;
                this.vs_xp += xp_gained;
                while (this.vs_xp >= this.vs_xp_for_next) {
                    this.vs_xp -= this.vs_xp_for_next;
                    this.vs_level++;
                    this.vs_xp_for_next = this.vs_level * 5;
                    const owned_weapons = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS].filter(d => d.category === 'weapon' && this.vs_powerups[d.id] > 0 && !(WEAPON_TO_EVOLUTION[d.id] && this.vs_powerups[WEAPON_TO_EVOLUTION[d.id]] > 0)).length;
                    const owned_effects = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS].filter(d => d.category === 'effect' && this.vs_powerups[d.id] > 0).length;
                    const pool = VS_POWERUP_DEFS.filter(p => {
                        if (p.one_time && this.vs_powerups[p.id]) return false;
                        if (p.max_rank && this.vs_powerups[p.id] >= p.max_rank) return false;
                        if (WEAPON_TO_EVOLUTION[p.id] && this.vs_powerups[WEAPON_TO_EVOLUTION[p.id]] > 0) return false;
                        if (this.vs_powerups[p.id] === 0) {
                            if (p.category === 'weapon' && owned_weapons >= 6) return false;
                            if (p.category === 'effect' && owned_effects >= 6) return false;
                        }
                        return true;
                    });
                    if (pool.length === 0) continue;
                    this.vs_level_up_active = true;
                    // Weighted selection: favour powerups the player already owns
                    const choices = [];
                    const remaining = [...pool];
                    for (let i = 0; i < 3 && remaining.length > 0; i++) {
                        const weights = remaining.map(p => this.vs_powerups[p.id] > 0 ? 3 : 1);
                        const total = weights.reduce((a, b) => a + b, 0);
                        let r = Math.random() * total;
                        let idx = 0;
                        for (idx = 0; idx < weights.length; idx++) {
                            r -= weights[idx];
                            if (r <= 0) break;
                        }
                        choices.push(remaining.splice(idx, 1)[0]);
                    }
                    // Guarantee at least one weapon choice
                    if (!choices.some(c => c.category === 'weapon')) {
                        const weapon_pool = remaining.filter(p => p.category === 'weapon');
                        if (weapon_pool.length > 0) {
                            const w = weapon_pool[Math.floor(Math.random() * weapon_pool.length)];
                            choices[choices.length - 1] = w;
                        }
                    }
                    this.vs_level_up_choices = choices.map(p => ({
                        ...p,
                        stats: this.get_powerup_desc(p.id),
                        is_new: this.vs_powerups[p.id] === 0,
                        current_level: this.vs_powerups[p.id],
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

            // Grey snake barrier — instant death on contact
            if (snake.alive && this.grey_snake && this.grey_snake.check_collision(snake.head.x, snake.head.y)) {
                snake.alive = false;
                this.enemy_manager.player_hp = 0;
                this.survivors_final_elapsed = Math.floor((performance.now() - this.survivors_start_time) / 1000);
                const cx = (snake.head.x + 0.5) * cell;
                const cy = (snake.head.y + 0.5) * cell;
                this.particles.emit(cx, cy, 25, '#888', 5);
                const kills = this.enemy_manager.total_kills;
                if (kills > this.survivors_high_score) {
                    this.survivors_high_score = kills;
                    localStorage.setItem('snake_vs_high', String(kills));
                }
                this.fsm.transition('DEATH');
                return;
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
                    play_eat_sound();
                    const boost_duration = GREEN_BOOST_BASE_MS + GREEN_BOOST_SCALE_MS * this.normal_fruits_eaten;
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
            const cell = this.renderer.cell_size;
            for (const snake of died) {
                const cx = (snake.head.x + 0.5) * cell;
                const cy = (snake.head.y + 0.5) * cell;
                this.particles.emit(cx, cy, 15, snake.color, 4);
                if (snake.is_player && this.fsm.current === 'PLAYING') {
                    this.fsm.transition('DEATH');
                }
            }

            this.snake_controller.check_encirclements(this.arena, this.snakes);
            if (this.zone_shrinker) this.zone_shrinker.update(this.snakes);

            if (this.player_snake && !this.player_snake.alive && this.fsm.current === 'PLAYING') {
                const cx = (this.player_snake.head.x + 0.5) * cell;
                const cy = (this.player_snake.head.y + 0.5) * cell;
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
        // Clear HUD overlay each frame (survivors render_survivors_playing repopulates it)
        this.renderer.clear_hud();
        this.fsm.render();
    }

    render_main_menu() {
        const ctx = this.renderer.hud_ctx || this.renderer.ctx;
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
        const ctx = this.renderer.hud_ctx || this.renderer.ctx;
        const w = this.renderer.logical_width;
        const h = this.renderer.logical_height;
        const elapsed = performance.now() - this.countdown_start;
        const total_sec = this.mode === 'battle_royale' ? 3 : 1;
        const count = total_sec - Math.floor(elapsed / 1000);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);

        let text, color;
        if (count > 0) {
            text = count.toString();
            color = count >= 2 ? '#ff4444' : '#ffaa00';
        } else {
            text = 'GO!';
            color = '#44ff44';
        }

        const phase_t = (elapsed % 1000) / 1000;
        const scale = 1 + 0.3 * Math.max(0, 1 - phase_t * 3);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.round(80 * scale)}px monospace`;
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, h / 2);
        ctx.restore();
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

        const hud = this.renderer.hud_ctx || ctx;
        if (this.mode === 'solo') {
            this.render_solo_hud(hud, size);
        } else {
            this.hud_renderer.render(
                hud, this.arena, this.snakes, this.player_snake,
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
            const boost_secs = ((GREEN_BOOST_BASE_MS + GREEN_BOOST_SCALE_MS * this.normal_fruits_eaten) / 1000).toFixed(1);
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
        const ctx = this.renderer.hud_ctx || this.renderer.ctx;
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

    // Perf timing helper — only times when overlay is active (zero overhead otherwise)
    _perf_time(label, fn) {
        if (!this._perf_overlay) { fn(); return; }
        const t0 = performance.now();
        fn();
        const elapsed = performance.now() - t0;
        this._perf_timings[label] = (this._perf_timings[label] || 0) + elapsed;
    }

    render_survivors_playing() {
        const ctx = this.renderer.ctx;
        const cell = this.renderer.cell_size;
        const w = this.renderer.logical_width;
        const h = this.renderer.logical_height;

        // Don't reset — update timings were already recorded this frame

        this.renderer.clear();

        const now = performance.now();

        let t = 1;
        if (this.last_tick_time > 0) {
            t = Math.min((now - this.last_tick_time) / VS_TICK_RATE, 1);
        }

        const dt = this._last_frame_time ? (now - this._last_frame_time) / 1000 : 0.016;
        this._last_frame_time = now;

        let interp_hx = 0, interp_hy = 0;
        if (this.player_snake && this.camera) {
            const head = this.player_snake.head;
            interp_hx = head.prev_x + (head.x - head.prev_x) * t + 0.5;
            interp_hy = head.prev_y + (head.y - head.prev_y) * t + 0.5;
            this.camera.update(interp_hx, interp_hy, dt);
        }

        ctx.save();
        this.camera.apply_transform(ctx);

        this._perf_time('arena+food', () => {
            this.survivors_renderer.render_arena_border(ctx, VS_ARENA_SIZE, cell);
            this.survivors_renderer.render_food(ctx, this.arena.food, cell, this.camera);
            this.survivors_renderer.render_hearts(ctx, this.enemy_manager.heart_drops, cell, this.camera);
        });

        if (this.chest_lottery) {
            this._perf_time('chests', () => this.chest_lottery.render_chests(ctx, cell, this.camera));
        }

        this._perf_time('pools+wells', () => {
            if (this.poison_mortar) this.poison_mortar.render_pools(ctx, cell);
            if (this.singularity_mortar) this.singularity_mortar.render_wells(ctx, cell);
        });

        this._perf_time('nests+pits', () => {
            if (this.snake_nest) this.snake_nest.render_nests(ctx, cell);
            if (this.hydra_brood) this.hydra_brood.render_nests(ctx, cell);
            if (this.cobra_pit) this.cobra_pit.render_pits(ctx, cell);
            if (this.ancient_brood_pit) this.ancient_brood_pit.render_pits(ctx, cell);
        });

        const cox = this.camera.half_view_x - this.camera.x;
        const coy = this.camera.half_view_y - this.camera.y;

        if (this.grey_snake) {
            this._perf_time('grey_snake', () => this.survivors_renderer.render_grey_snakes(ctx, this.grey_snake, cell, cox, coy));
        }

        this._perf_time('enemies', () => this.survivors_renderer.render_enemies(ctx, this.enemy_manager.enemies, cell, this.camera));

        if (this.bullet_manager) {
            this._perf_time('bullets', () => this.survivors_renderer.render_bullets(ctx, this.bullet_manager.bullets, cell, this.camera));
        }

        this._perf_time('player', () => {
            if (this.player_snake && this.player_snake.alive) {
                let color = '#fff';
                const vs_invuln_dur = VS_INVULN_DURATION * (1 + this.vs_powerups.chronofield * 0.25);
                const vs_immune = this.vs_invuln_start > 0 && now - this.vs_invuln_start < vs_invuln_dur;
                if (vs_immune) {
                    const pulse = (Math.sin(now / 200) + 1) / 2;
                    const g = Math.round(255 - pulse * 55);
                    color = `rgb(${Math.round(255 - pulse * 255)}, ${g}, 255)`;
                } else if (this.enemy_manager && this.enemy_manager.player_i_frames > 0) {
                    color = Math.floor(now / 80) % 2 === 0 ? '#f44' : '#fff';
                }
                this.snake_renderer.render(ctx, this.player_snake.segments, cell, t, color, 1.0, cox, coy);
            }
        });

        this._perf_time('projectiles', () => {
            if (this.poison_mortar) this.poison_mortar.render_projectiles(ctx, cell);
            if (this.singularity_mortar) this.singularity_mortar.render_projectiles(ctx, cell);
            if (this.snake_nest) { this.snake_nest.render_projectiles(ctx, cell); this.snake_nest.render_mini_snakes(ctx, cell); }
            if (this.hydra_brood) { this.hydra_brood.render_projectiles(ctx, cell); this.hydra_brood.render_snakes(ctx, cell); }
        });

        this._perf_time('fangs', () => {
            if (this.fang_barrage) this.fang_barrage.render(ctx, cell);
            if (this.serpent_gatling) this.serpent_gatling.render(ctx, cell);
            if (this.ricochet_fang) this.ricochet_fang.render(ctx, cell);
            if (this.shatter_fang) this.shatter_fang.render(ctx, cell);
        });

        this._perf_time('cobras', () => {
            if (this.cobra_pit) { this.cobra_pit.render_cobras(ctx, cell); this.cobra_pit.render_spits(ctx, cell); this.cobra_pit.render_projectiles(ctx, cell); }
            if (this.ancient_brood_pit) { this.ancient_brood_pit.render_cobras(ctx, cell); this.ancient_brood_pit.render_spits(ctx, cell); this.ancient_brood_pit.render_projectiles(ctx, cell); }
        });

        this._perf_time('beams', () => {
            if (this.sidewinder_beam) this.sidewinder_beam.render_with_head(ctx, cell, interp_hx, interp_hy);
            if (this.consumption_beam) this.consumption_beam.render_with_head(ctx, cell, interp_hx, interp_hy);
            if (this.tongue_lash) this.tongue_lash.render(ctx, cell);
            if (this.serpents_reckoning) this.serpents_reckoning.render_with_head(ctx, cell, interp_hx, interp_hy);
        });

        this._perf_time('nova+miasma', () => {
            if (this.venom_nova) this.venom_nova.render(ctx, cell);
            if (this.miasma) this.miasma.render(ctx, cell, interp_hx, interp_hy);
        });

        this._perf_time('particles', () => this.particles.render(ctx));

        ctx.restore();

        // --- HUD / text / overlays render to hud_ctx at native DPR for crisp text ---
        const hctx = this.renderer.hud_ctx || ctx;

        // Damage numbers on HUD layer (text-heavy)
        this._perf_time('dmg_numbers', () => {
            hctx.save();
            this.camera.apply_transform(hctx);
            this.damage_numbers.render(hctx, cell);
            hctx.restore();
        });

        this._perf_time('HUD', () => this.render_survivors_hud(hctx, w, h));

        if (this.player_snake && this.enemy_manager) {
            this._perf_time('minimap', () => this.survivors_renderer.render_minimap(
                hctx, this.player_snake, this.enemy_manager.enemies,
                VS_ARENA_SIZE, w, h,
                this.chest_lottery ? this.chest_lottery.chests : null,
                this.grey_snake
            ));
        }

        if (this.vs_level_up_active) {
            this.ui_renderer.draw_item_picker(hctx, this.vs_level_up_choices, this.vs_level_up_index, w, h);
        }

        // Lottery animation overlay
        if (this.vs_lottery_active && this.chest_lottery) {
            this.chest_lottery.render_lottery(hctx, cell, w, h);
        }

        if (this.vs_debug_menu_active) {
            this.render_debug_menu(hctx, w, h);
        }

        if (this.vs_evo_menu_active) {
            this.render_evolution_menu(hctx, w, h);
        }

        // Self-collision warning overlay
        if (this.vs_self_collision_freeze > 0) {
            const elapsed = performance.now() - this.vs_self_collision_freeze;
            const flash = Math.sin(elapsed * 0.015) > 0;
            if (flash) {
                hctx.save();
                hctx.globalAlpha = 0.25;
                hctx.fillStyle = '#ff0000';
                hctx.fillRect(0, 0, w, h);
                hctx.restore();
            }
        }

        // Resume countdown overlay
        if (this.vs_resume_countdown_start > 0) {
            this.render_resume_countdown(hctx, w, h);
        }

        // Performance overlay (F3)
        if (this._perf_overlay) {
            this._render_perf_overlay(hctx, w, h, now);
        }
    }

    _render_perf_overlay(ctx, w, h, now) {
        // FPS tracking
        if (this._perf_last_frame > 0) {
            const frame_ms = now - this._perf_last_frame;
            this._perf_fps_samples[this._perf_fps_idx % 60] = frame_ms;
            this._perf_fps_idx++;
        }
        this._perf_last_frame = now;

        const count = Math.min(this._perf_fps_idx, 60);
        let sum = 0;
        for (let i = 0; i < count; i++) sum += this._perf_fps_samples[i];
        const avg_ms = count > 0 ? sum / count : 16.67;
        const fps = 1000 / avg_ms;

        // Smooth timings with exponential moving average
        const alpha = 0.15;
        for (const key in this._perf_timings) {
            if (key in this._perf_smoothed) {
                this._perf_smoothed[key] = this._perf_smoothed[key] * (1 - alpha) + this._perf_timings[key] * alpha;
            } else {
                this._perf_smoothed[key] = this._perf_timings[key];
            }
        }

        // Sort by cost descending
        const entries = Object.entries(this._perf_smoothed)
            .filter(([, v]) => v > 0.01)
            .sort((a, b) => b[1] - a[1]);

        let total_render = 0;
        for (const [, v] of entries) total_render += v;

        // Draw overlay
        const pad = 8;
        const line_h = 16;
        const box_w = 340;
        const box_h = (entries.length + 7) * line_h + pad * 2;
        const bx = pad;
        const by = pad;

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#000';
        ctx.fillRect(bx, by, box_w, box_h);
        ctx.globalAlpha = 1;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let y = by + pad;

        // FPS + frame time
        const fps_color = fps >= 55 ? '#0f0' : fps >= 30 ? '#ff0' : '#f44';
        ctx.fillStyle = fps_color;
        ctx.fillText(`FPS: ${fps.toFixed(0)}  (${avg_ms.toFixed(1)}ms)`, bx + pad, y);
        y += line_h;

        // Show real update/render totals from game loop
        const gl = this.game_loop;
        const real_update = gl.perf_update_ms;
        const real_render = gl.perf_render_ms;
        const real_total = gl.perf_total_ms;
        const unmeasured = real_total - total_render;

        ctx.fillStyle = '#aaa';
        ctx.fillText(`Update: ${real_update.toFixed(1)}ms  Render: ${real_render.toFixed(1)}ms  JS total: ${real_total.toFixed(1)}ms`, bx + pad, y);
        y += line_h;

        if (unmeasured > 1) {
            ctx.fillStyle = '#f88';
            ctx.fillText(`Unmeasured: ${unmeasured.toFixed(1)}ms  (${avg_ms > 0 ? ((real_total / avg_ms) * 100).toFixed(0) : '?'}% of frame)`, bx + pad, y);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillText(`GPU/browser overhead: ${(avg_ms - real_total).toFixed(1)}ms`, bx + pad, y);
        }
        y += line_h;

        // Entity counts + canvas info
        const enemies = this.enemy_manager ? this.enemy_manager.enemies.filter(e => e.alive).length : 0;
        const food = this.arena ? this.arena.food.length : 0;
        const segs = this.player_snake ? this.player_snake.segments.length : 0;
        const game_dpr = this.renderer._force_dpr || 1;
        const native_dpr = window.devicePixelRatio || 1;
        const cw = this.renderer.canvas.width;
        const ch = this.renderer.canvas.height;
        ctx.fillStyle = '#888';
        ctx.fillText(`Enemies: ${enemies}  Food: ${food}  Ptcl: ${this.particles._count}  Segs: ${segs}`, bx + pad, y);
        y += line_h;
        ctx.fillText(`Game: ${cw}x${ch} DPR:${game_dpr.toFixed(1)}  HUD DPR:${native_dpr.toFixed(1)}`, bx + pad, y);
        y += line_h + 4;

        // Bar chart of timings
        const max_ms = Math.max(1, ...entries.map(e => e[1]));
        const bar_max_w = box_w - 130;

        for (const [label, ms] of entries) {
            const bar_w = (ms / max_ms) * bar_max_w;
            const pct = total_render > 0 ? (ms / total_render * 100) : 0;

            // Color by severity
            const bar_color = ms > 3 ? '#f44' : ms > 1 ? '#ff0' : '#0f0';
            ctx.fillStyle = bar_color;
            ctx.fillRect(bx + pad, y + 2, bar_w, line_h - 4);

            ctx.fillStyle = '#fff';
            ctx.fillText(`${label}`, bx + pad + 2, y);

            ctx.fillStyle = '#ccc';
            ctx.textAlign = 'right';
            ctx.fillText(`${ms.toFixed(2)}ms ${pct.toFixed(0)}%`, bx + box_w - pad, y);
            ctx.textAlign = 'left';

            y += line_h;
        }

        ctx.fillStyle = '#555';
        ctx.fillText('F3 to close', bx + pad, y + 4);

        ctx.restore();
    }

    render_resume_countdown(ctx, w, h) {
        const elapsed = performance.now() - this.vs_resume_countdown_start;
        let text, color;
        if (elapsed < 1000) {
            text = '1';
            color = '#ffaa00';
        } else {
            text = 'GO!';
            color = '#44ff44';
        }

        // Pulse/scale animation within each phase
        const phase_t = (elapsed % 1000) / 1000;
        const scale = 1 + 0.3 * Math.max(0, 1 - phase_t * 3); // pop-in effect
        const alpha = elapsed >= 1000 ? Math.max(0, 1 - (elapsed - 1000) / 500) : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.round(80 * scale)}px monospace`;
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, h / 2);
        ctx.restore();
    }

    render_debug_menu(ctx, w, h) {
        const all_defs = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS];
        const row_h = 28;
        const menu_w = 300;
        const menu_h = 50 + all_defs.length * row_h + 10;
        const mx = (w - menu_w) / 2;
        const my = (h - menu_h) / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(mx, my, menu_w, menu_h);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx, my, menu_w, menu_h);

        // Title
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DEBUG  —  F1 close', mx + menu_w / 2, my + 18);

        // Items
        for (let i = 0; i < all_defs.length; i++) {
            const def = all_defs[i];
            const ry = my + 40 + i * row_h;
            const lvl = this.vs_powerups[def.id] || 0;
            const selected = i === this.vs_debug_menu_index;

            if (selected) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
                ctx.fillRect(mx + 4, ry - row_h / 2 + 2, menu_w - 8, row_h - 2);
            }

            // Icon
            const icon = get_powerup_icon(def.id);
            if (icon) {
                ctx.drawImage(icon, mx + 10, ry - 9, 18, 18);
            }

            // Name
            ctx.fillStyle = selected ? '#0ff' : (def.evolution ? '#ff0' : '#ccc');
            ctx.font = selected ? 'bold 12px monospace' : '12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const label = def.evolution ? '\u2605 ' + def.name : def.name;
            ctx.fillText(label, mx + 34, ry);

            // Rank
            ctx.fillStyle = lvl >= (def.max_rank || 1) ? '#4f4' : '#888';
            ctx.textAlign = 'right';
            ctx.fillText(`${lvl}/${def.max_rank || 1}`, mx + menu_w - 12, ry);
        }
    }

    render_evolution_menu(ctx, w, h) {
        const all_powerups = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS];
        const name_map = {};
        for (const def of all_powerups) name_map[def.id] = def.name;

        const evos = VS_EVOLUTION_DEFS;
        const card_w = 200;
        const card_h = 120;
        const gap = 16;
        const cols = Math.min(evos.length, 3);
        const rows = Math.ceil(evos.length / cols);
        const total_w = cols * card_w + (cols - 1) * gap;
        const total_h = rows * card_h + (rows - 1) * gap;
        const menu_pad = 30;
        const title_h = 50;
        const hint_h = 30;
        const menu_w = total_w + menu_pad * 2;
        const menu_h = total_h + title_h + hint_h + menu_pad;
        const mx = (w - menu_w) / 2;
        const my = (h - menu_h) / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(mx, my, menu_w, menu_h);
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx, my, menu_w, menu_h);

        // Title
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2605 EVOLUTIONS \u2605', mx + menu_w / 2, my + 28);

        // Cards
        for (let i = 0; i < evos.length; i++) {
            const evo = evos[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = mx + menu_pad + col * (card_w + gap);
            const cy = my + title_h + row * (card_h + gap);

            const owned = (this.vs_powerups[evo.id] || 0) > 0;
            const req_met = evo.requires.every(r => (this.vs_powerups[r] || 0) >= 8);

            // Card border
            ctx.strokeStyle = owned ? '#4f4' : (req_met ? '#0ff' : '#555');
            ctx.lineWidth = owned ? 2.5 : 1.5;
            ctx.strokeRect(cx, cy, card_w, card_h);
            ctx.fillStyle = owned ? 'rgba(0, 80, 0, 0.3)' : 'rgba(30, 30, 30, 0.8)';
            ctx.fillRect(cx + 1, cy + 1, card_w - 2, card_h - 2);

            // Icon
            const icon = get_powerup_icon(evo.id);
            if (icon) {
                ctx.drawImage(icon, cx + 8, cy + 8, 32, 32);
            }

            // Evolution name
            ctx.fillStyle = owned ? '#4f4' : '#ff0';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(evo.name, cx + 48, cy + 16);

            // Status
            ctx.font = '10px monospace';
            ctx.fillStyle = owned ? '#4f4' : (req_met ? '#0ff' : '#888');
            ctx.fillText(owned ? 'UNLOCKED' : (req_met ? 'READY' : 'LOCKED'), cx + 48, cy + 32);

            // Requirements
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            for (let r = 0; r < evo.requires.length; r++) {
                const req_id = evo.requires[r];
                const req_name = name_map[req_id] || req_id;
                const req_lvl = this.vs_powerups[req_id] || 0;
                const met = req_lvl >= 8;
                const ry = cy + 54 + r * 18;

                const req_icon = get_powerup_icon(req_id);
                if (req_icon) {
                    ctx.drawImage(req_icon, cx + 10, ry - 7, 14, 14);
                }

                ctx.fillStyle = met ? '#4f4' : '#c88';
                ctx.fillText(`${req_name}`, cx + 28, ry);

                ctx.fillStyle = met ? '#4f4' : '#888';
                ctx.textAlign = 'right';
                ctx.fillText(`${req_lvl}/8`, cx + card_w - 10, ry);
                ctx.textAlign = 'left';
            }
        }

        // Hint
        ctx.fillStyle = '#666';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('F2 or ESC to close  \u2022  Get both requirements to Rank 8, then open a chest', mx + menu_w / 2, my + menu_h - 14);
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
        const box_size = icon_size + 4;
        const box_gap = icon_gap;
        const max_slots = 4;
        const all_defs = [...VS_POWERUP_DEFS, ...VS_EVOLUTION_DEFS];
        const row_height = box_size + 14;

        // Collect owned weapons and effects
        const owned_weapons = [];
        const owned_effects = [];
        for (const def of all_defs) {
            const lvl = this.vs_powerups[def.id];
            if (lvl > 0) {
                // Skip base weapons that have been evolved
                if (WEAPON_TO_EVOLUTION[def.id] && this.vs_powerups[WEAPON_TO_EVOLUTION[def.id]] > 0) continue;
                if (def.category === 'weapon') owned_weapons.push(def);
                else if (def.category === 'effect') owned_effects.push(def);
            }
        }

        // Top row: weapons
        const weapon_y = 68;
        for (let i = 0; i < max_slots; i++) {
            const bx = 12 + i * (box_size + box_gap);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, weapon_y, box_size, box_size);

            if (i < owned_weapons.length) {
                const def = owned_weapons[i];
                const lvl = this.vs_powerups[def.id];
                const icon = get_powerup_icon(def.id);
                if (icon) {
                    ctx.drawImage(icon, bx + 2, weapon_y + 2, icon_size, icon_size);
                }
                if (!def.one_time && lvl > 1) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(lvl, bx + box_size / 2, weapon_y + box_size + 1);
                }
            }
        }

        // Bottom row: effects
        const effect_y = weapon_y + row_height;
        for (let i = 0; i < max_slots; i++) {
            const bx = 12 + i * (box_size + box_gap);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, effect_y, box_size, box_size);

            if (i < owned_effects.length) {
                const def = owned_effects[i];
                const lvl = this.vs_powerups[def.id];
                const icon = get_powerup_icon(def.id);
                if (icon) {
                    ctx.drawImage(icon, bx + 2, effect_y + 2, icon_size, icon_size);
                }
                if (!def.one_time && lvl > 1) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(lvl, bx + box_size / 2, effect_y + box_size + 1);
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
                return `Crit chance: ${(lvl * 12.5).toFixed(1)}% \u2192 ${((lvl + 1) * 12.5).toFixed(1)}%`;
            }
            case 'gorger': {
                const cur_pct = lvl <= 0 ? 0 : Math.round(10 + (lvl - 1) * (40 / 7));
                const next_pct = Math.round(10 + lvl * (40 / 7));
                return `Dmg: +${cur_pct}%\u2192+${next_pct}% | Growth: \u00d7${1 + lvl}\u2192\u00d7${2 + lvl} | XP: \u00d7${1 + lvl}\u2192\u00d7${2 + lvl}`;
            }
            case 'plague': {
                if (lvl === 0) return 'Lob toxic bombs: 2.2 radius, 4.0s cooldown';
                const cur_cd = Math.max(1.5, 4 - (lvl - 1) * 0.4);
                const next_cd = Math.max(1.5, 4 - lvl * 0.4);
                const cur_r = (2.2 + (lvl - 1) * 0.35).toFixed(1);
                const next_r = (2.2 + lvl * 0.35).toFixed(1);
                return `CD: ${cur_cd}s\u2192${next_cd}s | Radius: ${cur_r}\u2192${next_r}`;
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
                return `Extra projectiles on all weapons: +${lvl} → +${lvl + 1} (max +2)`;
            }
            case 'fangs': {
                if (lvl === 0) return 'Fire 1 homing fang, 2.5s cooldown';
                const cur_count = lvl;
                const next_count = lvl + 1;
                const cur_cd = (Math.max(1, 2.5 - (lvl - 1) * 0.25)).toFixed(1);
                const next_cd = (Math.max(1, 2.5 - lvl * 0.25)).toFixed(1);
                return `Fangs: ${cur_count}→${next_count} | CD: ${cur_cd}s→${next_cd}s`;
            }
            case 'venom_nova': {
                if (lvl === 0) return 'Poison pulse: 2.5 radius, 3.5s cooldown';
                const cur_cd = Math.max(1.2, 3.5 - (lvl - 1) * 0.35);
                const next_cd = Math.max(1.2, 3.5 - lvl * 0.35);
                const cur_r = (2.5 + (lvl - 1) * 0.4).toFixed(1);
                const next_r = (2.5 + lvl * 0.4).toFixed(1);
                return `CD: ${cur_cd.toFixed(1)}s→${next_cd.toFixed(1)}s | Radius: ${cur_r}→${next_r}`;
            }
            case 'blast_radius': {
                const cur_pct = lvl * 15;
                const next_pct = (lvl + 1) * 15;
                return `AOE radius bonus: +${cur_pct}% → +${next_pct}%`;
            }
            case 'weapon_range': {
                const cur_pct = lvl * 12;
                const next_pct = (lvl + 1) * 12;
                return `Weapon range: +${cur_pct}% → +${next_pct}%`;
            }
            case 'sidewinder': {
                if (lvl === 0) return 'Tracking beam: 15 dmg/tick for 2.5s, locks onto nearest enemy';
                const cur_dmg = lvl * 15;
                const next_dmg = (lvl + 1) * 15;
                const cur_cd = (Math.max(2.0, 5.0 - (lvl - 1) * 0.4)).toFixed(1);
                const next_cd = (Math.max(2.0, 5.0 - lvl * 0.4)).toFixed(1);
                return `Dmg: ${cur_dmg}→${next_dmg}/tick | CD: ${cur_cd}s→${next_cd}s`;
            }
            case 'cobra_pit': {
                if (lvl === 0) return 'Spawns 4 spitting cobras that guard an area for 6s';
                const cur_cobras = 4 + Math.floor((lvl - 1) / 3);
                const next_cobras = 4 + Math.floor(lvl / 3);
                const cur_cd = Math.max(3.5, 8 - (lvl - 1) * 0.55);
                const next_cd = Math.max(3.5, 8 - lvl * 0.55);
                return `Cobras: ${cur_cobras}→${next_cobras} | CD: ${cur_cd.toFixed(1)}s→${next_cd.toFixed(1)}s`;
            }
            case 'tongue_lash': {
                if (lvl === 0) return 'Forked tongue whip: 80 dmg cone, slows enemies to 40% speed for 1.5s';
                const tl_cur_dmg = (1 + Math.floor(lvl / 2)) * 80;
                const tl_next_dmg = (1 + Math.floor((lvl + 1) / 2)) * 80;
                const tl_cur_cd = (Math.max(0.6, 2.0 - (lvl - 1) * 0.18)).toFixed(1);
                const tl_next_cd = (Math.max(0.6, 2.0 - lvl * 0.18)).toFixed(1);
                return `Dmg: ${tl_cur_dmg}→${tl_next_dmg} | CD: ${tl_cur_cd}s→${tl_next_cd}s`;
            }
            case 'ricochet': {
                if (lvl === 0) return 'Bouncing fang: 200 dmg, 3 bounces, damage ramps +20% per bounce';
                const cur_bounces = 3 + Math.floor((lvl - 1) / 2);
                const next_bounces = 3 + Math.floor(lvl / 2);
                const cur_cd = (Math.max(1.5, 3.5 - (lvl - 1) * 0.3)).toFixed(1);
                const next_cd = (Math.max(1.5, 3.5 - lvl * 0.3)).toFixed(1);
                return `Bounces: ${cur_bounces}→${next_bounces} | CD: ${cur_cd}s→${next_cd}s`;
            }
            case 'miasma':
                return 'Permanent toxic fog — repels enemies, 300 dmg/tick';
            case 'hydra_brood':
                return 'Two-headed mini snakes split into 2 headless brood on death';
            case 'serpent_gatling':
                return 'Rapid-fire piercing fangs — 120 dmg, pierce 3 enemies, 180ms cooldown';
            case 'consumption_beam':
                return 'Always-on drain beam — 80 dmg/tick, absorb enemies for 3× growth + vacuum fruit';
            case 'singularity_mortar':
                return 'Gravity well pulls enemies in for 2s then detonates for 2500 dmg';
            case 'shatter_fang':
                return 'Crits shatter fangs into 3 splinters that chain and shatter again — up to 3 generations deep';
            case 'ancient_brood_pit':
                return 'Ever-expanding pit endlessly spawns ancient cobras — 120 dmg spit, pit grows over time';
            default: return '';
        }
    }

    apply_powerup(id) {
        const def = VS_POWERUP_DEFS.find(p => p.id === id) || VS_EVOLUTION_DEFS.find(p => p.id === id);
        if (def && def.one_time) {
            this.vs_powerups[id] = 1;
        } else {
            this.vs_powerups[id]++;
        }
        // Gorger: 10% at rank 1 → 50% at rank 8 direct damage bonus
        const gorger = this.vs_powerups.gorger;
        const gorger_dmg_mult = gorger > 0 ? 1 + (10 + (gorger - 1) * (40 / 7)) / 100 : 1;
        const dur_mult = 1 + this.vs_powerups.chronofield * 0.25;
        const extra = this.vs_powerups.multishot;
        const radius_mult = 1 + this.vs_powerups.blast_radius * 0.15;
        const range_mult = 1 + this.vs_powerups.weapon_range * 0.12;
        const fire_cd_mult = Math.pow(0.85, this.vs_powerups.atk_speed);
        if (this.bullet_manager) {
            this.bullet_manager.fire_cooldown_mult = fire_cd_mult;
            this.bullet_manager.crit_chance = this.vs_powerups.crit * 0.125;
            this.bullet_manager.gorger_dmg_mult = gorger_dmg_mult;
            this.bullet_manager.extra_projectiles = this.vs_powerups.multishot;
            this.bullet_manager.range_mult = range_mult;
        }
        if (this.poison_mortar) {
            this.poison_mortar.level = this.vs_powerups.singularity_mortar ? 0 : this.vs_powerups.plague;
            this.poison_mortar.duration_mult = dur_mult;
            this.poison_mortar.extra_projectiles = extra;
            this.poison_mortar.radius_mult = radius_mult;
            this.poison_mortar.range_mult = range_mult;
            this.poison_mortar.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.singularity_mortar && this.vs_powerups.singularity_mortar) {
            this.singularity_mortar.active = true;
            this.singularity_mortar.crit_chance = this.vs_powerups.crit * 0.125;
            this.singularity_mortar.gorger_dmg_mult = gorger_dmg_mult;
            this.singularity_mortar.radius_mult = radius_mult;
            this.singularity_mortar.duration_mult = dur_mult;
            this.singularity_mortar.range_mult = range_mult;
            this.singularity_mortar.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.snake_nest) {
            this.snake_nest.level = this.vs_powerups.hydra_brood ? 0 : this.vs_powerups.snake_nest;
            this.snake_nest.duration_mult = dur_mult;
            this.snake_nest.extra_projectiles = extra;
            this.snake_nest.range_mult = range_mult;
            this.snake_nest.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.hydra_brood && this.vs_powerups.hydra_brood) {
            this.hydra_brood.active = true;
            this.hydra_brood.duration_mult = dur_mult;
            this.hydra_brood.range_mult = range_mult;
            this.hydra_brood.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.fang_barrage) {
            this.fang_barrage.level = this.vs_powerups.serpent_gatling ? 0 : this.vs_powerups.fangs;
            this.fang_barrage.extra_projectiles = extra;
            this.fang_barrage.crit_chance = this.vs_powerups.crit * 0.125;
            this.fang_barrage.gorger_dmg_mult = gorger_dmg_mult;
            this.fang_barrage.range_mult = range_mult;
            this.fang_barrage.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.serpent_gatling && this.vs_powerups.serpent_gatling) {
            this.serpent_gatling.active = true;
            this.serpent_gatling.extra_projectiles = extra;
            this.serpent_gatling.crit_chance = this.vs_powerups.crit * 0.125;
            this.serpent_gatling.gorger_dmg_mult = gorger_dmg_mult;
            this.serpent_gatling.range_mult = range_mult;
            this.serpent_gatling.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.venom_nova) {
            this.venom_nova.level = this.vs_powerups.miasma ? 0 : this.vs_powerups.venom_nova;
            this.venom_nova.duration_mult = dur_mult;
            this.venom_nova.extra_projectiles = extra;
            this.venom_nova.radius_mult = radius_mult;
            this.venom_nova.gorger_dmg_mult = gorger_dmg_mult;
            this.venom_nova.crit_chance = this.vs_powerups.crit * 0.125;
            this.venom_nova.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.miasma && this.vs_powerups.miasma) {
            this.miasma.active = true;
            this.miasma.gorger_dmg_mult = gorger_dmg_mult;
            this.miasma.radius_mult = radius_mult;
            this.miasma.crit_chance = this.vs_powerups.crit * 0.125;
        }
        if (this.sidewinder_beam) {
            this.sidewinder_beam.level = this.vs_powerups.consumption_beam ? 0 : this.vs_powerups.sidewinder;
            this.sidewinder_beam.extra_projectiles = extra;
            this.sidewinder_beam.crit_chance = this.vs_powerups.crit * 0.125;
            this.sidewinder_beam.range_mult = range_mult;
            this.sidewinder_beam.duration_mult = dur_mult;
            this.sidewinder_beam.gorger_dmg_mult = gorger_dmg_mult;
            this.sidewinder_beam.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.consumption_beam && this.vs_powerups.consumption_beam) {
            this.consumption_beam.active = true;
            this.consumption_beam.extra_projectiles = extra;
            this.consumption_beam.crit_chance = this.vs_powerups.crit * 0.125;
            this.consumption_beam.gorger_dmg_mult = gorger_dmg_mult;
            this.consumption_beam.duration_mult = dur_mult;
            this.consumption_beam.range_mult = range_mult;
        }
        if (this.ricochet_fang) {
            this.ricochet_fang.level = this.vs_powerups.shatter_fang ? 0 : this.vs_powerups.ricochet;
            this.ricochet_fang.extra_projectiles = extra;
            this.ricochet_fang.crit_chance = this.vs_powerups.crit * 0.125;
            this.ricochet_fang.gorger_dmg_mult = gorger_dmg_mult;
            this.ricochet_fang.duration_mult = dur_mult;
            this.ricochet_fang.radius_mult = radius_mult;
            this.ricochet_fang.range_mult = range_mult;
            this.ricochet_fang.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.shatter_fang && this.vs_powerups.shatter_fang) {
            this.shatter_fang.active = true;
            this.shatter_fang.extra_projectiles = extra;
            this.shatter_fang.crit_chance = this.vs_powerups.crit * 0.125;
            this.shatter_fang.gorger_dmg_mult = gorger_dmg_mult;
            this.shatter_fang.duration_mult = dur_mult;
            this.shatter_fang.radius_mult = radius_mult;
            this.shatter_fang.range_mult = range_mult;
            this.shatter_fang.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.cobra_pit) {
            this.cobra_pit.level = this.vs_powerups.ancient_brood_pit ? 0 : this.vs_powerups.cobra_pit;
            this.cobra_pit.duration_mult = dur_mult;
            this.cobra_pit.extra_projectiles = extra;
            this.cobra_pit.crit_chance = this.vs_powerups.crit * 0.125;
            this.cobra_pit.gorger_dmg_mult = gorger_dmg_mult;
            this.cobra_pit.radius_mult = radius_mult;
            this.cobra_pit.range_mult = range_mult;
            this.cobra_pit.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.ancient_brood_pit && this.vs_powerups.ancient_brood_pit) {
            this.ancient_brood_pit.active = true;
            this.ancient_brood_pit.duration_mult = dur_mult;
            this.ancient_brood_pit.extra_projectiles = extra;
            this.ancient_brood_pit.crit_chance = this.vs_powerups.crit * 0.125;
            this.ancient_brood_pit.gorger_dmg_mult = gorger_dmg_mult;
            this.ancient_brood_pit.radius_mult = radius_mult;
            this.ancient_brood_pit.range_mult = range_mult;
            this.ancient_brood_pit.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.tongue_lash) {
            this.tongue_lash.level = this.vs_powerups.serpents_reckoning ? 0 : this.vs_powerups.tongue_lash;
            this.tongue_lash.crit_chance = this.vs_powerups.crit * 0.125;
            this.tongue_lash.gorger_dmg_mult = gorger_dmg_mult;
            this.tongue_lash.extra_projectiles = extra;
            this.tongue_lash.range_mult = range_mult;
            this.tongue_lash.radius_mult = radius_mult;
            this.tongue_lash.duration_mult = dur_mult;
            this.tongue_lash.fire_cooldown_mult = fire_cd_mult;
        }
        if (this.serpents_reckoning && this.vs_powerups.serpents_reckoning) {
            this.serpents_reckoning.active = true;
            this.serpents_reckoning.crit_chance = this.vs_powerups.crit * 0.125;
            this.serpents_reckoning.gorger_dmg_mult = gorger_dmg_mult;
            this.serpents_reckoning.extra_projectiles = extra;
            this.serpents_reckoning.range_mult = range_mult;
            this.serpents_reckoning.radius_mult = radius_mult;
            this.serpents_reckoning.duration_mult = dur_mult;
            this.serpents_reckoning.fire_cooldown_mult = fire_cd_mult;
        }
    }

    check_constrictor_enclosure(snake) {
        const segs = snake.segments;
        if (segs.length < 8) {
            this.enclosed_region = null;
            this.enemy_manager.excluded_region = null;
            return;
        }

        // --- Build body set and bounding box ---
        const body_set = new Set();
        let min_x = Infinity, max_x = -Infinity, min_y = Infinity, max_y = -Infinity;
        for (const seg of segs) {
            body_set.add(seg.x + ',' + seg.y);
            if (seg.x < min_x) min_x = seg.x;
            if (seg.x > max_x) max_x = seg.x;
            if (seg.y < min_y) min_y = seg.y;
            if (seg.y > max_y) max_y = seg.y;
        }

        // Early-out: bbox must be at least 3x3 to contain any interior
        if (max_x - min_x < 2 || max_y - min_y < 2) {
            this.enclosed_region = null;
            this.enemy_manager.excluded_region = null;
            return;
        }

        // Expand bounding box by 1 for flood-fill border
        min_x--; max_x++; min_y--; max_y++;

        // --- Flood-fill from border to find outside cells ---
        const w = max_x - min_x + 1;
        const h = max_y - min_y + 1;
        // Use typed array bitmask instead of Set for speed
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h * 2);
        let qHead = 0, qTail = 0;

        // Seed border cells
        for (let x = min_x; x <= max_x; x++) {
            for (const y of [min_y, max_y]) {
                if (!body_set.has(x + ',' + y)) {
                    const idx = (x - min_x) + (y - min_y) * w;
                    if (!visited[idx]) {
                        visited[idx] = 1;
                        queue[qTail++] = x;
                        queue[qTail++] = y;
                    }
                }
            }
        }
        for (let y = min_y + 1; y < max_y; y++) {
            for (const x of [min_x, max_x]) {
                if (!body_set.has(x + ',' + y)) {
                    const idx = (x - min_x) + (y - min_y) * w;
                    if (!visited[idx]) {
                        visited[idx] = 1;
                        queue[qTail++] = x;
                        queue[qTail++] = y;
                    }
                }
            }
        }

        while (qHead < qTail) {
            const qx = queue[qHead++];
            const qy = queue[qHead++];
            for (let d = 0; d < 4; d++) {
                const ax = qx + (d === 0 ? 1 : d === 1 ? -1 : 0);
                const ay = qy + (d === 2 ? 1 : d === 3 ? -1 : 0);
                if (ax < min_x || ax > max_x || ay < min_y || ay > max_y) continue;
                const idx = (ax - min_x) + (ay - min_y) * w;
                if (visited[idx]) continue;
                if (body_set.has(ax + ',' + ay)) continue;
                visited[idx] = 1;
                queue[qTail++] = ax;
                queue[qTail++] = ay;
            }
        }

        // --- Collect interior cells (not body, not outside) ---
        const interior_set = new Set();
        for (let x = min_x + 1; x < max_x; x++) {
            for (let y = min_y + 1; y < max_y; y++) {
                const idx = (x - min_x) + (y - min_y) * w;
                if (!visited[idx] && !body_set.has(x + ',' + y)) {
                    interior_set.add(x + ',' + y);
                }
            }
        }

        if (interior_set.size === 0) {
            this.enclosed_region = null;
            this.enemy_manager.excluded_region = null;
            return;
        }

        // Store for spawn blocking (sync to enemy_manager immediately)
        this.enclosed_region = interior_set;
        this.enemy_manager.excluded_region = interior_set;

        // --- One-time kill: crush all enemies inside ---
        const cell = this.renderer.cell_size;
        let crushed = 0;
        for (const e of this.enemy_manager.enemies) {
            if (!e.alive || e.is_boss) continue;
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
                    this.enemy_manager._try_drop_heart(ex, ey);
                }

                if (this.damage_numbers) {
                    this.damage_numbers.emit(e.x, e.y - e.radius, dmg, true);
                }

                this.particles.emit(e.x * cell, e.y * cell, 8, e.color, 3);
            }
        }

        // Collect all food inside the enclosure
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
            // Sparse interior particles
            let particle_budget = 20;
            for (const key of interior_set) {
                if (particle_budget <= 0) break;
                if (Math.random() < 0.4) {
                    const [px, py] = key.split(',');
                    this.particles.emit((+px + 0.5) * cell, (+py + 0.5) * cell, 2, '#c00', 1.5);
                    particle_budget--;
                }
            }

            // In-place compaction
            { let w = 0; const arr = this.enemy_manager.enemies; for (let r = 0; r < arr.length; r++) { if (arr[r].alive) arr[w++] = arr[r]; } arr.length = w; }
        }
    }

    select_level_up_choice(index) {
        if (!this.vs_level_up_active || index < 0 || index >= this.vs_level_up_choices.length) return;
        this.apply_powerup(this.vs_level_up_choices[index].id);
        this.vs_level_up_active = false;
        this.vs_last_frame_time = performance.now();
        this.vs_resume_countdown_start = performance.now();
    }
}
