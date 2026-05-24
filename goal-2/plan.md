# Goal 2 Plan

## Requirements

This goal implements the five tasks confirmed with the user:

1. In 3D, EVACUATE is a special emergency action that activates all sounders; other alarm paths follow `.cpd` cause/effect configuration.
2. Remove the black square background around 3D device icons completely.
3. Add full 3D device interaction parity: single click selects, double-click triggers/restores input alarms in Simulation Mode, and right-click opens the device context menu.
4. Make the 2D configuration drawing itself the visible working canvas instead of showing the drawing inside a separate white canvas.
5. Make Zone, Loop, Sounder Group, and I/O Group highlighting actually affect visible 3D devices, with Group membership resolved from both direct device fields and CPD member loop/address lists.

The user requires one task at a time, with verification after every task before continuing, then one final full verification pass after all tasks.

## Current Context

- The app is Electron + Vue + TypeScript + Pinia + Element Plus + Three.js.
- The worktree already contains many existing changes. Do not revert unrelated files.
- Existing relevant modules:
  - `src/renderer/src/domain/fire/simulation/causeEffect.ts`
  - `src/renderer/src/domain/fire/simulation/engine.ts`
  - `src/renderer/src/components/fire/SimulationPanel.vue`
  - `src/renderer/src/components/fire/Planner2D.vue`
  - `src/renderer/src/components/fire/Viewer3D.vue`
  - `src/renderer/src/components/fire/DeviceContextMenu.vue`
  - `src/renderer/src/domain/fire/viewer3DHighlight.ts`
  - `src/renderer/src/stores/fireProjectStore.ts`
  - `src/renderer/src/i18n/en.ts`
  - `src/renderer/src/i18n/zh.ts`
- Recent full validation before this goal reportedly passed: lint, typecheck, test, and build.

## Execution Plan

Task 1: Fix EVACUATE output linkage and 3D sounder flashing.

- Add failing simulation tests proving manual EVACUATE activates all sounder-class outputs while normal programmed alarms still follow `.cpd` group rules.
- Implement the simulation output mapping.
- Add or adjust 3D animation support for active sounder outputs.
- Verify targeted simulation tests and typecheck.

Task 2: Remove 3D icon black square backgrounds.

- Inspect the current Three.js sprite material/texture path.
- Add a focused testable helper if practical, otherwise make a narrow UI renderer fix.
- Verify typecheck and build.

Task 3: Implement 3D device trigger and context interactions.

- Reuse the existing 2D context menu and store simulation actions.
- Add 3D double-click and right-click picking.
- Verify typecheck/build and relevant store/simulation tests.

Task 4: Make the 2D drawing fill the configuration canvas.

- Remove the visible white canvas backing when a floor map exists.
- Keep drawing bounds as the coordinate boundary and preserve zoom/pan/drop/zone/loop behavior.
- Verify typecheck/build and relevant store/loop tests.

Task 5: Complete 3D Zone/Loop/Group highlighting.

- Add failing tests for direct group fields and CPD member loop/address matching if coverage is missing.
- Ensure highlight target selection and rendering visibly affect devices in 3D.
- Verify highlight tests, typecheck, and build.

Final review:

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Inspect changed files and check for unrelated reversions.
- Update this goal's task file with completion notes and residual risks.

## Risks

- Three.js visual behavior may not be fully provable with unit tests. Use build/typecheck plus code review, and run a local visual check if practical.
- Existing dirty files may contain user changes. Keep edits tightly scoped and do not reset or checkout files.
- The active app may require native Electron dialogs for full workflow testing; if manual full-flow testing is not possible, record the exact gap.

## Rollback Plan

- Do not use destructive git commands.
- If a task change fails verification, revert only the hunks introduced for that task using `apply_patch`.
- If a broader issue is found, stop after recording the failing command and the changed files involved.
