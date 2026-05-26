import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CpdAdapterResult } from '../domain/fire/cpdAdapter'
import { applyCpdDiff, diffCpdImport, type CpdDiffResult } from '../domain/fire/cpdDiff'
import type { DeviceStatusFilter, FireProject, GroupMode } from '../domain/fire/types'
import {
  createInitialSimulationState,
  reduceSimulation,
  type SimulationAction
} from '../domain/fire/simulation/engine'
import { getEffectiveFloorHeight3D } from '../domain/fire/viewer3DGeometry'
import type { SimulationState } from '../domain/fire/simulation/types'
import { createFireProjectPlanningActions } from './fireProjectPlanningActions'
import {
  cloneValue,
  clampNumber,
  createEmptyFireProject,
  normalizeProjectDocument,
  type FireProjectDocument
} from './fireProjectDocument'
export type { FireProjectDocument } from './fireProjectDocument'

export type FirePlannerTool =
  | 'select'
  | 'placeDevice'
  | 'zoneRectangle'
  | 'zonePolygon'
  | 'manualLoopWiring'

export interface SimulationDispatchOptions {
  sounderDelaysEnabled?: boolean
}

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

  const {
    addBuilding,
    addFloor,
    addZoneArea,
    assignFloorMapAsset,
    clearFloorMapAsset,
    ensureDefaultPlanningFloor,
    moveDevice,
    placeDevices,
    removeBuilding,
    removeDeviceFromDrawing,
    removeFloor,
    removeZoneArea,
    replaceZoneArea,
    restoreDefaultLoopWiring,
    setManualLoopOrder
  } = createFireProjectPlanningActions({
    project,
    selectedDeviceId,
    withPlanningSnapshot
  })

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

  function setSimulationSoundEnabled(soundEnabled: boolean): void {
    project.value.simulationSettings = {
      ...project.value.simulationSettings,
      soundEnabled
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

  function setFloorSpacing3D(spacing: number): void {
    project.value.viewSettings = {
      ...project.value.viewSettings,
      floorSpacing3D: getEffectiveFloorHeight3D(spacing)
    }
  }

  function setMapOpacity3D(opacity: number): void {
    project.value.viewSettings = {
      ...project.value.viewSettings,
      mapOpacity3D: clampNumber(Number.isFinite(opacity) ? opacity : 1, 0, 1)
    }
  }

  function setFloorMapOpacity3D(floorId: string, opacity: number | null): void {
    const nextOpacity =
      opacity === null ? null : clampNumber(Number.isFinite(opacity) ? opacity : 1, 0, 1)

    project.value.buildings = project.value.buildings.map((building) => ({
      ...building,
      floors: building.floors.map((floor) => {
        if (floor.id !== floorId) {
          return floor
        }

        if (nextOpacity === null) {
          const nextFloor = { ...floor }
          delete nextFloor.mapOpacity3D
          return nextFloor
        }

        return {
          ...floor,
          mapOpacity3D: nextOpacity
        }
      })
    }))
  }

  function enterSimulationMode(): void {
    simulationMode.value = true
    simulationState.value = createInitialSimulationState()
  }

  function exitSimulationMode(): void {
    simulationMode.value = false
    resetSimulation()
  }

  function dispatchSimulationAction(
    action: SimulationAction,
    options: SimulationDispatchOptions = {}
  ): void {
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
        now: 'at' in action ? action.at : Date.now(),
        sounderDelaysEnabled: options.sounderDelaysEnabled
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
    setSimulationSoundEnabled,
    setDeviceIconScale2D,
    setFloorSpacing3D,
    setMapOpacity3D,
    setFloorMapOpacity3D,
    addBuilding,
    addFloor,
    removeBuilding,
    removeFloor,
    ensureDefaultPlanningFloor,
    assignFloorMapAsset,
    clearFloorMapAsset,
    addZoneArea,
    removeZoneArea,
    replaceZoneArea,
    setManualLoopOrder,
    restoreDefaultLoopWiring,
    enterSimulationMode,
    exitSimulationMode,
    dispatchSimulationAction,
    undo,
    redo
  }
})
