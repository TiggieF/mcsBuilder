# Stage 07 — New Materials System + Depots + Red Bull Upgrade

## Overview
This stage adds three new construction materials (Concrete, Wood, Glass), three new depots, and a new player-only power-up: Red Bull. No audio or snow is implemented in this stage. All mechanics implemented here must be fully compatible with later Stage 08 (snow + audio) and Stage 09 (drop accidents + medals).

---

# 1. MATERIAL TYPES

## 1.1 Material Rules
Implement 3 materials with strict floor‐based progression:

| Floors | Material Type |
|--------|---------------|
| 1–3    | Concrete      |
| 4–7    | Wood          |
| 8–10   | Glass         |

The MCS build logic must automatically detect required material based on current floor.

### Requirements:
- `world.currentMaterial` always equals the correct material string: `"concrete"`, `"wood"`, `"glass"`.
- The Builder may only build if the MCS has ≥ required material units.
- Fetcher must fetch only the required material type for the current floor.
- Material amounts stored at the MCS accumulate; overflow allowed.

---

# 2. DEPOTS (CONCRETE / WOOD / GLASS)

## 2.1 Depot Layout
Each depot is:
- **2×2** size  
- One designated pickup tile  
- Colours:
  - Concrete: **grey** (#9c9c9c)
  - Wood: **brown**
  - Glass: **light blue/cyan**

## 2.2 Spawn Rules
- Depots must NOT spawn touching the map boundary.
- Depots must NOT spawn within **1 tile of any obstacle**.
- No obstacle may spawn within **1 tile** of any depot.

## 2.3 Depot Mechanics
All depots behave identically:
- Unlimited supply of their respective material.
- Player may carry only **1 unit** at a time.
- Fetcher may carry only **1 unit** at a time.

Implement a single generic depot class with colour/material overrides.

---

# 3. OBSTACLE ADJUSTMENTS
- Reduce stone obstacle density by **20%**
- Reduce wooden obstacle density by **25%**

Ensure BFS/A* pathfinding treats these as non-walkable.

---

# 4. RED BULL POWER-UP

## 4.1 Spawn Logic
- Spawns every **5 minutes** (300 seconds) of in-game time.
- Only **one active Red Bull tile** allowed at once.
- Spawn Red Bull on allowed event tiles, never overlapping obstacles or depots.

## 4.2 Tile Appearance
- Size: **1×1**
- Colour: **blue tile** with optional lightning bolt icon

## 4.3 Pickup Rules
- Only the **player** can pick up Red Bull.
- On pickup:
  - Immediately remove tile.
  - Apply buff for **60 seconds**.
  - Buff does **not stack**, but refreshes timer if picked again.

## 4.4 Buff Effects
- Player speed × **2.0**
- Workers (Builder, Fetcher) speed × **1.3**
- Build time multiplier × **0.9** (10% faster build)

Implement buff as:
world.redBullBuff = { active: true, expiresAt: timestamp }

yaml
Copy code

Agents should read modifiers dynamically.

---

# 5. HUD CHANGES
Add these new HUD elements:

### 5.1 Material Icon + Counter
- Show icon representing the current required material.
- Show:
  - Required units for next floor
  - Stored units at MCS

### 5.2 Worker State Indicators (floating text)
Add floating text above workers indicating state:
- Fetching Concrete
- Fetching Wood
- Fetching Glass
- Delivering Material
- Building
- Resting
- Returning
- Idle

States update every tick.

---

# 6. Acceptance Criteria (Codex Must Pass)
- Materials change correctly based on floor number.
- Workers fetch correct material only.
- Depots generate correctly with spacing rules.
- Red Bull spawns every 5 minutes → despawns on pickup.
- Buff logic works and expires correctly.
- HUD updates material icons and worker state text.
- No sound, no snow, no accidents yet.