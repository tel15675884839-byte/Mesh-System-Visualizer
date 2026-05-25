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
import type { FireDevice } from './domain/fire/types'
import { getViewer3DDeviceAnimationFrame } from './domain/fire/viewer3DSimulationVisual'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import en from './i18n/en'
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
    nonDelayedState: DeviceSimulationOutput | null
    nonDelayedColor: string | null
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
store.loadFireProject(project)

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
  const statuses = store.project.devices.map((device) => {
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
    'cpd-non-delayed-zone-renders-active-3d-sounder',
    cpdSounder3D.nonDelayedState?.state === 'active' && cpdSounder3D.nonDelayedColor === '#ef4444'
  )

  return {
    ok: errors.length === 0,
    checks,
    errors,
    statuses,
    cpdSounder3D
  }
}

function runCpdSounder3DCheck(): Viewer3DCheckResult['cpdSounder3D'] {
  const delayed = adaptFixture(globalDelayRaw)
  const nonDelayed = adaptFixture(noDelayedRaw)
  const delayedSounder = deviceByAddress(delayed, 94)
  const nonDelayedSounder = deviceByAddress(nonDelayed, 94)
  const delayedState = getDeviceSimulationOutput(
    makeProjectDocument(delayed),
    trigger(delayed, 1),
    delayedSounder
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

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`fixture did not import address ${address}`)
  }

  return device
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
