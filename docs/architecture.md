# Architecture

## Overview
- **Frontend-only**
- **HTML-first** structure for easy grading and local running
- **Canvas-based** rendering loop (no WebGL)

## Modules
| File | Purpose |
|------|----------|
| `index.html` | Entry + rendering + UI |
| `state.js` | Holds global state (player, workers, map) |
| `fsm.js` | Worker finite state machine |
| `pathfinding.js` | A* movement |
| `ui.js` | Buttons, HUD, and contrast toggle |

## Principles
- Decouple game logic from visuals
- No external build system required
- Fully offline runnable
