# mcsBuilder Stage 08 Manual

## New features in this stage
- **Snow weather system** with 300–500 particles, a frosty overlay, and gentle wind sway plus light accumulation on obstacle tops.
- **Snow gameplay modifiers**: player and worker movement ×0.9, build time ×1.1, and fetch/drop time ×1.1 while snow is active.
- **Dynamic snow timing**: storms start immediately or randomly between 3–7 minutes, last at least 2 minutes, and fade out with a HUD banner and ❄️ icon.
- **Audio overhaul**: background music and spatial SFX for fetch, delivery, coffee, Red Bull, UI clicks, and an optional build hammer loop; master/music/SFX sliders with mute toggles.
- **Denser terrain**: roughly 10% more rocks and ponds compared to Stage 07 while keeping paths open.

## How to test snow effects
1. Start the stage and wait for the snow banner or ❄️ HUD icon. Snow may begin instantly or within 3–7 in-game minutes.
2. Watch for the translucent white overlay, drifting flakes, and light snow caps on obstacles.
3. After at least two minutes, snow will fade and the banner/icon will hide until the next storm window.

## Confirming snow modifiers
- **Movement slowdown**: begin walking before snow, note normal speed, then compare once the snow icon shows; the player and workers should move ~10% slower.
- **Build slowdown**: order the Builder to work on an in-progress floor. During snow, the build bar fills more slowly (10% longer). When snow ends, speed returns.
- **Fetch slowdown**: send Delivery to fetch. Loading and drop-off animations should take roughly 10% longer during snow, then normalize afterward.

## How to test each sound effect
- **Fetch**: order Delivery to Fetch; the pickup chime plays when they arrive at the depot.
- **Deliver**: when Delivery drops materials at the MCS, the delivery success jingle plays.
- **Coffee**: press **Space** at Starbucks to pick up coffee, or hand coffee to workers—the coffee cue plays.
- **Red Bull**: collect a Red Bull tile; the energy sting plays as the buff starts.
- **UI click**: press Pause/Speed or any worker action button to hear the UI click.
- **Build hammer (optional)**: while the Builder is actively constructing, a soft rhythmic tap loops every few seconds.

## Volume sliders and mute toggles
- Use the **Master**, **Music**, and **SFX** sliders in the control panel to change levels; labels show the percentage.
- **Mute All** silences everything; **Mute Music** or **Mute SFX** target just that channel. Adjusting any slider immediately updates the mix and background music.

## Snow HUD confirmation
- When snow begins, the HUD weather card gains a glowing **❄️** and the label switches to “Snowing,” and a floating “Snow Active” banner appears.
- When snow stops, the ❄️ fades out, the label returns to “Clear Skies,” and the banner hides.
