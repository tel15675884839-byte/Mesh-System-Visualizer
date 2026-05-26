# Phase 2: 3D Simulation Buttons

## Scope

Move the useful simulation controls into the 3D view as compact buttons, remove redundant right-side simulation UI, simplify reset behavior, and show delayed sounder countdowns in the 3D scene.

## Tasks

- [x] Remove the right-click "locate in tree" action from 2D/3D device context menus.
- [x] Replace the full 3D `SimulationPanel` with compact EVACUATE, BUZZER SILENCE, and RESET buttons.
- [x] Enter simulation mode automatically while the 3D view is mounted.
- [x] Make RESET restore the initial normal simulation state directly.
- [x] Show remaining delay seconds above delayed sounder icons, and start sounder animation only after the delay finishes.
- [x] Run light focused tests for the migrated behavior.

## Out Of Scope

- Device property diff presentation.
- Full regression, packaging, or deep browser matrix testing.

## Light Verification

- `npm run test -- src/renderer/src/domain/fire/__tests__/appRightPanelOverlay.test.ts src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`
- `npm run typecheck:web`
- `npx eslint` on the touched source and test files
- `http://localhost:5173/viewer3d-check.html` reported 3 simulation action buttons, no `.viewer-simulation-panel`, rendered canvas, and `viewer3d-check-report[data-ok="true"]`.
- Follow-up countdown fix: `Viewer3D` now owns the simulation tick interval while mounted; focused tests/typecheck pass, and the browser harness visually showed delayed labels decreasing instead of staying at `60s`.
