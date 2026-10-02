# Doomsday

Retro pixel-art HTML5 arcade shooter — defend Earth for 60 seconds per level across 5 levels, ending in a 3-phase mothership boss fight.

## Run

Serve the folder with any static server and open it in a browser:

```sh
python3 -m http.server 8000
# -> http://localhost:8000
```

No build step, no dependencies.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows | Move |
| SPACE | Shoot / menus |
| E | Activate queued power-up (FIFO, up to 3) |
| SHIFT | Rocket boost |
| P | Pause |
| M | Mute |

Mobile: on-screen D-pad, FIRE, and BOOST/PWR toggle buttons appear automatically.

## Features

- 320×180 internal resolution, adaptive hi-res scaling, custom pixel font
- Asteroids that split (large → medium → small), alien fighters, power-ups (Shield / Rapid Fire / Triple Shot / EMP)
- 3-phase mothership boss with sweeping volleys, spiral arcs, bullet rings, homing missiles and a telegraphed beam cannon
- 3 lives per run, Earth/player health carry-over between levels, score + combo system
- Synthesized Web Audio SFX and chiptune music, particles and screen shake
- EASY / NORMAL / HARD difficulty select
