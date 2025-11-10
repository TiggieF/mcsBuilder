# Stage 02 — Systems & Economy Playtest Guide

Stage 02 layers the simulation rules on top of the Stage 00 sandbox. This build introduces the central state model, stamina loops, resource formulas, and coffee boosts that will drive later automation. Use this checklist to validate the logic and capture balancing notes before we move forward.

## 1. Launch the build
1. Open `stages/stage-02-model-logic/index.html` in a desktop browser (Chrome/Firefox).
2. Ensure the 1140×600 canvas and the control panel are both visible without scrolling.

## 2. Baseline sanity check
- Confirm the HUD shows Floor **1**, Wood Stock `2/10`, Progress `0%`, and Total Time `00:00` on load.
- Toggle Pause, Speed, and Contrast to make sure the new state timer respects pausing and the speed button now cycles through 0.5× → 1× → 2× → 3× → 4×.

## 3. Inspect the state-driven HUD
- Walk around for ~10 seconds at different speeds and confirm Total Time advances proportionally to the selected multiplier.
- Click **Builder** once to switch the order label to `build (x.x)` and watch the progress bar start filling only after the wood stock drains to `0/10`.
- Allow the build to finish; verify the floor counter increments to **2**, the new wood requirement becomes `15`, and progress resets to `0%`.

## 4. Validate stamina behaviour
- With both workers idle, wait a few seconds and watch their stamina in the button labels climb back toward `5.0`.
- Set Builder to **build** and Delivery to **deliver**. Observe:
  - Builder consumes **3** stamina immediately when construction begins.
  - Delivery loses **0.5** stamina with each completed trip and the wood bar climbs toward its target.
  - When either worker hits `0`, their order automatically flips back to idle and a status bubble explains why.

## 5. Coffee perk flow
- Move to the Starbucks zone and press **Space** to pick up a coffee (a bubble should confirm).
- Approach an exhausted worker and press **Space** again to instantly refill both stamina bars back to `5.0`.
- Try interacting while already holding coffee to see the “hands full” response.

## 6. Interaction bubbles & tooltips
- Stand near each landmark (MCS, wood house, Starbucks, dorm) and press **Space** to read the contextual description.
- Trigger **Space** near a worker to check their live stamina readout.
- Make sure the interaction bubble continues to anchor above the player’s head while moving.

## 7. Worker motion & collisions
- Let both workers idle and confirm they wander slowly, hop once when entering idle, and continue to block the player just like buildings.
- While workers are assigned to build/deliver, verify they stay planted (no idle wandering) yet still collide properly with the player and obstacles.

## 8. Record feedback
Capture any observations about:
- Formula tuning (wood requirement feels too high/low, stamina drain rates, delivery cadence, etc.).
- UX clarity (button labels, HUD readouts, coffee flow messaging).
- Bugs or oddities with timers, collisions, or state resets between floors.

Drop your notes during the Stage 02 review so we can tune the systems before automation work begins.
