# Stage 00 — Playtest & Feedback Guide

Stage 00 now leans harder into the pixel-sim vibe while widening the map and adding randomized obstacles. Use this checklist to exercise every system, confirm nothing regressed, and capture feedback before we lock the scaffold.

## 1. Launch the build
1. Open `index.html` directly in a modern desktop browser (Chrome/Firefox).
2. Resize the window so the 1140×600 canvas and the control panel sit side-by-side without scrolling.

## 2. Learn the controls
- **W / A / S / D** – Move the player around the map; collisions should stop you from walking through structures or rocks.
- **Space** – Trigger the interaction bubble when standing near a zone; the text bubble should anchor over the player’s head.
- **UI Buttons** – Pause/Resume, cycle speeds (0.5× → 1× → 2× → 3× → 4×), toggle contrast, or ping each worker.

## 3. Explore the randomized map
1. The grid is now 38×20 tiles. Each page load should shuffle:
   - A 5×5 MCS build (now placed in a random valid location).
   - 2×2 Starbucks, wood house, and dorm structures (no overlaps).
   - A handful of tetris-style rock clusters that block paths but always leave at least one route between zones.
2. Refresh the page several times to confirm the shuffles respect spacing and still allow navigation between every landmark.
3. Verify the player cannot clip through any structure or rock regardless of the layout.

## 4. Observe the crew
- Worker sprites should appear grey when idle, wander slowly with small random walks, and perform a one-time “Mario hop” when they become idle (or when you poke them in the panel).
- “Idle” labels should float above their heads, updating instantly if you interact via the panel buttons.

## 5. Confirm the HUD & pacing tools
- Wood stock and build progress now display as animated progress bars with their values centered inside the bar.
- Total time continues counting while unpaused; ensure the floor readout stays at 1.
- Cycle through each speed tier (including the new 3× and 4× options) to make sure movement, timers, and progress all accelerate together.

## 6. Visual polish to review
- The grass, buildings, rocks, and characters should all present as crisp pixel art with no antialiasing.
- Interaction bubbles track above the player’s head even while moving.
- Confirm high-contrast mode still flips the palette appropriately.

## 7. Capture your feedback
Log anything noteworthy:
- Unexpected rock placements that choke off paths or feel unfair.
- Visual or collision issues introduced by the wider grid and randomization.
- UI/UX tweaks you want before the next development stage.

Share your notes during the stage approval review so we can fold them into Stage 01. Have fun exploring the new sandbox!
