# Numens Fire Alarm Simulator Implementation Handoff

Date: 2026-05-23

## Status

The implementation plan for the Numens Fire Alarm Simulator has been executed through Task 35. The active application shell is now the Fire Alarm Simulator workflow, not the old Mesh Studio workflow.

Latest implementation commits:

- `527251c Finalize fire simulator verification`
- `3a52f8e Wire fire app shell`
- `45510de Add fire i18n`
- `b708afa Add CPD reimport diff`
- `9515f9b Add drawing import`
- `ceb1e8e Add fire simulation panel`
- `d90b7bf Add fire 3D viewer`
- Earlier commits cover Tasks 1-14 and review cycles.

## Implemented Scope

Core domain and validation:

- Fire project domain model and simulation types.
- Device icon mapping and classification for fire alarm devices.
- CPD adapter from extractor JSON into fire project data.
- Issue collection for missing references, missing source devices, unplaced manual Loop devices, and non-addressable sounder point gaps.
- Loop wiring helpers for manual order, configured order, 2D segments, and cross-floor 3D segments.
- Zone geometry helpers for rectangles, polygons, bounding highlights, and point-in-polygon checks.

CIE simulation:

- Fire Alarm, Evacuate, Fault, Fire Brigade, Sounder, and I/O cause/effect handling.
- Delay, Skip Delay, Inhibit, Disabled, BUZZER SILENCE, and SYSTEM RESET behavior.
- Time-scale ticking in the simulation panel.
- Regression tests for the simulation engine, cause/effect resolver, and delay helpers.

Project persistence and import:

- `.cpd` import remains a configuration source only.
- `.fireproj` is the complete project save/open package format.
- `.fireproj` packages contain `metadata.json`, `project.json`, and managed assets under `assets/maps/`, `assets/icons/`, and `assets/audio/`.
- Original `.cpd` paths/files are rejected from `.fireproj` package contents.
- Drawing import supports PNG, JPG, JPEG, SVG, and PDF capture to managed map assets.
- CPD re-import diff preserves matched placements, Zone visual areas, and manual Loop wiring while surfacing added/removed/changed devices.

UI:

- Active app shell in `src/renderer/src/App.vue`.
- Fire Device Tree with Network, Panel, Loop, Zone, Type, Sounder Group, and I/O Group grouping.
- 2D planner with drawing background, device placement, device move, Zone drawing, manual Loop wiring, and simulation interactions.
- 3D viewer with building/floor planes, map textures, device sprites, Zone overlays, and Loop lines.
- Property panel, group inspector, simulation panel, and CPD re-import diff dialog.
- English and Chinese i18n files are wired through `vue-i18n`.

## Stability Pass Completed

The 2026-05-23 stability tasks are complete:

- CPD group parsing now treats `0`, empty, missing, and unparseable group values as unassigned.
- Device Tree grouping no longer renders Zone/Sounder/I/O group `0` or unassigned buckets for those grouped views.
- 2D Loop lines are confirmed to come only from effective Loop order.
- 2D drag movement is preview-only until mouse release, with only adjacent Loop preview lines updated.
- 2D selected-device styling no longer uses an outer ring; selection is icon-only.
- 2D planner toolbar controls are compact grouped icon/select controls and fit the 1280px planner harness without overflow.
- 3D floor maps use the same resolved asset href path as 2D, including managed `fire-asset://local/...` paths.
- 3D floor spacing was increased, device sprite size follows the global 2D icon scale, and the visible reference grid was removed.
- Simulation cause/effect was rechecked from input trigger to CPD Zone/Sounder Group/I/O Group outputs.
- Simulation delay handling now uses parsed `delayedSounders`, `overrideDelays`, and `ioOverrideDelay` fields.
- 2D and 3D simulation visuals distinguish active input, fault, active sounder, active I/O, delayed output, and disabled states.
- Simulation Panel audio feedback is gated by Simulation Mode, the project sound setting, and active audible outputs, with one oscillator stopped on silence/reset/restore/exit.

## Verification Completed

Final verification commands run successfully:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Observed final test result:

- 14 test files passed.
- 90 tests passed.

Runtime UI review:

- A local Planner2D harness rendered a nonblank canvas with 4 devices and 3 Loop lines.
- Browser console error log was empty.
- No Mesh/RSSI/Leader/Router/HTML topology text appeared in the harness.
- Selected-device review showed 1 selected device, 0 visible selected rings, and icon-only shadow highlighting.
- Toolbar review at 1280px reported `scrollWidth == clientWidth`, so the compact toolbar did not require horizontal overflow in the harness.

The active fire code was also searched for old product concepts. No old Mesh, RSSI, Leader, Router, or HTML topology product workflow remains exposed in the active Fire Simulator code. The only remaining `Mesh` matches in active fire files are Three.js class names such as `THREE.Mesh` in the 3D viewer.

## Goal 4 Zone And 2D Lifecycle Fixes Completed

The 2026-05-24 Goal 4 pass fixed the new Zone drawing and 2D Building/Floor lifecycle work end to end:

- Store actions now support undoable `removeBuilding`, `removeFloor`, `clearFloorMapAsset`, and `replaceZoneArea`.
- Deleting a Building/Floor unplaces affected devices and non-addressable sounder points, removes affected Zone visual areas, clears affected selected devices, and keeps a valid default planning target when the last target is deleted.
- Clearing a drawing removes only the floor `mapAssetId` and resets the canvas dimensions while preserving devices, Zone areas, and managed assets.
- Planner2D now exposes compact controls for delete Building, delete Floor, clear drawing, select/delete Zone area, and replace selected Zone area.
- Zone polygon persistence is guarded against too few points, duplicate adjacent points, tiny areas, and self-intersection.
- Viewer3D now filters saved and temporary Zone areas by the same Building/Floor scope rules as floors/devices, and Zone focus bounds only include visible/current-scope areas.
- 3D Zone resolution now combines saved areas with temporary device-bounds areas per Building/Floor, without duplicating floors that already have saved areas.
- Save/open normalization and CPD re-import preservation now drop orphan Building/Floor visual references instead of resurrecting deleted targets.

Goal 4 verification commands run successfully:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Observed Goal 4 final test result:

- 25 test files passed.
- 153 tests passed.

Runtime and focused checks:

- `http://127.0.0.1:5174/planner-check.html` reported `ok: true` for add/delete Building, add/delete Floor, assign/clear Drawing, draw/delete Zone area.
- Browser console errors/warnings were empty during the Planner2D harness run.
- The 1280px Planner2D toolbar reported no initial horizontal overflow after hiding Zone-area edit controls until a Zone area is selected.
- `viewer3DZoneArea.test.ts` and `viewer3DViewState.test.ts` passed again after full validation, covering saved/temporary Zone area resolution and Building/Floor scope/focus behavior.

## Known Risks And Gaps

- No sample `.cpd` or `.fireproj` file was present in the repository during final verification, so the long manual import/export workflow was not executed end-to-end with real customer data.
- PDF drawing import supports `pdfPage` at the API level, but the current 2D planner toolbar imports the default first page until a fuller map import dialog is added.
- The old top-level Mesh UI files still exist in the repository but are retired from the active `App.vue` workflow. ESLint now excludes these retired top-level legacy renderer files so lint reflects the active Fire Alarm app.
- The worktree contains unrelated or pre-existing modified/untracked files. They were intentionally preserved and not reverted.
- Runtime review used a local planner harness for fast UI validation. The full Electron native file-dialog workflow still needs real operator/customer sample files for an end-to-end manual run.
- There is not yet a dedicated browser-mounted 3D runtime harness; Goal 4 3D Zone behavior is covered by focused domain tests plus the production build.

## Current Dirty Worktree Notes

At the time of the original 2026-05-23 handoff, `git status --short` still reported unrelated or previously existing changes including:

- Modified `README.md`, `electron-builder.yml`, `out/main/index.js`, and `out/preload/index.js`.
- Deleted old public icon files such as `Leader.svg`, `Router.svg`, `heat-mult.svg`, `io-module.svg`, `mcp.svg`, and `smoke.svg`.
- Modified retired legacy renderer components and utilities under `src/renderer/src/components/`, `src/renderer/src/stores/loggerStore.ts`, and `src/renderer/src/utils/`.
- Untracked `AGENTS.md`, `docs/`, `out/renderer/`, new public fire device icons, and `src/renderer/src/assets/logo.svg`.

After Goal 4, the worktree also contains the intentional Goal 4 files under `goal-4/`, `scripts/planner-check.vite.config.mjs`, active Fire renderer/store/domain/i18n source files, and this handoff document. The build command also updated generated `out/renderer` artifacts and `.eslintcache`; these were left in place. Other status entries such as `.codex-dev-run/Exam_6002_Answer_Advanced.extract.json` and Fire adapter files were not cleaned or reverted.

Do not clean or revert these automatically in the next session. Inspect them first and preserve user changes unless explicitly instructed otherwise.

## Bug Fix Session Starting Points

Recommended first checks for the next session:

```powershell
git status --short
npm run lint
npm run typecheck
npm run test
npm run build
```

Useful entry points:

- App shell: `src/renderer/src/App.vue`
- Fire store: `src/renderer/src/stores/fireProjectStore.ts`
- Domain types: `src/renderer/src/domain/fire/types.ts`
- CPD adapter: `src/renderer/src/domain/fire/cpdAdapter.ts`
- CPD import IPC: `src/main/cpdImport.ts`
- Fire project package IPC: `src/main/fireProjectPackage.ts`
- Drawing import IPC: `src/main/drawingImport.ts`
- Preload API: `src/preload/fireApi.ts`
- 2D planner: `src/renderer/src/components/fire/Planner2D.vue`
- 3D viewer: `src/renderer/src/components/fire/Viewer3D.vue`
- Simulation panel: `src/renderer/src/components/fire/SimulationPanel.vue`
- Simulation engine: `src/renderer/src/domain/fire/simulation/engine.ts`
- Cause/effect resolver: `src/renderer/src/domain/fire/simulation/causeEffect.ts`

When fixing bugs, prefer adding or updating focused tests under `src/renderer/src/domain/fire/__tests__/` or `src/renderer/src/domain/fire/simulation/__tests__/` before changing behavior.
