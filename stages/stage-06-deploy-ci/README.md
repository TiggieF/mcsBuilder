# Stage 06 — Deploy & CI Ready Build

The final stage packages the mcsBuilder prototype into a single self-contained HTML file.
It keeps the UI that evolved through the earlier stages (HUD, playfield canvas, control
panel, win overlay, worker FSM log) while cleaning the logic and removing debug-only
constructs. All CSS and JavaScript are inline so the submission can open offline with no
external dependencies.

## What's included
- `mcsBuilder_final.html` — playable build with inline assets, metadata, and comments that preserves the Stage 04 UI + FSM layout.
- Worker finite state machines for the Builder and Delivery specialists.
- Canvas renderer that visualizes the growing tower and worker movements.
- Accessibility improvements such as high-contrast mode, semantic controls, and live
  status regions.

## How to run
Open `mcsBuilder_final.html` in any modern browser. No build process or web server is
required.
