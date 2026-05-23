# Numens Fire Alarm Simulator Implementation Handoff

Date: 2026-05-23

## Status

The implementation plan for the Numens Fire Alarm Simulator has been executed through Task 20. The active application shell is now the Fire Alarm Simulator workflow, not the old Mesh Studio workflow.

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

## Verification Completed

Final verification commands run successfully:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Observed final test result:

- 11 test files passed.
- 70 tests passed.

The active fire code was also searched for old product concepts. No old Mesh, RSSI, Leader, Router, or HTML topology product workflow remains exposed in the active Fire Simulator code. The only remaining `Mesh` matches in active fire files are Three.js class names such as `THREE.Mesh` in the 3D viewer.

## Known Risks And Gaps

- No sample `.cpd` or `.fireproj` file was present in the repository during final verification, so the long manual import/export workflow was not executed end-to-end with real customer data.
- PDF drawing import supports `pdfPage` at the API level, but the current 2D planner toolbar imports the default first page until a fuller map import dialog is added.
- The old top-level Mesh UI files still exist in the repository but are retired from the active `App.vue` workflow. ESLint now excludes these retired top-level legacy renderer files so lint reflects the active Fire Alarm app.
- The worktree contains unrelated or pre-existing modified/untracked files. They were intentionally preserved and not reverted.

## Current Dirty Worktree Notes

At the time of this handoff, `git status --short` still reported unrelated or previously existing changes including:

- Modified `README.md`, `electron-builder.yml`, `out/main/index.js`, and `out/preload/index.js`.
- Deleted old public icon files such as `Leader.svg`, `Router.svg`, `heat-mult.svg`, `io-module.svg`, `mcp.svg`, and `smoke.svg`.
- Modified retired legacy renderer components and utilities under `src/renderer/src/components/`, `src/renderer/src/stores/loggerStore.ts`, and `src/renderer/src/utils/`.
- Untracked `AGENTS.md`, `docs/`, `out/renderer/`, new public fire device icons, and `src/renderer/src/assets/logo.svg`.

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
