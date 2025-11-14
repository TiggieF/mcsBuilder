# mcsBuilder · Stage 6.2

Stage 6.2 keeps the late-stage gameplay but trims unused UI. The contrast toggle is gone, the worker state log now streams to the browser console, and the worker sprites no longer run the idle jump animation. The result is leaner markup, shorter styles, and less JavaScript while keeping every gameplay element intact.

## Run locally
Open `index.html` in any modern desktop browser. All assets are inline (canvas-based), so no server is required.

## Folder structure
```
stage6.2/
├── index.html      # Layout + DOM structure
├── style.css       # Theme, HUD, panel, overlays
├── main.js         # Game logic, rendering, input
├── README.md       # Developer docs
└── MANUAL.md       # Player-facing manual
```

## Code organization
`main.js` is organized into small sections so it is easier to navigate:

1. **Config + DOM hooks** – constants, canvas, HUD references, and top-level state setup.
2. **World generation** – helper functions that place zones, rocks, paths, and textures.
3. **State + helpers** – utility math, timing, FSM transitions, HUD updates, speech bubble support.
4. **Simulation** – player movement, worker AI (build/deliver/rest), coffee interactions, win/reset flow.
5. **Rendering** – tile patterns, workers, player, overlays, and HUD refresh.
6. **Input + loop** – keyboard controls, panel buttons, worker cards, and the fixed-FPS update/draw cycle.

Key helpers worth knowing:

- `createInitialState(spawnCell, blocked)` – builds the `state` object, workers, and HUD counters.
- `handleBuilder(worker, dt)` and `handleDelivery(worker, dt)` – run the FSM rules for each worker role.
- `setWorkerOrder(worker, order)` – centralizes order changes, UI feedback, and FSM transitions.
- `generateZones()` / `generateRocks()` – recreate the stage layout deterministically per run.

## Extending the game
- **New zones or art** – update the zone templates in `generateZones()` and add a matching pattern helper.
- **Additional workers** – push a new `createWorker` result inside `createInitialState` and extend `WorkerFSMConfig` with its states.
- **Balance tweaks** – adjust the config constants (stamina costs, speeds, timers) defined near the top of `main.js`.
- **UI changes** – update `style.css` or add extra HUD entries; values are exposed via the `hud-*` IDs.

Because logic, art, and layout are in separate files (and the UI is now smaller), each change can be made without touching the other layers.
