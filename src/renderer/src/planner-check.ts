import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createI18n } from 'vue-i18n'
import Planner2D from './components/fire/Planner2D.vue'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import { createRectangleArea } from './domain/fire/zoneGeometry'
import en from './i18n/en'

interface PlannerLifecycleCheckResult {
  ok: boolean
  checks: Record<string, boolean>
  errors: string[]
}

interface PlannerCheckSummary {
  buildings: number
  floors: number
  devices: number
  zoneAreas: number
}

declare global {
  interface Window {
    __plannerCheck?: {
      runLifecycleCheck: () => PlannerLifecycleCheckResult
      getSummary: () => PlannerCheckSummary
    }
  }
}

const project: FireProjectDocument = {
  schemaVersion: 1,
  projectId: 'planner-check',
  name: 'Planner Check',
  createdAt: 1,
  updatedAt: 1,
  language: 'en',
  networks: [
    {
      id: 'network-1',
      name: 'Network 1',
      sourceFileName: 'planner.cpd',
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
              configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d'],
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
    deviceIconScale2D: 1,
    deviceIconScale3D: 1,
    mapOpacity: 1,
    labelColor: '#111827',
    showLoopLines: true,
    showGroupHelperLines: true
  },
  simulationSettings: { timeScale: 1, soundEnabled: true },
  devices: ['a', 'b', 'c', 'd'].map((suffix, index) => ({
    id: `device-${suffix}`,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: index + 1,
    type:
      suffix === 'a'
        ? 'optical_det'
        : suffix === 'b'
          ? 'input_output'
          : suffix === 'd'
            ? 'sounder'
            : 'manual_call_point',
    friendlyTypeName:
      suffix === 'a'
        ? 'Optical Detector'
        : suffix === 'b'
          ? 'Input/Output'
          : suffix === 'd'
            ? 'Sounder'
            : 'Manual Call Point',
    description: `Device ${suffix.toUpperCase()}`,
    zoneNumber: 1,
    isInputCapable: suffix !== 'd',
    isOutputCapable: suffix === 'b' || suffix === 'd',
    isSounder: suffix === 'd',
    isWirelessType: false,
    disabled: suffix === 'a',
    inhibitSounders: false,
    inhibitIO: suffix === 'b',
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: {
      status: 'placed',
      buildingId: 'building-1',
      floorId: 'floor-1',
      position: { x: 120 + index * 150, y: 220, z: 0 }
    },
    raw: {}
  })),
  issues: [],
  nonAddressableSounderPoints: []
}

const pinia = createPinia()
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const app = createApp({ render: () => h(Planner2D) })

app.use(pinia)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

const store = useFireProjectStore(pinia)
store.loadFireProject(project)

function runLifecycleCheck(): PlannerLifecycleCheckResult {
  const checks: Record<string, boolean> = {}
  const errors: string[] = []

  const record = (name: string, passed: boolean): void => {
    checks[name] = passed
    if (!passed) {
      errors.push(name)
    }
  }

  const initialBuildingIds = store.project.buildings.map((building) => building.id)
  const buildingId = store.addBuilding('Harness Building')
  record(
    'add-building',
    store.project.buildings.some((building) => building.id === buildingId)
  )
  store.removeBuilding(buildingId)
  record(
    'delete-building',
    store.project.buildings.map((building) => building.id).join(',') ===
      initialBuildingIds.join(',')
  )

  const target = store.ensureDefaultPlanningFloor()
  const floorId = store.addFloor(target.buildingId, 'Harness Floor')
  record(
    'add-floor',
    Boolean(
      floorId &&
      store.project.buildings
        .find((building) => building.id === target.buildingId)
        ?.floors.some((floor) => floor.id === floorId)
    )
  )
  if (floorId) {
    store.removeFloor(target.buildingId, floorId)
  }
  record(
    'delete-floor',
    Boolean(
      floorId &&
      !store.project.buildings
        .find((building) => building.id === target.buildingId)
        ?.floors.some((floor) => floor.id === floorId)
    )
  )

  store.assignFloorMapAsset({
    asset: {
      id: 'harness-map',
      kind: 'map',
      name: 'Harness Map',
      packagePath: 'assets/maps/harness-map.png',
      runtimePath: 'data:image/png;base64,',
      mimeType: 'image/png'
    },
    buildingId: target.buildingId,
    floorId: target.floorId,
    mapWidth: 640,
    mapHeight: 480
  })
  const targetBuilding = store.project.buildings.find(
    (building) => building.id === target.buildingId
  )
  const targetFloor = targetBuilding?.floors.find((floor) => floor.id === target.floorId)
  record(
    'assign-drawing',
    targetFloor?.mapAssetId === 'harness-map' &&
      targetFloor?.mapWidth === 640 &&
      targetFloor?.mapHeight === 480
  )
  store.clearFloorMapAsset(target.buildingId, target.floorId)
  const clearedTargetFloor = store.project.buildings
    .find((building) => building.id === target.buildingId)
    ?.floors.find((floor) => floor.id === target.floorId)
  record(
    'clear-drawing',
    clearedTargetFloor?.mapAssetId === undefined &&
      clearedTargetFloor?.mapWidth === 1200 &&
      clearedTargetFloor?.mapHeight === 800
  )

  const zone = store.project.networks[0]?.panels[0]?.zones[0]
  if (zone) {
    const area = createRectangleArea({
      id: 'harness-zone-area',
      networkId: zone.networkId,
      panelId: zone.panelId,
      zoneNumber: zone.zoneNumber,
      buildingId: target.buildingId,
      floorId: target.floorId,
      start: { x: 40, y: 40 },
      end: { x: 180, y: 150 },
      color: '#ef4444',
      opacity: 0.2
    })
    store.addZoneArea(area)
    record('draw-zone-area', getZoneAreaCount() === 1)
    store.removeZoneArea(area.id)
    record('delete-zone-area', getZoneAreaCount() === 0)
  } else {
    record('draw-zone-area', false)
    record('delete-zone-area', false)
  }

  return {
    ok: errors.length === 0,
    checks,
    errors
  }
}

function getZoneAreaCount(): number {
  return store.project.networks.reduce(
    (networkTotal, network) =>
      networkTotal +
      network.panels.reduce(
        (panelTotal, panel) =>
          panelTotal +
          panel.zones.reduce((zoneTotal, zone) => zoneTotal + zone.visualAreas.length, 0),
        0
      ),
    0
  )
}

function getSummary(): PlannerCheckSummary {
  return {
    buildings: store.project.buildings.length,
    floors: store.project.buildings.reduce((total, building) => total + building.floors.length, 0),
    devices: store.project.devices.length,
    zoneAreas: getZoneAreaCount()
  }
}

function writeHarnessReport(result: PlannerLifecycleCheckResult): void {
  let report = document.getElementById('planner-check-report') as HTMLPreElement | null
  if (!report) {
    report = document.createElement('pre')
    report.id = 'planner-check-report'
    report.hidden = true
    document.body.appendChild(report)
  }
  report.dataset.ok = String(result.ok)
  report.textContent = JSON.stringify(
    {
      result,
      summary: getSummary()
    },
    null,
    2
  )
}

window.__plannerCheck = {
  runLifecycleCheck,
  getSummary
}

queueMicrotask(() => {
  writeHarnessReport(runLifecycleCheck())
})
