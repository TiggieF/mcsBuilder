# STAGE 00 — IMPLEMENT PROMPT

## Goal
Create the **scaffold** for mcsBuilder as a single HTML file runnable in browser (no dependencies).  
It should set up:
- Canvas (900×900)
- 30×30 grid
- Player (WASD movement, Space interaction placeholder)
- Zones: MCS, wood house, Starbucks, beds
- Simple UI panel (Pause, Speed, Contrast, Worker buttons)
- HUD (wood stock, floor, progress, total time)

## Technical Constraints
- Must be one self-contained `index.html`
- Use plain JS + Canvas 2D API
- Frame loop at 30 FPS
- Collisions prevent player from entering solids (walls/buildings)
- Space triggers contextual text bubble (no logic yet)
- Worker placeholders with labels above head (“idle”)

## Deliverables
- `index.html` with:
  - `<canvas>` 900×900
  - `<script>` block containing all logic
  - Inline CSS for pixel-art style
  - Keyboard input
  - UI panel + HUD elements



# STAGE 02 — IMPLEMENT PROMPT

## Goal
Add the **game’s data model and internal logic** into the existing HTML (Stage 00 base).  
Introduce stamina, floor progress, resource stock, and formulas.

## Additions
1. **State Model**
   - Global JS object with:
     ```js
     state = {
       time: { elapsed: 0, speed: 1 },
       floor: { n: 1, progress: 0, need: 10 },
       stock: { wood: 0 },
       player: { x, y, item: 'none', cooldown: 0 },
       workers: [
         { id:'W1', role:'builder', stamina:5, inv:0, order:'idle' },
         { id:'W2', role:'delivery', stamina:5, inv:0, order:'idle' }
       ]
     }
     ```
2. **Economy Formulas**
   - Wood needed: `W(n) = 10 + 5*(n - 1)`
   - Build time: `T(n) = 5 + 5*(n - 1)`
3. **Stamina Rules**
   - Max = 5
   - −0.5 per trip, −3 per build start
   - Rest: linear recovery (0.25/s)
4. **Rest & Coffee**
   - Player can deliver coffee to instantly refill both workers
5. **HUD Updates**
   - Update floor number, progress %, wood stock, total time.

## Deliverables
- One single HTML file (upgraded from Stage 00)
- No A* or FSM yet — logic placeholders only
- All constants defined in JS


# STAGE 04 — IMPLEMENT PROMPT

## Goal
Implement **worker AI and FSM behaviours** using A* pathfinding (Manhattan grid).  
Keep everything inside the same HTML.

## Additions
1. **FSM**
   - States: `idle`, `move`, `fetch`, `build`, `rest`, `return`
   - Transitions triggered by stamina and player orders.
2. **Pathfinding**
   - A* 4-way, replan every 1 second or on collision.
3. **Worker Roles**
   - W1 = Builder  
     → Move to build pad → Check wood stock → Build until stamina 0 → Rest → Resume
   - W2 = Delivery  
     → Move to wood house → Fetch 3 → Drop → Repeat until cancel.
4. **Player Interaction**
   - Space picks up or drops based on tile
   - Pressing Space on MCS coffee tile refills both workers.
5. **UI Panel**
   - Buttons update worker orders.
   - HUD refreshes all state data live.
6. **Collision**
   - No entity overlap (player, workers, buildings, beds).

## Deliverables
- Finalized HTML (still one file)
- Properly working movement + FSM loop

# STAGE 05 — IMPLEMENT PROMPT

## Goal
Add **analytics, win condition, and polish** to the existing single HTML.

## Additions
1. **Timer**
   - Count total seconds since start.
   - Display formatted mm:ss in HUD.
2. **Floor Progress**
   - Draw progress bar or % above MCS.
3. **Win Condition**
   - Floor 10 complete → “Construction Complete!” message and total time.
4. **Accessibility**
   - High-contrast mode toggle
   - Adjustable game speed (0.5×, 1×, 1.5×, 2×)
5. **Visual Feedback**
   - Label over player showing held item.
   - Labels over workers (“fetch”, “build”, “rest”, “idle”).
   - Bubbles for “no wood” messages.
6. **Performance**
   - Maintain 30 FPS
   - Smooth update with `requestAnimationFrame`.

## Deliverables
- One polished HTML (final look & feel)
- Game fully playable from start to finish.

# STAGE 06 — IMPLEMENT PROMPT

## Goal
Finalize the project for submission as a **single self-contained HTML file**.

## Tasks
1. **Cleanup**
   - Remove debug overlays and console logs.
   - Inline all CSS and JS.
2. **Metadata**
   - Title, author (Tiger Fang), and course info in `<head>`.
3. **Submission Packaging**
   - Ensure game runs offline (no external dependencies).
   - Embed all logic inline — no imports or modules.
4. **Test Cases**
   - Start game → Build 10 floors → Show completion screen with total time.

## Deliverables
- `mcsBuilder_final.html` (single runnable file)
- Must open directly in browser without internet connection.
