import * as THREE from 'three'
import type {
  FireBuilding,
  FireDevice,
  FireFloor,
  FirePanel,
  FireZone,
  Vector3
} from '../../domain/fire/types'
import {
  getDeviceIconWorldCenterHeight,
  getDeviceIconWorldSize
} from '../../domain/fire/deviceSizing'
import { getEffectiveFloorHeight3D } from '../../domain/fire/viewer3DGeometry'
import {
  getDeviceSimulationOutput,
  type DeviceSimulationOutput
} from '../../domain/fire/simulationOutputMapping'
import { isDeviceHighlighted } from '../../domain/fire/viewer3DHighlight'
import { getDeviceStatusAppearance } from '../../domain/fire/deviceVisualState'

interface Viewer3DSceneContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Viewer3DSceneCalculationOptions {
  planScale: number
  defaultFloorHeight: number
}

export function createViewer3DSceneCalculations(
  context: Viewer3DSceneContext,
  options: Viewer3DSceneCalculationOptions
): {
  getDevicePoint: (device: FireDevice) => THREE.Vector3 | null
  getRenderedDeviceWorldSize: (device: FireDevice) => number
  getFloorOrigin: (building: FireBuilding, buildingIndex: number, floor: FireFloor) => THREE.Vector3
  getDeviceColor: (device: FireDevice) => THREE.ColorRepresentation
  getSelectedZoneBounds: () => THREE.Box3 | null
  findSelectedZone: () => { panel: FirePanel; zone: FireZone } | null
  hasActiveInput: (deviceId: string) => boolean
  hasActiveFault: (deviceId: string) => boolean
  getDeviceOutputState: (device: FireDevice) => DeviceSimulationOutput | null
} {
  const {
    project,
    selectedDeviceId,
    simulationState,
    hiddenBuildingIds,
    hiddenFloorIds,
    highlightTargetId,
    highlightSelection
  } = context
  const { planScale, defaultFloorHeight } = options

  function getDevicePoint(device: FireDevice): THREE.Vector3 | null {
    const placement = device.placement
    if (
      placement.status !== 'placed' ||
      !placement.position ||
      !placement.buildingId ||
      !placement.floorId
    ) {
      return null
    }

    if (
      hiddenBuildingIds.value.has(placement.buildingId) ||
      hiddenFloorIds.value.has(placement.floorId)
    ) {
      return null
    }

    const buildingIndex = project.value.buildings.findIndex(
      (building: FireBuilding) => building.id === placement.buildingId
    )
    const building = project.value.buildings[buildingIndex]
    const floor = building?.floors.find(
      (candidate: FireFloor) => candidate.id === placement.floorId
    )
    if (!building || !floor) return null

    const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
    const position = placement.position as Vector3
    const iconSize = getRenderedDeviceWorldSize(device)
    return new THREE.Vector3(
      origin.x + position.x * planScale,
      origin.y + getDeviceIconWorldCenterHeight(iconSize),
      origin.z + position.y * planScale
    )
  }

  function getRenderedDeviceWorldSize(device: FireDevice): number {
    const scale = project.value.viewSettings.deviceIconScale2D ?? 1
    const baseSize = getDeviceIconWorldSize(scale, planScale)
    return device.id === selectedDeviceId.value ? baseSize * 1.2 : baseSize
  }

  function getFloorOrigin(
    building: FireBuilding,
    buildingIndex: number,
    floor: FireFloor
  ): THREE.Vector3 {
    const baseX = (building.position?.x ?? buildingIndex * 1600) * planScale
    const baseZ = (building.position?.y ?? 0) * planScale
    const floorHeight = getEffectiveFloorHeight3D(
      project.value.viewSettings.floorSpacing3D ?? floor.floorHeight3D ?? defaultFloorHeight
    )
    return new THREE.Vector3(baseX, floor.levelIndex * floorHeight, baseZ)
  }

  function getDeviceColor(device: FireDevice): THREE.ColorRepresentation {
    return getDeviceStatusAppearance(device).spriteColor
  }

  function getSelectedZoneBounds(): THREE.Box3 | null {
    const selected = findSelectedZone()
    if (!selected) return null

    const bounds = new THREE.Box3()
    for (const area of selected.zone.visualAreas) {
      if (hiddenBuildingIds.value.has(area.buildingId) || hiddenFloorIds.value.has(area.floorId)) {
        continue
      }
      includeZoneAreaBounds(bounds, area.buildingId, area.floorId, area.points)
    }

    const selection = highlightSelection.value
    for (const device of project.value.devices) {
      if (!isDeviceHighlighted(project.value, selection, device)) continue

      const point = getDevicePoint(device)
      if (!point) continue

      const size = getRenderedDeviceWorldSize(device)
      bounds.expandByPoint(point.clone().add(new THREE.Vector3(-size, -size, -size)))
      bounds.expandByPoint(point.clone().add(new THREE.Vector3(size, size, size)))
    }

    return bounds.isEmpty() ? null : bounds
  }

  function includeZoneAreaBounds(
    bounds: THREE.Box3,
    buildingId: string,
    floorId: string,
    points: Array<{ x: number; y: number }>
  ): void {
    const buildingIndex = project.value.buildings.findIndex(
      (building: FireBuilding) => building.id === buildingId
    )
    const building = project.value.buildings[buildingIndex]
    const floor = building?.floors.find((candidate: FireFloor) => candidate.id === floorId)
    if (!building || !floor || points.length === 0) return

    const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
    for (const point of points) {
      bounds.expandByPoint(
        new THREE.Vector3(origin.x + point.x * planScale, origin.y, origin.z + point.y * planScale)
      )
    }
  }

  function findSelectedZone(): { panel: FirePanel; zone: FireZone } | null {
    const targetId = highlightTargetId.value
    if (!targetId) return null

    for (const network of project.value.networks) {
      for (const panel of network.panels) {
        const zone = panel.zones.find((candidate: FireZone) => candidate.id === targetId)
        if (zone) return { panel, zone }
      }
    }

    return null
  }

  function hasActiveInput(deviceId: string): boolean {
    return simulationState.value.activeInputAlarms.some(
      (alarm: { deviceId: string }) => alarm.deviceId === deviceId
    )
  }

  function hasActiveFault(deviceId: string): boolean {
    return simulationState.value.activeFaults.some(
      (fault: { deviceId: string }) => fault.deviceId === deviceId
    )
  }

  function getDeviceOutputState(device: FireDevice): DeviceSimulationOutput | null {
    return getDeviceSimulationOutput(project.value, simulationState.value.outputs, device)
  }

  return {
    getDevicePoint,
    getRenderedDeviceWorldSize,
    getFloorOrigin,
    getDeviceColor,
    getSelectedZoneBounds,
    findSelectedZone,
    hasActiveInput,
    hasActiveFault,
    getDeviceOutputState
  }
}
