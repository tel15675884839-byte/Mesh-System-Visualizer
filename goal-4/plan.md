# Goal 4 Plan

## Objective

Thoroughly fix the Zone area and 2D configuration lifecycle gaps in `Numens Fire Alarm Simulator`, covering store/domain cleanup, UI actions, undo/redo, `.fireproj` persistence, 3D scope behavior, and runtime verification.

## Feature Contract

### Data ownership

- Buildings and floors live in `project.buildings`.
- Floor drawings are assets in `project.assets` referenced by `FireFloor.mapAssetId`.
- Device placements reference `buildingId` and `floorId` through `device.placement`.
- Zone visual areas live in `project.networks[].panels[].zones[].visualAreas`.
- 3D rendering reads the same saved Zone visual areas plus temporary runtime-only Zone bounds from `viewer3DZoneArea.ts`.

### Boundaries

- Deleting a Building/Floor is a planning operation and must be undoable.
- Deleting a Building/Floor must clean or unplace all references that point to removed IDs.
- Removing a floor drawing must not delete the asset file from disk, but it must unassign the floor's `mapAssetId`.
- Zone visual area edit/delete affects only the visual overlay; it must not alter CPD Zone assignment or device group fields.
- Temporary 3D Zone areas are render-time only and must never be persisted to `.fireproj`.

## State Chain To Verify

```text
user action -> UI event -> store action -> project state cleanup -> undo/redo -> save payload -> open/normalize -> 2D render -> 3D resolve -> 3D scope/highlight -> rendered result
```

## Failure Modes

- Delete the selected Building while devices, drawings, Zone areas, and floor opacity overrides point to its floors.
- Delete the selected Floor while it is the only floor in a Building.
- Delete a floor with placed devices and manual Loop wiring visible on other floors.
- Clear a drawing from a floor that still has placed devices and Zone areas.
- Draw multiple Zone areas for the same Zone across multiple floors, then select a 3D Building/Floor scope.
- Highlight a Zone with saved area on one floor and only device placements on another floor.
- Draw invalid polygon points and verify they are rejected before persistence.
- Save/open after deletes and verify no orphan floor/building references remain.
- Undo/redo every delete/clear/edit action.

## Required Reading Before Execution

```text
AGENTS.md
goal-4/input.md
src/renderer/src/stores/fireProjectStore.ts
src/renderer/src/components/fire/Planner2D.vue
src/renderer/src/components/fire/Viewer3D.vue
src/renderer/src/domain/fire/viewer3DZoneArea.ts
src/renderer/src/domain/fire/viewer3DViewState.ts
src/renderer/src/domain/fire/zoneGeometry.ts
docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md
```

## Verification Baseline

Minimum final commands:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Runtime verification must use the real app or a renderer harness with `@vitejs/plugin-vue`. Do not treat a `.vue` import-analysis error from a wrong Vite boot path as a product failure.
