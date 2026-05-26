# Phase One Design Review

Classifier: APP UI.

Screenshots:

- Desktop 2D: `.codex-dev-run/phase1-planner.png`
- Desktop 3D after polish: `.codex-dev-run/phase1-viewer3d-polished.png`
- Mobile 3D after polish: `.codex-dev-run/phase1-viewer3d-mobile-polished.png`

## Findings

1. I noticed the 2D planner no longer has the right-side Properties / Output Groups / Simulation panel or panel toggle. This matches the phase-one direction and gives the canvas the full remaining workspace.
   - Status: verified.

2. I noticed the 3D Simulation panel initially overflowed below the 3D viewport because it inherited `height: 100%` from `SimulationPanel`.
   - Fix: override embedded panel height in `Viewer3D.css` so top/bottom positioning controls the size.
   - Status: fixed and verified.

3. I noticed the 3D drawing controls showed the raw i18n key `FIRE.VIEWER3D.DRAWINGCONTROL`.
   - Fix: add `fire.viewer3d.drawingControl` in English and Chinese dictionaries.
   - Status: fixed and verified.

4. I wondered if the right-side Simulation panel would cover too much of the 3D canvas on narrow screens.
   - Check: 390x720 viewport keeps the panel docked at the bottom, leaves upper canvas visible, and keeps the panel within the viewport.
   - Status: verified.

## Quick Wins Applied

- Docked the 3D Simulation panel inside the 3D viewport.
- Removed the old right panel and property/output tabs from the app shell.
- Removed the deferred property entry from the device context menu.
- Fixed the 3D panel height overflow.
- Fixed the visible drawing-control translation key.

## Score

- Baseline design score: 7.2/10
- Final design score: 8.0/10
- AI slop score: low, no new marketing-style card grids, decorative blobs, or gradient noise introduced.
