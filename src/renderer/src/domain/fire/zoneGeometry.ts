import type { FireDevice, Vector2, ZoneVisualArea } from './types'

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
}): ZoneVisualArea {
  return {
    id: args.id,
    networkId: args.networkId,
    panelId: args.panelId,
    zoneNumber: args.zoneNumber,
    buildingId: args.buildingId,
    floorId: args.floorId,
    kind: 'rectangle',
    points: rectangleFromBounds(args.start, args.end),
    color: args.color,
    opacity: args.opacity
  }
}

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
}): ZoneVisualArea {
  return {
    id: args.id,
    networkId: args.networkId,
    panelId: args.panelId,
    zoneNumber: args.zoneNumber,
    buildingId: args.buildingId,
    floorId: args.floorId,
    kind: 'polygon',
    points: args.points.map(copyPoint),
    color: args.color,
    opacity: args.opacity
  }
}

export function buildBoundingAreaForDevices(devices: FireDevice[], padding: number): Vector2[] {
  const placedPositions = devices.flatMap((device) => {
    const position = device.placement.position

    return device.placement.status === 'placed' && position !== undefined ? [position] : []
  })

  if (placedPositions.length === 0) {
    return []
  }

  const xs = placedPositions.map((position) => position.x)
  const ys = placedPositions.map((position) => position.y)

  return rectangleFromBounds(
    { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding },
    { x: Math.max(...xs) + padding, y: Math.max(...ys) + padding }
  )
}

export function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
  if (polygon.length < 3) {
    return false
  }

  let inside = false

  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const currentPoint = polygon[current]
    const previousPoint = polygon[previous]

    if (pointIsOnSegment(point, previousPoint, currentPoint)) {
      return true
    }

    const crossesHorizontalRay =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x

    if (crossesHorizontalRay) {
      inside = !inside
    }
  }

  return inside
}

function rectangleFromBounds(a: Vector2, b: Vector2): Vector2[] {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ]
}

function copyPoint(point: Vector2): Vector2 {
  return { x: point.x, y: point.y }
}

function pointIsOnSegment(point: Vector2, a: Vector2, b: Vector2): boolean {
  const crossProduct = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y)

  if (Math.abs(crossProduct) > Number.EPSILON) {
    return false
  }

  return (
    point.x >= Math.min(a.x, b.x) &&
    point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) &&
    point.y <= Math.max(a.y, b.y)
  )
}
