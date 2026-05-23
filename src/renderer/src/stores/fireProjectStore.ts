import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CpdAdapterResult } from '../domain/fire/cpdAdapter'
import { applyCpdDiff, diffCpdImport, type CpdDiffResult } from '../domain/fire/cpdDiff'
import type {
  DeviceStatusFilter,
  FireAsset,
  FireDevice,
  FireFloor,
  FireIssue,
  FireProject,
  GroupMode,
  NonAddressableSounderPoint,
  Vector3,
  ZoneVisualArea
} from '../domain/fire/types'
import {
  createInitialSimulationState,
  reduceSimulation,
  type SimulationAction
} from '../domain/fire/simulation/engine'
import type { SimulationState } from '../domain/fire/simulation/types'

export type FirePlannerTool =
  | 'select'
  | 'placeDevice'
  | 'zoneRectangle'
  | 'zonePolygon'
  | 'manualLoopWiring'

export interface FireProjectDocument extends FireProject {
  devices: FireDevice[]
  issues: FireIssue[]
  nonAddressableSounderPoints: NonAddressableSounderPoint[]
}

const GRID_SPACING = 48
const MIN_DEVICE_ICON_SCALE_2D = 0.4
const MAX_DEVICE_ICON_SCALE_2D = 3

export const useFireProjectStore = defineStore('fireProject', () => {
  const project = ref<FireProjectDocument>(createEmptyFireProject())
  const selectedNetworkId = ref<string | null>(null)
  const selectedPanelId = ref<string | null>(null)
  const selectedDeviceId = ref<string | null>(null)
  const treeGroupMode = ref<GroupMode>('loop')
  const deviceStatusFilter = ref<DeviceStatusFilter>('all')
  const searchText = ref('')
  const simulationMode = ref(false)
  const simulationState = ref<SimulationState>(createInitialSimulationState())
  const activeTool = ref<FirePlannerTool>('select')
  const pendingCpdImport = ref<CpdAdapterResult | null>(null)
  const pendingCpdDiff = ref<CpdDiffResult | null>(null)
  const undoStack = ref<FireProjectDocument[]>([])
  const redoStack = ref<FireProjectDocument[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function loadFromCpdAdapterResult(result: CpdAdapterResult): void {
    const now = Date.now()
    const current = project.value

    project.value = {
      ...createEmptyFireProject(now),
      projectId: `fire-project-${now}`,
      name: result.projectName,
      createdAt: now,
      updatedAt: now,
      language: current.language,
      networks: [cloneValue(result.network)],
      buildings: [],
      assets: [],
      viewSettings: cloneValue(current.viewSettings),
      simulationSettings: cloneValue(current.simulationSettings),
      devices: cloneValue(result.devices),
      issues: cloneValue(result.issues),
      nonAddressableSounderPoints: []
    }
    selectedNetworkId.value = result.network.id
    selectedPanelId.value = result.network.panels[0]?.id ?? null
    selectedDeviceId.value = null
    resetHistory()
    resetSimulation()
  }

  function prepareCpdReimport(result: CpdAdapterResult): CpdDiffResult {
    const diff = diffCpdImport(project.value, result)
    pendingCpdImport.value = cloneValue(result)
    pendingCpdDiff.value = cloneValue(diff)
    return diff
  }

  function applyPendingCpdDiff(): void {
    if (!pendingCpdImport.value || !pendingCpdDiff.value) {
      return
    }

    project.value = normalizeProjectDocument(
      applyCpdDiff(project.value, pendingCpdImport.value, pendingCpdDiff.value)
    )
    pendingCpdImport.value = null
    pendingCpdDiff.value = null
    resetHistory()
    resetSimulation()
  }

  function cancelPendingCpdDiff(): void {
    pendingCpdImport.value = null
    pendingCpdDiff.value = null
  }

  function loadFireProject(nextProject: FireProject | FireProjectDocument): void {
    project.value = normalizeProjectDocument(nextProject)
    selectedNetworkId.value = project.value.networks[0]?.id ?? null
    selectedPanelId.value = project.value.networks[0]?.panels[0]?.id ?? null
    selectedDeviceId.value = null
    resetHistory()
    resetSimulation()
  }

  function selectDevice(deviceId: string | null): void {
    selectedDeviceId.value = deviceId
  }

  function placeDevices(
    deviceIds: string[],
    buildingId: string,
    floorId: string,
    startPosition: Vector3
  ): void {
    if (deviceIds.length === 0) {
      return
    }

    withPlanningSnapshot(() => {
      const columns = Math.min(5, deviceIds.length)
      const deviceIdSet = new Set(deviceIds)

      project.value.devices = project.value.devices.map((device) => {
        const index = deviceIds.indexOf(device.id)
        if (!deviceIdSet.has(device.id) || index < 0) {
          return device
        }

        return {
          ...device,
          placement: {
            ...device.placement,
            status: 'placed',
            buildingId,
            floorId,
            position: {
              x: startPosition.x + (index % columns) * GRID_SPACING,
              y: startPosition.y + Math.floor(index / columns) * GRID_SPACING,
              z: startPosition.z
            }
          }
        }
      })
    })
  }

  function moveDevice(deviceId: string, position: Vector3): void {
    withPlanningSnapshot(() => {
      project.value.devices = project.value.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              placement: {
                ...device.placement,
                status: 'placed',
                position
              }
            }
          : device
      )
    })
  }

  function removeDeviceFromDrawing(deviceId: string): void {
    withPlanningSnapshot(() => {
      project.value.devices = project.value.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              placement: {
                status: 'unplaced',
                rotation: device.placement.rotation
              }
            }
          : device
      )
    })
  }

  function setTreeGroupMode(mode: GroupMode): void {
    treeGroupMode.value = mode
  }

  function setDeviceStatusFilter(filter: DeviceStatusFilter): void {
    deviceStatusFilter.value = filter
  }

  function setSearchText(text: string): void {
    searchText.value = text
  }

  function setSimulationTimeScale(timeScale: FireProject['simulationSettings']['timeScale']): void {
    project.value.simulationSettings = {
      ...project.value.simulationSettings,
      timeScale
    }
  }

  function setDeviceIconScale2D(scale: number): void {
    project.value.viewSettings = {
      ...project.value.viewSettings,
      deviceIconScale2D: clampNumber(
        Number.isFinite(scale) ? scale : 1,
        MIN_DEVICE_ICON_SCALE_2D,
        MAX_DEVICE_ICON_SCALE_2D
      )
    }
  }

  function addBuilding(name?: string): string {
    const buildingId = createId('building')
    const floor = createPlanningFloor(buildingId, 1)

    withPlanningSnapshot(() => {
      project.value.buildings = [
        ...project.value.buildings,
        {
          id: buildingId,
          name: name ?? `Building ${project.value.buildings.length + 1}`,
          floors: [floor],
          position: { x: 0, y: 0 },
          size: { width: 1200, depth: 800 },
          rotation: 0
        }
      ]
    })

    return buildingId
  }

  function addFloor(buildingId: string, name?: string): string | null {
    const building = project.value.buildings.find((candidate) => candidate.id === buildingId)
    if (!building) {
      return null
    }

    const floor = createPlanningFloor(buildingId, building.floors.length + 1, name)

    withPlanningSnapshot(() => {
      project.value.buildings = project.value.buildings.map((candidate) =>
        candidate.id === buildingId
          ? {
              ...candidate,
              floors: [...candidate.floors, floor]
            }
          : candidate
      )
    })

    return floor.id
  }

  function ensureDefaultPlanningFloor(): { buildingId: string; floorId: string } {
    const existingBuilding = project.value.buildings[0]
    const existingFloor = existingBuilding?.floors[0]

    if (existingBuilding && existingFloor) {
      return { buildingId: existingBuilding.id, floorId: existingFloor.id }
    }

    if (existingBuilding && !existingFloor) {
      const floorId = addFloor(existingBuilding.id) as string
      return { buildingId: existingBuilding.id, floorId }
    }

    const buildingId = addBuilding()
    const building = project.value.buildings.find((candidate) => candidate.id === buildingId)
    const floorId = building?.floors[0]?.id

    if (!floorId) {
      throw new Error('Unable to create a default planning floor.')
    }

    return { buildingId, floorId }
  }

  function assignFloorMapAsset(args: {
    asset: FireAsset
    buildingId: string
    floorId: string
    mapWidth?: number
    mapHeight?: number
  }): void {
    withPlanningSnapshot(() => {
      project.value.assets = [
        ...project.value.assets.filter((asset) => asset.id !== args.asset.id),
        cloneValue(args.asset)
      ]
      project.value.buildings = project.value.buildings.map((building) =>
        building.id === args.buildingId
          ? {
              ...building,
              floors: building.floors.map((floor) =>
                floor.id === args.floorId
                  ? {
                      ...floor,
                      mapAssetId: args.asset.id,
                      mapWidth: args.mapWidth ?? floor.mapWidth,
                      mapHeight: args.mapHeight ?? floor.mapHeight
                    }
                  : floor
              )
            }
          : building
      )
    })
  }

  function addZoneArea(area: ZoneVisualArea): void {
    withPlanningSnapshot(() => {
      project.value.networks = project.value.networks.map((network) => ({
        ...network,
        panels: network.panels.map((panel) => ({
          ...panel,
          zones: panel.zones.map((zone) =>
            zone.id === area.id ||
            (zone.panelId === area.panelId && zone.zoneNumber === area.zoneNumber)
              ? {
                  ...zone,
                  visualAreas: [...zone.visualAreas, cloneValue(area)]
                }
              : zone
          )
        }))
      }))
    })
  }

  function removeZoneArea(areaId: string): void {
    withPlanningSnapshot(() => {
      project.value.networks = project.value.networks.map((network) => ({
        ...network,
        panels: network.panels.map((panel) => ({
          ...panel,
          zones: panel.zones.map((zone) => ({
            ...zone,
            visualAreas: zone.visualAreas.filter((area) => area.id !== areaId)
          }))
        }))
      }))
    })
  }

  function setManualLoopOrder(loopId: string, deviceIds: string[]): void {
    withPlanningSnapshot(() => {
      project.value.networks = project.value.networks.map((network) => ({
        ...network,
        panels: network.panels.map((panel) => ({
          ...panel,
          loops: panel.loops.map((loop) =>
            loop.id === loopId || String(loop.loopId) === loopId
              ? {
                  ...loop,
                  manualDeviceOrder: [...deviceIds]
                }
              : loop
          )
        }))
      }))
    })
  }

  function restoreDefaultLoopWiring(loopId: string): void {
    withPlanningSnapshot(() => {
      project.value.networks = project.value.networks.map((network) => ({
        ...network,
        panels: network.panels.map((panel) => ({
          ...panel,
          loops: panel.loops.map((loop) =>
            loop.id === loopId || String(loop.loopId) === loopId
              ? {
                  ...loop,
                  manualDeviceOrder: []
                }
              : loop
          )
        }))
      }))
    })
  }

  function enterSimulationMode(): void {
    simulationMode.value = true
    simulationState.value = createInitialSimulationState()
  }

  function exitSimulationMode(): void {
    simulationMode.value = false
    resetSimulation()
  }

  function dispatchSimulationAction(action: SimulationAction): void {
    const network =
      project.value.networks.find((item) => item.id === selectedNetworkId.value) ??
      project.value.networks[0]
    if (!network) {
      return
    }

    simulationState.value = reduceSimulation(
      simulationState.value,
      {
        network,
        devices: project.value.devices.filter((device) => device.networkId === network.id),
        nonAddressablePoints: project.value.nonAddressableSounderPoints.filter(
          (point) => point.networkId === network.id
        ),
        now: 'at' in action ? action.at : Date.now()
      },
      action
    )
  }

  function undo(): void {
    const previous = undoStack.value.pop()
    if (!previous) {
      return
    }

    redoStack.value.push(cloneValue(project.value))
    project.value = previous
  }

  function redo(): void {
    const next = redoStack.value.pop()
    if (!next) {
      return
    }

    undoStack.value.push(cloneValue(project.value))
    project.value = next
  }

  function withPlanningSnapshot(change: () => void): void {
    undoStack.value.push(cloneValue(project.value))
    redoStack.value = []
    change()
    project.value.updatedAt = Date.now()
  }

  function resetHistory(): void {
    undoStack.value = []
    redoStack.value = []
  }

  function resetSimulation(): void {
    simulationState.value = createInitialSimulationState()
  }

  return {
    project,
    selectedNetworkId,
    selectedPanelId,
    selectedDeviceId,
    treeGroupMode,
    deviceStatusFilter,
    searchText,
    simulationMode,
    simulationState,
    activeTool,
    pendingCpdImport,
    pendingCpdDiff,
    canUndo,
    canRedo,
    loadFromCpdAdapterResult,
    prepareCpdReimport,
    applyPendingCpdDiff,
    cancelPendingCpdDiff,
    loadFireProject,
    selectDevice,
    placeDevices,
    moveDevice,
    removeDeviceFromDrawing,
    setTreeGroupMode,
    setDeviceStatusFilter,
    setSearchText,
    setSimulationTimeScale,
    setDeviceIconScale2D,
    addBuilding,
    addFloor,
    ensureDefaultPlanningFloor,
    assignFloorMapAsset,
    addZoneArea,
    removeZoneArea,
    setManualLoopOrder,
    restoreDefaultLoopWiring,
    enterSimulationMode,
    exitSimulationMode,
    dispatchSimulationAction,
    undo,
    redo
  }
})

export function createEmptyFireProject(now = Date.now()): FireProjectDocument {
  return {
    schemaVersion: 1,
    projectId: `fire-project-${now}`,
    name: 'Untitled Fire Project',
    createdAt: now,
    updatedAt: now,
    language: 'en',
    networks: [],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#111827',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: {
      timeScale: 1,
      soundEnabled: true
    },
    devices: [],
    issues: [],
    nonAddressableSounderPoints: []
  }
}

function normalizeProjectDocument(project: FireProject | FireProjectDocument): FireProjectDocument {
  const document = project as FireProjectDocument

  return {
    ...cloneValue(project),
    devices: cloneValue(document.devices ?? []),
    issues: cloneValue(document.issues ?? []),
    nonAddressableSounderPoints: cloneValue(document.nonAddressableSounderPoints ?? [])
  }
}

function createPlanningFloor(buildingId: string, index: number, name?: string): FireFloor {
  return {
    id: createId('floor'),
    buildingId,
    name: name ?? `Floor ${index}`,
    levelIndex: index - 1,
    mapWidth: 1200,
    mapHeight: 800,
    camera2D: { x: 0, y: 0, scale: 1 },
    floorScale3D: 1,
    floorHeight3D: 3
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
