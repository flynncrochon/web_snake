// SVG icons for each power-up, pre-rendered to Image objects for canvas drawing.

const ICON_SIZE = 64;

const S = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"`;

const SVG_DEFS = {
    // Venom Shot — venom droplet projectile
    venom_shot: `<svg ${S}>
        <path d="M32 8 Q22 28 22 38 A10 10 0 0 0 42 38 Q42 28 32 8 Z" fill="#00cc33" opacity="0.9"/>
        <path d="M32 12 Q26 28 26 36 A6 6 0 0 0 38 36 Q38 28 32 12 Z" fill="#33ff66" opacity="0.5"/>
        <circle cx="30" cy="34" r="2" fill="#fff" opacity="0.6"/>
        <path d="M18 20 L12 16" stroke="#00cc33" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        <path d="M46 20 L52 16" stroke="#00cc33" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        <path d="M20 28 L14 26" stroke="#00cc33" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
        <path d="M44 28 L50 26" stroke="#00cc33" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
    </svg>`,

    // Graviton — magnetic pull field
    magnet: `<svg ${S}>
        <path d="M20 16 L20 36 A12 12 0 0 0 44 36 L44 16" fill="none" stroke="#668fff" stroke-width="6" stroke-linecap="round"/>
        <rect x="15" y="10" width="10" height="12" rx="2" fill="#ff4455"/>
        <rect x="39" y="10" width="10" height="12" rx="2" fill="#4455ff"/>
        <path d="M26 48 Q32 54 38 48" fill="none" stroke="#668fff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <path d="M22 52 Q32 60 42 52" fill="none" stroke="#668fff" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
    </svg>`,

    // Rapid Fire — stacked chevrons
    atk_speed: `<svg ${S}>
        <path d="M16 40 L32 28 L48 40" fill="none" stroke="#ffaa00" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M16 28 L32 16 L48 28" fill="none" stroke="#ffcc44" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M16 52 L32 40 L48 52" fill="none" stroke="#cc7700" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" opacity="0.5"/>
    </svg>`,

    // Dead Eye — crosshair with inner ring
    crit: `<svg ${S}>
        <circle cx="32" cy="32" r="18" fill="none" stroke="#ff4444" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="8" fill="none" stroke="#ff4444" stroke-width="2"/>
        <circle cx="32" cy="32" r="2.5" fill="#ff6666"/>
        <line x1="32" y1="4" x2="32" y2="20" stroke="#ff4444" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="32" y1="44" x2="32" y2="60" stroke="#ff4444" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="32" x2="20" y2="32" stroke="#ff4444" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="44" y1="32" x2="60" y2="32" stroke="#ff4444" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,

    // Gorger — ravenous gullet
    gorger: `<svg ${S}>
        <ellipse cx="32" cy="32" rx="22" ry="18" fill="#aa5500" stroke="#ffaa00" stroke-width="2.5"/>
        <ellipse cx="32" cy="32" rx="14" ry="10" fill="#220000"/>
        <polygon points="14,24 20,32 12,30" fill="#fff"/>
        <polygon points="24,22 28,32 20,30" fill="#fff"/>
        <polygon points="36,22 40,30 32,32" fill="#fff"/>
        <polygon points="50,24 52,30 44,32" fill="#fff"/>
        <polygon points="18,42 22,34 14,34" fill="#fff" opacity="0.8"/>
        <polygon points="32,43 36,34 28,34" fill="#fff" opacity="0.8"/>
        <polygon points="46,42 50,34 42,34" fill="#fff" opacity="0.8"/>
        <circle cx="22" cy="14" r="4" fill="#ff6600" opacity="0.9"/>
        <circle cx="42" cy="14" r="4" fill="#ff6600" opacity="0.9"/>
        <circle cx="22" cy="14" r="1.5" fill="#220000"/>
        <circle cx="42" cy="14" r="1.5" fill="#220000"/>
    </svg>`,

    // Plague Mortar — skull bomb
    plague: `<svg ${S}>
        <circle cx="32" cy="36" r="18" fill="#337733"/>
        <circle cx="32" cy="36" r="18" fill="none" stroke="#55aa55" stroke-width="2"/>
        <circle cx="25" cy="32" r="4.5" fill="#112211"/>
        <circle cx="39" cy="32" r="4.5" fill="#112211"/>
        <path d="M26 42 L28 40 L30 42 L32 40 L34 42 L36 40 L38 42" fill="none" stroke="#112211" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="34" y1="18" x2="38" y2="8" stroke="#55aa55" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="40" cy="6" r="3.5" fill="#ffcc00" opacity="0.9"/>
        <circle cx="42" cy="4" r="2" fill="#ffee66" opacity="0.6"/>
    </svg>`,


    // Snake Nest — three small green snakes
    snake_nest: `<svg ${S}>
        <!-- Snake 1 (left) — curving right -->
        <path d="M10 52 Q8 42 14 34 Q20 26 16 18" fill="none" stroke="#22bb44" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 52 Q8 42 14 34 Q20 26 16 18" fill="none" stroke="#44ee66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="15" cy="16" r="3.5" fill="#22bb44"/>
        <circle cx="13.5" cy="15" r="1" fill="#115533"/>
        <circle cx="16.5" cy="15" r="1" fill="#115533"/>
        <path d="M13 19 L15 21 L17 19" fill="none" stroke="#ff4444" stroke-width="1" stroke-linecap="round"/>
        <!-- Snake 2 (center) — S-curve, tallest -->
        <path d="M32 54 Q38 44 28 36 Q18 28 32 16" fill="none" stroke="#22bb44" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M32 54 Q38 44 28 36 Q18 28 32 16" fill="none" stroke="#44ee66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="32" cy="13.5" r="4" fill="#22bb44"/>
        <circle cx="30" cy="12.5" r="1.2" fill="#115533"/>
        <circle cx="34" cy="12.5" r="1.2" fill="#115533"/>
        <path d="M30 16.5 L32 18.5 L34 16.5" fill="none" stroke="#ff4444" stroke-width="1" stroke-linecap="round"/>
        <!-- Snake 3 (right) — curving left -->
        <path d="M54 52 Q56 42 50 34 Q44 26 48 18" fill="none" stroke="#22bb44" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M54 52 Q56 42 50 34 Q44 26 48 18" fill="none" stroke="#44ee66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="49" cy="16" r="3.5" fill="#22bb44"/>
        <circle cx="47.5" cy="15" r="1" fill="#115533"/>
        <circle cx="50.5" cy="15" r="1" fill="#115533"/>
        <path d="M47 19 L49 21 L51 19" fill="none" stroke="#ff4444" stroke-width="1" stroke-linecap="round"/>
    </svg>`,

    // Coiled Volley — top-down coiled snake with fang projectiles erupting outward
    multishot: `<svg ${S}>
        <!-- Outer coil ring -->
        <circle cx="32" cy="36" r="18" fill="none" stroke="#7733bb" stroke-width="5"/>
        <circle cx="32" cy="36" r="18" fill="none" stroke="#9955dd" stroke-width="2.5"/>
        <!-- Inner coil ring -->
        <circle cx="32" cy="36" r="10" fill="none" stroke="#7733bb" stroke-width="4.5"/>
        <circle cx="32" cy="36" r="10" fill="none" stroke="#aa66ee" stroke-width="2"/>
        <!-- Snake head at top of coil -->
        <ellipse cx="32" cy="17" rx="6" ry="5" fill="#8844cc"/>
        <ellipse cx="32" cy="17" rx="5" ry="4" fill="#aa55ee" opacity="0.6"/>
        <circle cx="29.5" cy="16" r="1.2" fill="#220044"/>
        <circle cx="34.5" cy="16" r="1.2" fill="#220044"/>
        <!-- Fang projectiles bursting upward from head -->
        <path d="M28 14 L24 2" stroke="#eebbff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M24 2 L22 7 M24 2 L27 6" fill="none" stroke="#eeddff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M32 13 L32 1" stroke="#ffccff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M32 1 L30 6 M32 1 L34 6" fill="none" stroke="#eeddff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M36 14 L40 2" stroke="#eebbff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M40 2 L37 6 M40 2 L42 7" fill="none" stroke="#eeddff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Glow dots at fang tips -->
        <circle cx="24" cy="2" r="2" fill="#ddaaff" opacity="0.9"/>
        <circle cx="32" cy="1" r="2" fill="#ffccff" opacity="0.9"/>
        <circle cx="40" cy="2" r="2" fill="#ddaaff" opacity="0.9"/>
        <!-- Center energy core -->
        <circle cx="32" cy="36" r="4" fill="#bb77ee"/>
        <circle cx="32" cy="36" r="2" fill="#eeccff"/>
    </svg>`,

    // Viper Fangs — open jaw with prominent fangs and venom
    fangs: `<svg ${S}>
        <!-- Upper jaw ridge -->
        <path d="M4 16 Q32 4 60 16 Q32 22 4 16" fill="#992244"/>
        <path d="M8 16 Q32 6 56 16 Q32 20 8 16" fill="#bb3358" opacity="0.6"/>
        <!-- Left fang — filled shape -->
        <path d="M16 14 C12 26 14 40 22 54 C26 40 26 26 24 14 Z" fill="#f2e8e0" stroke="#ddd0c4" stroke-width="0.8"/>
        <!-- Left fang — specular highlight -->
        <path d="M18 18 C16 28 16 38 21 50" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.35"/>
        <!-- Left fang — venom groove -->
        <path d="M22 16 C23 28 23 40 22 52" fill="none" stroke="#dd6688" stroke-width="1" opacity="0.5"/>
        <!-- Right fang — filled shape -->
        <path d="M40 14 C38 26 38 40 42 54 C52 40 52 26 48 14 Z" fill="#f2e8e0" stroke="#ddd0c4" stroke-width="0.8"/>
        <!-- Right fang — specular highlight -->
        <path d="M46 18 C48 28 48 38 43 50" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.35"/>
        <!-- Right fang — venom groove -->
        <path d="M42 16 C41 28 41 40 42 52" fill="none" stroke="#dd6688" stroke-width="1" opacity="0.5"/>
        <!-- Venom drops -->
        <ellipse cx="22" cy="57" rx="2" ry="3" fill="#55ee44" opacity="0.9"/>
        <ellipse cx="22" cy="56" rx="1" ry="1.5" fill="#aaffaa" opacity="0.5"/>
        <ellipse cx="42" cy="57" rx="2" ry="3" fill="#55ee44" opacity="0.9"/>
        <ellipse cx="42" cy="56" rx="1" ry="1.5" fill="#aaffaa" opacity="0.5"/>
    </svg>`,

    // Venom Nova — radiating poison burst
    venom_nova: `<svg ${S}>
        <circle cx="32" cy="32" r="10" fill="#33cc55"/>
        <circle cx="32" cy="32" r="6" fill="#22aa44"/>
        <circle cx="32" cy="32" r="3" fill="#88ffaa"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="#44ee66" stroke-width="2.5" stroke-dasharray="6 4" opacity="0.8"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="#33cc55" stroke-width="2" stroke-dasharray="4 6" opacity="0.5"/>
        <line x1="32" y1="8" x2="32" y2="14" stroke="#66ff88" stroke-width="2" stroke-linecap="round"/>
        <line x1="32" y1="50" x2="32" y2="56" stroke="#66ff88" stroke-width="2" stroke-linecap="round"/>
        <line x1="8" y1="32" x2="14" y2="32" stroke="#66ff88" stroke-width="2" stroke-linecap="round"/>
        <line x1="50" y1="32" x2="56" y2="32" stroke="#66ff88" stroke-width="2" stroke-linecap="round"/>
        <line x1="14" y1="14" x2="18" y2="18" stroke="#66ff88" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="50" y1="14" x2="46" y2="18" stroke="#66ff88" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="14" y1="50" x2="18" y2="46" stroke="#66ff88" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="50" y1="50" x2="46" y2="46" stroke="#66ff88" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    </svg>`,

    // Toxic Expanse — expanding ripple rings
    blast_radius: `<svg ${S}>
        <circle cx="32" cy="32" r="8" fill="none" stroke="#66ffaa" stroke-width="3"/>
        <circle cx="32" cy="32" r="16" fill="none" stroke="#44dd88" stroke-width="2.5" opacity="0.7"/>
        <circle cx="32" cy="32" r="24" fill="none" stroke="#33bb66" stroke-width="2" opacity="0.4"/>
        <circle cx="32" cy="32" r="4" fill="#88ffcc"/>
        <line x1="32" y1="4" x2="32" y2="12" stroke="#66ffaa" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="32" y1="52" x2="32" y2="60" stroke="#66ffaa" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="4" y1="32" x2="12" y2="32" stroke="#66ffaa" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="52" y1="32" x2="60" y2="32" stroke="#66ffaa" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <path d="M12 12 L16 16" stroke="#66ffaa" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
        <path d="M48 12 L44 16" stroke="#66ffaa" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
        <path d="M12 52 L16 48" stroke="#66ffaa" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
        <path d="M48 52 L44 48" stroke="#66ffaa" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
    </svg>`,

    // Serpent's Reach — targeting range extending outward
    weapon_range: `<svg ${S}>
        <circle cx="32" cy="32" r="6" fill="none" stroke="#44ddff" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="14" fill="none" stroke="#33bbdd" stroke-width="2" stroke-dasharray="4 3" opacity="0.7"/>
        <circle cx="32" cy="32" r="22" fill="none" stroke="#2299bb" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.4"/>
        <circle cx="32" cy="32" r="2.5" fill="#88eeff"/>
        <!-- Outward arrows (cardinal) -->
        <path d="M32 8 L32 2 M29 5 L32 2 L35 5" fill="none" stroke="#44ddff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M32 56 L32 62 M29 59 L32 62 L35 59" fill="none" stroke="#44ddff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 32 L2 32 M5 29 L2 32 L5 35" fill="none" stroke="#44ddff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M56 32 L62 32 M59 29 L62 32 L59 35" fill="none" stroke="#44ddff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // Miasma — toxic fog cloud with glowing eyes
    miasma: `<svg ${S}>
        <ellipse cx="32" cy="34" rx="24" ry="14" fill="#2d8040" opacity="0.6"/>
        <ellipse cx="22" cy="30" rx="14" ry="12" fill="#35994a" opacity="0.5"/>
        <ellipse cx="42" cy="32" rx="13" ry="11" fill="#35994a" opacity="0.5"/>
        <ellipse cx="32" cy="28" rx="16" ry="12" fill="#44cc66" opacity="0.4"/>
        <circle cx="26" cy="30" r="4" fill="#112211"/>
        <circle cx="38" cy="30" r="4" fill="#112211"/>
        <circle cx="26" cy="29" r="1.5" fill="#66ff88"/>
        <circle cx="38" cy="29" r="1.5" fill="#66ff88"/>
        <ellipse cx="20" cy="48" rx="2" ry="3" fill="#44ff66" opacity="0.7"/>
        <ellipse cx="32" cy="50" rx="2.5" ry="3.5" fill="#44ff66" opacity="0.8"/>
        <ellipse cx="44" cy="47" rx="1.5" ry="2.5" fill="#44ff66" opacity="0.6"/>
        <path d="M12 42 Q18 46 24 42 Q30 38 36 42 Q42 46 48 42 Q52 39 56 42" fill="none" stroke="#44cc66" stroke-width="2" opacity="0.5" stroke-linecap="round"/>
    </svg>`,

    // Hydra Nest — coiled base with three fang-tipped heads
    // Hydra Brood — two-headed snake splitting into two headless snakes
    hydra_brood: `<svg ${S}>
        <!-- Main body (Y-fork) -->
        <path d="M32 58 Q30 48 32 36" fill="none" stroke="#7744bb" stroke-width="5" stroke-linecap="round"/>
        <path d="M32 58 Q30 48 32 36" fill="none" stroke="#9966dd" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Left neck -->
        <path d="M32 36 Q24 28 16 18" fill="none" stroke="#6644aa" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M32 36 Q24 28 16 18" fill="none" stroke="#9966dd" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <!-- Left head -->
        <circle cx="15" cy="16" r="4.5" fill="#8844cc"/>
        <circle cx="13" cy="15" r="1.2" fill="#44ff88"/>
        <circle cx="17" cy="15" r="1.2" fill="#44ff88"/>
        <!-- Right neck -->
        <path d="M32 36 Q40 28 48 18" fill="none" stroke="#6644aa" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M32 36 Q40 28 48 18" fill="none" stroke="#9966dd" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <!-- Right head -->
        <circle cx="49" cy="16" r="4.5" fill="#8844cc"/>
        <circle cx="47" cy="15" r="1.2" fill="#44ff88"/>
        <circle cx="51" cy="15" r="1.2" fill="#44ff88"/>
        <!-- Split brood snakes (headless, smaller, muted purple) -->
        <path d="M10 56 Q6 50 8 44" fill="none" stroke="#8855bb" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
        <path d="M54 56 Q58 50 56 44" fill="none" stroke="#8855bb" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
        <!-- Fork glow -->
        <circle cx="32" cy="36" r="4" fill="#aa66ff" opacity="0.35"/>
        <circle cx="32" cy="36" r="2" fill="#cc88ff" opacity="0.5"/>
    </svg>`,

    // Serpent's Gatling — rapid-fire piercing fangs (fang + speed chevrons)
    serpent_gatling: `<svg ${S}>
        <!-- Triple rapid-fire fangs -->
        <path d="M14 48 Q18 38 22 30 Q24 24 22 20" fill="none" stroke="#cc8833" stroke-width="3" stroke-linecap="round"/>
        <path d="M22 20 L18 14 L24 16 Z" fill="#f0e8d8"/>
        <path d="M30 50 Q32 40 34 32 Q36 26 34 20" fill="none" stroke="#dd9944" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M34 20 L30 12 L38 15 Z" fill="#f0e8d8"/>
        <path d="M48 48 Q46 38 42 30 Q40 24 42 20" fill="none" stroke="#cc8833" stroke-width="3" stroke-linecap="round"/>
        <path d="M42 20 L38 14 L44 16 Z" fill="#f0e8d8"/>
        <!-- Venom tips -->
        <circle cx="20" cy="14" r="2" fill="#66ff88" opacity="0.8"/>
        <circle cx="33" cy="12" r="2.5" fill="#66ff88" opacity="0.9"/>
        <circle cx="42" cy="14" r="2" fill="#66ff88" opacity="0.8"/>
        <!-- Speed lines -->
        <line x1="8" y1="34" x2="16" y2="34" stroke="#ffaa00" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="6" y1="40" x2="14" y2="40" stroke="#ffaa00" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <line x1="48" y1="34" x2="56" y2="34" stroke="#ffaa00" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="50" y1="40" x2="58" y2="40" stroke="#ffaa00" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <!-- Pierce arrow -->
        <path d="M28 56 L32 52 L36 56" fill="none" stroke="#ffcc44" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    </svg>`,

    // Sidewinder Beam — sinuous laser beam
    sidewinder: `<svg ${S}>
        <!-- Beam path (S-curve like a sidewinder snake) -->
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#2288cc" stroke-width="5" stroke-linecap="round" opacity="0.4"/>
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#44ddff" stroke-width="3" stroke-linecap="round"/>
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#ccffff" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
        <!-- Source glow -->
        <circle cx="8" cy="32" r="5" fill="#44ddff" opacity="0.6"/>
        <circle cx="8" cy="32" r="3" fill="#ccffff" opacity="0.8"/>
        <!-- Impact flash -->
        <circle cx="56" cy="32" r="6" fill="#44ddff" opacity="0.4"/>
        <circle cx="56" cy="32" r="3.5" fill="#88eeff" opacity="0.7"/>
        <path d="M52 26 L60 38 M60 26 L52 38" stroke="#ccffff" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>
        <!-- Electric arcs -->
        <path d="M18 22 L22 18 L20 24" fill="none" stroke="#88eeff" stroke-width="1" opacity="0.5"/>
        <path d="M42 42 L46 38 L44 44" fill="none" stroke="#88eeff" stroke-width="1" opacity="0.5"/>
    </svg>`,

    // Consumption Beam — hungry draining beam (red/orange S-curve with skull)
    consumption_beam: `<svg ${S}>
        <!-- Beam path (S-curve, red/orange) -->
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#aa3322" stroke-width="5" stroke-linecap="round" opacity="0.4"/>
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#ff6644" stroke-width="3" stroke-linecap="round"/>
        <path d="M8 32 Q20 18 32 32 Q44 46 56 32" fill="none" stroke="#ffdd88" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
        <!-- Source glow (hungry mouth) -->
        <circle cx="8" cy="32" r="6" fill="#ff6644" opacity="0.5"/>
        <circle cx="8" cy="32" r="3.5" fill="#ffcc44" opacity="0.8"/>
        <!-- Drain target (withering) -->
        <circle cx="56" cy="32" r="7" fill="#aa3322" opacity="0.3"/>
        <circle cx="56" cy="32" r="4" fill="#ff6644" opacity="0.5"/>
        <!-- Absorption arrows flowing toward source -->
        <path d="M44 26 L40 28 L44 30" fill="none" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <path d="M34 38 L30 36 L34 34" fill="none" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <path d="M22 24 L18 26 L22 28" fill="none" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
    </svg>`,

    // Singularity Mortar — dark gravity vortex with mortar shell
    singularity_mortar: `<svg ${S}>
        <!-- Outer gravity distortion rings -->
        <circle cx="32" cy="32" r="26" fill="none" stroke="#8040cc" stroke-width="2" stroke-dasharray="5 4" opacity="0.4"/>
        <circle cx="32" cy="32" r="20" fill="none" stroke="#a060ff" stroke-width="2.5" stroke-dasharray="4 3" opacity="0.6"/>
        <!-- Inner vortex -->
        <circle cx="32" cy="32" r="13" fill="#2a0050" stroke="#a060ff" stroke-width="2"/>
        <circle cx="32" cy="32" r="8" fill="#1a0030"/>
        <!-- Singularity core -->
        <circle cx="32" cy="32" r="4" fill="#cc88ff"/>
        <circle cx="32" cy="32" r="2" fill="#fff" opacity="0.8"/>
        <!-- Spiral arms -->
        <path d="M32 32 Q38 24 28 18" fill="none" stroke="#b070ff" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <path d="M32 32 Q26 40 36 46" fill="none" stroke="#b070ff" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <path d="M32 32 Q40 38 44 28" fill="none" stroke="#b070ff" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
        <!-- Pull arrows pointing inward -->
        <path d="M10 20 L18 24 L14 16" fill="#a060ff" opacity="0.6"/>
        <path d="M54 44 L46 40 L50 48" fill="#a060ff" opacity="0.6"/>
        <path d="M50 12 L44 18 L52 18" fill="#a060ff" opacity="0.5"/>
        <path d="M14 52 L20 46 L12 46" fill="#a060ff" opacity="0.5"/>
        <!-- Explosion burst lines -->
        <line x1="32" y1="4" x2="32" y2="10" stroke="#ff88cc" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="32" y1="54" x2="32" y2="60" stroke="#ff88cc" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="4" y1="32" x2="10" y2="32" stroke="#ff88cc" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        <line x1="54" y1="32" x2="60" y2="32" stroke="#ff88cc" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>`,

    // Chronofield — clock with tick marks
    chronofield: `<svg ${S}>
        <circle cx="32" cy="32" r="23" fill="none" stroke="#00cccc" stroke-width="3"/>
        <circle cx="32" cy="32" r="23" fill="none" stroke="#00ffff" stroke-width="1" opacity="0.3"/>
        <line x1="32" y1="12" x2="32" y2="16" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
        <line x1="32" y1="48" x2="32" y2="52" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="32" x2="16" y2="32" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
        <line x1="48" y1="32" x2="52" y2="32" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
        <line x1="32" y1="32" x2="32" y2="18" stroke="#00ffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="32" y1="32" x2="43" y2="38" stroke="#00ccdd" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="3" fill="#00ffff"/>
    </svg>`,

    // Ricochet Fang — diamond fang bouncing between targets
    ricochet: `<svg ${S}>
        <!-- Bounce path (zigzag) -->
        <path d="M8 50 L24 20 L40 44 L56 14" fill="none" stroke="#66ccff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3" opacity="0.5"/>
        <!-- Impact sparks at bounce points -->
        <circle cx="24" cy="20" r="3.5" fill="#88ddff" opacity="0.6"/>
        <circle cx="40" cy="44" r="3.5" fill="#88ddff" opacity="0.6"/>
        <!-- Diamond fang projectile at tip -->
        <polygon points="56,14 50,8 44,14 50,20" fill="#d8eeff" stroke="#aaddff" stroke-width="1.5"/>
        <polygon points="54,14 50,10 47,14 50,18" fill="#ffffff" opacity="0.3"/>
        <!-- Glow at tip -->
        <circle cx="56" cy="14" r="3" fill="#66ccff" opacity="0.7"/>
        <circle cx="56" cy="14" r="1.5" fill="#ffffff" opacity="0.8"/>
        <!-- Starting fang at origin -->
        <polygon points="8,50 4,46 8,42 12,46" fill="#aaddff" opacity="0.4"/>
        <!-- Motion arrows -->
        <path d="M16 38 L20 34 L18 40" fill="#66ccff" opacity="0.5"/>
        <path d="M34 30 L38 34 L36 28" fill="#66ccff" opacity="0.5"/>
    </svg>`,

    // Cobra Pit — hooded cobra rising from a dark pit with venom spit
    cobra_pit: `<svg ${S}>
        <!-- Dark pit -->
        <ellipse cx="32" cy="56" rx="18" ry="6" fill="#1a0f04"/>
        <ellipse cx="32" cy="56" rx="21" ry="7.5" fill="none" stroke="#5a4020" stroke-width="1.5"/>
        <!-- Body — S-curve from pit up to head -->
        <path d="M34 56 Q39 48 36 42 Q33 36 29 33 Q25 30 32 24" fill="none" stroke="#1a5a1a" stroke-width="7" stroke-linecap="round"/>
        <path d="M34 56 Q39 48 36 42 Q33 36 29 33 Q25 30 32 24" fill="none" stroke="#2a8a2a" stroke-width="5" stroke-linecap="round"/>
        <path d="M34 56 Q39 48 36 42 Q33 36 29 33 Q25 30 32 24" fill="none" stroke="#3daa3d" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
        <!-- Head — kite/arrowhead -->
        <polygon points="32,4 39,18 32,24 25,18" fill="#33aa33" stroke="#1a5a1a" stroke-width="1.2"/>
        <polygon points="32,7 37,18 32,22 27,18" fill="#3dbb3d" opacity="0.3"/>
        <!-- Eyes -->
        <circle cx="29" cy="16" r="2.5" fill="#ffee44"/>
        <ellipse cx="29" cy="16" rx="0.7" ry="2" fill="#111"/>
        <circle cx="35" cy="16" r="2.5" fill="#ffee44"/>
        <ellipse cx="35" cy="16" rx="0.7" ry="2" fill="#111"/>
        <!-- Forked tongue -->
        <line x1="32" y1="4" x2="32" y2="0" stroke="#ff3333" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="32" y1="0" x2="30" y2="-2" stroke="#ff3333" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="32" y1="0" x2="34" y2="-2" stroke="#ff3333" stroke-width="0.8" stroke-linecap="round"/>
    </svg>`,

    // Tongue Lash — forked tongue whip in a cone
    tongue_lash: `<svg ${S}>
        <!-- Cone sweep indicator -->
        <path d="M32 36 L8 12 A30 30 0 0 1 56 12 Z" fill="#ff3366" opacity="0.15"/>
        <path d="M32 36 L8 12 A30 30 0 0 1 56 12" fill="none" stroke="#ff3366" stroke-width="1.5" opacity="0.4"/>
        <!-- Tongue shaft -->
        <path d="M32 58 Q32 42 32 30" fill="none" stroke="#cc2244" stroke-width="5" stroke-linecap="round"/>
        <path d="M32 58 Q32 42 32 30" fill="none" stroke="#ff4466" stroke-width="3" stroke-linecap="round"/>
        <!-- Forked tips -->
        <path d="M32 30 Q28 20 20 10" fill="none" stroke="#cc2244" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M32 30 Q36 20 44 10" fill="none" stroke="#cc2244" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M32 30 Q28 20 20 10" fill="none" stroke="#ff4466" stroke-width="2" stroke-linecap="round"/>
        <path d="M32 30 Q36 20 44 10" fill="none" stroke="#ff4466" stroke-width="2" stroke-linecap="round"/>
        <!-- Tip glow -->
        <circle cx="20" cy="10" r="3" fill="#ff6688" opacity="0.7"/>
        <circle cx="44" cy="10" r="3" fill="#ff6688" opacity="0.7"/>
        <!-- Slow effect sparkles -->
        <circle cx="14" cy="18" r="1.5" fill="#88ccff" opacity="0.6"/>
        <circle cx="50" cy="18" r="1.5" fill="#88ccff" opacity="0.6"/>
        <circle cx="32" cy="8" r="1.5" fill="#88ccff" opacity="0.5"/>
    </svg>`,

    // Serpent's Scales — shield with scale pattern
    serpent_scales: `<svg ${S}>
        <path d="M32 8 L48 18 L48 34 Q48 50 32 56 Q16 50 16 34 L16 18 Z" fill="#1a5a8a" stroke="#50b4ff" stroke-width="2"/>
        <path d="M32 14 L42 20 L42 34 Q42 44 32 50 Q22 44 22 34 L22 20 Z" fill="#2a7ab0" opacity="0.4"/>
        <line x1="24" y1="26" x2="40" y2="26" stroke="#0e3d5e" stroke-width="1.5" opacity="0.5"/>
        <line x1="22" y1="34" x2="42" y2="34" stroke="#0e3d5e" stroke-width="1.5" opacity="0.5"/>
        <line x1="24" y1="42" x2="40" y2="42" stroke="#0e3d5e" stroke-width="1.5" opacity="0.5"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="#50b4ff" stroke-width="1" opacity="0.3"/>
    </svg>`,

    // Shatter Fang — cracking diamond that explodes into splinters
    shatter_fang: `<svg ${S}>
        <!-- Central cracking diamond fang -->
        <polygon points="32,8 44,32 32,52 20,32" fill="#ffd4b0" stroke="#ff8844" stroke-width="2"/>
        <polygon points="32,14 40,32 32,46 24,32" fill="#ffe8d0" opacity="0.5"/>
        <!-- Crack lines through diamond -->
        <line x1="28" y1="18" x2="36" y2="30" stroke="#ff6644" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="34" y1="22" x2="26" y2="38" stroke="#ff6644" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="30" y1="28" x2="38" y2="42" stroke="#ff6644" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
        <!-- Splinter shards flying outward -->
        <polygon points="10,14 14,10 16,16" fill="#ffcc88" stroke="#ff8844" stroke-width="1"/>
        <polygon points="52,12 56,16 50,18" fill="#ffcc88" stroke="#ff8844" stroke-width="1"/>
        <polygon points="8,46 12,42 14,48" fill="#ffcc88" stroke="#ff8844" stroke-width="1"/>
        <polygon points="50,48 54,44 56,50" fill="#ffcc88" stroke="#ff8844" stroke-width="1"/>
        <polygon points="14,30 10,26 8,32" fill="#ffbb77" stroke="#ff8844" stroke-width="0.8" opacity="0.6"/>
        <polygon points="54,30 56,34 52,36" fill="#ffbb77" stroke="#ff8844" stroke-width="0.8" opacity="0.6"/>
        <!-- Explosion burst lines -->
        <line x1="18" y1="20" x2="12" y2="14" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="46" y1="18" x2="52" y2="12" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="16" y1="42" x2="10" y2="48" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="48" y1="44" x2="54" y2="50" stroke="#ffaa44" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
        <!-- Core glow -->
        <circle cx="32" cy="30" r="5" fill="#ff6644" opacity="0.4"/>
        <circle cx="32" cy="30" r="2.5" fill="#ffcc44" opacity="0.6"/>
    </svg>`,

    // Ancient Brood Pit — expanding amber pit with ancient snake and rune ring
    ancient_brood_pit: `<svg ${S}>
        <!-- Cracked pit ground -->
        <ellipse cx="20" cy="56" rx="15" ry="5" fill="#0d0800"/>
        <ellipse cx="20" cy="56" rx="15" ry="5" fill="none" stroke="#6b4400" stroke-width="1.2"/>
        <line x1="20" y1="56" x2="7" y2="51" stroke="#8b5e1a" stroke-width="0.7" opacity="0.5"/>
        <line x1="20" y1="56" x2="33" y2="52" stroke="#8b5e1a" stroke-width="0.7" opacity="0.5"/>
        <line x1="20" y1="56" x2="20" y2="62" stroke="#8b5e1a" stroke-width="0.7" opacity="0.4"/>
        <!-- Rune dots -->
        <circle cx="9" cy="50" r="1" fill="#ffcc44" opacity="0.45"/>
        <circle cx="31" cy="50" r="1" fill="#ffcc44" opacity="0.45"/>
        <circle cx="13" cy="60" r="0.8" fill="#ffcc44" opacity="0.3"/>
        <circle cx="27" cy="60" r="0.8" fill="#ffcc44" opacity="0.3"/>
        <!-- Thick body rising from pit -->
        <path d="M20 56 Q16 46 19 36 Q22 28 20 18" fill="none" stroke="#5a3800" stroke-width="9" stroke-linecap="round"/>
        <path d="M20 56 Q16 46 19 36 Q22 28 20 18" fill="none" stroke="#b07818" stroke-width="7" stroke-linecap="round"/>
        <path d="M20 56 Q16 46 19 36 Q22 28 20 18" fill="none" stroke="#cc8822" stroke-width="5" stroke-linecap="round"/>
        <!-- Diamond scale pattern on body -->
        <polygon points="18,42 20,40 22,42 20,44" fill="#9a6a18" opacity="0.5"/>
        <polygon points="19,34 21,32 23,34 21,36" fill="#9a6a18" opacity="0.4"/>
        <!-- Flared hood -->
        <polygon points="20,16 10,20 13,14 20,10 27,14 30,20" fill="#dd9922" stroke="#6b4400" stroke-width="1"/>
        <!-- Upper jaw (snout) -->
        <polygon points="20,6 13,13 16,14 24,14 27,13" fill="#ddaa33" stroke="#6b4400" stroke-width="0.8"/>
        <!-- Open mouth cavity -->
        <ellipse cx="20" cy="13.5" rx="4" ry="2" fill="#0a0200"/>
        <!-- Mouth energy glow -->
        <ellipse cx="20" cy="13.5" rx="3" ry="1.5" fill="#ffaa33" opacity="0.35"/>
        <ellipse cx="20" cy="13.5" rx="1.5" ry="0.8" fill="#ffeecc" opacity="0.6"/>
        <!-- Lower jaw -->
        <polygon points="16,14 20,17 24,14" fill="#b07818" stroke="#6b4400" stroke-width="0.6"/>
        <!-- Fangs -->
        <line x1="16.5" y1="13.5" x2="16" y2="16" stroke="#ffe8cc" stroke-width="1" stroke-linecap="round"/>
        <line x1="23.5" y1="13.5" x2="24" y2="16" stroke="#ffe8cc" stroke-width="1" stroke-linecap="round"/>
        <!-- Glowing eyes on hood -->
        <circle cx="16" cy="11.5" r="2" fill="#ff8800" opacity="0.5"/>
        <circle cx="24" cy="11.5" r="2" fill="#ff8800" opacity="0.5"/>
        <circle cx="16" cy="11.5" r="1.2" fill="#ffaa00"/>
        <circle cx="24" cy="11.5" r="1.2" fill="#ffaa00"/>
        <ellipse cx="16" cy="11.5" rx="0.35" ry="1" fill="#110000"/>
        <ellipse cx="24" cy="11.5" rx="0.35" ry="1" fill="#110000"/>
    </svg>`,

    // Serpent's Reckoning — grapple tongue yanking an enemy back
    serpents_reckoning: `<svg ${S}>
        <!-- Drag trail (motion lines) -->
        <line x1="48" y1="18" x2="38" y2="22" stroke="#cc44ff" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <line x1="52" y1="24" x2="42" y2="26" stroke="#cc44ff" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
        <line x1="50" y1="14" x2="40" y2="18" stroke="#cc44ff" stroke-width="1" stroke-linecap="round" opacity="0.3"/>
        <!-- Tongue body — curved S from head to target -->
        <path d="M12 48 Q20 50 28 38 Q36 26 48 20" fill="none" stroke="#aa2266" stroke-width="5" stroke-linecap="round" opacity="0.4"/>
        <path d="M12 48 Q20 50 28 38 Q36 26 48 20" fill="none" stroke="#dd3366" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 48 Q20 50 28 38 Q36 26 48 20" fill="none" stroke="#ffaacc" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
        <!-- Forked tip gripping -->
        <line x1="48" y1="20" x2="54" y2="14" stroke="#dd3366" stroke-width="2" stroke-linecap="round"/>
        <line x1="48" y1="20" x2="56" y2="22" stroke="#dd3366" stroke-width="2" stroke-linecap="round"/>
        <!-- Grabbed enemy (circle) -->
        <circle cx="52" cy="16" r="5" fill="#555" stroke="#dd3366" stroke-width="1.5" opacity="0.7"/>
        <circle cx="52" cy="16" r="2" fill="#ff88bb" opacity="0.5"/>
        <!-- Arrow showing drag direction -->
        <path d="M42 30 L34 36 M36 32 L34 36 L38 38" fill="none" stroke="#ff2266" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        <!-- Head glow -->
        <circle cx="12" cy="48" r="6" fill="#dd3366" opacity="0.3"/>
        <circle cx="12" cy="48" r="3" fill="#ffaacc" opacity="0.5"/>
        <!-- Stun stars on grabbed enemy -->
        <path d="M58 10 L59 12 L61 12 L59.5 13.5 L60.5 16 L58 14 L55.5 16 L56.5 13.5 L55 12 L57 12 Z" fill="#ffcc44" opacity="0.6"/>
    </svg>`,

    // Ouroboros — rotating ring of green fang-scales pointing outward, orbiting a serpent eye
    ouroboros: `<svg ${S}>
        <!-- Orbit ring -->
        <circle cx="32" cy="32" r="22" fill="none" stroke="#22cc44" stroke-width="3" opacity="0.3"/>
        <circle cx="32" cy="32" r="22" fill="none" stroke="#66ff88" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>
        <!-- Orbiting fangs (6 around the ring, pointing outward) -->
        <polygon points="32,4 28,12 36,12" fill="#22cc44"/>
        <polygon points="53,15 46,20 50,26" fill="#22cc44"/>
        <polygon points="53,49 50,38 46,44" fill="#22cc44"/>
        <polygon points="32,60 36,52 28,52" fill="#22cc44"/>
        <polygon points="11,49 18,44 14,38" fill="#22cc44"/>
        <polygon points="11,15 14,26 18,20" fill="#22cc44"/>
        <!-- Fang highlights -->
        <polygon points="32,6 30,11 34,11" fill="#88ff99" opacity="0.6"/>
        <polygon points="51,17 48,21 49,25" fill="#88ff99" opacity="0.6"/>
        <polygon points="51,47 49,40 48,43" fill="#88ff99" opacity="0.6"/>
        <polygon points="32,58 34,53 30,53" fill="#88ff99" opacity="0.6"/>
        <polygon points="13,47 16,43 15,39" fill="#88ff99" opacity="0.6"/>
        <polygon points="13,17 15,25 16,21" fill="#88ff99" opacity="0.6"/>
        <!-- Central serpent eye -->
        <circle cx="32" cy="32" r="8" fill="#0a2218"/>
        <circle cx="32" cy="32" r="6" fill="#143828"/>
        <ellipse cx="32" cy="32" rx="2" ry="5" fill="#44ff66"/>
        <ellipse cx="32" cy="32" rx="1" ry="4" fill="#ccffdd" opacity="0.7"/>
        <!-- Core glow -->
        <circle cx="32" cy="32" r="10" fill="none" stroke="#44ff66" stroke-width="1" opacity="0.3"/>
    </svg>`,
};

// Cache loaded Image objects
const icon_cache = {};
let loading = false;
let loaded = false;

function svg_to_image(svg_string) {
    return new Promise((resolve) => {
        const img = new Image();
        const blob = new Blob([svg_string], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

export async function load_powerup_icons() {
    if (loaded || loading) return;
    loading = true;
    const entries = Object.entries(SVG_DEFS);
    const results = await Promise.all(entries.map(([, svg]) => svg_to_image(svg)));
    for (let i = 0; i < entries.length; i++) {
        if (results[i]) {
            icon_cache[entries[i][0]] = results[i];
        }
    }
    loaded = true;
    loading = false;
}

export function get_powerup_icon(id) {
    return icon_cache[id] || null;
}

export { ICON_SIZE };
