# Stage 09 — Material Drop Accidents + Medals + Camera Shake

## Overview
This final stage adds the delivery accident mechanic, medal thresholds, camera shake, and the start menu with difficulty selector.

---

# 1. DELIVERY ACCIDENT SYSTEM

## 1.1 Chance Rules
While Fetcher is carrying **any material**, every tile moved has:
- **10% (0.1)** chance to DROP MATERIAL

## 1.2 Effects on Drop
- Material is **lost permanently**.
- Worker plays “Oops!” bubble for 1 second.
- Worker stops and enters “Awaiting Instruction” or returns automatically after 3 seconds.
- Play SFX: `oops.wav`
- Trigger **camera shake** (see section 3).

---

# 2. MEDAL SYSTEM

## Win is reaching Floor 10.  
Award medals based on total time:

| Medal | Time Limit | HUD Colour |
|--------|-------------|-------------|
| Gold | ≤ **800mins** | Gold (#FFD700) |
| Silver | ≤ **900mins** | Silver (#C0C0C0) |
| Bronze | ≤ **1000mins** | Bronze (#CD7F32) |
| Fail | > 5 hours | Red |

### Required UI:
- Medal popup panel
- Final time display
- Animated medal drop
- Colour-coded result

---

# 3. CAMERA SHAKE EFFECT

Trigger when:
- Material drop event occurs

### Shake Parameters:
duration: 0.4s
magnitude: 4px (easy:2, normal:4, hard:6)
frequency: 30 Hz

markdown
Copy code

Implement shake as camera offset that decays over time.

---

# 4. START MENU

## Elements
- Game Title “MCS Builder”
- Difficulty Options (Easy / Normal / Hard)
- Start Button
- Controls/Instructions Button
- Version label

## Difficulty Modifiers
### Easy:
- Speed ×1.1  
- Build time ×0.9  
- Drop chance = 0  
- Snow slowdown = −5%

### Normal:
- Base rules

### Hard:
- Speed ×0.9  
- Build time ×1.1  
- Drop chance ×1.5 (→ 15%)  
- Snow slowdown = −15%  
- Red Bull spawns every 7 minutes

---

# 5. Acceptance Criteria
- Drops occur properly per tile.
- Camera shake works.
- Medal logic correctly identifies thresholds.
- Start menu loads before simulation.
- Difficulty modifies gameplay variables correctly.