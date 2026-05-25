import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createI18n } from 'vue-i18n'
import Viewer3D from './components/fire/Viewer3D.vue'
import { adaptCpdExport, type CpdAdapterResult } from './domain/fire/cpdAdapter'
import { getDeviceStatusAppearance } from './domain/fire/deviceVisualState'
import { resolveCauseAndEffect } from './domain/fire/simulation/causeEffect'
import type { OutputActivation } from './domain/fire/simulation/types'
import {
  getDeviceSimulationOutput,
  type DeviceSimulationOutput
} from './domain/fire/simulationOutputMapping'
import { shouldPlaySimulationAlarmAudio } from './domain/fire/simulationAudio'
import type { FireDevice } from './domain/fire/types'
import { getViewer3DDeviceAnimationFrame } from './domain/fire/viewer3DSimulationVisual'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import en from './i18n/en'
import delayEdgeRaw from '../../../fixtures/cpd/extracted/6002-delay-edge-fields.json?raw'
import globalDelayRaw from '../../../fixtures/cpd/extracted/6002-global-sounder-delay.json?raw'
import noDelayedRaw from '../../../fixtures/cpd/extracted/6002-zone-no-delayed-sounders.json?raw'

interface Viewer3DCheckResult {
  ok: boolean
  checks: Record<string, boolean>
  errors: string[]
  statuses: Array<{
    id: string
    address: number | undefined
    state: string
    markerColor: string
    spriteColor: string
  }>
  cpdSounder3D: {
    delayedState: DeviceSimulationOutput | null
    delayedColor: string | null
    delayEdgeAddress4SounderState: DeviceSimulationOutput | null
    delayEdgeAddress4IoState: DeviceSimulationOutput | null
    delayEdgeAddress4ActiveOutputCount: number
    nonDelayedState: DeviceSimulationOutput | null
    nonDelayedColor: string | null
  }
  mountedDelayEdge3D: {
    beforeDelaySounderState: DeviceSimulationOutput | null
    beforeDelayIoState: DeviceSimulationOutput | null
    beforeDelayCountdownSeconds: number
    beforeDelayActiveOutputCount: number
    beforeDelayShouldPlayAudio: boolean
    afterDelaySounderState: DeviceSimulationOutput | null
    afterDelayColor: string | null
    afterDelayShouldPlayAudio: boolean
    afterDelayActiveOutputCount: number
  }
}

declare global {
  interface Window {
    __viewer3DCheck?: {
      runVisualCheck: () => Viewer3DCheckResult
    }
  }
}

const project: FireProjectDocument = {
  schemaVersion: 1,
  projectId: 'viewer3d-check',
  name: 'Viewer 3D Check',
  createdAt: 1,
  updatedAt: 1,
  language: 'en',
  networks: [
    {
      id: 'network-1',
      name: 'Network 1',
      sourceFileName: 'viewer3d.cpd',
      sourceImportedAt: 1,
      sounderMode: 'Programmed',
      panels: [
        {
          id: 'panel-1',
          networkId: 'network-1',
          panelNumber: 1,
          panelName: 'Panel 1',
          general: {
            panelNumber: 1,
            sounderMode: 'Programmed',
            evacuateDelaySeconds: 0,
            sounderDelaySeconds: 0,
            inputOutputDelaySeconds: 0,
            fireBrigadeDelaySeconds: 0,
            onManualCallPoints: false,
            onTwoDevices: false,
            delayOffAtNight: false,
            raw: {}
          },
          loops: [
            {
              id: 'loop-1',
              networkId: 'network-1',
              panelId: 'panel-1',
              loopId: 1,
              name: 'Loop 1',
              configuredDeviceOrder: ['device-disabled', 'device-inhibited', 'device-normal'],
              manualDeviceOrder: [],
              color: '#2563eb'
            }
          ],
          zones: [
            {
              id: 'zone-1',
              networkId: 'network-1',
              panelId: 'panel-1',
              zoneNumber: 1,
              text: 'Zone 1',
              enabled: true,
              delayedSounders: false,
              alarmMode: 'single',
              visualAreas: [],
              raw: {}
            }
          ],
          sounderGroups: [],
          ioGroups: [],
          sounders: { raw: {} }
        }
      ]
    }
  ],
  buildings: [
    {
      id: 'building-1',
      name: 'Building 1',
      floors: [
        {
          id: 'floor-1',
          buildingId: 'building-1',
          name: 'Floor 1',
          levelIndex: 0,
          mapWidth: 800,
          mapHeight: 500,
          camera2D: { x: 0, y: 0, scale: 1 },
          floorHeight3D: 3,
          floorScale3D: 1
        }
      ],
      position: { x: 0, y: 0 },
      size: { width: 800, depth: 500 },
      rotation: 0
    }
  ],
  assets: [],
  viewSettings: {
    deviceIconScale2D: 1.2,
    deviceIconScale3D: 1.2,
    mapOpacity: 1,
    labelColor: '#111827',
    showLoopLines: true,
    showGroupHelperLines: true
  },
  simulationSettings: { timeScale: 1, soundEnabled: true },
  devices: [
    {
      id: 'device-disabled',
      address: 21,
      type: 'optical_det',
      friendlyTypeName: 'Optical Detector',
      disabled: true,
      inhibitRelays: false
    },
    {
      id: 'device-inhibited',
      address: 17,
      type: 'input_output',
      friendlyTypeName: 'Input/Output',
      disabled: false,
      inhibitRelays: true
    },
    {
      id: 'device-normal',
      address: 114,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      disabled: false,
      inhibitRelays: false
    }
  ].map((device, index) => ({
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    description: device.friendlyTypeName,
    zoneNumber: 1,
    isInputCapable: device.type !== 'sounder',
    isOutputCapable: device.type !== 'optical_det',
    isSounder: device.type === 'sounder',
    isWirelessType: false,
    inhibitSounders: false,
    inhibitIO: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: {
      status: 'placed',
      buildingId: 'building-1',
      floorId: 'floor-1',
      position: { x: 220 + index * 180, y: 250, z: 0 }
    },
    raw: {},
    ...device
  })),
  issues: [],
  nonAddressableSounderPoints: []
}

const pinia = createPinia()
const store = useFireProjectStore(pinia)
const mountedDelayEdge = adaptFixture(delayEdgeRaw)
store.loadFireProject(makePlacedProjectDocument(mountedDelayEdge))
store.enterSimulationMode()
store.dispatchSimulationAction({
  type: 'activate-input',
  deviceId: deviceByAddress(mountedDelayEdge, 4).id,
  at: Date.now()
})

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const app = createApp({
  render: () => h('div', { class: 'viewer3d-check-shell' }, [h(Viewer3D)])
})

app.use(pinia)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

function runVisualCheck(): Viewer3DCheckResult {
  const checks: Record<string, boolean> = {}
  const errors: string[] = []
  const cpdSounder3D = runCpdSounder3DCheck()
  const mountedDelayEdge3D = runMountedDelayEdge3DCheck()
  const statuses = project.devices.map((device) => {
    const appearance = getDeviceStatusAppearance(device)
    return {
      id: device.id,
      address: device.address,
      state: appearance.state,
      markerColor: appearance.color,
      spriteColor: appearance.spriteColor
    }
  })

  const record = (name: string, passed: boolean): void => {
    checks[name] = passed
    if (!passed) {
      errors.push(name)
    }
  }

  const canvas = document.querySelector('canvas')
  record('canvas-rendered', Boolean(canvas && canvas.width > 0 && canvas.height > 0))
  record(
    'disabled-status-preserves-sprite-color',
    statuses.some(
      (status) =>
        status.address === 21 &&
        status.state === 'disabled' &&
        status.markerColor === '#f59e0b' &&
        status.spriteColor === '#ffffff'
    )
  )
  record(
    'inhibited-status-preserves-sprite-color',
    statuses.some(
      (status) =>
        status.address === 17 &&
        status.state === 'inhibited' &&
        status.markerColor === '#7c3aed' &&
        status.spriteColor === '#ffffff'
    )
  )
  record(
    'cpd-delayed-zone-renders-delayed-3d-sounder',
    cpdSounder3D.delayedState?.state === 'delayActive' && cpdSounder3D.delayedColor === '#0ea5e9'
  )
  record(
    'cpd-delay-edge-zone1-has-no-immediate-active-3d-outputs',
    cpdSounder3D.delayEdgeAddress4SounderState?.state === 'delayActive' &&
      cpdSounder3D.delayEdgeAddress4IoState?.state === 'delayActive' &&
      cpdSounder3D.delayEdgeAddress4ActiveOutputCount === 0
  )
  record(
    'mounted-delay-edge-store-has-no-immediate-active-outputs',
    mountedDelayEdge3D.beforeDelayActiveOutputCount === 0
  )
  record(
    'mounted-delay-edge-renders-delayed-sounder-output',
    mountedDelayEdge3D.beforeDelaySounderState?.state === 'delayActive'
  )
  record(
    'mounted-delay-edge-renders-delayed-io-output',
    mountedDelayEdge3D.beforeDelayIoState?.state === 'delayActive'
  )
  record(
    'mounted-delay-edge-shows-countdown-before-active',
    mountedDelayEdge3D.beforeDelayCountdownSeconds > 0
  )
  record(
    'mounted-delay-edge-audio-muted-before-countdown-expires',
    mountedDelayEdge3D.beforeDelayShouldPlayAudio === false
  )
  record(
    'mounted-delay-edge-starts-audio-and-active-light-after-countdown',
    mountedDelayEdge3D.afterDelaySounderState?.state === 'active' &&
      mountedDelayEdge3D.afterDelayShouldPlayAudio === true &&
      mountedDelayEdge3D.afterDelayColor === '#ef4444'
  )
  record(
    'cpd-non-delayed-zone-renders-active-3d-sounder',
    cpdSounder3D.nonDelayedState?.state === 'active' && cpdSounder3D.nonDelayedColor === '#ef4444'
  )

  return {
    ok: errors.length === 0,
    checks,
    errors,
    statuses,
    cpdSounder3D,
    mountedDelayEdge3D
  }
}

function runCpdSounder3DCheck(): Viewer3DCheckResult['cpdSounder3D'] {
  const delayed = adaptFixture(globalDelayRaw)
  const delayEdge = adaptFixture(delayEdgeRaw)
  const nonDelayed = adaptFixture(noDelayedRaw)
  const delayedSounder = deviceByAddress(delayed, 94)
  const delayEdgeSounder = deviceByAddress(delayEdge, 94)
  const delayEdgeIo = deviceByAddress(delayEdge, 7)
  const delayEdgeAddress4Outputs = trigger(delayEdge, 4)
  const nonDelayedSounder = deviceByAddress(nonDelayed, 94)
  const delayedState = getDeviceSimulationOutput(
    makeProjectDocument(delayed),
    trigger(delayed, 1),
    delayedSounder
  )
  const delayEdgeAddress4SounderState = getDeviceSimulationOutput(
    makeProjectDocument(delayEdge),
    delayEdgeAddress4Outputs,
    delayEdgeSounder
  )
  const delayEdgeAddress4IoState = getDeviceSimulationOutput(
    makeProjectDocument(delayEdge),
    delayEdgeAddress4Outputs,
    delayEdgeIo
  )
  const nonDelayedState = getDeviceSimulationOutput(
    makeProjectDocument(nonDelayed),
    trigger(nonDelayed, 1),
    nonDelayedSounder
  )

  return {
    delayedState,
    delayedColor: getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: delayedState?.state ?? null,
      sounderPattern: delayedState?.sounderPattern,
      isSounder: delayedSounder.isSounder
    }).color,
    delayEdgeAddress4SounderState,
    delayEdgeAddress4IoState,
    delayEdgeAddress4ActiveOutputCount: delayEdgeAddress4Outputs.filter(
      (output) => output.state === 'active'
    ).length,
    nonDelayedState,
    nonDelayedColor: getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: nonDelayedState?.state ?? null,
      sounderPattern: nonDelayedState?.sounderPattern,
      isSounder: nonDelayedSounder.isSounder
    }).color
  }
}

function adaptFixture(raw: string): CpdAdapterResult {
  return adaptCpdExport(JSON.parse(raw), 1234)
}

function makeProjectDocument(result: CpdAdapterResult): FireProjectDocument {
  return {
    schemaVersion: 1,
    projectId: 'cpd-viewer3d-fixture',
    name: result.projectName,
    createdAt: 0,
    updatedAt: 0,
    language: 'en',
    networks: [result.network],
    buildings: [],
    assets: [],
    viewSettings: project.viewSettings,
    simulationSettings: project.simulationSettings,
    devices: result.devices,
    issues: result.issues,
    nonAddressableSounderPoints: []
  }
}

function makePlacedProjectDocument(result: CpdAdapterResult): FireProjectDocument {
  const document = makeProjectDocument(result)
  const buildingId = 'cpd-delay-edge-building'
  const floorId = 'cpd-delay-edge-floor'

  return {
    ...document,
    buildings: [
      {
        id: buildingId,
        name: 'Delay Edge Building',
        floors: [
          {
            id: floorId,
            buildingId,
            name: 'Floor 1',
            levelIndex: 0,
            mapWidth: 1200,
            mapHeight: 800,
            camera2D: { x: 0, y: 0, scale: 1 },
            floorHeight3D: 3,
            floorScale3D: 1
          }
        ],
        position: { x: 0, y: 0 },
        size: { width: 1200, depth: 800 },
        rotation: 0
      }
    ],
    devices: result.devices.map((device, index) => ({
      ...device,
      placement: {
        status: 'placed',
        buildingId,
        floorId,
        position: {
          x: 120 + (index % 5) * 190,
          y: 130 + Math.floor(index / 5) * 140,
          z: 0
        }
      }
    }))
  }
}

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`fixture did not import address ${address}`)
  }

  return device
}

function mountedDeviceByAddress(address: number): FireDevice {
  const device = store.project.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`mounted project did not include address ${address}`)
  }

  return device
}

function mountedDeviceOutputState(address: number): DeviceSimulationOutput | null {
  return getDeviceSimulationOutput(
    store.project,
    store.simulationState.outputs,
    mountedDeviceByAddress(address)
  )
}

function mountedActiveOutputCount(): number {
  return store.simulationState.outputs.filter((output) => output.state === 'active').length
}

function mountedShouldPlayAudio(): boolean {
  return shouldPlaySimulationAlarmAudio({
    simulationMode: store.simulationMode,
    soundEnabled: store.project.simulationSettings.soundEnabled,
    soundState: store.simulationState.soundState,
    project: store.project,
    devices: store.project.devices,
    outputs: store.simulationState.outputs
  })
}

function runMountedDelayEdge3DCheck(): Viewer3DCheckResult['mountedDelayEdge3D'] {
  const beforeDelaySounderState = mountedDeviceOutputState(94)
  const beforeDelayIoState = mountedDeviceOutputState(7)
  const beforeDelayCountdownSeconds = Math.max(
    0,
    Math.ceil(beforeDelaySounderState?.remainingDelaySeconds ?? 0)
  )
  const beforeDelayActiveOutputCount = mountedActiveOutputCount()
  const beforeDelayShouldPlayAudio = mountedShouldPlayAudio()

  store.dispatchSimulationAction({
    type: 'tick',
    at: Date.now() + beforeDelayCountdownSeconds * 1000,
    elapsedSeconds: beforeDelayCountdownSeconds
  })

  const afterDelaySounderState = mountedDeviceOutputState(94)
  const afterDelaySounder = mountedDeviceByAddress(94)

  return {
    beforeDelaySounderState,
    beforeDelayIoState,
    beforeDelayCountdownSeconds,
    beforeDelayActiveOutputCount,
    beforeDelayShouldPlayAudio,
    afterDelaySounderState,
    afterDelayColor: getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: afterDelaySounderState?.state ?? null,
      sounderPattern: afterDelaySounderState?.sounderPattern,
      isSounder: afterDelaySounder.isSounder
    }).color,
    afterDelayShouldPlayAudio: mountedShouldPlayAudio(),
    afterDelayActiveOutputCount: mountedActiveOutputCount()
  }
}

function trigger(result: CpdAdapterResult, address: number): OutputActivation[] {
  return resolveCauseAndEffect({
    network: result.network,
    devices: result.devices,
    nonAddressablePoints: [],
    activeInputAlarms: [{ deviceId: deviceByAddress(result, address).id, activatedAt: 0 }]
  })
}

function writeHarnessReport(result: Viewer3DCheckResult): void {
  let report = document.getElementById('viewer3d-check-report') as HTMLPreElement | null
  if (!report) {
    report = document.createElement('pre')
    report.id = 'viewer3d-check-report'
    report.hidden = true
    document.body.appendChild(report)
  }
  report.dataset.ok = String(result.ok)
  report.textContent = JSON.stringify(result, null, 2)
}

window.__viewer3DCheck = {
  runVisualCheck
}

window.setTimeout(() => {
  writeHarnessReport(runVisualCheck())
}, 500)
