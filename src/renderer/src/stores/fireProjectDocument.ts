import type {
  FireBuilding,
  FireDevice,
  FireFloor,
  FireIssue,
  FireProject,
  FirePanel,
  FireZone,
  IOGroup,
  NonAddressableSounderPoint,
  SounderGroup,
  ZoneVisualArea
} from '../domain/fire/types'
import { DEFAULT_FLOOR_HEIGHT_3D, getEffectiveFloorHeight3D } from '../domain/fire/viewer3DGeometry'
import { validateZonePolygon } from '../domain/fire/zoneGeometry'

export const DEFAULT_MAP_WIDTH = 1200
export const DEFAULT_MAP_HEIGHT = 800

export interface FireProjectDocument extends FireProject {
  devices: FireDevice[]
  issues: FireIssue[]
  nonAddressableSounderPoints: NonAddressableSounderPoint[]
}

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
      floorSpacing3D: DEFAULT_FLOOR_HEIGHT_3D,
      mapOpacity: 1,
      mapOpacity3D: 1,
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

export function normalizeProjectDocument(
  project: FireProject | FireProjectDocument
): FireProjectDocument {
  const document = project as FireProjectDocument
  const clonedProject = cloneValue(project)
  const devices = cloneValue(document.devices ?? [])

  return normalizeOrphanPlanningReferences({
    ...clonedProject,
    networks: synthesizeMissingPanelRelations(clonedProject.networks, devices),
    viewSettings: {
      ...clonedProject.viewSettings,
      floorSpacing3D: getEffectiveFloorHeight3D(clonedProject.viewSettings.floorSpacing3D),
      mapOpacity3D: clampNumber(clonedProject.viewSettings.mapOpacity3D ?? 1, 0, 1)
    },
    devices,
    issues: cloneValue(document.issues ?? []),
    nonAddressableSounderPoints: cloneValue(document.nonAddressableSounderPoints ?? [])
  })
}

function normalizeOrphanPlanningReferences(document: FireProjectDocument): FireProjectDocument {
  const validFloorKeys = getValidPlanningFloorKeys(document.buildings)

  return {
    ...document,
    devices: document.devices.map((device) =>
      placementHasValidPlanningTarget(device.placement, validFloorKeys)
        ? device
        : {
            ...device,
            placement: unplacedPlanningPlacement(device.placement)
          }
    ),
    nonAddressableSounderPoints: document.nonAddressableSounderPoints.map((point) =>
      placementHasValidPlanningTarget(point.placement, validFloorKeys)
        ? point
        : {
            ...point,
            placement: unplacedPlanningPlacement(point.placement)
          }
    ),
    networks: document.networks.map((network) => ({
      ...network,
      panels: network.panels.map((panel) => ({
        ...panel,
        zones: panel.zones.map((zone) => ({
          ...zone,
          visualAreas: zone.visualAreas.filter((area) =>
            validFloorKeys.has(planningFloorKey(area.buildingId, area.floorId))
          )
        }))
      }))
    }))
  }
}

function synthesizeMissingPanelRelations(
  networks: FireProject['networks'],
  devices: FireDevice[]
): FireProject['networks'] {
  return networks.map((network) => ({
    ...network,
    panels: network.panels.map((panel) => ({
      ...panel,
      zones: mergeZones(panel.zones, synthesizePanelZones(panel, devices)),
      sounderGroups: mergeSounderGroups(
        panel.sounderGroups,
        synthesizePanelSounderGroups(panel, devices)
      ),
      ioGroups: mergeIOGroups(panel.ioGroups, synthesizePanelIOGroups(panel, devices))
    }))
  }))
}

function mergeZones(existingZones: FireZone[], synthesizedZones: FireZone[]): FireZone[] {
  const existingZoneNumbers = new Set(existingZones.map((zone) => zone.zoneNumber))
  return [
    ...synthesizedZones.filter((zone) => !existingZoneNumbers.has(zone.zoneNumber)),
    ...existingZones
  ].sort((left, right) => left.zoneNumber - right.zoneNumber)
}

function mergeSounderGroups(
  existingGroups: SounderGroup[],
  synthesizedGroups: SounderGroup[]
): SounderGroup[] {
  const existingGroupIds = new Set(existingGroups.map((group) => group.groupId))
  return [
    ...synthesizedGroups.filter((group) => !existingGroupIds.has(group.groupId)),
    ...existingGroups
  ].sort((left, right) => left.groupId - right.groupId)
}

function mergeIOGroups(existingGroups: IOGroup[], synthesizedGroups: IOGroup[]): IOGroup[] {
  const existingGroupIds = new Set(existingGroups.map((group) => group.groupId))
  return [
    ...synthesizedGroups.filter((group) => !existingGroupIds.has(group.groupId)),
    ...existingGroups
  ].sort((left, right) => left.groupId - right.groupId)
}

export function hasZoneArea(panels: FirePanel[], areaId: string): boolean {
  return panels.some((panel) =>
    panel.zones.some((zone) => zone.visualAreas.some((area) => area.id === areaId))
  )
}

export function isValidZoneVisualArea(area: ZoneVisualArea): boolean {
  return area.kind !== 'polygon' || validateZonePolygon(area.points).valid
}

function getValidPlanningFloorKeys(buildings: FireProject['buildings']): Set<string> {
  return new Set(
    buildings.flatMap((building) =>
      building.floors.map((floor) => planningFloorKey(building.id, floor.id))
    )
  )
}

function planningFloorKey(buildingId: string, floorId: string): string {
  return `${buildingId}:${floorId}`
}

function placementHasValidPlanningTarget(
  placement: FireDevice['placement'],
  validFloorKeys: Set<string>
): boolean {
  if (placement.status !== 'placed') {
    return true
  }

  return Boolean(
    placement.buildingId &&
    placement.floorId &&
    validFloorKeys.has(planningFloorKey(placement.buildingId, placement.floorId))
  )
}

function unplacedPlanningPlacement(placement: FireDevice['placement']): FireDevice['placement'] {
  return {
    status: 'unplaced',
    rotation: placement.rotation
  }
}

function synthesizePanelZones(panel: FirePanel, devices: FireDevice[]): FireZone[] {
  return Array.from(
    new Set(
      devices
        .filter((device) => device.panelId === panel.id)
        .map((device) => device.zoneNumber)
        .filter((zoneNumber): zoneNumber is number => zoneNumber !== undefined && zoneNumber > 0)
    )
  )
    .sort((left, right) => left - right)
    .map((zoneNumber) => ({
      id: `${panel.id}-zone-${zoneNumber}`,
      networkId: panel.networkId,
      panelId: panel.id,
      zoneNumber,
      text: `Zone ${zoneNumber}`,
      enabled: true,
      delayedSounders: false,
      alarmMode: 'single',
      visualAreas: [],
      raw: { synthesizedFromDeviceZones: true }
    }))
}

function synthesizePanelSounderGroups(panel: FirePanel, devices: FireDevice[]): SounderGroup[] {
  return uniquePanelGroupIds(panel, devices, (device) => device.sounderGroupId).map((groupId) => ({
    id: `${panel.id}-sounder-group-${groupId}`,
    networkId: panel.networkId,
    panelId: panel.id,
    groupId,
    title: `Sounder Group ${groupId}`,
    addressableMembers: devices
      .filter((device) => device.panelId === panel.id && device.sounderGroupId === groupId)
      .map(deviceToGroupMember),
    nonAddressableMembers: [],
    raw: { synthesizedFromDeviceGroups: true }
  }))
}

function synthesizePanelIOGroups(panel: FirePanel, devices: FireDevice[]): IOGroup[] {
  return uniquePanelGroupIds(panel, devices, (device) => device.ioGroupId).map((groupId) => ({
    id: `${panel.id}-io-group-${groupId}`,
    networkId: panel.networkId,
    panelId: panel.id,
    groupId,
    members: devices
      .filter((device) => device.panelId === panel.id && device.ioGroupId === groupId)
      .map(deviceToGroupMember),
    raw: { synthesizedFromDeviceGroups: true }
  }))
}

function uniquePanelGroupIds(
  panel: FirePanel,
  devices: FireDevice[],
  getGroupId: (device: FireDevice) => number | undefined
): number[] {
  return Array.from(
    new Set(
      devices
        .filter((device) => device.panelId === panel.id)
        .map(getGroupId)
        .filter((groupId): groupId is number => groupId !== undefined && groupId > 0)
    )
  ).sort((left, right) => left - right)
}

function deviceToGroupMember(device: FireDevice): {
  loopId?: number
  physicalAddress?: number
  description?: string
  raw: Record<string, unknown>
} {
  return {
    loopId: device.loopId,
    physicalAddress: device.address,
    description: device.location || device.description,
    raw: { synthesizedFromDeviceId: device.id }
  }
}

export function createPlanningFloor(buildingId: string, index: number, name?: string): FireFloor {
  return {
    id: createId('floor'),
    buildingId,
    name: name ?? `Floor ${index}`,
    levelIndex: index - 1,
    mapWidth: DEFAULT_MAP_WIDTH,
    mapHeight: DEFAULT_MAP_HEIGHT,
    camera2D: { x: 0, y: 0, scale: 1 },
    floorScale3D: 1,
    floorHeight3D: DEFAULT_FLOOR_HEIGHT_3D
  }
}

export function createPlanningBuilding(index: number, name?: string): FireBuilding {
  const buildingId = createId('building')
  return {
    id: buildingId,
    name: name ?? `Building ${index}`,
    floors: [createPlanningFloor(buildingId, 1)],
    position: { x: 0, y: 0 },
    size: { width: 1200, depth: 800 },
    rotation: 0
  }
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getNextPlacementOrder(project: FireProjectDocument): number {
  const maxOrder = project.devices.reduce((max, device) => {
    const order = finitePlacementOrder(device.placement.order)
    return order === undefined ? max : Math.max(max, order)
  }, 0)
  return maxOrder + 1
}

export function finitePlacementOrder(order: number | undefined): number | undefined {
  return typeof order === 'number' && Number.isFinite(order) ? order : undefined
}
