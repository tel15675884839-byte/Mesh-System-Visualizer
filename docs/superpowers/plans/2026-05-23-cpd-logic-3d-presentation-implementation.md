# CPD Logic And 3D Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CPD relation loss, add 3D opacity/filter/Zone-region presentation, and make 2D configuration-only.

**Architecture:** Add explicit relation audit/model helpers in the fire domain, keep CPD deserialization in the existing extractor/main-process boundary, and keep presentation behavior behind tested pure helper modules where possible. Vue components should call helpers and store setters rather than embedding relation rules directly in templates.

**Tech Stack:** Electron, Vue 3, TypeScript, Pinia, Element Plus, Three.js, Vitest, PowerShell CPD extractor.

---

## File Structure

- Create `src/renderer/src/domain/fire/cpdRelationAudit.ts`: relation counting and layer classification helpers for extractor JSON and adapted project data.
- Create `src/renderer/src/domain/fire/viewer3DViewState.ts`: pure filtering/highlighting state resolver for 3D scope, opacity and relation-context visibility.
- Create `src/renderer/src/domain/fire/viewer3DZoneArea.ts`: pure saved/temporary Zone area resolution helpers.
- Modify `src/renderer/src/domain/fire/types.ts`: add view-state and relation-audit types plus per-floor opacity override field.
- Modify `src/renderer/src/domain/fire/cpdAdapter.ts`: preserve missing relation fields and normalize group/zone links.
- Modify `src/renderer/src/domain/fire/simulation/causeEffect.ts`: consume completed normalized relations.
- Modify `src/renderer/src/stores/fireProjectStore.ts`: add setters for map opacity, per-floor opacity and 3D view state if persisted in project state.
- Modify `src/renderer/src/components/fire/Viewer3D.vue`: render opacity, scope controls, filtered devices/floors/loops and Zone regions.
- Modify `src/renderer/src/components/fire/Planner2D.vue`: remove runtime simulation imports, actions and classes.
- Modify `src/renderer/src/App.vue`: hide simulation panel/tab while in 2D.
- Modify `src/renderer/src/i18n/en.ts` and `src/renderer/src/i18n/zh.ts`: add labels for 3D controls and 2D/3D separation.
- Test files:
  - `src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
  - `src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts`
  - `src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts`
  - `src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts`
  - existing `cpdAdapter.test.ts`, `viewer3DHighlight.test.ts`, and simulation tests.

## Task 1: CPD Relationship Audit Baseline

**Files:**

- Create: `src/renderer/src/domain/fire/cpdRelationAudit.ts`
- Create: `src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
- Read/possibly generate fixture from: `D:\Users\30741\Desktop\程序开发\报警模拟器\Exam_6002_Answer_Advanced.cpd`

- [ ] **Step 1: Write failing relation-count tests**

Create tests that call an audit helper with a small inline extractor-shaped object:

```ts
const extractor = {
  panels: [{ panelNumber: 1, general: { SounderMode: 'Programmed' } }],
  zones: [{ panelNumber: 1, zoneNumber: 3, sounderGroupAlarm1: 4, ioGroup1Alarm1: 2 }],
  sounderGroups: [{ panelNumber: 1, groupId: 4, members: [{ loopId: 1, physicalAddress: 7 }] }],
  ioGroups: [{ panelNumber: 1, groupId: 2, members: [{ loopId: 1, physicalAddress: 8 }] }],
  devices: [
    {
      panelNumber: 1,
      loopId: 1,
      address: 7,
      zone: 3,
      sounderGroup: 4,
      raw: { InhibitSounders: true }
    },
    { panelNumber: 1, loopId: 1, address: 8, zone: 3, ioGroup: 2, raw: { DeviceDisabled: true } }
  ]
}
```

Expected audit counts:

```ts
expect(report.extractor.zoneToSounderGroupLinks).toBe(1)
expect(report.extractor.zoneToIOGroupLinks).toBe(1)
expect(report.extractor.sounderGroupMembers).toBe(1)
expect(report.extractor.ioGroupMembers).toBe(1)
expect(report.extractor.deviceZoneAssignments).toBe(2)
expect(report.extractor.deviceSounderGroupAssignments).toBe(1)
expect(report.extractor.deviceIOGroupAssignments).toBe(1)
expect(report.extractor.disableOrInhibitFields).toBe(2)
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
```

Expected: fail because `cpdRelationAudit.ts` does not exist.

- [ ] **Step 3: Implement the audit helper**

Add pure helpers:

```ts
export interface CpdRelationCountSet {
  zoneToSounderGroupLinks: number
  zoneToIOGroupLinks: number
  sounderGroupMembers: number
  ioGroupMembers: number
  deviceZoneAssignments: number
  deviceSounderGroupAssignments: number
  deviceIOGroupAssignments: number
  disableOrInhibitFields: number
  delayOrOverrideFields: number
}

export interface CpdRelationAuditReport {
  extractor: CpdRelationCountSet
  adapted: CpdRelationCountSet
  missing: Array<{
    layer: string
    relation: keyof CpdRelationCountSet
    extractor: number
    adapted: number
  }>
}
```

The helper must count extractor-shaped records and adapted `FireProject`/`FireDevice` records separately.

- [ ] **Step 4: Run focused test**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
```

Expected: pass.

## Task 2: CPD Relation Model And Adapter Normalization

**Files:**

- Modify: `src/renderer/src/domain/fire/types.ts`
- Modify: `src/renderer/src/domain/fire/cpdAdapter.ts`
- Modify: `src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`
- Modify: `src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
- Possibly modify: `D:\Users\30741\Desktop\程序开发\报警模拟器\CpdExtractorPortable\CpdExtractor.ps1`

- [ ] **Step 1: Write failing adapter tests**

Extend `cpdAdapter.test.ts` with a case proving:

- Zone 3 retains `sounderGroupAlarm1 = 4` and `ioGroup1Alarm1 = 2`;
- Sounder Group 4 has member L1/A7;
- I/O Group 2 has member L1/A8;
- devices assigned to Zone/Sounder Group/I/O Group are countable by `auditAdaptedCpdRelations`.

- [ ] **Step 2: Verify tests fail for missing mapping**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
```

Expected: at least one relation count or explicit mapping assertion fails before implementation.

- [ ] **Step 3: Implement normalization**

Update adapter mapping to:

- read camelCase and original CPD raw names for Zone links;
- read `members`, `GDataDetail`, `GDataDetailEx` style arrays when present;
- keep `raw` objects on Zone, Sounder Group, I/O Group and members;
- synthesize only missing groups and mark them with `raw.synthesizedFromDeviceGroups = true`.

- [ ] **Step 4: Extend extractor only if required**

If Task 1 proves fields are absent from extractor JSON, update `CpdExtractor.ps1` to emit the missing fields in the existing schema rather than adding browser-side `.cpd` parsing.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
npm run typecheck
```

Expected: pass.

## Task 3: 3D View State, Filtering And Opacity

**Files:**

- Create: `src/renderer/src/domain/fire/viewer3DViewState.ts`
- Create: `src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts`
- Modify: `src/renderer/src/domain/fire/types.ts`
- Modify: `src/renderer/src/stores/fireProjectStore.ts`
- Modify: `src/renderer/src/components/fire/Viewer3D.vue`
- Modify: `src/renderer/src/i18n/en.ts`
- Modify: `src/renderer/src/i18n/zh.ts`

- [ ] **Step 1: Write failing view-state tests**

Cover:

- global map opacity clamps to `0..1`;
- floor opacity override wins over global opacity;
- building scope hides unrelated buildings;
- floor scope hides unrelated floors in the same building;
- selected cross-floor relation endpoint remains visible when a selected Loop/Group spans floors.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts
```

Expected: fail because helper does not exist.

- [ ] **Step 3: Implement pure resolver**

Export types and functions:

```ts
export type Viewer3DScopeKind = 'all' | 'building' | 'floor' | 'type'
export interface Viewer3DScopeSelection {
  kind: Viewer3DScopeKind
  targetId: string | null
}
export function getFloorMapOpacity(globalOpacity: number, override?: number): number
export function shouldRenderViewer3DFloor(args: Viewer3DFloorVisibilityArgs): boolean
export function shouldRenderViewer3DDevice(args: Viewer3DDeviceVisibilityArgs): boolean
```

- [ ] **Step 4: Wire UI**

Add toolbar controls in `Viewer3D.vue` for opacity and scope. Use `el-slider`, `el-select` and existing highlight controls. Apply material opacity on 3D floor/map materials and filter render loops through the helper.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts
npm run typecheck
```

Expected: pass.

## Task 4: 3D Zone Area Highlight

**Files:**

- Create: `src/renderer/src/domain/fire/viewer3DZoneArea.ts`
- Create: `src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts`
- Modify: `src/renderer/src/components/fire/Viewer3D.vue`

- [ ] **Step 1: Write failing Zone-area tests**

Cover:

- saved `visualAreas` are returned unchanged for 3D rendering;
- temporary bounds are generated from placed devices when no saved area exists;
- temporary bounds are grouped per floor;
- unplaced devices do not create bounds;
- generated areas include padding and are marked `temporary: true`.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts
```

Expected: fail because helper does not exist.

- [ ] **Step 3: Implement helper and render path**

Use saved areas first. For temporary bounds, calculate min/max from placed device positions on the selected Zone and floor, add padding, and return rectangle points.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts
npm run typecheck
```

Expected: pass.

## Task 5: 2D Configuration-Only Behavior

**Files:**

- Create: `src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts`
- Modify: `src/renderer/src/components/fire/Planner2D.vue`
- Modify: `src/renderer/src/App.vue`

- [ ] **Step 1: Write failing static source contract test**

Test that `Planner2D.vue` no longer contains:

- `simulationMode`;
- `simulationState`;
- `getDeviceSimulationOutputState`;
- `activate-input`;
- `restore-input`;
- `trigger-fault`;
- `restore-fault`.

Test that `App.vue` renders `SimulationPanel` only when `viewMode === '3d'`.

- [ ] **Step 2: Verify test fails**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts
```

Expected: fail because 2D still imports and dispatches simulation behavior.

- [ ] **Step 3: Remove 2D simulation behavior**

Edit `Planner2D.vue` to keep selection, dragging, placement, context menu properties/removal/location, Zone tools and loop wiring, while removing runtime simulation state/classes/actions.

Edit `App.vue` so the simulation tab is not available in 2D and selecting 2D while the simulation tab is active switches to properties or group.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts
npm run typecheck
```

Expected: pass.

## Task 6: Simulation Consumes Completed CPD Relations

**Files:**

- Modify: `src/renderer/src/domain/fire/simulation/causeEffect.ts`
- Modify: `src/renderer/src/domain/fire/simulation/__tests__/causeEffect.test.ts`
- Modify: `src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`

- [ ] **Step 1: Write failing cause/effect tests**

Add tests that show a Zone alarm activates:

- Sounder Group linked by Zone alarm field;
- I/O Group linked by Zone alarm field;
- device outputs matched through group member loop/address;
- no disabled output;
- no inhibited output class.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
```

Expected: relation-driven output assertion fails before implementation.

- [ ] **Step 3: Implement cause/effect completion**

Update simulation logic to consume normalized Zone/group/member relations. Prefer existing device assignment fields when present, and fall back to group member loop/address matching.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts
npm run typecheck
```

Expected: pass.

## Task 7: Final Integration And Validation

**Files:**

- Modify: `goal-3/tasks.md`
- Modify only touched implementation files required by final fixes.

- [ ] **Step 1: Run final validation**

Run:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

- [ ] **Step 2: Fix validation failures**

Use the failing command output to make the smallest scoped fix, then rerun the failed command.

- [ ] **Step 3: Inspect status**

Run:

```powershell
git status --short
```

Record changed files in `goal-3/tasks.md`.

## Self-Review

- Spec coverage: Task 1 covers CPD audit; Task 2 covers extractor/adapter/model relation loss; Task 3 covers opacity and 3D filtering; Task 4 covers Zone area highlight; Task 5 covers 2D/3D separation; Task 6 covers simulation relation use; Task 7 covers i18n/final validation.
- Placeholder scan: no task uses placeholder-marker language as an acceptance step.
- Type consistency: view-state and relation-audit helper names are consistent across tasks and tests.
