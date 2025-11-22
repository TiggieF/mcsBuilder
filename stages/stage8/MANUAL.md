# mcsBuilder Stage 08 Manual

## New features in this stage
- **Snow weather system** with 300–500 drifting particles, a frosty overlay, and light caps on obstacle tops.
- **Snow gameplay modifiers**: movement ×0.7 (30% slower), build time ×1.1, and fetch/drop time ×1.1 whenever snow is active.
- **Predictable snow cadence**: storms occur every 10 in-game minutes and last at least 2 minutes; a “SNOW!” head bubble appears when they start.
- **Audio overhaul**: background music with spatial SFX for fetch, delivery, coffee, Red Bull, UI clicks, and an optional build hammer loop; compact sliders control loudness.
- **Denser terrain**: roughly 15% more rocks and ponds compared to Stage 07 while keeping paths open.

## How to test snow effects
1. Start the stage and let the timer reach 10:00; a snow banner, ❄️ HUD icon, and “SNOW!” head bubble above the player should appear together.
2. Observe the translucent overlay, falling particles, and thin snow lines on obstacle tops throughout the storm.
3. After at least 2 minutes of snow, wait for the banner/icon to hide; the next storm should arrive 10 minutes after the previous one ends.

## Confirming snow modifiers
- **Movement slowdown (30%)**: walk before snow to gauge normal speed, then keep moving after “SNOW!” appears; both player and workers should clearly move slower (≈70% of normal). Confirm full speed returns once snow clears.
- **Build slowdown (10% longer)**: assign the Builder to an in-progress floor. While snowing, the build bar fills noticeably slower; after snow stops, progress resumes at the faster baseline.
- **Fetch slowdown (10% longer)**: order Delivery to Fetch just before snow starts. Compare pickup/drop timings during the snow window to a clear-weather run; the snowy run should take slightly longer, then normalize afterward.

## How to test each sound effect
- **Fetch**: click **Fetch** for Delivery; listen for the pickup chime at the depot.
- **Deliver**: when Delivery drops at the MCS, the delivery success jingle plays.
- **Coffee**: press **Space** at Starbucks to pick up coffee, then hand it to a worker; the coffee cue plays on pickup/delivery.
- **Red Bull**: collect a Red Bull tile; the energy sting plays as the buff begins.
- **UI click**: press Pause/Resume, Speed, or any worker action; each click emits the UI sound.
- **Build hammer (optional)**: while the Builder is actively constructing, a soft hammer loop plays; it should quiet down when they stop.

## Volume sliders
- Use the compact **Master**, **Music**, and **SFX** sliders (no numeric readout) to adjust loudness; moving any slider immediately updates the mix.
- The background track pauses as soon as you pause the game and resumes when you unpause. Winning or restarting stops it; restarting begins it again.

## Snow HUD confirmation
- When snow begins, the HUD weather card highlights the **❄️** icon, the label reads “Snowing,” the “SNOW!” head bubble appears above the player, and the “Snow Active” banner shows.
- When snow stops, the ❄️ fades out, the label returns to “Clear Skies,” and the banner hides; the head bubble also clears after its brief display.
