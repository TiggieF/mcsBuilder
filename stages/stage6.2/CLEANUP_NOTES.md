# Candidate Functions for Removal

The following helpers seem to add complexity without contributing to the core builder gameplay loop. Removing them (and their assets) would simplify the stage considerably.

## Rock/Pond Generation Pipeline
- `computeRockForbiddenCells` (main.js, around line 124)
- `generateRocks` (main.js, around line 781)
- `buildRockTiles` (main.js, around line 931)
- `renderRocks` (main.js, around line 1685)
- `createRockPattern` and `createWaterPattern` (main.js texture helpers)

These functions and their associated data add decorative obstacles (rocks, ponds, fountains) that consume dozens of lines and multiple passes over the grid. If environmental obstacles are no longer desired, the entire pipeline—starting from forbidden-cell computation, random placement, tile generation, and final rendering—can be safely deleted along with their entries in the `textures` cache.

## Decorative Texture Helpers
- `createBrickPattern`
- `createStripedPattern`

If the UI is moving toward a flatter aesthetic, these pattern generators could also be removed. Static colors would drastically shrink the texture bootstrapping section and reduce the number of offscreen canvas allocations.

Before deleting any of these helpers, confirm that no other module depends on the exported textures. In this stage, they are scoped locally, so trimming them should only require removing their references from the drawing routines.
