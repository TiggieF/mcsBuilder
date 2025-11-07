# Builders of the MCS Building — Product Requirements Document (PRD)

## 1) Purpose & Learning Alignment
This coursework implements a **2D, top-down management sim** in JavaScript/Canvas called **mcsBuilder** (Builders of the MCS Building). It demonstrates:
- Decoupled architecture (logic vs UI vs rendering).
- Autonomous object behaviours (FSM + A* pathfinding).
- Deep “machinations” via rising costs/times and operational constraints.
- Accessibility (game speed, high-contrast) and clear UI feedback.
- Tight documentation for report/videos/diagrams delivery.

## 2) Player Fantasy
You are the site manager building Durham’s **MCS Building**. Coordinate two workers (one Builder, one Delivery) and personally fetch/deliver **wood** and **coffee** to finish **10 floors** as fast as possible.

## 3) World & Layout
- Grid: **30×30** tiles; tiles render **10 px** scaled ×3 (canvas 900×900).
- Zones (inclusive ranges):
  - **MCS**: (10..19, 10..19)
    - Drop-off: (10,10)
    - Build Pad: (11,10)
    - Coffee Serve: (12,10)
  - **Wood house (2×2)**: (3..4, 3..4), pickup at (4,4)
  - **Starbucks (2×2)**: (21..22, 12..13), pickup at (21,13)
  - **Beds** (two): (8,12) and (9,12) (W1/W2 dedicated)
- Map borders x∈{0,29}, y∈{0,29} are solid.
- Interiors are **non-walkable**; only entry tiles are interactable.

## 4) Controls (Player)
- **WASD**: move (4-directional; no diagonal)
- **Space**: context action with **0.5 s cooldown**
  - At wood pickup (empty hands): take 1 wood (**1 s**)
  - At Starbucks pickup (empty hands): take coffee (**1 s**)
  - At MCS drop (holding wood): deposit (**0.5 s**) → stock++
  - At MCS coffee tile (holding coffee): refill both workers to **stamina=5**
- Player holds **max 1 item** (“Wood” or “Coffee”), has **no stamina system**, **cannot build**, and **moves faster** than workers.

## 5) Workers, Roles, Orders
- **W1 (Builder)**: actions → Build / Rest / Cancel
- **W2 (Delivery)**: actions → Fetch Wood / Rest / Cancel
- One active order per worker (new order overrides current). On Cancel, worker heads to its own bed; on full stamina, they wander slowly.
- Idle behaviour: random walk—1 tile every 2 s at slow speed.

## 6) Stamina System (Workers)
- Max: **5**
- **Rest**: linear 0→5 in **20 s** (0.25 per second)
- **Delivery trip** (pickup→return→drop completes): **−0.5 stamina** (applied on drop)
- **Build start** (each new session): **−3 stamina**
- **Movement cost**: 0
- If stamina < required for next step → **auto Rest**
- **Coffee** (served by player at MCS): instantly sets both to **5** (no storage/overfill)

## 7) A* Pathfinding & Collisions
- Grid **A*** (4-way, Manhattan).
- Replan if blocked and every 1 s while moving.
- **Grid occupancy** is exclusive; if next tile is occupied, wait 0.25 s then retry.
- Use AABB for draw ordering/debug overlays.

## 8) Economy & Scaling
- Floors **1..10**
- Wood needed: **W(n) = 10 + 5·(n−1)**
- Build time: **T(n) = 5 + 5·(n−1)** seconds
- **Auto-start**: if stock ≥ W(n) and W1 is ordered to Build (on pad), building starts.
- Only **one builder** on the pad. Progress accumulates; pauses if W1 rests; resumes on return (new −3 cost charged at each session start).
- Excess wood is stored and carries forward.
- If W1 is on pad but stock < W(n) → bubble “no wood” (2 s) then wait.

## 9) UI/Accessibility
- **Panel**
  - W1 card: state, stamina (0..5), inv, order; buttons: Build / Rest / Cancel
  - W2 card: state, stamina (0..5), inv, order; buttons: Fetch Wood / Rest / Cancel
  - Global: Pause/Resume, Speed (0.5×/1×/1.5×/2×), High Contrast, Sound On/Off
- **HUD**: Wood Stock, Wood Needed, Current Floor, Floor Progress %, Total Time
- **Overhead labels**: workers show `fetch/build/rest/idle` and `no wood`; player shows `Wood/Coffee`
- **Pixel style**: 10×10 tiles ×3 scale; **Press Start 2P** font
- **High-contrast** palette toggle

## 10) Win/Lose
- **Win**: Floor 10 complete → “Construction Complete” with **total time**, Restart button
- **Lose**: none; **no save**

## 11) Acceptance Criteria (Samples)
- A* respects solids and agent occupancy; replans on blocks.
- Builder cannot start without stock; bubble shown; waits.
- Stamina matches spec; rest is linear; resume charges −3 at each session start.
- UI reflects state accurately; contrast and speed toggles functional.
- Logic/UI/render decoupled (module boundaries respected).

## 12) Delivery & Submission
- Deliver code + README + **2-page report** + **two 1-min videos** + **two Machinations PNGs + URLs** as a single ZIP (<1 GB).


# Product Requirements Document (PRD) — mcsBuilder

## Game Concept
A 2D top-down building management game built in **vanilla JS + Canvas**.  
The player manages two AI workers (Builder, Delivery) to construct the **Durham MCS Building** floor by floor, with stamina, A* pathfinding, and resource loops.

---

## Player Role
- Move freely (WASD)
- Collect wood from a wood house and coffee from Starbucks
- Deliver items to MCS or serve coffee to workers

---

## Worker Roles
| Worker | Role | Abilities |
|---------|------|------------|
| W1 | Builder | Builds floors, rests, consumes stamina |
| W2 | Delivery | Fetches wood, rests, consumes stamina |

---

## Economy & Scaling
| Floor | Wood Needed | Build Time |
|--------|--------------|------------|
| 1 | 10 | 5s |
| n | 10 + 5*(n-1) | 5 + 5*(n-1)s |

---

## Game Rules
- Player carries 1 item (wood or coffee)
- Workers have stamina (max 5)
  - −0.5 per trip
  - −3 per build session
  - +0.25 per second during rest
- Coffee instantly restores both workers to 5
- Player has no stamina
- No lose condition; win when reaching Floor 10

---

## Accessibility
- Adjustable speed (0.5×–2×)
- High-contrast toggle
- Large pixel visuals (Press Start 2P font)

---

## Evaluation Criteria
- Technical structure (logic/UI/render separation)
- AI behaviour (FSM + A*)
- Dynamic resource loops
- Accessibility implementation
