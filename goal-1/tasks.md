# Goal 1 Tasks

- [x] Task 1: Add Test Harness And Domain Type Skeleton
  - Owned files: `package.json`, `src/renderer/src/domain/fire/types.ts`, `src/renderer/src/domain/fire/simulation/types.ts`, `src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts`
  - Verification: `npm install`, `npm run test`, `npm run typecheck`
  - Completion note: Added Vitest scripts/dependency, generated lockfile changes via `npm install`, created the fire domain type skeleton, created the simulation type skeleton, and added the Task 1 smoke test. Worker verification: `npm install` passed, `npm run test` passed, `npm run typecheck` failed from out-of-scope existing errors. Manager verification: `npm run test` passed with 1 test; `npm run typecheck` failed at `src/main/index.ts` lines 70, 94, and 118 because `"success"` is not assignable to the existing logger level union; separate `npm run typecheck:web` failed in existing files `ThreeDView.vue`, `loggerStore.ts`, and `projectStore.ts`. Spec compliance review approved. Code quality review approved with one low-risk note that Task 2 will replace the smoke test with real device icon tests. No commit was made because `package.json` and `package-lock.json` already contained pre-existing user changes before this task.

- [x] Task 2: Implement Device Icon Mapping And Device Classification
  - Completion note: Replaced the smoke test with the Task 2 icon/classification test suite and added `deviceIcons.ts` with CPD icon mapping, friendly names, normalization, input/output capability, wireless-type, and sounder helpers. Worker red check failed as expected before implementation; targeted tests passed 6/6 after implementation. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts` passed with 6 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved. Scoped commit created: `ea75eba Add fire domain test harness and device icons`.

- [x] Task 3: Implement CPD Adapter
  - Completion note: Added `adaptCpdExport`, `CpdAdapterResult`, adapter diagnostics, and CPD extractor-like tests covering Network, multiple Panels, sounder mode, delays, panel/loop/address device IDs, I/O classification, group mapping, and unresolved Zone alarm mode. Worker red check failed as expected before implementation; final targeted tests passed 7/7. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts` passed with 7 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved. Scoped commit created: `a08fb6d Add CPD adapter`.

- [x] Review Cycle A: Broad debug/review after Tasks 1-3
  - Completion note: Ran broad checks after Tasks 1-3. `npm run test` passed with 2 files and 13 tests. `npm run typecheck` still fails at existing out-of-scope `src/main/index.ts` logger level errors. `npm run typecheck:web` still fails in existing out-of-scope `ThreeDView.vue`, `loggerStore.ts`, and `projectStore.ts`. No new fire-domain regression was found.

- [x] Task 4: Implement Issues Model And Validation Helpers
  - Completion note: Added `collectFireProjectIssues` and issue tests for missing loop/address, source-missing placed devices, missing Zone/Sounder Group/I/O Group references, manual Loop order references to unplaced devices, and active non-addressable sounders without representative points. First spec review requested making `FireIssue.id` required; fixed by adding stable IDs to adapter diagnostics. First code quality review requested unique non-addressable sounder issue IDs by CIE/channel; fixed with regression coverage. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts src/renderer/src/domain/fire/__tests__/issues.test.ts` passed with 14 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Scoped commit created: `1691cc6 Add fire issue detection`.

- [x] Task 5: Implement Loop Wiring Helpers
  - Completion note: Added `loopWiring.ts` and tests for manual order priority, configured order fallback, current-floor 2D segments, cross-floor 3D segments, and skipped segments for unknown/unplaced devices. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts` passed with 5 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved.

- [x] Task 6: Implement Zone Geometry Helpers
  - Completion note: Added `zoneGeometry.ts` and tests for rectangle creation, polygon creation, bounding highlight points for placed devices, and point-in-polygon detection. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/zoneGeometry.test.ts` passed with 4 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved.

- [x] Review Cycle B: Broad debug/review after Tasks 4-6
  - Completion note: Ran broad checks after Tasks 4-6. `npm run test` passed with 5 files and 29 tests. `npm run typecheck` still fails at existing out-of-scope `src/main/index.ts` logger level errors. No new fire-domain regression was found.

- [x] Task 7: Implement CIE Simulation Engine
  - Completion note: Added pure simulation delay helpers, cause/effect resolver, reducer engine, and tests for delays, Programmed/Preset outputs, disabled/inhibited handling, fault I/O, buzzer silence, system reset source persistence, and manual evacuate. Spec review requested fixes for persistent delay/skip state, disabled Programmed group outputs, and disabled FaultIOGroup outputs; all were fixed with regression tests. Manager verification: `npm run test -- src/renderer/src/domain/fire/simulation` passed with 3 files and 28 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved.

- [x] Task 8: Build Fire Project Store
  - Completion note: Added `useFireProjectStore` with required fire project state/actions, CPD adapter loading, default project creation, grid placement, planning-operation undo/redo snapshots, simulation mode dispatch, and focused Pinia/Vitest store tests. Manager verification: `npm run test -- src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 4 tests; full `npm run test` passed with 9 files and 61 tests; `npm run typecheck` still fails from out-of-scope `src/main/index.ts` logger level errors. Spec compliance and code quality reviews approved.

- [x] Task 9: Implement Main Process CPD Import IPC
  - Completion note: Added injectable main-process `importCpdFile`, `.cpd` selection/import IPC handler, typed preload `window.fireApi.importCpd()`, and kept existing `window.api` behavior. Spec review required running the portable extractor with `cwd: extractorDir`; fixed in `cpdImport.ts`. Manager verification: `npm run typecheck:node` passed; `npm run typecheck:web` still fails from out-of-scope existing renderer errors in `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Spec compliance and code quality reviews approved.

- [x] Review Cycle C: Broad debug/review after Tasks 7-9
  - Completion note: Ran broad checks after Tasks 7-9. `npm run test` passed with 9 files and 61 tests. `npm run typecheck` now passes node typecheck and fails only in existing out-of-scope renderer files: `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. No new fire-domain regression was found.

- [x] Task 10: Implement `.fireproj` Package Import And Export
  - Completion note: Added `adm-zip` package support, implemented main-process `.fireproj` package writer/reader with required `metadata.json`, `project.json`, `assets/maps/`, `assets/icons/`, and `assets/audio/` entries, rejected original `.cpd` paths, guarded package extraction paths, and exposed `window.fireApi.saveFireProject(projectPayload)` / `window.fireApi.openFireProject()`. Verification: `npm run typecheck:node` passed; `npm run test` passed with 9 files and 61 tests; `npm run typecheck` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Spec compliance review approved; manager code quality review found no blocking Task 10 issues.

- [x] Task 11: Implement Device Tree UI
  - Completion note: Added pure `buildFireDeviceTree` helper and tests for Network > Panel > Group > Device hierarchy, Loop/Zone/Type/Sounder Group/I/O Group grouping, status filters, issue filters, and CPD-field search. Added `components/fire/DeviceTree.vue` wired to the fire project store with group/status segmented controls, search, left-click selection, double-click focus emit, drag payloads, and right-click context-menu emit. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts` passed with 6 tests; `npm run typecheck:web` failed only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts` after fixing the one new icon import error.

- [x] Task 12: Implement 2D Planner UI
  - Completion note: Added new fire 2D planner components: `Planner2D.vue`, `DeviceContextMenu.vue`, `ZoneToolbar.vue`, and `LoopWiringToolbar.vue`. The planner renders current floor maps, placed device icons/labels, solid Loop lines, Zone overlays, drag/drop placement, single-commit device move preview, right-click context actions, Simulation Mode alarm/fault actions, rectangle Zone drawing, polygon Zone drawing with Esc cancel, and manual Loop wiring draft/save/restore flow. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts src/renderer/src/domain/fire/__tests__/zoneGeometry.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 13 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`.

- [x] Review Cycle D: Broad debug/review after Tasks 10-12
  - Completion note: Ran broad checks after Tasks 10-12. `npm run test` passed with 10 files and 67 tests. `npm run typecheck` passed node typecheck and still fails only in existing out-of-scope renderer files: `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Local review found and fixed one Task 12 undo-history risk by making drag movement preview-only until mouseup. No new fire-domain regression was found.

- [x] Task 13: Implement 3D Viewer UI
  - Completion note: Added `components/fire/Viewer3D.vue` as a fire-specific Three.js viewer with full-surface canvas rendering, building/floor planes, optional map textures, placed device icon sprites, solid effective Loop lines across floors/buildings, translucent Zone overlays, selected-device highlighting, and simulation state coloring for alarm/fault/output/disabled devices. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts` passed with 5 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Manual 3D browser/canvas verification is deferred until Task 19 wires the new fire shell into the running app.

- [x] Task 14: Implement Property Panel And Group Inspector
  - Completion note: Added `components/fire/PropertyPanel.vue` for selected-device CPD properties, placement status, Panel/Loop/Address/Type/Location/Zone/group fields, disabled/inhibit/delay flags, reporting/sensitivity fields, and raw CPD details collapsed by default. Added `components/fire/GroupInspector.vue` for Sounder/I/O group ID, description, members, Panel/Loop/Address/Zone/location, non-addressable sounder channels, triggering Zones, current simulation output state, delay, and inhibit/disabled reason. Verification: `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/tree.test.ts` passed with 34 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`.

- [x] Task 15: Implement Simulation Panel
  - Completion note: Added `components/fire/SimulationPanel.vue` with Simulation Mode toggle, EVACUATE, BUZZER SILENCE, SYSTEM RESET, time scale `1x/5x/10x/30x`, periodic delay ticking, Skip Delay controls, system/sound/buzzer/output status, active input/fault restore controls, delayed/active output lists, Fire Brigade and Fault I/O status, and event log. Added `setSimulationTimeScale` to the fire project store. Verification: `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 32 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`.

- [x] Review Cycle E: Broad debug/review after Tasks 13-15
  - Completion note: Ran broad checks after Tasks 13-15. `npm run test` passed with 10 files and 67 tests. `npm run typecheck` passed node typecheck and still fails only in existing out-of-scope renderer files: `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Local review confirmed the new 3D viewer, property/group panels, and simulation panel read and write the shared fire store/simulation state without reintroducing Mesh topology concepts.

- [x] Task 16: Implement Drawing Import For Images And PDF
  - Completion note: Added `src/main/drawingImport.ts` for PNG/JPG/JPEG/SVG import by copying into app-managed map assets and PDF import by rendering/capturing the requested page to PNG through a hidden Electron window. Added `window.fireApi.importDrawing({ pdfPage? })`, main IPC `fire:select-and-import-drawing`, `FireAsset.runtimePath`, store `assignFloorMapAsset`, and a Planner2D import-drawing button that assigns the imported map to the current floor. Verification: `npm run typecheck:node` passed; `npm run test -- src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 4 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Risk: the API supports PDF page selection via `pdfPage`, while the current Planner2D toolbar uses the default first page until a fuller map configuration dialog is wired.

- [ ] Task 17: Implement CPD Re-import Diff
  - Completion note:

- [ ] Task 18: Implement I18n
  - Completion note:

- [ ] Review Cycle F: Broad debug/review after Tasks 16-18
  - Completion note:

- [ ] Task 19: Wire App Shell And Retire Mesh UI
  - Completion note:

- [ ] Task 20: Final Verification And Review
  - Completion note:
