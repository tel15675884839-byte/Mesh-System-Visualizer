import type { Ref } from 'vue'
import type { FireAsset, FireDevice, Vector3, ZoneVisualArea } from '../domain/fire/types'
import {
  cloneValue,
  createPlanningBuilding,
  createPlanningFloor,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  finitePlacementOrder,
  getNextPlacementOrder,
  hasZoneArea,
  isValidZoneVisualArea,
  type FireProjectDocument
} from './fireProjectDocument'

const GRID_SPACING = 48

interface FireProjectPlanningActionsContext {
  project: Ref<FireProjectDocument>
  selectedDeviceId: Ref<string | null>
  withPlanningSnapshot: (change: () => void) => void
}

export function createFireProjectPlanningActions({
  project,
  selectedDeviceId,
  withPlanningSnapshot
}: FireProjectPlanningActionsContext): {
  addBuilding: (name?: string) => string
  addFloor: (buildingId: string, name?: string) => string | null
  addZoneArea: (area: ZoneVisualArea) => void
  assignFloorMapAsset: (args: {
    asset: FireAsset
    buildingId: string
    floorId: string
    mapWidth?: number
    mapHeight?: number
  }) => void
  clearFloorMapAsset: (buildingId: string, floorId: string) => void
  ensureDefaultPlanningFloor: () => { buildingId: string; floorId: string }
  moveDevice: (deviceId: string, position: Vector3) => void
  placeDevices: (
    deviceIds: string[],
    buildingId: string,
    floorId: string,
    startPosition: Vector3
  ) => void
  removeBuilding: (buildingId: string) => void
  removeDeviceFromDrawing: (deviceId: string) => void
  removeFloor: (buildingId: string, floorId: string) => void
  removeZoneArea: (areaId: string) => void
  replaceZoneArea: (areaId: string, nextArea: ZoneVisualArea) => void
  restoreDefaultLoopWiring: (loopId: string) => void
  setManualLoopOrder: (loopId: string, deviceIds: string[]) => void
} {
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
      let nextOrder = getNextPlacementOrder(project.value)

      project.value.devices = project.value.devices.map((device) => {
        const index = deviceIds.indexOf(device.id)
        if (!deviceIdSet.has(device.id) || index < 0) {
          return device
        }
        const existingOrder =
          device.placement.status === 'placed'
            ? finitePlacementOrder(device.placement.order)
            : undefined

        return {
          ...device,
          placement: {
            ...device.placement,
            status: 'placed',
            buildingId,
            floorId,
            order: existingOrder ?? nextOrder++,
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

  function addBuilding(name?: string): string {
    const building = createPlanningBuilding(project.value.buildings.length + 1, name)

    withPlanningSnapshot(() => {
      project.value.buildings = [...project.value.buildings, building]
    })

    return building.id
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

  function cleanPlanningReferences(args: {
    shouldRemovePlacement: (placement: FireDevice['placement']) => boolean
    shouldRemoveZoneArea: (area: ZoneVisualArea) => boolean
  }): void {
    const affectedDeviceIds = new Set<string>()

    project.value.devices = project.value.devices.map((device) => {
      if (!args.shouldRemovePlacement(device.placement)) {
        return device
      }

      affectedDeviceIds.add(device.id)
      return {
        ...device,
        placement: {
          status: 'unplaced',
          rotation: device.placement.rotation
        }
      }
    })

    project.value.nonAddressableSounderPoints = project.value.nonAddressableSounderPoints.map(
      (point) =>
        args.shouldRemovePlacement(point.placement)
          ? {
              ...point,
              placement: {
                status: 'unplaced',
                rotation: point.placement.rotation
              }
            }
          : point
    )

    project.value.networks = project.value.networks.map((network) => ({
      ...network,
      panels: network.panels.map((panel) => ({
        ...panel,
        zones: panel.zones.map((zone) => ({
          ...zone,
          visualAreas: zone.visualAreas.filter((area) => !args.shouldRemoveZoneArea(area))
        }))
      }))
    }))

    if (selectedDeviceId.value && affectedDeviceIds.has(selectedDeviceId.value)) {
      selectedDeviceId.value = null
    }
  }

  function removeBuilding(buildingId: string): void {
    const building = project.value.buildings.find((candidate) => candidate.id === buildingId)
    if (!building) {
      return
    }

    const removedFloorIds = new Set(building.floors.map((floor) => floor.id))

    withPlanningSnapshot(() => {
      project.value.buildings = project.value.buildings.filter(
        (candidate) => candidate.id !== buildingId
      )
      if (project.value.buildings.length === 0) {
        project.value.buildings = [createPlanningBuilding(1)]
      }
      cleanPlanningReferences({
        shouldRemovePlacement: (placement) => placement.buildingId === buildingId,
        shouldRemoveZoneArea: (area) =>
          area.buildingId === buildingId || removedFloorIds.has(area.floorId)
      })
    })
  }

  function removeFloor(buildingId: string, floorId: string): void {
    const building = project.value.buildings.find((candidate) => candidate.id === buildingId)
    if (!building?.floors.some((floor) => floor.id === floorId)) {
      return
    }

    withPlanningSnapshot(() => {
      project.value.buildings = project.value.buildings.map((candidate) => {
        if (candidate.id !== buildingId) {
          return candidate
        }

        const remainingFloors = candidate.floors.filter((floor) => floor.id !== floorId)
        return {
          ...candidate,
          floors:
            remainingFloors.length > 0 ? remainingFloors : [createPlanningFloor(candidate.id, 1)]
        }
      })
      cleanPlanningReferences({
        shouldRemovePlacement: (placement) =>
          placement.buildingId === buildingId && placement.floorId === floorId,
        shouldRemoveZoneArea: (area) => area.buildingId === buildingId && area.floorId === floorId
      })
    })
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

  function clearFloorMapAsset(buildingId: string, floorId: string): void {
    const building = project.value.buildings.find((candidate) => candidate.id === buildingId)
    const floor = building?.floors.find((candidate) => candidate.id === floorId)
    if (!floor?.mapAssetId) {
      return
    }

    withPlanningSnapshot(() => {
      project.value.buildings = project.value.buildings.map((candidate) =>
        candidate.id === buildingId
          ? {
              ...candidate,
              floors: candidate.floors.map((candidateFloor) => {
                if (candidateFloor.id !== floorId) {
                  return candidateFloor
                }

                const nextFloor = {
                  ...candidateFloor,
                  mapWidth: DEFAULT_MAP_WIDTH,
                  mapHeight: DEFAULT_MAP_HEIGHT
                }
                delete nextFloor.mapAssetId
                return nextFloor
              })
            }
          : candidate
      )
    })
  }

  function addZoneArea(area: ZoneVisualArea): void {
    if (!isValidZoneVisualArea(area)) {
      return
    }

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

  function replaceZoneArea(areaId: string, nextArea: ZoneVisualArea): void {
    if (!isValidZoneVisualArea(nextArea)) {
      return
    }

    if (!project.value.networks.some((network) => hasZoneArea(network.panels, areaId))) {
      return
    }

    withPlanningSnapshot(() => {
      project.value.networks = project.value.networks.map((network) => ({
        ...network,
        panels: network.panels.map((panel) => ({
          ...panel,
          zones: panel.zones.map((zone) => ({
            ...zone,
            visualAreas: zone.visualAreas.map((area) =>
              area.id === areaId ? cloneValue(nextArea) : area
            )
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

  return {
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
  }
}
