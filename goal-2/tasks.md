# Goal 2 Tasks

- [x] Task 1: EVACUATE sounder linkage and 3D flashing
  - Scope:
    - Manual EVACUATE activates all enabled sounder-class outputs.
    - Normal detector/MCP/input alarms continue to follow `.cpd` cause/effect configuration.
    - Active sounder outputs visibly flash in 3D.
  - Verification before Task 2:
    - `npm run test -- src/renderer/src/domain/fire/simulation`
    - `npm run typecheck`
  - Completion note: Added failing coverage proving manual EVACUATE activates all enabled Network sounder outputs while normal Programmed alarms remain CPD-configured. Updated `causeEffect.ts` so manual EVACUATE emits `device:*` outputs for addressable sounders, disabled outputs stay disabled, and the existing global `evacuate:*` output remains. Added `viewer3DSimulationVisual.ts` with tested active/delayed output animation frames and wired `Viewer3D.vue` to flash active 3D sounders without rebuilding the scene every frame. Verification passed: `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts` passed with 4 files and 34 tests; `npm run typecheck` passed.

- [x] Task 2: Remove 3D icon black square background
  - Scope:
    - Three.js device icons use transparent backgrounds.
    - No black square or black rectangular backing remains behind 3D sprites.
  - Verification before Task 3:
    - `npm run typecheck`
    - `npm run build`
  - Completion note: Inspected icon SVG resources and found no full-size black background rectangles. Updated `Viewer3D.vue` sprite texture/material setup to preserve transparency in WebGL: disabled mipmaps, set linear filtering, forced `transparent`, added `alphaTest`, disabled depth write, and disabled tone mapping for icon sprites. Verification passed: `npm run typecheck` passed; `npm run build` passed.

- [x] Task 3: Add 3D device trigger and context interactions
  - Scope:
    - Single-click selects a 3D device and opens the right panel.
    - Double-click input-capable devices in Simulation Mode toggles alarm active/restored.
    - Right-click devices opens the same context actions used by 2D.
    - Blank click clears selection and hides the right panel.
  - Verification before Task 4:
    - `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
    - `npm run typecheck`
    - `npm run build`
  - Completion note: Added `DeviceContextMenu` reuse in `Viewer3D.vue`, factored 3D picking into a shared helper, and wired single-click select/blank-clear, double-click input alarm toggle in Simulation Mode, and right-click context actions. Updated `App.vue` so 3D Open Properties selects the Properties tab just like 2D. Verification passed: `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 4 files and 43 tests; `npm run typecheck` passed; `npm run build` passed.

- [x] Review Cycle A: Broad debug/review after Tasks 1-3
  - Scope:
    - Check simulation, 3D renderer interaction changes, and context-menu integration for regressions.
  - Verification:
    - `npm run test`
    - `npm run typecheck`
  - Completion note: Ran broad regression checks after EVACUATE, 3D sprite, and 3D interaction changes. Verification passed: `npm run test` passed with 19 files and 107 tests; `npm run typecheck` passed. No regression was found before continuing to Task 4.

- [x] Task 4: Make 2D drawing the actual canvas boundary
  - Scope:
    - In 2D configuration mode, the imported drawing fills the visible working surface.
    - Remove the separate white canvas look under/around a drawing.
    - Preserve zoom, pan, drag/drop placement, Zone drawing, and Loop wiring.
  - Verification before Task 5:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
    - `npm run typecheck`
    - `npm run build`
  - Completion note: Updated `Planner2D.vue` so the white canvas rectangle and card styling are only used when no map is assigned. When a drawing exists, the SVG work surface fills the central panel with transparent background, no card border, no rounded white backing, and the imported drawing remains the coordinate boundary under the existing zoom/pan/drop/Zone/Loop layers. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 2 files and 19 tests; `npm run typecheck` passed; `npm run build` passed.

- [x] Task 5: Complete 3D Zone, Loop, and Group highlighting
  - Scope:
    - 3D Zone selection highlights matching devices and dims unrelated devices.
    - 3D Loop selection highlights matching devices/lines and dims unrelated devices.
    - 3D Sounder Group and I/O Group selection supports direct device fields and CPD member loop/address lists.
    - Highlighting must visibly affect device opacity/color in the 3D scene.
  - Verification before final review:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts`
    - `npm run typecheck`
    - `npm run build`
  - Completion note: Expanded `viewer3DHighlight.test.ts` to cover direct group fields and CPD member loop/address matching for Sounder Group and I/O Group. Added `getViewer3DDeviceHighlightAppearance` so 3D highlight behavior has an explicit visual contract: highlighted devices stay orange/full opacity and unrelated devices dim to 0.18 opacity. Updated `Viewer3D.vue` to use that appearance helper for sprite opacity while retaining Loop/Zone/Group target controls and existing highlighted rings. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts` passed with 3 tests; `npm run typecheck` passed; `npm run build` passed.

- [x] Final Validation
  - Scope:
    - Re-run final verification after all tasks.
    - Inspect changed files and residual risks.
  - Verification:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run test`
    - `npm run build`
  - Completion note: Ran final full validation after all tasks. First lint run exited 0 with three Prettier warnings, so `npm run lint -- --fix` was run to format the touched files. Final rerun passed cleanly: `npm run lint` passed with no warnings; `npm run typecheck` passed; `npm run test` passed with 19 files and 108 tests; `npm run build` passed. `git status --short` was inspected afterward; the repo remains dirty with many pre-existing unrelated changes, plus this goal's scoped changes under `goal-2`, `App.vue`, `Planner2D.vue`, `Viewer3D.vue`, simulation cause/effect, and viewer 3D highlight/visual tests/helpers.
