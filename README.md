# Ultimate Snake

A browser-based snake game with three game modes, a full roguelike survivors mode, and way too many weapons. No dependencies, no build step — just open `index.html` and go.

## Game Modes

### Solo
Classic snake. Eat food, grow longer, try not to die. High scores saved locally.

### Battle Royale
You vs 15 AI snakes. The arena shrinks every 8 seconds. Last one alive wins.

### Survivors
This is the big one. Vampire Survivors-style roguelike where you fight off waves of enemies for 20 minutes across a huge arena. Enemies get tougher and split when killed. You level up by collecting XP and pick from random powerups each level — there are 16 base weapons and 8 evolutions you can unlock by combining the right ones.

**Weapons:**
- Viper Fangs — homing fang projectiles
- Plague Mortar — toxic bombs that leave poison zones
- Snake Nest — lob eggs that hatch mini snakes
- Venom Nova — poison pulse around your head
- Sidewinder Beam — lock-on tracking beam
- Ricochet Fang — bouncing fang that chains between enemies
- Cobra Pit — spawns spitting cobras
- Tongue Lash — forked tongue whip that slows enemies

**Buffs:**
- Graviton — bigger fruit pickup radius
- Rapid Fire — faster attack speed
- Dead Eye — crit chance
- Ravenous Maw — more growth, XP, and damage
- Chronofield — longer duration on timed effects
- Coiled Volley — extra projectiles
- Toxic Expanse — bigger AOE
- Serpent's Reach — longer weapon range

**Evolutions** (combine two specific powerups to unlock):
- Miasma (Venom Nova + Toxic Expanse) — permanent toxic fog
- Hydra Brood (Snake Nest + Coiled Volley) — two-headed mini snakes that split on death
- Serpent's Gatling (Viper Fangs + Rapid Fire) — rapid-fire piercing fangs
- Consumption Beam (Sidewinder + Ravenous Maw) — always-on drain beam
- Singularity Mortar (Plague Mortar + Graviton) — gravity well that pulls enemies in then detonates
- Shatter Fang (Ricochet Fang + Dead Eye) — crits shatter into chaining splinters
- Ancient Brood Pit (Cobra Pit + Chronofield) — expanding pit that spawns ancient cobras
- Serpent's Reckoning (Tongue Lash + Serpent's Reach) — grapple tongue that drags enemies back

## Controls

- **Arrow keys / WASD** — move
- **Escape** — pause
- **Space / Enter** — restart after death, confirm selections
- **1-9** — quick-select powerups during level-up
- **F2** — evolution menu (Survivors)

## Running it

Just open `index.html` in a browser. That's it. Pure vanilla JS, no frameworks, no npm, no build tools.
