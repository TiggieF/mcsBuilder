# Stage 04 — UI & FSM Playtest Guide

Stage 04 builds on the Stage 02 sandbox by giving you a richer command panel, labelled worker actions, and a visible finite state machine (FSM) log. Use this checklist to validate the upgraded controls, confirm HUD accuracy, and verify that state transitions stay coherent while the crews roam the pixel map.

## 1. Launch the build
1. Open `stages/stage-04-ui-fsm/index.html` in a desktop browser (Chrome/Firefox).
2. Ensure the 1140×600 canvas sits alongside the control panel without scrolling.

## 2. Panel and HUD shakedown
- The HUD should still read Floor **1**, Wood `2/10`, Progress `0%`, Time `00:00` on load.
- Click the Speed button to cycle through `0.5× → 1× → 2× → 3× → 4× → 8× → 16×`, confirming the timer and wandering animations accelerate accordingly.
- Inspect both worker cards: the order chip should read **Idle**, stamina should show `5.0 / 5`, and the state text should say `Idle`.
- Watch the FSM log (bottom of the panel) to confirm it starts empty and populates as soon as you issue commands.

## 3. Builder command flow
- Press **Build** on the Builder card. Confirm the order chip switches to **Build**, the button highlights, and the FSM log records an entry like `Idle —build→ Heading To Site`.
- Follow the builder to the MCS edge; once aligned, the on-screen label above their head should change to `Building · x.x/5` (using the formatted state name).
- Let the floor finish while the builder has <2.5 stamina. They should automatically walk to the dorm, disappear to rest, and the FSM log should show `Building —complete→ Idle` followed by `Heading To Dorm`, `Resting`, and `Recovered` entries.
- Tap **Cancel** mid-walk to make sure the builder stops, the card shows **Idle**, and the FSM log captures the cancellation.

## 4. Delivery fetch loop
- Hit **Fetch** on the Delivery card. Verify the chip reads **Fetch**, the FSM log records a transition into `Heading To Wood`, and the worker routes around obstacles correctly.
- Observe the loading pause at the wood house, the march back to MCS, and the delivery animation—each phase should generate log entries (`arriveSource`, `loadComplete`, `arriveSite`, `dropComplete`).
- Run the courier until stamina hits zero. They should immediately head for the dorm without manual input, log the rest transitions, and resume wandering once recovered.
- Press **Rest** manually to ensure the courier breaks off their route, heads to the beds, and the state log mirrors the detour.

## 5. Coffee & stamina perks
- Grab a latte from Starbucks (SPACE) and confirm the bold `LATTE` tag sits above the player.
- Deliver the drink to a resting worker. They should reappear instantly with stamina restored, their card switching back to **Idle**, and the log noting a `Recovered` transition.
- Try to pick up another drink while carrying one to confirm the "hands full" bubble still appears.

## 6. Visual & collision sanity
- Walk the player around ponds, rocks, and buildings to ensure collisions remain solid and obstacles still keep a tile of spacing from landmarks and canvas edges.
- Brush past workers while they are active; you should not be able to walk through them.
- Toggle Contrast mode to verify the UI remains legible in both themes.

## 7. Capture feedback
Record any notes about:
- FSM accuracy (unexpected transitions, missing log entries, or stale state labels).
- Command responsiveness (buttons not highlighting, incorrect chips, or late reactions).
- Balance tuning for stamina, build pace, or wood throughput under the higher speed multipliers.

Drop your findings with the Stage 04 review so we can iterate on the control surface before automation logic lands.
