# Feature Specification: Core Gameplay Simulation

**Feature Branch**: `[001-core-gameplay]`
**Created**: 2025-11-10
**Status**: Draft
**Input**: Synthesised from `/docs/product.md`, `/docs/architecture.md`, and `/docs/stages/*`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Finish ten floors efficiently (Priority: P1)
The player coordinates workers and personal actions to raise the MCS Building to Floor 10 using only wood deliveries and builder effort.

**Why this priority**: Completing construction is the core loop that proves the simulation works.

**Independent Test**: From a fresh load of `stages/stage-06-deploy-ci/mcsBuilder_final.html`, play until Floor 10 completes while recording total time and verifying no soft locks occur.

**Acceptance Scenarios**:

1. **Given** a new game on Floor 1 with stock at zero, **When** the player delivers enough wood and orders the Builder to start, **Then** floor progress begins and consumes the correct wood amount.
2. **Given** floor progress is paused because stock ran out, **When** the Delivery worker returns with additional wood, **Then** the Builder resumes automatically once stock meets the requirement.

---

### User Story 2 - Sustain the supply chain (Priority: P2)
The player maintains worker stamina, coffee, and wood flow so deliveries and builds continue without manual micromanagement.

**Why this priority**: Without a reliable supply chain the core loop stalls, breaking pacing and analytics.

**Independent Test**: Intentionally drain worker stamina to zero, then use coffee service and rest orders to restore both workers and resume operations.

**Acceptance Scenarios**:

1. **Given** both workers are below stamina 3, **When** the player serves coffee at the MCS coffee tile, **Then** both workers instantly return to stamina 5 and their current orders resume.
2. **Given** Delivery is ordered to fetch wood with full stamina, **When** it encounters an occupied tile, **Then** the agent waits/replans and still completes the delivery without clipping through obstacles.

---

### User Story 3 - Monitor and tune operations (Priority: P3)
The player uses UI panels, HUD, and analytics to understand system state and adjust orders or toggles without ambiguity.

**Why this priority**: Clear feedback enables graders to validate behaviour and ensure accessibility requirements are met.

**Independent Test**: Toggle speed and contrast controls while watching HUD values, verifying analytics counters update after each floor.

**Acceptance Scenarios**:

1. **Given** the player toggles High Contrast mode, **When** the HUD and panel update, **Then** all text remains legible and the toggle state persists until changed again.
2. **Given** Floor 5 completes, **When** the analytics summary is displayed, **Then** total time, wood consumed, and worker rest time reflect recorded values within ±1 second.

---

### Edge Cases
- Wood stock hits zero while Builder is mid-session: Builder pauses without consuming extra stamina and surfaces “no wood” feedback.
- Delivery path is blocked by both workers simultaneously: A* replans or waits without teleporting or overlapping tiles.
- Player holds an item when serving coffee: Serving consumes the coffee and leaves the player empty-handed; no duplicate buffs occur.
- Game is left idle for several minutes: Simulation remains deterministic without drifting timers or unbounded loops.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Game MUST load from `/stages/stage-06-deploy-ci/mcsBuilder_final.html` (and earlier stage HTML files) without a build step.
- **FR-002**: Grid MUST be 30×30 tiles with solid borders at x∈{0,29}, y∈{0,29}; agents obey collision rules.
- **FR-003**: Player MUST move via WASD, interact with Space (0.5 s cooldown), and carry at most one item (wood or coffee).
- **FR-004**: Delivery worker MUST fetch wood from (4,4) and deposit at (10,10); Builder MUST build from (11,10) consuming stamina −3 per session and −0.5 per delivery trip.
- **FR-005**: Coffee service at (12,10) MUST restore both workers to stamina 5 instantly without exceeding max.
- **FR-006**: HUD MUST display wood stock, wood required, floor number, floor progress %, total time, and worker states matching real-time data.
- **FR-007**: High-contrast, speed (0.5×/1×/1.5×/2×), and sound toggles MUST remain functional after new features are added.
- **FR-008**: Analytics introduced in Stage 05 MUST capture total build time, wood usage, and worker rest time and present them on completion.

### Key Entities *(include if feature involves data)*

- **Player**: `{position, velocity, heldItem, interactCooldown}`
- **Worker**: `{id, role, stamina, state, assignedOrder, path}` with deterministic FSM transitions.
- **WorldTile**: `{x, y, zone, walkable, occupantId}` representing grid occupancy and interaction payloads.
- **FloorProgress**: `{currentFloor, requiredWood, deliveredWood, buildTimeAccumulated}` controlling progression logic.
- **Telemetry**: `{totalTime, woodConsumed, restTimeByWorker}` captured for analytics screens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can complete Floor 10 within ≤15 minutes on mid-range hardware following README instructions.
- **SC-002**: Rendering loop maintains ≥30 FPS throughout a full run measured via browser dev tools.
- **SC-003**: Manual reviewers can execute all acceptance scenarios using documented controls without encountering blockers.
- **SC-004**: Analytics summary reports totals with an error margin ≤1 unit (1 second, 1 wood) when compared to manual counts.
