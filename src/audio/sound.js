let ctx = null;

function get_ctx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
}

// Throttle map to prevent overlapping rapid sounds
const _last = {};
function throttled(key, min_ms, fn) {
    const now = performance.now();
    if (_last[key] && now - _last[key] < min_ms) return;
    _last[key] = now;
    fn();
}

// Master volume
const VOL = 0.12;

function make_osc(ac, type, freq, vol, dur) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(vol * VOL, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + dur);
    return osc;
}

function make_noise(ac, vol, dur) {
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol * VOL, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(ac.currentTime);
    return src;
}

// ---- Eating ----

export function play_eat_sound() {
    const ac = get_ctx();
    if (ac.state === 'suspended') ac.resume();
    const osc = make_osc(ac, 'sine', 600, 1.2, 0.1);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.06);
}

// ---- Projectile fire (fangs, barrage, shatter, ricochet) ----

export function play_fang_fire() {
    throttled('fang_fire', 80, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sawtooth', 400, 0.5, 0.06);
        osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.05);
    });
}

// ---- Projectile hit ----

export function play_fang_hit() {
    throttled('fang_hit', 50, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'square', 250, 0.4, 0.05);
        make_noise(ac, 0.3, 0.04);
    });
}

// ---- Gatling fire (rapid, subtle) ----

export function play_gatling_fire() {
    throttled('gatling', 100, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'square', 500, 0.3, 0.03);
    });
}

// ---- Gatling hit ----

export function play_gatling_hit() {
    throttled('gatling_hit', 60, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'triangle', 300, 0.3, 0.04);
    });
}

// ---- Ricochet ping (metallic bounce) ----

export function play_ricochet_ping() {
    throttled('ricochet', 60, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 1200, 0.6, 0.1);
        osc.frequency.exponentialRampToValueAtTime(1800, ac.currentTime + 0.03);
        osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.1);
    });
}

// ---- Mortar / egg launch (arcing whoosh) ----

export function play_mortar_launch() {
    throttled('mortar_launch', 200, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 200, 0.25, 0.2);
        osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.15);
        make_noise(ac, 0.1, 0.15);
    });
}

// ---- Mortar / egg land (thump) ----

export function play_mortar_land() {
    throttled('mortar_land', 100, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 120, 0.8, 0.15);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.12);
        make_noise(ac, 0.35, 0.08);
    });
}

// ---- Explosion / AoE burst (venom nova, singularity detonation) ----

export function play_explosion() {
    throttled('explosion', 150, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sawtooth', 100, 1.0, 0.3);
        osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.25);
        make_noise(ac, 0.6, 0.25);
    });
}

// ---- Tongue lash (whip crack) ----

export function play_lash() {
    throttled('lash', 150, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_noise(ac, 0.7, 0.08);
        const osc = make_osc(ac, 'sawtooth', 800, 0.5, 0.06);
        osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.05);
    });
}

// ---- Beam start / active (sidewinder, consumption) ----

export function play_beam_start() {
    throttled('beam_start', 400, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 300, 0.5, 0.3);
        osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.2);
    });
}

// ---- Beam damage tick ----

export function play_beam_tick() {
    throttled('beam_tick', 150, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'sine', 600, 0.25, 0.05);
    });
}

// ---- Summon / hatch (nests, broods) ----

export function play_summon() {
    throttled('summon', 200, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'triangle', 300, 0.25, 0.2);
        osc.frequency.exponentialRampToValueAtTime(700, ac.currentTime + 0.15);
    });
}

// ---- Mini snake / summon hit ----

export function play_summon_hit() {
    throttled('summon_hit', 60, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'triangle', 400, 0.35, 0.05);
    });
}

// ---- Grapple grab (serpents reckoning tongue connect) ----

export function play_grapple() {
    throttled('grapple', 300, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sawtooth', 150, 0.6, 0.2);
        osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.2);
    });
}

// ---- Devour chomp (serpents reckoning eat) ----

export function play_devour() {
    throttled('devour', 200, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'square', 100, 0.8, 0.12);
        make_noise(ac, 0.5, 0.08);
    });
}

// ---- Gravity well active (singularity mortar pull) ----

export function play_gravity_well() {
    throttled('gravity', 500, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 80, 0.5, 0.5);
        osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.4);
    });
}

// ---- Miasma pulse ----

export function play_miasma_pulse() {
    throttled('miasma', 400, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 150, 0.4, 0.3);
        osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.25);
    });
}

// ---- Shatter crack (splinter spawn on crit) ----

export function play_shatter() {
    throttled('shatter', 100, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_noise(ac, 0.6, 0.1);
        const osc = make_osc(ac, 'square', 1000, 0.4, 0.08);
        osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.07);
    });
}

// ---- Nova pulse (expanding ring) ----

export function play_nova() {
    throttled('nova', 200, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        const osc = make_osc(ac, 'sine', 400, 0.8, 0.25);
        osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.2);
        make_noise(ac, 0.4, 0.15);
    });
}

// ---- Pool damage tick (poison mortar) ----

export function play_pool_tick() {
    throttled('pool_tick', 250, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'sine', 200, 0.2, 0.06);
    });
}

// ---- Chest open (dramatic reveal) ----

export function play_chest_open() {
    const ac = get_ctx();
    if (ac.state === 'suspended') ac.resume();
    // Rising shimmer
    const o1 = make_osc(ac, 'sine', 300, 0.7, 0.4);
    o1.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.3);
    const o2 = make_osc(ac, 'triangle', 450, 0.4, 0.35);
    o2.frequency.exponentialRampToValueAtTime(1000, ac.currentTime + 0.25);
    make_noise(ac, 0.3, 0.15);
}

// ---- Roulette tick (item cycling click) ----

export function play_roulette_tick() {
    throttled('roulette_tick', 30, () => {
        const ac = get_ctx();
        if (ac.state === 'suspended') ac.resume();
        make_osc(ac, 'sine', 800, 0.35, 0.03);
    });
}

// ---- Roulette settle (beam lands on item — win chime) ----

export function play_roulette_settle() {
    const ac = get_ctx();
    if (ac.state === 'suspended') ac.resume();
    // Two-note ascending chime
    const t = ac.currentTime;
    const o1 = ac.createOscillator();
    const g1 = ac.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(660, t);
    g1.gain.setValueAtTime(0.6 * VOL, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o1.connect(g1); g1.connect(ac.destination);
    o1.start(t); o1.stop(t + 0.2);

    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(880, t + 0.1);
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.setValueAtTime(0.7 * VOL, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o2.connect(g2); g2.connect(ac.destination);
    o2.start(t + 0.1); o2.stop(t + 0.35);

    // Shimmer
    const o3 = ac.createOscillator();
    const g3 = ac.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(1320, t + 0.15);
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.setValueAtTime(0.3 * VOL, t + 0.15);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o3.connect(g3); g3.connect(ac.destination);
    o3.start(t + 0.15); o3.stop(t + 0.45);
}
