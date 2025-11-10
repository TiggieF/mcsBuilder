# Stage 00 — Playtest & Feedback Guide

Welcome back to the Stage 00 scaffold of **mcsBuilder**. This revision keeps the original controls while refreshing the map layout and presentation. Follow the steps below to validate the new build, confirm Stage 00 deliverables, and capture any feedback before we advance to the next stage.

## 1. Launch the build
1. Open `index.html` directly in a modern desktop browser (Chrome/Firefox).
2. Allow the window to display the full canvas (1020×600) alongside the control panel without scrolling.

## 2. Learn the controls
- **W / A / S / D** – Move the player around the map.
- **Space** – Trigger the contextual interaction bubble (text placeholder) when standing near a zone or worker.
- **UI Buttons** – Click Pause, Speed, Contrast, and Worker buttons to observe the current placeholder responses.

## 3. Explore the map
1. Traverse the 34×20 grid to visit each zone:
   - MCS construction site (now a 5×5 tile build in the center).
   - Wood house (2×2 tiles, random placement each load).
   - Starbucks kiosk (2×2 tiles, random placement each load).
   - Dorm beds (2×2 tiles, random placement each load).
2. Refresh the page a few times to confirm the three small buildings relocate without overlapping each other or the MCS footprint.
3. Verify collision boundaries prevent walking through any structure, regardless of placement.
4. Check that worker placeholders remain on the map with floating "idle" labels above their heads.

## 4. Confirm the HUD & panel
- HUD now shows wood stock as a fraction (e.g., `1/5`), plus floor level, progress percentage, and total elapsed time.
- Control panel still contains Pause, Speed, Contrast, and Worker action buttons with placeholder interactions.
- Contrast toggle flips between default and high-contrast palettes.

## 5. Visual polish to review
- Canvas background uses a pixelated grass texture inspired by the provided reference art.
- Buildings render with pixel-style patterns and silhouettes; make sure the vibe matches what you expect for Stage 00.
- Interaction bubbles should appear above the player’s head when triggered.

## 6. Capture your feedback
Record any notes about:
- Visual clarity, sizing, or layout quirks (especially with the wider map).
- Input responsiveness, collision bugs, or interaction bubble placement.
- Additional UI tweaks desired before Stage 01.

Share this feedback during the stage approval review so the next iteration can incorporate your findings. Enjoy exploring Stage 00!
