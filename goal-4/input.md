# Goal 4 Input

## Original Request

把前面 Zone 的问题和这次 2D 配置界面的问题都修复；先写一个 Tasks，这次需要全方面彻底修复。

## Defects To Cover

### Zone / 3D issues found in audit

- 3D Zone area rendering does not follow Building/Floor scope filtering.
- 3D Zone focus bounds can include hidden floors/buildings, causing camera focus to jump to unrelated areas.
- `resolveViewer3DZoneAreas()` uses all-or-nothing saved-area logic: if a Zone has one saved visual area, temporary areas are not generated for other floors with devices in the same Zone.
- Zone visual areas can be drawn but cannot be selected, deleted, or edited from the 2D UI.
- Polygon Zone areas have no geometry validation for duplicate points, tiny areas, or self-intersection.

### 2D configuration lifecycle issues found in audit

- New Building can be created but cannot be deleted.
- New Floor can be created but cannot be deleted.
- Imported floor drawing can be replaced but cannot be cleared/unassigned.
- Deleting Building/Floor must not leave orphan device placements, Zone areas, map references, or 3D floor opacity overrides.
- Existing tests only cover creation paths, not delete/cleanup/undo/redo/save-open lifecycle behavior.

## Product Boundaries

- Zone visual areas are visual overlays only. They must not change CPD Zone assignment.
- `.cpd` remains configuration-only.
- `.fireproj` remains the full save/open artifact for drawings, placements, Zone areas, Loop wiring, buildings, floors, and view settings.
- 2D remains configuration-only; runtime simulation behavior belongs in 3D.
