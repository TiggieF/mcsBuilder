---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/spec/specs/[###-feature-name]/`
**Prerequisites**: `plan.md`, `spec.md`, `checklists/requirements.md`

**Tests**: Include manual validation steps from the spec. Add automated tests only when the feature explicitly requires them.

**Organization**: Tasks are grouped by user story so each slice can be implemented, reviewed, and approved independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Tasks that can run in parallel (different files, no dependency on order)
- **[Story]**: User story identifier (US1, US2, etc.)
- Always call out exact file paths inside the stage directory being modified

## Phase 0: Preflight (Shared Infrastructure)

- [ ] T000 Ensure `spec`, `plan`, and `checklist` are up to date and approved
- [ ] T001 Confirm target stage README lists validation steps; update if needed
- [ ] T002 [P] Snapshot previous stage HTML for reference

## Phase 1: Stage Shell & Assets

- [ ] T010 [US1] Duplicate latest stage HTML into `stages/[stage-name]/index.html`
- [ ] T011 [US1] Wire base canvas loop (60 Hz update, 30 FPS render) using vanilla JS
- [ ] T012 [P][US1] Import or generate sprites/assets required for this stage (store locally)
- [ ] T013 [US1] Update `stages/[stage-name]/README.md` with new controls/steps

## Phase 2: User Story 1 — [Title] (Priority: P1)

**Goal**: [Describe the critical gameplay slice]

### Validation
- [ ] T020 Define manual playtest steps matching the spec acceptance criteria in README

### Implementation
- [ ] T021 [US1] Implement core logic in `index.html` (or extracted JS modules if established)
- [ ] T022 [P][US1] Update HUD/panel bindings reflecting new state
- [ ] T023 [US1] Ensure deterministic behaviour (replay with identical inputs)

## Phase 3: User Story 2 — [Title] (Priority: P2)

**Goal**: [Describe supporting interaction]

- [ ] T030 [US2] Extend state objects / FSMs to cover new behaviour
- [ ] T031 [P][US2] Update collision/pathfinding rules if required
- [ ] T032 [US2] Surface accessibility or feedback changes in UI

## Phase 4: User Story 3 — [Title] (Priority: P3)

**Goal**: [Describe analytics/polish slice]

- [ ] T040 [US3] Capture analytics or timers per spec
- [ ] T041 [P][US3] Render visual/audio feedback for the new data
- [ ] T042 [US3] Document verification steps in README / docs

## Phase 5: Polish & Regression

- [ ] T050 Run through README validation end-to-end and log results in `/logs/`
- [ ] T051 [P] Confirm high-contrast, speed, and sound toggles still function
- [ ] T052 [P] Smoke-test earlier stages to ensure no regressions
- [ ] T053 Update `docs/stages/stage-plan.md` status if stage completes
- [ ] T054 Prepare summary + instructions for PR reviewers

> Remove unused sections if a feature contains fewer stories. Add new phases for additional stories following the same pattern.
