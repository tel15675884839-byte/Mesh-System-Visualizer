import type { FireDevice, FireZone, Vector2, ZoneVisualArea } from './types'

export interface Viewer3DZoneAreaResolutionArgs {
  zone: FireZone
  devices: FireDevice[]
  includeTemporary: boolean
  padding?: number
  temporaryColor?: string
  temporaryOpacity?: number
}

export interface Viewer3DResolvedZoneArea extends ZoneVisualArea {
  temporary: boolean
}

const DEFAULT_PADDING = 56
const DEFAULT_TEMPORARY_COLOR = '#ef4444'
const DEFAULT_TEMPORARY_OPACITY = 0.24

export function resolveViewer3DZoneAreas({
  zone,
  devices,
  includeTemporary,
  padding = DEFAULT_PADDING,
  temporaryColor = DEFAULT_TEMPORARY_COLOR,
  temporaryOpacity = DEFAULT_TEMPORARY_OPACITY
}: Viewer3DZoneAreaResolutionArgs): Viewer3DResolvedZoneArea[] {
  if (zone.visualAreas.length > 0) {
    return zone.visualAreas.map((area) => ({
      ...area,
      temporary: false
    }))
  }

  if (!includeTemporary) {
    return []
  }

  return Array.from(groupPlacedZoneDevicesByFloor(zone.zoneNumber, devices).entries()).map(
    ([key, floorDevices]) => {
      const [buildingId, floorId] = key.split(':')
      const bounds = getDeviceBounds(floorDevices, padding)

      return {
        id: `temporary-zone-${zone.id}-${buildingId}-${floorId}`,
        networkId: zone.networkId,
        panelId: zone.panelId,
        zoneNumber: zone.zoneNumber,
        buildingId,
        floorId,
        kind: 'rectangle',
        points: boundsToRectangle(bounds),
        color: temporaryColor,
        opacity: temporaryOpacity,
        temporary: true
      }
    }
  )
}

function groupPlacedZoneDevicesByFloor(
  zoneNumber: number,
  devices: FireDevice[]
): Map<string, FireDevice[]> {
  const groups = new Map<string, FireDevice[]>()

  for (const device of devices) {
    const placement = device.placement
    if (
      device.zoneNumber !== zoneNumber ||
      placement.status !== 'placed' ||
      !placement.position ||
      !placement.buildingId ||
      !placement.floorId
    ) {
      continue
    }

    const key = `${placement.buildingId}:${placement.floorId}`
    groups.set(key, [...(groups.get(key) ?? []), device])
  }

  return groups
}

function getDeviceBounds(
  devices: FireDevice[],
  padding: number
): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const positions = devices
    .map((device) => device.placement.position)
    .filter((position): position is { x: number; y: number; z: number } => Boolean(position))

  return {
    minX: Math.min(...positions.map((position) => position.x)) - padding,
    minY: Math.min(...positions.map((position) => position.y)) - padding,
    maxX: Math.max(...positions.map((position) => position.x)) + padding,
    maxY: Math.max(...positions.map((position) => position.y)) + padding
  }
}

function boundsToRectangle(bounds: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}): Vector2[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ]
}
