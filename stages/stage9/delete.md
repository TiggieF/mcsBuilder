# Stage 9 — Cleanup Tracker

## ✅ Completed cleanups (implemented in `main.js`)
1. Removed the unused `tripTimer` property/resets from worker objects.
2. Removed the unused `orderStarted` bookkeeping.
3. Deleted the `logStateTransition` debug helper and its caller.
4. Stopped toggling the unused `.active` class on the Controls button.
5. Deleted the unused `snowIcon` DOM query.
6. Removed the unused `SNOW_START_MIN` / `SNOW_START_MAX` constants.

## 🔍 Next cleanup / reuse opportunities
1. **Consolidate worker cargo resets**  
   - `worker.inv = 0; worker.cargo = null;` appears in several places (`stages/stage9/main.js:1620-1622, 1913-1914, 3005-3028`). A helper such as `clearWorkerCargo(worker)` would reduce repetition and guarantee consistent behavior whenever a worker drops, idles, or switches orders.

2. **Factor Red Bull scheduling into a helper**  
   - `world.nextRedBullAt = state.time.elapsed + getRedBullInterval();` is repeated in `spawnRedBullTile` and `applyRedBullBuff` (stages/stage9/main.js:2655-2659, 2677-2679). Wrapping the assignment in `scheduleNextRedBull()` would DRY these branches and make it harder to forget when to queue the next spawn.

3. **Cache workers by role during UI refreshes**  
   - `refreshWorkerCards` and `handleWorkerAction` repeatedly call `workers.find(w => w.role === workerKey)` for each card/button interaction (stages/stage9/main.js:2821-2843, 2847-2879). Maintaining a small `const workersByRole = Object.fromEntries(...)` per update would avoid repeated searches and simplify future refactors where more worker roles are added.

4. **Share worker-action mapping data**  
   - `handleWorkerAction`, `formatOrderLabel`, and `isActionActive` each hardcode the mapping between buttons/actions/orders (stages/stage9/main.js:2821-2866, 2884-2915). Consider defining a single configuration object that declares available actions per role, their labels, and the orders they trigger so the UI, logic, and highlighting stay in sync automatically.

5. **(Optional) Remove the empty `stages/stage9/README.md` or replace it with a pointer to `MANUAL.md` / `stage9.md`**  
   - Keeps docs consolidated in one place (user already planned to handle this).

These follow-ups keep folder9 lean and make future balance tweaks safer.
