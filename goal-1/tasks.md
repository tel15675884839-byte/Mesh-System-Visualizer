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

- [x] Task 17: Implement CPD Re-import Diff
  - Completion note: Added `cpdDiff.ts` with `diffCpdImport` and `applyCpdDiff`, matching devices by `panelNumber + loopId + address`, reporting added/removed/changed devices, preserving matched placement, preserving Zone visual areas and manual Loop wiring, adding new devices as unplaced, and marking removed devices as missing. Added `ImportDiffDialog.vue` and store pending re-import actions. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdDiff.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts` passed with 7 tests; `npm run typecheck:web` still fails only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`.

- [x] Task 18: Implement I18n
  - Completion note: Added `vue-i18n`, created `src/renderer/src/i18n/index.ts`, `en.ts`, and `zh.ts`, wired i18n into `main.ts`, and converted the major visible strings in the new fire Device Tree, Planner toolbar, context menu, Zone/Loop toolbars, Property Panel, Group Inspector, Simulation Panel, and Import Diff dialog to translation keys. Verification: `npm run test` passed with 11 files and 70 tests; `npm run typecheck:web` and `npm run build` still fail only in existing out-of-scope renderer files `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`.

- [x] Review Cycle F: Broad debug/review after Tasks 16-18
  - Completion note: Ran broad checks after Tasks 16-18. `npm run test` passed with 11 files and 70 tests. `npm run typecheck` passed node typecheck and still fails only in existing out-of-scope renderer files: `ThreeDView.vue`, `loggerStore.ts`, and old `projectStore.ts`. Local review confirmed drawing import, CPD re-import diff, and i18n changes remain scoped to fire-domain/main/preload/new fire UI code.

- [x] Task 19: Wire App Shell And Retire Mesh UI
  - Completion note: Replaced `App.vue` with the new Numens Fire Alarm Simulator shell: New from CPD, Open `.fireproj`, Save `.fireproj`, Re-import CPD / Compare & Sync, 2D/3D view switch, left Fire Device Tree, central Planner2D/Viewer3D, right Properties/Group/Simulation tabs, and Import Diff dialog. Removed old Mesh Studio app shell from the active user-facing workflow. Fixed old residual typecheck blockers in `ThreeDView.vue`, `types/index.ts`, and `projectStore.ts` so the project can build while those legacy files remain unused. Verification: `npm run test` passed with 11 files and 70 tests; `npm run typecheck` passed; `npm run build` passed.

- [x] Task 20: Final Verification And Review
  - Completion note: Final manager review completed in-process per the user's later instruction to stop using SubAgents. Fixed active lint blockers in the main/preload entrypoints, formatted new fire-domain files, and updated ESLint scope so the active Fire Alarm app is checked while retired top-level Mesh UI files are excluded from lint. Verification: `npm run lint` passed; `npm run typecheck` passed; `npm run test` passed with 11 files and 70 tests; `npm run build` passed. Compliance review: active App shell is the Fire Alarm Simulator workflow, `.cpd` remains import/config source only, `.fireproj` remains complete save/open package format, and the CIE simulation test suite covers Fire Alarm, Evacuate, Fault, Fire Brigade, Sounder/I/O outputs, Delay/Skip Delay, Disabled/Inhibit, BUZZER SILENCE, and SYSTEM RESET behavior. Search review found no old Mesh/RSSI/Leader/Router/topology product exposure in active fire code; the only `Mesh` hits were Three.js geometry class names in `Viewer3D.vue`. Risk: no sample `.cpd` or `.fireproj` was present in the repository, so the long manual import/export workflow from the plan was not executed end-to-end with real files; behavior is validated through unit tests, typecheck, lint, build, and code review.

- [x] Task 21: Verify CPD Group Parsing Semantics
  - Owned files: `src/renderer/src/domain/fire/cpdAdapter.ts`, `src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`, `src/renderer/src/domain/fire/types.ts`
  - Requirements:
    - Add focused tests for valid non-zero Zone, Sounder Group, and I/O Group extraction from CPD-like data.
    - Add focused tests proving `0`, empty, missing, or unparseable group values become unassigned rather than valid groups.
    - Recheck I/O Group mapping specifically, because incorrect recognition is a known risk.
    - Fix adapter mapping only if tests show a parsing or normalization bug.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`
    - Do not continue to Task 22 until this passes.
  - Completion note: Added CPD adapter tests for valid non-zero Zone, Sounder Group, and I/O Group values supplied as CPD-like numeric strings, plus zero/empty/missing/unparseable group values. Updated `src/renderer/src/domain/fire/cpdAdapter.ts` so device group references, Zone output mappings, FaultIOGroup, and panel Zone/Sounder/I/O group rows only keep positive group numbers; invalid group rows are skipped instead of creating group 0. Verification: first targeted test run failed as expected on group `0` parsing; after the fix, `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts` passed with 9 tests. Risk: no real customer `.cpd` sample is present, so this remains schema-fixture validation against the documented extractor output.

- [x] Task 22: Fix Device Tree Group Filtering Rules
  - Owned files: `src/renderer/src/domain/fire/tree.ts`, `src/renderer/src/domain/fire/__tests__/tree.test.ts`
  - Requirements:
    - Do not render `Zone 0`, `Sounder Group 0`, or `I/O Group 0`.
    - Do not render an "Unassigned" bucket for Zone, Sounder Group, or I/O Group grouped views.
    - Do not put sounders or pure output devices under Zone grouping.
    - Include dual-capability devices in Zone grouping only when they have a valid non-zero Zone assignment.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts`
    - Do not continue to Task 23 until this passes.
  - Completion note: Updated `src/renderer/src/domain/fire/__tests__/tree.test.ts` with failing coverage for Zone 0, Sounder Group 0, I/O Group 0, unassigned group buckets, and pure output devices in Zone grouping. Updated `src/renderer/src/domain/fire/tree.ts` so Zone grouping only includes input-capable devices with a positive Zone, Sounder/I/O grouping only includes positive configured/member groups, and no unassigned Sounder/I/O buckets are produced. Verification: first targeted run failed on the old Sounder-in-Zone and Zone 0 behavior; after the fix, `npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts` passed with 7 tests. Risk: this intentionally removes unassigned output-class devices from Sounder/I/O grouped views per the stability requirement, so users must use Loop/Type/All views to locate ungrouped outputs.

- [x] Task 23: Redesign Device Tree Header Controls
  - Owned files: `src/renderer/src/components/fire/DeviceTree.vue`, `src/renderer/src/i18n/en.ts`, `src/renderer/src/i18n/zh.ts`
  - Requirements:
    - Replace long header controls with compact icon buttons and hover tooltips where practical.
    - Keep search input full-width and visually separated from grouped icon controls.
    - Prevent squeezing, collision, and unstable wrapping in the left panel.
    - Keep the existing grouping and status-filter behavior intact.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts`
    - Manual UI check when running the app: inspect the Device Tree header at normal and narrow panel widths.
    - Do not continue to Task 24 until the header is visually acceptable.
  - Completion note: Updated `src/renderer/src/components/fire/DeviceTree.vue` to replace long segmented labels with compact icon button groups and tooltips, with search kept as a separate full-width row. Added `groupLabel` and `filterLabel` i18n keys in `src/renderer/src/i18n/en.ts` and replaced the mojibake Chinese dictionary in `src/renderer/src/i18n/zh.ts` with valid UTF-8 Chinese while adding the same keys. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts` passed with 7 tests; `npm run typecheck:web` passed. Manual UI check: started the dev renderer at `http://localhost:5173`, used a temporary Vite harness with the real `DeviceTree.vue` and CPD fixture at 340px and 280px widths; both headers rendered 9 compact icon buttons, search stayed full-width, toolbar `scrollWidth` equaled `clientWidth` at both widths, and Zone/Group 0 text was not visible. Risk: manual check used a local component harness because the Electron app's real import/open flows use native file dialogs; the harness was deleted before commit and did not alter product code.

- [x] Task 24: Confirm 2D Loop-Only Line Source
  - Owned files: `src/renderer/src/domain/fire/loopWiring.ts`, `src/renderer/src/domain/fire/__tests__/loopWiring.test.ts`, `src/renderer/src/components/fire/Planner2D.vue`
  - Requirements:
    - Prove 2D connection lines come only from effective Loop order.
    - Do not use Zone, Sounder Group, or I/O Group to create 2D device connection lines.
    - Preserve manual Loop order priority over configured CPD Loop order.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts`
    - Do not continue to Task 25 until this passes.
  - Completion note: Added a focused `src/renderer/src/domain/fire/__tests__/loopWiring.test.ts` case proving `buildCurrentFloorLoopSegments` only connects consecutive devices in the effective Loop order and ignores unrelated same-floor devices that share Zone, Sounder Group, or I/O Group membership. Code audit of `src/renderer/src/components/fire/Planner2D.vue` confirmed 2D `loopLines` are built only by iterating panel `loops` and `buildCurrentFloorLoopSegments`; no Zone/Group data path creates connection lines. Verification: `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts` passed with 6 tests. Risk: this validates the current helper/component path; manual drawing review remains covered again in Tasks 25, 27, 34, and 35.

- [ ] Task 25: Optimize 2D Drag Line Preview
  - Owned files: `src/renderer/src/components/fire/Planner2D.vue`, `src/renderer/src/domain/fire/loopWiring.ts`, `src/renderer/src/domain/fire/__tests__/loopWiring.test.ts`, `src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
  - Requirements:
    - During drag, visually update only Loop segments adjacent to the dragged device.
    - Do not write every mousemove into the store.
    - Commit final device coordinates once on mouse release.
    - Keep drag behavior smooth on larger device lists.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
    - Manual UI check when running the app: drag a middle Loop device and confirm only adjacent lines follow during drag, then persist after release.
    - Do not continue to Task 26 until the drag behavior is smooth and correct.

- [ ] Task 26: Refine 2D Device Selection Highlight
  - Owned files: `src/renderer/src/components/fire/Planner2D.vue`
  - Requirements:
    - Remove any selected-device outer circle or ring.
    - Use icon-only highlighting such as subtle brightness, opacity, or shadow.
    - Keep alarm, fault, delayed, and active-output visual states distinguishable from selected-only state.
  - Verification before next task:
    - Manual UI check when running the app: select normal, alarm, fault, and output devices and confirm no selected outer ring appears.
    - Run a targeted command only if related domain logic changes; otherwise record this as UI-only verification.
    - Do not continue to Task 27 until selection visuals are acceptable.

- [ ] Task 27: Rework 2D Planner Toolbar Layout
  - Owned files: `src/renderer/src/components/fire/Planner2D.vue`, `src/renderer/src/components/fire/ZoneToolbar.vue`, `src/renderer/src/components/fire/LoopWiringToolbar.vue`, `src/renderer/src/i18n/en.ts`, `src/renderer/src/i18n/zh.ts`
  - Requirements:
    - Group controls into floor/drawing, Zone tools, Loop tools, and view controls.
    - Use SVG/icon buttons with hover tooltips for action commands.
    - Keep selects and sliders aligned and readable.
    - Prevent long visible text from forcing toolbar collision.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
    - Manual UI check when running the app: inspect toolbar at normal and narrow central panel widths.
    - Do not continue to Task 28 until the toolbar is visually acceptable.

- [ ] Task 28: Fix 3D Floor Map Texture Rendering
  - Owned files: `src/renderer/src/components/fire/Viewer3D.vue`, `src/renderer/src/domain/fire/projectAssets.ts`, `src/renderer/src/domain/fire/__tests__/projectAssets.test.ts`
  - Requirements:
    - Render each 3D floor with the same imported drawing asset used by the corresponding 2D floor.
    - Fix the black floor-map rendering issue.
    - Keep texture loading compatible with packaged `fire-asset:` paths and managed map assets.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/projectAssets.test.ts`
    - Manual UI check when running the app: import a JPG/PNG drawing, switch to 3D, and confirm the floor texture is visible rather than black.
    - Do not continue to Task 29 until 3D map rendering is correct.

- [ ] Task 29: Adjust 3D Floor Spacing, Device Scale, And Grid Visibility
  - Owned files: `src/renderer/src/components/fire/Viewer3D.vue`, `src/renderer/src/stores/fireProjectStore.ts`, `src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
  - Requirements:
    - Increase default floor-to-floor spacing so multiple floors are visually distinct.
    - Make 3D device marker size follow the global 2D device icon scale.
    - Do not add a separate 3D size control.
    - Hide the visible bottom reference grid while preserving any internal coordinate or scaling logic.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/fireProjectStore.test.ts`
    - Manual UI check when running the app: inspect two floors, device size changes after adjusting 2D icon size, and absence of visible reference grid.
    - Do not continue to Task 30 until 3D spacing/scale/grid behavior is acceptable.

- [ ] Task 30: Audit Simulation Input-To-Output Logic
  - Owned files: `src/renderer/src/domain/fire/simulation/engine.ts`, `src/renderer/src/domain/fire/simulation/causeEffect.ts`, `src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts`, `src/renderer/src/domain/fire/simulation/__tests__/causeEffect.test.ts`
  - Requirements:
    - Audit the full path from triggered input action to calculated output state.
    - Confirm output calculation uses parsed CPD Zone triggers, Sounder Groups, and I/O Groups.
    - Confirm active outputs appear in simulation state with the correct output IDs and reasons.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/simulation`
    - Do not continue to Task 31 until this passes.

- [ ] Task 31: Audit Simulation Delay, Disable, And Inhibit Behavior
  - Owned files: `src/renderer/src/domain/fire/simulation/engine.ts`, `src/renderer/src/domain/fire/simulation/causeEffect.ts`, `src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts`, `src/renderer/src/domain/fire/simulation/__tests__/causeEffect.test.ts`, `src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`
  - Requirements:
    - Confirm delayed outputs remain distinguishable from active outputs.
    - Confirm disabled devices and disabled outputs do not incorrectly activate.
    - Confirm inhibited sounders, I/O, and relays suppress the correct output types.
    - Treat already parsed but unused CPD fields as bugs if they affect simulation correctness.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`
    - Do not continue to Task 32 until this passes.

- [ ] Task 32: Add 2D And 3D Simulation Visual States
  - Owned files: `src/renderer/src/components/fire/Planner2D.vue`, `src/renderer/src/components/fire/Viewer3D.vue`
  - Requirements:
    - Input alarms show clear red flashing or pulsing.
    - Active sounders show a strong flashing visual state.
    - Active I/O outputs show a distinct active state.
    - Delayed outputs show a pending or slower animation state.
    - Faults show amber warning animation.
    - Disabled or inhibited items remain muted/greyed and are not overridden by normal active animations.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/simulation`
    - Manual UI check when running the app: trigger input, fault, delayed output, and disabled/inhibited cases; inspect 2D and 3D visuals.
    - Do not continue to Task 33 until visual states are distinguishable.

- [ ] Task 33: Add Simulation Audio Feedback
  - Owned files: `src/renderer/src/components/fire/SimulationPanel.vue`, `src/renderer/src/stores/fireProjectStore.ts`, `src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts`
  - Requirements:
    - Add audible feedback for active sounder behavior.
    - Respect the existing simulation sound setting.
    - Ensure BUZZER SILENCE, SYSTEM RESET, and output restoration stop or mute audio appropriately.
    - Avoid overlapping or runaway repeated audio playback.
  - Verification before next task:
    - `npm run test -- src/renderer/src/domain/fire/simulation`
    - Manual UI/audio check when running the app: trigger a sounder, toggle sound setting, silence, reset, and restore.
    - Do not continue to Task 34 until audio behavior is acceptable.

- [ ] Task 34: Cross-Module Runtime Review
  - Owned files: active fire UI and domain files changed by Tasks 21-33
  - Requirements:
    - Review the running app across Device Tree, 2D, 3D, Properties, Output Groups, and Simulation.
    - Confirm no old Mesh, RSSI, Leader, Router, or HTML topology product feature was reconnected.
    - Confirm UI layout has no obvious clipping, overlap, or confusing control grouping.
    - Confirm each task's verification result is recorded in its completion note before moving on.
  - Verification before next task:
    - Manual runtime UI review is required after Tasks 21-33.
    - Targeted test reruns should cover the files changed during Tasks 21-33.
    - Do not continue to Task 35 until runtime review passes.

- [ ] Task 35: Final Logic, Code, And UI Validation
  - Owned files: `docs/2026-05-23-fire-simulator-stability-requirements.md`, `docs/2026-05-23-implementation-handoff.md`, `goal-1/tasks.md`
  - Requirements:
    - Run final logic and code validation after all stability tasks are complete.
    - Run final UI review once more after the code validation passes.
    - Update the handoff with completed tasks, exact commands, results, manual UI findings, and residual risks.
    - Preserve unrelated dirty worktree changes unless explicitly told otherwise.
  - Verification:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run test`
    - `npm run build`
    - Final manual UI review of Device Tree, 2D, 3D, and Simulation.
