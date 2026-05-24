# Numens Fire Alarm Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current Electron/Vue/Three.js Mesh Studio copy into `Numens Fire Alarm Simulator`, a CPD-driven 2D/3D fire alarm planning and simulation application.

**Architecture:** Keep the existing Electron, Vue, TypeScript, Element Plus, Pinia, and Three.js application shell. Replace Mesh-specific domain code with a CPD-normalized project model, a `.fireproj` package format, planning tools for devices/Zones/Loops, and a deterministic CIE simulation engine.

**Tech Stack:** Electron, electron-vite, Vue 3, TypeScript, Pinia, Element Plus, Three.js, vis-network where retained for 2D canvas behavior, PowerShell CPD extractor, Vitest or Node-based TypeScript tests added as part of the test harness.

---

## Execution Governance

The primary assistant acts as implementation manager and final reviewer. SubAgents do feature code, tests, and first-pass verification.

Per task:

1. Manager dispatches one worker SubAgent with this task's exact scope.
2. Worker edits only the files assigned in the task.
3. Worker runs the required commands and reports outputs.
4. Manager dispatches a spec-compliance reviewer SubAgent.
5. If spec review fails, worker fixes and the spec reviewer rechecks.
6. Manager dispatches a code-quality reviewer SubAgent.
7. If code review fails, worker fixes and the code reviewer rechecks.
8. Manager marks the task complete only after both reviews pass.

Workers must not revert unrelated changes. The current worktree may already contain user changes.

Recommended manager verification after each task:

```powershell
git status --short
npm run typecheck
```

Run heavier checks when UI or packaging behavior changes:

```powershell
npm run lint
npm run build
```

## Current Project Root

All paths below are relative to:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator
```

## Planned File Structure

Create domain modules:

```text
src/renderer/src/domain/fire/types.ts
src/renderer/src/domain/fire/cpdAdapter.ts
src/renderer/src/domain/fire/deviceIcons.ts
src/renderer/src/domain/fire/issues.ts
src/renderer/src/domain/fire/loopWiring.ts
src/renderer/src/domain/fire/zoneGeometry.ts
src/renderer/src/domain/fire/simulation/types.ts
src/renderer/src/domain/fire/simulation/engine.ts
src/renderer/src/domain/fire/simulation/delays.ts
src/renderer/src/domain/fire/simulation/causeEffect.ts
src/renderer/src/domain/fire/simulation/reducer.ts
```

Create project and package modules:

```text
src/renderer/src/stores/fireProjectStore.ts
src/main/fireProjectPackage.ts
src/main/cpdImport.ts
src/preload/fireApi.ts
```

Create UI components:

```text
src/renderer/src/components/fire/DeviceTree.vue
src/renderer/src/components/fire/DeviceContextMenu.vue
src/renderer/src/components/fire/PropertyPanel.vue
src/renderer/src/components/fire/Planner2D.vue
src/renderer/src/components/fire/Viewer3D.vue
src/renderer/src/components/fire/ZoneToolbar.vue
src/renderer/src/components/fire/LoopWiringToolbar.vue
src/renderer/src/components/fire/SimulationPanel.vue
src/renderer/src/components/fire/GroupInspector.vue
src/renderer/src/components/fire/ImportDiffDialog.vue
```

Create i18n modules:

```text
src/renderer/src/i18n/index.ts
src/renderer/src/i18n/en.ts
src/renderer/src/i18n/zh.ts
```

Create tests:

```text
src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts
src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts
src/renderer/src/domain/fire/__tests__/issues.test.ts
src/renderer/src/domain/fire/__tests__/loopWiring.test.ts
src/renderer/src/domain/fire/__tests__/zoneGeometry.test.ts
src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts
src/renderer/src/domain/fire/simulation/__tests__/delays.test.ts
src/renderer/src/domain/fire/simulation/__tests__/causeEffect.test.ts
```

Modify existing app shell files:

```text
src/main/index.ts
src/preload/index.ts
src/preload/index.d.ts
src/renderer/src/App.vue
src/renderer/src/main.ts
src/renderer/src/assets/main.css
package.json
```

Retire or replace Mesh-specific modules during implementation:

```text
src/renderer/src/stores/projectStore.ts
src/renderer/src/types/index.ts
src/renderer/src/utils/htmlParser.ts
src/renderer/src/utils/treeHelper.ts
src/renderer/src/components/LoopManager.vue
src/renderer/src/components/DeviceTree.vue
src/renderer/src/components/DeviceList.vue
src/renderer/src/components/TwoDView.vue
src/renderer/src/components/ThreeDView.vue
src/renderer/src/components/PropertyPanel.vue
```

These can remain temporarily while new modules are wired in, but their Mesh semantics must not remain in final user-facing behavior.

## Task 1: Add Test Harness And Domain Type Skeleton

**Files:**

- Modify: `package.json`
- Create: `src/renderer/src/domain/fire/types.ts`
- Create: `src/renderer/src/domain/fire/simulation/types.ts`
- Create: `src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts`

- [ ] **Step 1: Add test tooling scripts**

Add `vitest` as a dev dependency and add scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
  }
}
```

Preserve all existing scripts and dependencies.

- [ ] **Step 2: Create fire domain types**

Create `src/renderer/src/domain/fire/types.ts` with exported TypeScript types for:

```ts
export type SounderMode = 'Programmed' | 'Preset'
export type PlacementStatus = 'unplaced' | 'placed' | 'missing'
export type GroupMode = 'loop' | 'zone' | 'type' | 'sounderGroup' | 'ioGroup'
export type DeviceStatusFilter = 'all' | 'unplaced' | 'placed' | 'issues'
export type ZoneAlarmMode = 'single' | 'double'
export type VisualShapeKind = 'rectangle' | 'polygon'

export interface Vector2 {
  x: number
  y: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface FireProject {
  schemaVersion: number
  projectId: string
  name: string
  createdAt: number
  updatedAt: number
  language: 'en' | 'zh'
  networks: FireNetwork[]
  buildings: FireBuilding[]
  assets: FireAsset[]
  viewSettings: FireViewSettings
  simulationSettings: SimulationSettings
}

export interface FireNetwork {
  id: string
  name: string
  sourceFileName: string
  sourceImportedAt: number
  extractorVersion?: string
  sounderMode: SounderMode
  panels: FirePanel[]
}

export interface FirePanel {
  id: string
  networkId: string
  panelNumber: number
  panelName: string
  panelModel?: string
  general: PanelGeneralConfig
  loops: FireLoop[]
  zones: FireZone[]
  sounderGroups: SounderGroup[]
  ioGroups: IOGroup[]
  sounders: PanelSounderConfig
}

export interface PanelGeneralConfig {
  panelNumber: number
  sounderMode: SounderMode
  faultIOGroup?: number
  evacuateDelaySeconds: number
  evacuateMode?: string
  sounderDelaySeconds: number
  sounderActiveOn?: string
  sounderMode1?: string
  inputOutputDelaySeconds: number
  fireBrigadeDelaySeconds: number
  fireBrigadeActiveOn?: string
  fireBrigadeMode?: string
  onManualCallPoints: boolean
  onTwoDevices: boolean
  delayOffAtNight: boolean
  raw: Record<string, unknown>
}

export interface FireLoop {
  id: string
  networkId: string
  panelId: string
  loopId: number
  name: string
  configuredDeviceOrder: string[]
  manualDeviceOrder: string[]
  color: string
}

export interface FireDevice {
  id: string
  networkId: string
  panelId: string
  panelNumber: number
  loopId?: number
  address?: number
  type: string
  friendlyTypeName: string
  description?: string
  classify?: string
  location?: string
  zoneNumber?: number
  sounderGroupId?: number
  ioGroupId?: number
  isInputCapable: boolean
  isOutputCapable: boolean
  isSounder: boolean
  isWirelessType: boolean
  disabled: boolean
  inhibitSounders: boolean
  inhibitIO: boolean
  inhibitRelays: boolean
  evacuateIO: boolean
  ioOverrideDelay: boolean
  immediateEvacuate: boolean
  setEvacuateTimer: boolean
  overrideDelays: boolean
  selectedDisablement?: string
  reportingDetail?: string
  smokeSensitivity?: string
  heatGrade?: string
  sounderGroupValue?: string
  imageIndex?: number
  placement: DevicePlacement
  raw: Record<string, unknown>
}

export interface DevicePlacement {
  status: PlacementStatus
  buildingId?: string
  floorId?: string
  position?: Vector3
  rotation?: number
}

export interface FireZone {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  text: string
  enabled: boolean
  delayedSounders: boolean
  alarmMode: ZoneAlarmMode
  sounderGroupAlarm1?: number
  sounderGroupAlarm2?: number
  ioGroup1Alarm1?: number
  ioGroup1Alarm2?: number
  ioGroup2Alarm1?: number
  ioGroup3Alarm1?: number
  ioGroup4Alarm1?: number
  visualAreas: ZoneVisualArea[]
  raw: Record<string, unknown>
}

export interface ZoneVisualArea {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  buildingId: string
  floorId: string
  kind: VisualShapeKind
  points: Vector2[]
  color: string
  opacity: number
}

export interface SounderGroup {
  id: string
  networkId: string
  panelId: string
  groupId: number
  title?: string
  description?: string
  addressableMembers: GroupMember[]
  nonAddressableMembers: NonAddressableSounderMember[]
  raw: Record<string, unknown>
}

export interface IOGroup {
  id: string
  networkId: string
  panelId: string
  groupId: number
  members: GroupMember[]
  raw: Record<string, unknown>
}

export interface GroupMember {
  loopId?: number
  physicalAddress?: number
  description?: string
  status?: string
  raw: Record<string, unknown>
}

export interface NonAddressableSounderMember {
  cieId?: number
  nonAddressable1?: boolean
  nonAddressable2?: boolean
  raw: Record<string, unknown>
}

export interface NonAddressableSounderPoint {
  id: string
  networkId: string
  panelId: string
  sounderGroupId: number
  cieId?: number
  channel: 'nonAddressable1' | 'nonAddressable2'
  label: string
  placement: DevicePlacement
}

export interface FireBuilding {
  id: string
  name: string
  floors: FireFloor[]
  position?: Vector2
  size?: { width: number; depth: number }
  rotation?: number
}

export interface FireFloor {
  id: string
  buildingId: string
  name: string
  levelIndex: number
  mapAssetId?: string
  mapWidth?: number
  mapHeight?: number
  camera2D?: { x: number; y: number; scale: number }
  floorScale3D?: number
  floorHeight3D?: number
}

export interface FireAsset {
  id: string
  kind: 'map' | 'icon' | 'audio'
  name: string
  packagePath: string
  mimeType?: string
}

export interface FireViewSettings {
  deviceIconScale2D: number
  deviceIconScale3D: number
  mapOpacity: number
  labelColor: string
  showLoopLines: boolean
  showGroupHelperLines: boolean
}

export interface SimulationSettings {
  timeScale: 1 | 5 | 10 | 30
  soundEnabled: boolean
}

export interface PanelSounderConfig {
  raw: Record<string, unknown>
}
```

- [ ] **Step 3: Create simulation type file**

Create `src/renderer/src/domain/fire/simulation/types.ts`:

```ts
export type SystemState = 'normal' | 'fault' | 'evacuate' | 'fireAlarm'
export type OutputState = 'normal' | 'delayActive' | 'active' | 'inhibited' | 'disabled'
export type SoundState = 'silent' | 'fault' | 'fire'

export interface ActiveInputAlarm {
  deviceId: string
  activatedAt: number
}

export interface ActiveFault {
  deviceId: string
  activatedAt: number
}

export interface OutputActivation {
  outputId: string
  state: OutputState
  causes: string[]
  remainingDelaySeconds?: number
  reason?: string
}

export interface SimulationState {
  systemState: SystemState
  soundState: SoundState
  buzzerSilenced: boolean
  activeInputAlarms: ActiveInputAlarm[]
  activeFaults: ActiveFault[]
  outputs: OutputActivation[]
  eventLog: SimulationEvent[]
}

export interface SimulationEvent {
  id: string
  timestamp: number
  type: string
  message: string
  relatedDeviceId?: string
}
```

- [ ] **Step 4: Add a smoke test to verify Vitest runs**

Create `src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs TypeScript tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run verification**

Run:

```powershell
npm install
npm run test
npm run typecheck
```

Expected:

- `npm run test` passes.
- `npm run typecheck` passes or reveals pre-existing type errors that must be recorded before continuing.

## Task 2: Implement Device Icon Mapping And Device Classification

**Files:**

- Create: `src/renderer/src/domain/fire/deviceIcons.ts`
- Replace smoke test: `src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts`

- [ ] **Step 1: Write icon mapping tests**

Replace `deviceIcons.test.ts` with tests for:

```ts
import { describe, expect, it } from 'vitest'
import {
  getDeviceIconByType,
  getFriendlyDeviceTypeName,
  isInputCapableType,
  isOutputCapableType,
  normalizeDeviceType
} from '../deviceIcons'

describe('device icon mapping', () => {
  it('normalizes case, hyphen, and spaces', () => {
    expect(normalizeDeviceType(' Wireless-Heat   Det ')).toBe('wireless_heat det')
  })

  it('maps known CPD type to icon', () => {
    expect(getDeviceIconByType('manual_call_point')).toBe('manual-call-point.svg')
    expect(getDeviceIconByType('smoke_detector')).toBe('optical-detector.svg')
  })

  it('returns unknown icon for unsupported type', () => {
    expect(getDeviceIconByType('not_real')).toBe('unknown-device.svg')
  })

  it('returns friendly names', () => {
    expect(getFriendlyDeviceTypeName('wireless_sounder')).toBe('Wireless Sounder')
  })

  it('treats I/O as input and output capable', () => {
    expect(isInputCapableType('input_output')).toBe(true)
    expect(isOutputCapableType('input_output')).toBe(true)
  })

  it('treats sounder as output only', () => {
    expect(isInputCapableType('sounder')).toBe(false)
    expect(isOutputCapableType('sounder')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts
```

Expected:

- FAIL because `deviceIcons.ts` does not exist.

- [ ] **Step 3: Implement mapping**

Create `src/renderer/src/domain/fire/deviceIcons.ts`:

```ts
export const unknownDeviceIcon = 'unknown-device.svg'

export const deviceIconByType: Record<string, string> = {
  co_det: 'co-detector.svg',
  gas_det: 'gas-detector.svg',
  heat_det: 'heat-detector.svg',
  input_output: 'input-output.svg',
  manual_call_point: 'manual-call-point.svg',
  multi_det: 'multi-detector.svg',
  optical_det: 'optical-detector.svg',
  smoke_detector: 'optical-detector.svg',
  sounder: 'sounder.svg',
  zone_monitor: 'zone-monitor.svg',
  wireless_co_det: 'wireless-co-detector.svg',
  wireless_gas_det: 'wireless-gas-detector.svg',
  wireless_heat_det: 'wireless-heat-detector.svg',
  wireless_input_output: 'wireless-input-output.svg',
  wireless_manual_call_point: 'wireless-manual-call-point.svg',
  wireless_multi_det: 'wireless-multi-detector.svg',
  wireless_optical_det: 'wireless-optical-detector.svg',
  wireless_sounder: 'wireless-sounder.svg'
}

export const friendlyNameByType: Record<string, string> = {
  co_det: 'CO Detector',
  gas_det: 'Gas Detector',
  heat_det: 'Heat Detector',
  input_output: 'Input/Output',
  manual_call_point: 'Manual Call Point',
  multi_det: 'Multi Detector',
  optical_det: 'Optical Detector',
  smoke_detector: 'Optical Detector',
  sounder: 'Sounder',
  zone_monitor: 'Zone Monitor',
  wireless_co_det: 'Wireless CO Detector',
  wireless_gas_det: 'Wireless Gas Detector',
  wireless_heat_det: 'Wireless Heat Detector',
  wireless_input_output: 'Wireless Input/Output',
  wireless_manual_call_point: 'Wireless Manual Call Point',
  wireless_multi_det: 'Wireless Multi Detector',
  wireless_optical_det: 'Wireless Optical Detector',
  wireless_sounder: 'Wireless Sounder'
}

const inputCapableTypes = new Set([
  'co_det',
  'gas_det',
  'heat_det',
  'input_output',
  'manual_call_point',
  'multi_det',
  'optical_det',
  'smoke_detector',
  'zone_monitor',
  'wireless_co_det',
  'wireless_gas_det',
  'wireless_heat_det',
  'wireless_input_output',
  'wireless_manual_call_point',
  'wireless_multi_det',
  'wireless_optical_det'
])

const outputCapableTypes = new Set([
  'input_output',
  'sounder',
  'wireless_input_output',
  'wireless_sounder'
])

export function normalizeDeviceType(type: string | undefined | null): string {
  return String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, ' ')
}

export function getDeviceIconByType(type: string | undefined | null): string {
  return deviceIconByType[normalizeDeviceType(type)] ?? unknownDeviceIcon
}

export function getFriendlyDeviceTypeName(type: string | undefined | null): string {
  const normalized = normalizeDeviceType(type)
  return friendlyNameByType[normalized] ?? String(type ?? 'Unknown Device')
}

export function isInputCapableType(type: string | undefined | null): boolean {
  return inputCapableTypes.has(normalizeDeviceType(type))
}

export function isOutputCapableType(type: string | undefined | null): boolean {
  return outputCapableTypes.has(normalizeDeviceType(type))
}

export function isWirelessDeviceType(type: string | undefined | null): boolean {
  return normalizeDeviceType(type).startsWith('wireless_')
}

export function isSounderType(type: string | undefined | null): boolean {
  const normalized = normalizeDeviceType(type)
  return normalized === 'sounder' || normalized === 'wireless_sounder'
}
```

- [ ] **Step 4: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts
npm run typecheck
```

Expected:

- Device icon tests pass.
- Typecheck passes.

## Task 3: Implement CPD Adapter

**Files:**

- Create: `src/renderer/src/domain/fire/cpdAdapter.ts`
- Create: `src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts`
- Modify only if needed: `src/renderer/src/domain/fire/types.ts`

- [ ] **Step 1: Write adapter tests**

Create tests covering:

- one Network from source file,
- multiple Panels,
- Sounder Mode,
- Panel general delay seconds,
- devices normalized with `panel + loop + address` key,
- I/O input/output dual capability,
- Zone Group mapping,
- unresolved `alarmMode` creates an issue marker in raw or adapter diagnostics.

Use a minimal extractor-like fixture inside the test:

```ts
const fixture = {
  schemaVersion: 1,
  extractor: { name: 'CpdExtractor', version: '1.0.0' },
  source: { fileName: 'sample.cpd', exportedAt: '2026-05-22T00:00:00.000Z' },
  panelCount: 1,
  panels: [
    {
      panelNumber: 1,
      panelModel: 'ControlPanel6002_N',
      general: {
        PanelNumber: 1,
        SounderMode: 'Programmed',
        FaultIOGroup: 5,
        SounderDelayMM: 1,
        SounderDelaySS: 30,
        InputOutputDelayMM: 0,
        InputOutputDelaySS: 15,
        FireBrigadeDelayMM: 2,
        FireBrigadeDelaySS: 0,
        EvacuteDelayMM: 0,
        EvacuteDelaySS: 20,
        OnManualCallPoints: true,
        OnTwoDevices: true
      }
    }
  ],
  devices: [
    {
      panelNumber: 1,
      panelId: 'panel-1',
      loopId: 1,
      address: 10,
      type: 'manual_call_point',
      classify: 'Manual Call Point',
      description: 'MCP',
      location: 'Lobby',
      zone: 3,
      sounderGroup: 7,
      ioGroup: 9,
      disabled: false,
      inhibitSounders: false,
      inhibitIO: false,
      overrideDelays: false,
      immediateEvacuate: true,
      raw: { PhysicalAddress: 10 }
    }
  ],
  zones: [
    {
      panelNumber: 1,
      zoneNumber: 3,
      text: 'Lobby',
      enabled: true,
      delayedSounders: true,
      sounderGroupAlarm1: 7,
      sounderGroupAlarm2: 8,
      ioGroup1Alarm1: 9,
      ioGroup1Alarm2: 10,
      raw: {}
    }
  ],
  sounderGroups: [
    {
      panelNumber: 1,
      groupId: 7,
      title: 'SG7',
      description: 'Main sounders',
      members: [{ loopId: 1, physicalAddress: 11, status: 'enabled', raw: {} }],
      raw: {}
    }
  ],
  ioGroups: [
    {
      panelNumber: 1,
      groupId: 9,
      members: [{ entry: 1, loopId: 1, physicalAddress: 10, description: 'I/O', raw: {} }],
      raw: {}
    }
  ]
}
```

- [ ] **Step 2: Implement adapter**

Create:

```ts
export interface CpdAdapterResult {
  projectName: string
  network: FireNetwork
  devices: FireDevice[]
  issues: FireIssue[]
}

export function adaptCpdExport(input: unknown, now = Date.now()): CpdAdapterResult
```

Implementation rules:

- Generate Network ID as `network-${safeFileBase}-${now}`.
- Generate Panel ID as `${networkId}-panel-${panelNumber}`.
- Generate Device ID as `${panelId}-loop-${loopId}-addr-${address}` when Loop and Address exist.
- Sounder Mode maps only `Programmed` and `Preset`; unknown values become `Programmed` and create Issue.
- Delay seconds = `MM * 60 + SS`, using zero for missing values.
- Zone `alarmMode`:
  - use `zone.alarmMode` if it is `single` or `double`,
  - otherwise use `single` and create Issue `zone.alarm-mode-unresolved`.
- Preserve raw rows.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts
npm run typecheck
```

Expected:

- Tests pass.
- Typecheck passes.

## Task 4: Implement Issue Detection

**Files:**

- Create: `src/renderer/src/domain/fire/issues.ts`
- Create: `src/renderer/src/domain/fire/__tests__/issues.test.ts`

- [ ] **Step 1: Write tests for issue detection**

Cover:

- missing Loop or Address,
- placed missing source device,
- missing Zone reference,
- missing Sounder Group reference,
- missing I/O Group reference,
- manual Loop segment references unplaced device,
- active non-addressable sounder without representative point.

- [ ] **Step 2: Implement `collectFireProjectIssues`**

Create:

```ts
export type FireIssueSeverity = 'info' | 'warning' | 'error'

export interface FireIssue {
  id: string
  code: string
  severity: FireIssueSeverity
  message: string
  relatedDeviceId?: string
  relatedPanelId?: string
  relatedLoopId?: string
  relatedZoneId?: string
  relatedGroupId?: string
}

export function collectFireProjectIssues(project: FireProject): FireIssue[]
```

Rules:

- `device.missing-loop-address` is error.
- `device.source-missing-placed` is warning.
- `device.zone-missing` is warning.
- `device.sounder-group-missing` is warning.
- `device.io-group-missing` is warning.
- `loop.manual-order-unplaced-device` is warning.
- `sounder.non-addressable-no-point` is info.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/issues.test.ts
npm run typecheck
```

## Task 5: Implement Loop Wiring Domain Logic

**Files:**

- Create: `src/renderer/src/domain/fire/loopWiring.ts`
- Create: `src/renderer/src/domain/fire/__tests__/loopWiring.test.ts`

- [ ] **Step 1: Write tests**

Cover:

- effective order uses manual order when non-empty,
- default order uses configured order,
- 2D segments include only same-floor placed device pairs,
- 3D segments include placed device pairs even across floors,
- unplaced devices skip that segment and produce skipped count.

- [ ] **Step 2: Implement functions**

Create:

```ts
export interface LoopSegment {
  fromDeviceId: string
  toDeviceId: string
}

export interface LoopSegmentsResult {
  segments: LoopSegment[]
  skippedSegments: LoopSegment[]
}

export function getEffectiveLoopOrder(loop: FireLoop): string[]
export function buildLoopSegments(loop: FireLoop, devices: FireDevice[]): LoopSegmentsResult
export function buildCurrentFloorLoopSegments(
  loop: FireLoop,
  devices: FireDevice[],
  floorId: string
): LoopSegmentsResult
```

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/loopWiring.test.ts
npm run typecheck
```

## Task 6: Implement Zone Geometry Domain Logic

**Files:**

- Create: `src/renderer/src/domain/fire/zoneGeometry.ts`
- Create: `src/renderer/src/domain/fire/__tests__/zoneGeometry.test.ts`

- [ ] **Step 1: Write tests**

Cover:

- rectangle points from drag start/end,
- polygon area stores clicked points,
- temporary bounding rectangle around placed Zone devices,
- point-in-polygon detects device inside wrong Zone visual area.

- [ ] **Step 2: Implement geometry helpers**

Create:

```ts
export function createRectangleArea(args: {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  buildingId: string
  floorId: string
  start: Vector2
  end: Vector2
  color: string
  opacity: number
}): ZoneVisualArea

export function createPolygonArea(args: {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  buildingId: string
  floorId: string
  points: Vector2[]
  color: string
  opacity: number
}): ZoneVisualArea

export function buildBoundingAreaForDevices(devices: FireDevice[], padding: number): Vector2[]

export function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean
```

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/zoneGeometry.test.ts
npm run typecheck
```

## Task 7: Implement CIE Simulation Engine Core

**Files:**

- Create: `src/renderer/src/domain/fire/simulation/delays.ts`
- Create: `src/renderer/src/domain/fire/simulation/causeEffect.ts`
- Create: `src/renderer/src/domain/fire/simulation/engine.ts`
- Create: `src/renderer/src/domain/fire/simulation/__tests__/delays.test.ts`
- Create: `src/renderer/src/domain/fire/simulation/__tests__/causeEffect.test.ts`
- Create: `src/renderer/src/domain/fire/simulation/__tests__/engine.test.ts`

- [ ] **Step 1: Write delay tests**

Cover:

- general sounder delay,
- I/O delay,
- Fire Brigade delay,
- Evacuate delay,
- skip delay,
- time scale reducing remaining seconds.

- [ ] **Step 2: Write cause/effect tests**

Cover:

- Programmed stage 1 Zone outputs,
- Programmed stage 2 Zone outputs,
- Preset activates all Network sounders,
- I/O remains config-driven in Preset,
- disabled input does not create effective alarm,
- inhibit sounders blocks sounders,
- inhibit I/O blocks I/O,
- fire sound priority over fault sound.

- [ ] **Step 3: Write engine tests**

Cover:

- double-click active input equivalent action activates alarm,
- restoring input removes source,
- system reset with active source returns to alarm,
- buzzer silence silences current sound,
- new alarm after buzzer silence restarts sound,
- trigger fault activates FaultIOGroup,
- restore fault clears source,
- manual evacuate starts evacuate flow.

- [ ] **Step 4: Implement simulation modules**

Required public API:

```ts
export interface SimulationEngineInput {
  network: FireNetwork
  devices: FireDevice[]
  nonAddressablePoints: NonAddressableSounderPoint[]
  now: number
}

export type SimulationAction =
  | { type: 'activate-input'; deviceId: string; at: number }
  | { type: 'restore-input'; deviceId: string; at: number }
  | { type: 'trigger-fault'; deviceId: string; at: number }
  | { type: 'restore-fault'; deviceId: string; at: number }
  | { type: 'evacuate'; at: number }
  | { type: 'buzzer-silence'; at: number }
  | { type: 'system-reset'; at: number }
  | { type: 'tick'; at: number; elapsedSeconds: number }
  | { type: 'skip-delay'; outputId: string; at: number }

export function createInitialSimulationState(): SimulationState
export function reduceSimulation(
  state: SimulationState,
  input: SimulationEngineInput,
  action: SimulationAction
): SimulationState
```

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/simulation
npm run typecheck
```

## Task 8: Build Fire Project Store

**Files:**

- Create: `src/renderer/src/stores/fireProjectStore.ts`
- Modify: `src/renderer/src/main.ts`
- Create store tests if store testing pattern is added.

- [ ] **Step 1: Implement Pinia store**

The store must expose:

```ts
project
selectedNetworkId
selectedPanelId
selectedDeviceId
treeGroupMode
deviceStatusFilter
searchText
simulationMode
simulationState
activeTool
```

Actions:

```ts
loadFromCpdAdapterResult(result)
loadFireProject(project)
selectDevice(deviceId)
placeDevices(deviceIds, buildingId, floorId, startPosition)
moveDevice(deviceId, position)
removeDeviceFromDrawing(deviceId)
setTreeGroupMode(mode)
setDeviceStatusFilter(filter)
setSearchText(text)
addZoneArea(area)
removeZoneArea(areaId)
setManualLoopOrder(loopId, deviceIds)
restoreDefaultLoopWiring(loopId)
enterSimulationMode()
exitSimulationMode()
dispatchSimulationAction(action)
```

- [ ] **Step 2: Add undo/redo store support**

Use transaction snapshots for planning operations:

- placement,
- movement,
- remove placement,
- Zone visual area change,
- manual Loop wiring change.

Expose:

```ts
canUndo
canRedo
undo()
redo()
```

Do not store history in `.fireproj`.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run typecheck
npm run test
```

## Task 9: Implement Main Process CPD Import IPC

**Files:**

- Create: `src/main/cpdImport.ts`
- Modify: `src/main/index.ts`
- Create: `src/preload/fireApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Implement main-process import function**

Create a function:

```ts
export async function importCpdFile(args: {
  cpdPath: string
  extractorDir: string
  tempDir: string
}): Promise<{ jsonPath: string; content: string }>
```

Behavior:

- Call `CpdExtractor.cmd` or `CpdExtractor.ps1`.
- Write output JSON to temp path.
- Return JSON content.
- Convert extractor exit codes into user-facing errors.

- [ ] **Step 2: Add IPC handlers**

Expose:

```ts
fire:select-and-import-cpd
```

The handler opens a file dialog for `.cpd`, runs extractor, and returns parsed JSON content plus source path metadata.

- [ ] **Step 3: Update preload API**

Expose typed API:

```ts
window.fireApi.importCpd()
```

- [ ] **Step 4: Run verification**

Run:

```powershell
npm run typecheck:node
npm run typecheck:web
```

## Task 10: Implement `.fireproj` Package Import And Export

**Files:**

- Create: `src/main/fireProjectPackage.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/fireApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `package.json`

- [ ] **Step 1: Add package dependency**

Add a zip library such as `adm-zip` or `yazl/yauzl`. Prefer a simple maintained package already compatible with Electron main process.

- [ ] **Step 2: Implement export**

Create:

```ts
export async function writeFireProjectPackage(args: {
  targetPath: string
  metadata: unknown
  project: unknown
  assetPaths: Array<{ packagePath: string; sourcePath: string }>
}): Promise<void>
```

Output contains:

```text
metadata.json
project.json
assets/maps/
assets/icons/
assets/audio/
```

Do not include original `.cpd`.

- [ ] **Step 3: Implement import**

Create:

```ts
export async function readFireProjectPackage(path: string): Promise<{
  metadata: unknown
  project: unknown
  extractedAssetRoot: string
}>
```

- [ ] **Step 4: Add IPC and preload API**

Expose:

```ts
window.fireApi.saveFireProject(projectPayload)
window.fireApi.openFireProject()
```

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

## Task 11: Implement Device Tree UI

**Files:**

- Create: `src/renderer/src/components/fire/DeviceTree.vue`
- Create helper if needed: `src/renderer/src/domain/fire/tree.ts`
- Create tests if helper is pure: `src/renderer/src/domain/fire/__tests__/tree.test.ts`

- [ ] **Step 1: Implement pure tree builder**

Inputs:

- project,
- group mode,
- status filter,
- search text.

Output:

```text
Network
  Panel
    Group
      Device
```

Group modes:

- Loop,
- Zone,
- Type,
- Sounder Group,
- I/O Group.

- [ ] **Step 2: Implement UI component**

Controls:

- group mode segmented control,
- status filter segmented control with `All`, `Unplaced`, `Placed`, `Issues`,
- search input,
- tree rows with icon and status.

Interactions:

- left-click selects,
- double-click in normal mode locates/focuses only,
- drag supports device placement,
- right-click emits context menu request.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/tree.test.ts
npm run typecheck
```

## Task 12: Implement 2D Planner UI

**Files:**

- Create: `src/renderer/src/components/fire/Planner2D.vue`
- Create: `src/renderer/src/components/fire/DeviceContextMenu.vue`
- Create: `src/renderer/src/components/fire/ZoneToolbar.vue`
- Create: `src/renderer/src/components/fire/LoopWiringToolbar.vue`
- Modify store if needed: `src/renderer/src/stores/fireProjectStore.ts`

- [ ] **Step 1: Render map and placed devices**

Use existing 2D canvas/vis-network behavior where useful. Render:

- floor drawing,
- placed devices,
- labels,
- selected device state,
- alarm/fault/output visual states.

- [ ] **Step 2: Implement device drag placement**

Support:

- one device,
- multi-device grid placement,
- moving placed device,
- remove from drawing through context menu.

- [ ] **Step 3: Implement context menu**

Menu items:

- Open Properties,
- Remove from Drawing,
- Locate in Tree,
- Start Alarm in Simulation Mode,
- Restore Input in Simulation Mode,
- Trigger Fault in Simulation Mode,
- Restore Fault in Simulation Mode.

- [ ] **Step 4: Implement Zone drawing tools**

Default rectangle:

- drag to create area.

Polygon:

- click vertices,
- double-click finish,
- Esc cancel.

- [ ] **Step 5: Implement Loop wiring tools**

Flow:

- select Loop,
- highlight Loop devices,
- click devices in order,
- render solid line,
- save manual order,
- restore default.

- [ ] **Step 6: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- Start app with `npm run dev`.
- Import or load a fixture project.
- Place devices.
- Draw Zone rectangle.
- Draw manual Loop line.
- Use right-click context menu.

## Task 13: Implement 3D Viewer UI

**Files:**

- Create: `src/renderer/src/components/fire/Viewer3D.vue`
- Reuse logic from existing `src/renderer/src/components/ThreeDView.vue` where useful.
- Modify: `src/renderer/src/domain/fire/loopWiring.ts` only if 3D helper needs extra pure functions.

- [ ] **Step 1: Render buildings, floors, and map textures**

Preserve current useful 3D building/floor behavior.

- [ ] **Step 2: Render devices**

Render placed devices as sprites or planes with mapped SVG icons.

- [ ] **Step 3: Render Loop lines**

Render effective Loop order in 3D:

- same floor,
- cross floor,
- cross building.

Use solid Loop color.

- [ ] **Step 4: Render Zone overlays**

Render Zone visual areas as translucent floor overlays.

- [ ] **Step 5: Render highlights and simulation states**

Show:

- selected device,
- selected Loop,
- selected Zone,
- selected Group,
- active alarm,
- active sounder,
- active I/O,
- fault,
- disabled/inhibited.

- [ ] **Step 6: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- 3D scene is nonblank.
- Devices appear on correct floors.
- Cross-floor Loop line is visible.
- Zone overlays do not hide devices.

## Task 14: Implement Property Panel And Group Inspector

**Files:**

- Create: `src/renderer/src/components/fire/PropertyPanel.vue`
- Create: `src/renderer/src/components/fire/GroupInspector.vue`

- [ ] **Step 1: Implement device property panel**

Show:

- Panel,
- Loop,
- Address,
- Type,
- Description,
- Location,
- Zone,
- Sounder Group,
- I/O Group,
- disabled/inhibit flags,
- delay override flags,
- sensitivity and grade fields,
- raw CPD section collapsed by default.

- [ ] **Step 2: Implement Group Inspector**

For Sounder Group and I/O Group show:

- Group ID,
- title/description,
- members,
- member Panel/Loop/Address/Zone,
- triggering Zones,
- current simulation state,
- delay remaining,
- inhibited/disabled reason.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- Right-click device Open Properties opens panel.
- Group click opens inspector.

## Task 15: Implement Simulation Panel

**Files:**

- Create: `src/renderer/src/components/fire/SimulationPanel.vue`
- Modify: `src/renderer/src/stores/fireProjectStore.ts`

- [ ] **Step 1: Implement Network-level controls**

Controls:

- Simulation Mode toggle,
- EVACUATE,
- BUZZER SILENCE,
- SYSTEM RESET,
- time scale `1x`, `5x`, `10x`, `30x`,
- Skip Delay for delayed outputs.

- [ ] **Step 2: Implement status display**

Show:

- Network Sounder Mode,
- system state,
- sound state,
- active input alarms,
- active faults,
- active outputs,
- delayed outputs,
- Fire Brigade state,
- FaultIOGroup state,
- event log.

- [ ] **Step 3: Wire simulation actions to 2D/3D state**

Ensure active outputs affect:

- device flashing,
- output highlights,
- sound playback,
- group inspector state.

- [ ] **Step 4: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/simulation
npm run typecheck
npm run build
```

Manual check:

- Enter Simulation Mode.
- Double-click input to activate alarm.
- BUZZER SILENCE silences sound.
- New alarm restarts sound.
- SYSTEM RESET with active input returns to alarm.
- Restore Input then SYSTEM RESET returns normal.
- Trigger Fault activates fault state and fault sound.

## Task 16: Implement Drawing Import For Images And PDF

**Files:**

- Modify or create main process helper: `src/main/drawingImport.ts`
- Modify preload fire API: `src/preload/fireApi.ts`
- Modify UI where building/floor maps are configured.

- [ ] **Step 1: Implement image import**

Support:

- PNG,
- JPG,
- JPEG,
- SVG.

Copy selected file into project asset staging area and create `FireAsset`.

- [ ] **Step 2: Implement PDF page import**

Use an Electron-compatible PDF rendering approach. The first working implementation may render via Chromium offscreen or a maintained PDF library.

Behavior:

- allow page selection,
- default to first page,
- save selected page as map image asset.

- [ ] **Step 3: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- Import PNG map.
- Import PDF first page.
- Assign map to floor.
- Verify 2D and 3D display.

## Task 17: Implement CPD Re-import Diff

**Files:**

- Create: `src/renderer/src/domain/fire/cpdDiff.ts`
- Create: `src/renderer/src/domain/fire/__tests__/cpdDiff.test.ts`
- Create: `src/renderer/src/components/fire/ImportDiffDialog.vue`
- Modify: `src/renderer/src/stores/fireProjectStore.ts`

- [ ] **Step 1: Write diff tests**

Cover:

- matched device preserves placement,
- new device becomes unplaced,
- removed device becomes missing,
- changed type/Zone/Group appears in diff summary,
- user confirmation applies changes.

- [ ] **Step 2: Implement diff**

Public API:

```ts
export interface CpdDiffResult {
  matched: Array<{ existingDeviceId: string; incomingDeviceId: string }>
  added: string[]
  removed: string[]
  changed: Array<{ deviceId: string; fields: string[] }>
}

export function diffCpdImport(existing: FireProject, incoming: CpdAdapterResult): CpdDiffResult
export function applyCpdDiff(
  existing: FireProject,
  incoming: CpdAdapterResult,
  diff: CpdDiffResult
): FireProject
```

Match key:

```text
panelNumber + loopId + address
```

- [ ] **Step 3: Implement Diff dialog**

Show:

- added count,
- removed count,
- changed count,
- changed field list,
- confirm/cancel.

- [ ] **Step 4: Run verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdDiff.test.ts
npm run typecheck
```

## Task 18: Implement I18n

**Files:**

- Create: `src/renderer/src/i18n/index.ts`
- Create: `src/renderer/src/i18n/en.ts`
- Create: `src/renderer/src/i18n/zh.ts`
- Modify: `src/renderer/src/main.ts`
- Modify new fire UI components to use i18n.

- [ ] **Step 1: Add i18n dependency if needed**

Use `vue-i18n` unless the project already contains an i18n solution.

- [ ] **Step 2: Create translation dictionaries**

Include keys for:

- Device Tree,
- grouping modes,
- status filters,
- Simulation Panel,
- context menu,
- property panel,
- import/export,
- issues.

- [ ] **Step 3: Wire language preference**

Default:

- follow saved project preference when project is loaded,
- otherwise use system or English fallback.

- [ ] **Step 4: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- Switch English/Chinese.
- New UI text changes without mojibake.

## Task 19: Wire App Shell And Retire Mesh UI

**Files:**

- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/MenuBar.vue` or replace with fire-specific menu component.
- Modify: `src/renderer/src/components/WelcomeScreen.vue` or replace.
- Modify: `src/renderer/src/assets/main.css`

- [ ] **Step 1: Update app name**

Use:

```text
Numens Fire Alarm Simulator
```

Chinese name:

```text
Numens 消防报警模拟器
```

- [ ] **Step 2: Implement lifecycle UI**

Actions:

- New from CPD,
- Open `.fireproj`,
- Save `.fireproj`,
- Save As `.fireproj`,
- Re-import CPD / Compare & Sync when project is open.

- [ ] **Step 3: Replace workspace layout**

2D mode:

- left Device Tree,
- central Planner2D,
- right properties/inspector/simulation panel.

3D mode:

- central Viewer3D,
- overlay controls,
- simulation panel available.

- [ ] **Step 4: Remove user-facing Mesh labels**

Remove or rename:

- Mesh,
- RSSI,
- Leader,
- Router,
- HTML topology import,
- wireless topology.

Wireless CPD device types remain visible as device types.

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run typecheck
npm run build
```

Manual check:

- App opens.
- No Mesh workflow is visible.
- CPD import entry exists.
- Fire project open/save entries exist.

## Task 20: Final Verification And Review

**Files:**

- No planned feature files. This task verifies integrated behavior.

- [ ] **Step 1: Run full static checks**

Run:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected:

- All pass.

- [ ] **Step 2: Run manual workflow**

Manual workflow:

1. Start app with `npm run dev`.
2. Import a `.cpd`.
3. Confirm Network > Panel > Loop tree appears.
4. Switch grouping to Zone, Type, Sounder Group, I/O Group.
5. Filter All, Unplaced, Placed, Issues.
6. Upload a PNG drawing.
7. Add building and floor.
8. Place one detector, one manual call point, one sounder, one I/O.
9. Batch place multiple devices.
10. Draw a Zone rectangle.
11. Draw a Zone polygon.
12. Select Loop and draw manual Loop order.
13. Switch to 3D and confirm devices and Loop line appear.
14. Enter Simulation Mode.
15. Double-click an input to trigger fire alarm.
16. Confirm sounder/I/O behavior follows CPD.
17. Press BUZZER SILENCE.
18. Trigger a new input and confirm sound restarts.
19. Press SYSTEM RESET while input remains active and confirm alarm returns.
20. Restore input and press SYSTEM RESET again.
21. Trigger fault and confirm FaultIOGroup behavior.
22. Export `.fireproj`.
23. Close and reopen `.fireproj`.
24. Confirm maps, placement, Zone areas, Loop lines, and settings restore.

- [ ] **Step 3: Final manager review**

Manager reviews:

- final diff,
- changed files,
- test evidence,
- whether wireless Mesh behavior is removed from user-facing workflow,
- whether design decisions in the spec are implemented,
- whether unrelated user changes were preserved.

- [ ] **Step 4: Final code review SubAgent**

Dispatch one reviewer SubAgent with:

- design document path,
- implementation plan path,
- final diff,
- test output.

Reviewer must report:

- blocking issues,
- non-blocking risks,
- missing tests,
- approval state.

Only after approval can the manager report implementation completion.

## SubAgent Dispatch Template

Use this prompt shape for each implementation worker:

```text
You are a worker SubAgent implementing Task N from:
docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md

Project root:
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator

Design source:
docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md

Ownership:
[list exact files for this task]

Rules:
- Edit only the owned files unless you ask first.
- Do not revert unrelated changes.
- Do not restore Mesh/RSSI/Leader/Router behavior as product behavior.
- Follow the design document.
- Write tests before implementation where this task defines tests.
- Run the required commands.
- Report changed files and command results.

Return status:
DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED.
```

## Spec Coverage Map

- CPD import: Tasks 3, 9, 17.
- Device icons and type behavior: Task 2.
- Project model: Tasks 1, 3, 8.
- Device Tree: Task 11.
- 2D planning: Tasks 12, 16.
- 3D visualization: Task 13.
- Zone drawing: Tasks 6, 12.
- Loop wiring: Tasks 5, 12, 13.
- Group highlighting: Tasks 11, 14.
- Simulation engine: Tasks 7, 15.
- Fault simulation: Tasks 7, 15.
- Evacuate and Fire Brigade simulation: Tasks 7, 15.
- Delay and time scale: Tasks 7, 15.
- Inhibit and disabled rules: Task 7.
- `.fireproj`: Task 10.
- CPD re-import Diff: Task 17.
- i18n: Task 18.
- App shell transformation: Task 19.
- Final review and verification: Task 20.
