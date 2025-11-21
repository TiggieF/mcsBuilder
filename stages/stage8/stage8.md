# Stage 08 — Snow Weather System + Audio Integration

## Overview
Add environmental snow effects, snow gameplay modifiers, and integrate all sound effects. This stage adds no new materials, no accident system, and no medals (those are Stage 09).

---

# 1. SNOW WEATHER SYSTEM

## 1.1 Visual Snow
Implement a performant particle emitter:
- Maximum ~300–500 snow particles alive.
- White particles falling downward.
- Subtle wind sway (horizontal oscillation).
- Light white overlay (5–10% opacity).
- Optional accumulation at tile edges.

## 1.2 Snow Activation
Snow should begin:
- Automatically at game start **OR**
- Randomly between 3–7 minutes

Snow must last at least 2 minutes before switching off (can be optional).

---

# 2. GAMEPLAY EFFECTS UNDER SNOW

### While snow is active:
- Movement speed × **0.9** (−10%)
- Build time × **1.1** (+10%)
- Fetch time × **1.1** (+10%)

These must combine multiplicatively with Red Bull buff from Stage 07.

---

# 3. AUDIO SYSTEM

## 3.1 Required Inputs (YOU provide the files)
- `bgm.mp3` (normal background music)
- `fetch.wav`
- `deliverySuccess.wav`
- `coffeePickup.wav`
- `redbull.wav`
- `oops.wav` (used in Stage 09)
- `uiClick.wav`
- `buildHammer.wav` (optional: synthetic generator if not provided)

## 3.2 Sound Mechanics
Implement:
1. **Global Settings**
   - Master volume slider  
   - Music volume slider  
   - SFX volume slider  
   - Mute toggles

2. **Spatialisation (simple)**
   - Volume decreases with distance from camera center.

3. **Events**
   - On fetch: play `fetch.wav`
   - On delivery: play `deliverySuccess.wav`
   - On coffee pickup: play `coffeePickup.wav`
   - On Red Bull: play `redbull.wav`
   - On build tick: play `buildHammer.wav` (optional low-volume rhythmic loop)
   - On UI button: `uiClick.wav`

4. **Snow**
   - codex codes the snow effect

---

# 4. HUD IMPROVEMENTS
- Add Snow Icon (❄️) when snow is active.
- Show a “Snow Active” banner fade-in/out.

---

# 5. Acceptance Criteria
- Snow visually spawns and despawns.
- Speed and build modifiers apply correctly.
- All sound events play correctly with volume controls.
- HUD shows Snow icon when active.


All sound assets are in mp3 format and located inside /music/ folder:
- bgm.mp3
- fetch.mp3
- deliverySuccess.mp3
- coffee.mp3
- redbull.mp3
- uiclick.mp3
- oops.mp3
- buildingSound.mp3
