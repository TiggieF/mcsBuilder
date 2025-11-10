<!--
Sync Impact Report
- Version change: 0.0.0 → 1.0.0
- Modified principles: Introduced five project principles
- Added sections: Additional Constraints, Development Workflow, Governance refinements
- Removed sections: None
- Templates requiring updates: ✅ .specify/templates/spec-template.md, ✅ .specify/templates/plan-template.md, ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: None
-->
# mcsBuilder Constitution

## Core Principles

### I. Stage-Gated Delivery
Every commit must implement exactly **one published stage** from `docs/stages/`, keeping prior stages runnable. Advancing to the next stage requires the previous stage’s README instructions to be satisfied and logged in `/logs/`.

### II. Browser-First Implementation
The project ships as static HTML/JS/CSS assets with **no build tooling or external dependencies**. Code must run offline in modern Chromium- and Gecko-based browsers and load via `file://` without warnings.

### III. Deterministic Simulation & Telemetry
Autonomous worker logic is deterministic for a fixed seed: FSM transitions, A* paths, and stamina changes must yield identical results between runs. Starting Stage 05, the game records total build time, wood usage, and worker rest time for analytics.

### IV. Accessibility & Clarity
All UI must ship with keyboard control, high-contrast palette, readable fonts, and status messaging mirroring HUD values. Accessibility toggles (speed, contrast, sound) remain available every stage once introduced.

### V. Documentation & Approval Discipline
Specs, plans, and tasks precede implementation. Each stage README documents manual verification steps; changes require updated docs before coding. Pull requests include instructions for reviewers to validate gameplay.

## Delivery Constraints
- **Performance**: Maintain ≥30 FPS at 900×900 canvas resolution on mid-range laptops.
- **Scope**: Single-player management sim; two workers (Builder, Delivery) only.
- **Assets**: Use local pixel art or generated placeholders; no external asset pipelines.
- **Persistency**: No save/load or backend services.

## Development Workflow
1. Draft or amend the feature spec under `spec/specs/` using `/speckit.specify` flow.
2. Validate against the checklist in `checklists/requirements.md`.
3. Produce plan (`/speckit.plan`) capturing technical context, stage alignment, and file layout.
4. Enumerate tasks with `/speckit.tasks`, grouped by user story.
5. Implement code for a single stage; ensure manual approval before moving forward.

## Governance
- The constitution supersedes ad-hoc practices. Amendments require documentation updates plus reviewer approval.
- Version increments follow SemVer (MAJOR incompatible change, MINOR principle addition, PATCH clarifications).
- Compliance is verified during PR review; checklist breaches block merges.
- Runtime development guidance must align with `/docs` and this constitution.

**Version**: 1.0.0 | **Ratified**: 2025-11-10 | **Last Amended**: 2025-11-10
