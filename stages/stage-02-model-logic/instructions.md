# Stage 02 — Systems & Economy Playtest Guide

Stage 02 layers the simulation rules on top of the Stage 00 sandbox. This build introduces the shared state model, stamina management tied to the dorm, true worker pathing (wood house → MCS runs and on-site construction), plus brighter interaction cues and coffee boosts. Use this checklist to validate the logic and capture balancing notes before we move forward.

## 1. Launch the build
1. Open `stages/stage-02-model-logic/index.html` in a desktop browser (Chrome/Firefox).
2. Ensure the 1140×600 canvas and the control panel are both visible without scrolling.

## 2. Baseline sanity check
- Confirm the HUD shows Floor **1**, Wood Stock `2/10`, Progress `0%`, and Total Time `00:00` on load.
- Toggle Pause, Speed, and Contrast to make sure the new state timer respects pausing and the speed button now cycles through 0.5× → 1× → 2× → 3× → 4× → 8× → 16×.
- Scan the playfield and confirm ponds and rock clusters avoid hugging the canvas edge or the top-left corners of any functional buildings.
- Confirm the MCS, dorm, wood house, and Starbucks all spawn with a tile of breathing room between their walls, the canvas edge, and any obstacle clusters.

## 3. Inspect the state-driven HUD
- Walk around for ~10 seconds at different speeds and confirm Total Time advances proportionally to the selected multiplier.
- Click **Builder** once so the button label shows `build (x.x)` and confirm the wood bar immediately reserves the full requirement (`0/10` on floor 1).
- Let construction finish; Floor should advance to **2**, Wood Stock should jump to `0/15`, and the progress bar should reset.
- While construction runs, the progress bar should fill at a calmer pace (~1.5× longer than before) to reflect the slower on-site work.

## 4. Worker orders & pathing
- Set **Builder** to build. Watch them jog from their current spot to the highlighted edge of the MCS zone, snap beside it, and only then begin filling the progress bar.
- While building, verify the builder stays locked beside the site (no wandering) and the status card above their head shows `build · x.x/5`.
- While they travel, make sure they snake around rocks/ponds instead of getting stuck — the new pathfinding should re-route around obstacles every time.
- Toggle the Builder back to idle and confirm they resume slow wandering with a single hop animation.
- Let a build finish while the builder has less than 2.5 stamina left; they should automatically walk to the dorm and vanish until fully recovered.

## 5. Delivery runs & rest cycle
- Assign **Delivery** to deliver. They should march to the wood house, pause briefly to load, and then hike back to the MCS edge before the wood bar increases.
- Watch stamina: each trip should shave a slightly larger chunk (~0.5) so they still make multiple deliveries before tiring.
- Let either worker drain stamina to `0`. They should immediately path to the dorm, fade out for an extended breather, then reappear beside the dorm once fully recovered (no manual orders required).

## 6. Coffee perk flow
- Grab a drink from Starbucks with **Space** and confirm the bright “LATTE” badge hovers above the player.
- Deliver it to a resting worker: they should pop back out of the dorm instantly, with stamina topped up and their button label back to `idle (5.0)`.
- Attempt to grab another drink while holding one to see the "hands full" warning.

## 7. Interaction cues & collisions
- Stand near each landmark (MCS, wood house, Starbucks, dorm) and press **Space** to read the contextual description in the brighter bubble.
- Hover near a worker and press **Space** to check their stamina readout; confirm invisible/resting workers cannot be targeted.
- Ensure workers still block player movement while active, yet players can slide around obstacles and ponds retain their blue tint variety.

## 8. Record feedback
Capture any observations about:
- Formula tuning (wood requirement feels too high/low, stamina drain rates, delivery cadence, etc.).
- UX clarity (button labels, HUD readouts, coffee flow messaging).
- Bugs or oddities with timers, collisions, or state resets between floors.

Drop your notes during the Stage 02 review so we can tune the systems before automation work begins.
