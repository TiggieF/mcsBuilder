# mcsBuilder Stage 07 Manual

## New features in this stage
- **Three material types**: Concrete (floors 1–3), Wood (4–7), and Glass (8–10) with automatic detection per floor.
- **Material depots**: Dedicated 2×2 depots for each material (grey concrete, brown wood, cyan glass) with one-tile pickup spots.
- **Dynamic stock system**: MCS stock tracks each material independently, allows overflow, and blocks building until the required material count is available.
- **Red Bull power-up**: Spawns every 5 in-game minutes; boosts player/worker speed and build speed for 60 seconds.
- **HUD upgrades**: Material icon plus stored/needed counts for the active material, plus worker floating state labels above each worker.
- **Obstacle tuning**: Reduced obstacle density (~20–25% fewer) and depots keep a 1-tile clearance from obstacles.

## How to test the stage
1. **Material progression**
   - Start a new run and note the HUD material card shows **Concrete**.
   - Build through floor 3; when floor 4 starts, HUD should flip to **Wood**, and to **Glass** at floor 8.
2. **Depot spacing**
   - Inspect the map at start: each depot is a 2×2 block not touching the boundary or obstacles. Rocks/ponds should not be within 1 tile of any depot.
3. **Worker fetch logic**
   - Assign Delivery to fetch. Confirm they walk to the depot that matches the current floor material and deliver 1 unit at a time to the MCS.
   - When stock is full for the floor, Delivery idles instead of over-fetching.
4. **Player material handling**
   - Walk into a depot, press **Space** to pick up one unit. Carry it to the MCS and press **Space** to deposit; stock should increment even if it exceeds the current need.
5. **Red Bull power-up**
   - Let the in-game clock reach 5:00 (speed-up is allowed). A blue Red Bull tile should spawn on the map.
   - Pick it up with the player: speeds jump (player ×2, workers ×1.3) and build time shortens (×0.9) for 60s. Timer refreshes if collected again.
6. **HUD and labels**
   - Verify the HUD shows stored vs. needed counts for the active material and updates when you deposit or spend materials.
   - Floating labels above workers should read states such as "Fetching Concrete", "Delivering Material", "Building", or "Resting" and update as orders change.

## Gameplay & interaction notes
- **Controls**: WASD to move, **Space** to interact, Pause/Speed buttons, and worker card buttons to issue Build/Fetch/Rest/Cancel.
- **Materials & depots**: Only one material unit can be carried at a time (player or Delivery). Depots have unlimited supply; collect by standing inside and pressing **Space**.
- **MCS stock**: Each build consumes the full requirement for the active floor’s material. Stock can exceed the requirement and is kept per material type.
- **Worker behaviour**:
  - Delivery fetches only the required material for the current floor and carries one unit per trip.
  - Builder won’t start until enough of the required material is stocked; stamina is consumed on build start.
  - Rest sends workers to the dorm; they remain hidden while recovering.
- **Red Bull**: Only the player can collect it. Buff expires automatically after 60s or on restart; future spawns are scheduled every 300s of in-game time.
- **Obstacles**: Rocks/ponds are sparser than previous stages and never sit within 1 tile of any depot.

## Known limitations
- No audio, snow, or accident/medal systems are present in this stage (those arrive in later stages).
- Red Bull spawns at open walkable tiles but does not avoid proximity to workers or the player.
