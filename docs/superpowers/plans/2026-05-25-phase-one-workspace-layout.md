# Phase One Workspace Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the fixed right-side Properties / Output Groups / Simulation panel from the 2D workspace, keep 2D as the main planning canvas, and place Simulation controls inside the right side of the 3D view.

**Architecture:** This is a renderer layout change only. The CPD model, output group data, simulation engine, cause/effect behavior, project persistence, and group highlighting helpers stay intact. Device property change comparison against `6002-empty.cpd` is explicitly deferred.

**Tech Stack:** Electron, Vue 3 SFCs, TypeScript, Pinia, Element Plus, Three.js, Vitest static layout regression tests, renderer browser verification.

---

## Feature Contract

- Data source: existing `useFireProjectStore`, CPD adapter output, and simulation state.
- Write path: no CPD/device/output-group data writes are added.
- Read path: `App.vue` owns global workspace mode; `Viewer3D` reads simulation state and renders the `SimulationPanel` in-view.
- Persistence boundary: `.fireproj` schema and save/open payloads are unchanged.
- Business rules preserved:
  - Simulation remains explicit through `enterSimulationMode()` / `exitSimulationMode()`.
  - 2D configuration remains separate from simulation controls.
  - Output group data remains available to tree/group/highlight/simulation logic, but the old right tab UI is removed.
  - Device property changes compared with default CPD are not implemented in this phase.

## Failure Modes

- Removing the right panel breaks `selectedDeviceId` watches or stale emits.
- `SimulationPanel` mounted in 3D does not fill the side area or blocks the 3D canvas too much.
- The old independent `Simulation` top view remains visible and duplicates controls.
- 2D still has a panel toggle or reserves right-side width.
- The context menu still exposes `Open Properties` even though the target UI was removed.
- Existing output group logic is accidentally deleted instead of just the right panel tab.
- Mobile or narrow window layouts make the 3D panel cover all useful content.

## Test Matrix

- Static layout regression:
  - `App.vue` has only `cpd`, `2d`, and `3d` workspace modes.
  - `App.vue` does not import or render `PropertyPanel`, `GroupInspector`, right-panel tabs, or panel toggle controls.
  - `App.vue` does not render a standalone `SimulationPanel` center view.
  - `Viewer3D.template.html` renders `SimulationPanel` as part of the 3D view.
  - `DeviceContextMenu.vue` does not expose `Open Properties` while property changes are deferred.
- Type/lint/build:
  - `npm run typecheck`
  - targeted `npm run test -- ...`
  - broader `npm run test`
  - `npm run build`
- Runtime/UI:
  - start renderer with dev server or Electron preview as appropriate.
  - open app, load or seed a project if needed.
  - verify 2D has no right panel/tabs/toggle.
  - verify 3D shows the simulation panel on the right side.
  - verify no obvious overlap or unusable layout.
- Design review:
  - use `design-review` after runtime screenshots.
  - fix high-impact UI problems introduced by this phase.

## State Chain Trace

```text
user switches workspace mode
-> App.vue updates viewMode
-> App.vue renders CpdInspector, Planner2D, or Viewer3D only
-> Planner2D fills center workspace without right-panel overlay
-> Viewer3D renders 3D canvas plus right-side SimulationPanel
-> SimulationPanel dispatches existing store simulation actions
-> store updates simulationState
-> Viewer3D scene helpers receive simulationMode/simulationState
-> 3D objects and side SimulationPanel reflect the same runtime state
```

## Tasks

### Task 1: Write Failing Layout Tests

**Files:**

- Modify: `src/renderer/src/domain/fire/__tests__/appRightPanelOverlay.test.ts`
- Modify: `src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts`

- [x] Replace the old right-panel overlay expectations with the new phase-one layout contract.
- [x] Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/appRightPanelOverlay.test.ts src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts
```

- [x] Expected result before implementation: FAIL because the old right panel and standalone Simulation view still exist.

### Task 2: Remove App-Level Right Panel And Standalone Simulation View

**Files:**

- Modify: `src/renderer/src/App.vue`

- [x] Remove `RightPanelTab`, `rightPanelTab`, `isRightPanelOpen`, selected-device/right-panel watchers, `PropertyPanel`, `GroupInspector`, `SimulationPanel`, and right-panel toggle imports/usages.
- [x] Restrict `ViewMode` to `cpd | 2d | 3d`.
- [x] Remove the top-level `Simulation` radio button.
- [x] Render only `CpdInspector`, `Planner2D`, or `Viewer3D` in the center pane.
- [x] Remove `.right-pane`, `.panel-toggle`, and right-panel transition CSS.
- [x] Keep the workspace grid as device tree plus main workspace.

### Task 3: Embed Simulation Panel In The 3D View

**Files:**

- Modify: `src/renderer/src/components/fire/Viewer3D.ts`
- Modify: `src/renderer/src/components/fire/Viewer3D.template.html`
- Modify: `src/renderer/src/components/fire/Viewer3D.css`

- [x] Import/register `SimulationPanel` in `Viewer3D.ts`.
- [x] Render `<SimulationPanel class="viewer-simulation-panel" />` inside `Viewer3D.template.html`.
- [x] Add CSS so the panel is docked to the right of the 3D view, scrolls internally, and leaves the 3D canvas visible.
- [x] Add responsive CSS so narrow screens stack or reduce the panel without blocking the viewer.

### Task 4: Defer Device Property Changes Cleanly

**Files:**

- Modify: `src/renderer/src/components/fire/DeviceContextMenu.vue`
- Modify: `src/renderer/src/components/fire/Planner2D.template.html`
- Modify: `src/renderer/src/components/fire/Viewer3D.template.html`

- [x] Remove `Open Properties` from the context menu while the property-change comparison feature is deferred.
- [x] Remove `openProperties` emits/listeners from 2D and 3D templates.
- [x] Keep `Remove from Drawing`, `Locate in Tree`, and simulation context actions unchanged.

### Task 5: Verify And Review UI

**Files:**

- Modify only if verification or design review exposes a scoped issue.

- [x] Run targeted layout tests and confirm they pass.
- [x] Run broader tests/typecheck/build.
- [x] Start a renderer runtime and inspect the UI.
- [x] Use `design-review` to audit the changed 2D/3D layout.
- [x] Apply any scoped UI polish needed by the audit.
- [x] Re-run verification after any polish.

## Deferred

- Device property changed-values view.
- CPD default comparison against `fixtures/cpd/6002-empty.cpd`.
- Dedicated replacement UI for Output Groups.
- Any simulation-engine behavior changes.
