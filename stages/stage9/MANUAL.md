# Stage 09 Manual — Accidents, Medals, and Start Menu

## New Features
- **Delivery accidents:** Delivery worker has a per-tile drop chance while carrying materials. Dropped loads are lost, play the `oops.mp3` sound, show an "Oops!" banner, pause the worker, trigger camera shake, and auto-resume the fetch order after 3 seconds if still idle.
- **Camera shake:** 0.4s shake with frequency 30Hz. Magnitude scales by difficulty (Easy 2px, Normal 4px, Hard 6px).
- **Medal ceremony:** After reaching floor 10, a medal popup shows Gold (≤3h), Silver (≤4h), Bronze (≤5h), or Fail (>5h) with color-coded label and animated drop-in.
- **Start menu:** Pick difficulty (Easy/Normal/Hard), open controls/instructions, then start the project. Restarting opens the start menu again.
- **Difficulty effects:**
  - Easy: speed ×1.1, build times ×0.9, no drops, snow slowdown reduced by 5%, Red Bull every 5 minutes (base), camera shake 2px.
  - Normal: baseline rules, 10% drop chance per tile, 4px shake.
  - Hard: speed ×0.9, build times ×1.1, drop chance ×1.5 (15%), snow slowdown +15%, Red Bull every 7 minutes, camera shake 6px.

## How to Run
Open `index.html` in a browser. The start menu appears immediately—choose a difficulty, optionally open the controls panel, then press **Start Project**.

## Testing Checklist
- **Accident chance (0.1 per tile while carrying):**
  1. Start on Normal.
  2. Order the delivery worker to fetch; watch while carrying to the MCS site.
  3. As the worker crosses tiles, there is a 10% chance per tile to trigger an "Oops" state, lose the load, and shake the camera.
  4. On Easy, verify no drops occur; on Hard, drops are noticeably more frequent.
- **Camera shake:** When an accident occurs, the whole scene should jitter for ~0.4s. Magnitude is smaller on Easy and larger on Hard.
- **Medal thresholds:** Build to floor 10. The win overlay shows medal and time. Use the speed toggle to simulate different times; Gold ≤3h, Silver ≤4h, Bronze ≤5h, Fail above that. Restart to retry with another simulated pace.
- **Start menu use:** Confirm the overlay loads before gameplay. Difficulty buttons highlight selection, **Controls/Instructions** toggles the tips panel, and **Start Project** hides the menu and begins music/simulation.
- **Difficulty effects:**
  - **Easy:** faster movement, faster build, no drops, lighter snow slowdown.
  - **Normal:** base speeds, 10% drop chance, standard snow.
  - **Hard:** slower movement, slower build, higher drop chance, heavier snow penalty, Red Bull every 7 minutes.
  Observe worker movement speed, build time, and drop frequency to confirm.
- **Restart / switch difficulties:** Use **Restart Project** on the win overlay (or reload) to reopen the start menu. Pick a different difficulty and start again to simulate alternate balance.

