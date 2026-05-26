import type { FireDevice, Vector2, ZoneVisualArea } from './types'

export type ZonePolygonValidationResult =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'too-few-points'
        | 'duplicate-adjacent-points'
        | 'area-too-small'
        | 'self-intersection'
    }

const MIN_USABLE_POLYGON_AREA = 4
const GEOMETRY_EPSILON = 1e-6

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

export function validateZonePolygon(points: Vector2[]): ZonePolygonValidationResult {
  if (uniquePointCount(points) < 3) {
    return { valid: false, reason: 'too-few-points' }
  }

  if (hasAdjacentDuplicatePoints(points)) {
    return { valid: false, reason: 'duplicate-adjacent-points' }
  }

  if (hasSelfIntersection(points)) {
    return { valid: false, reason: 'self-intersection' }
  }

  if (Math.abs(polygonArea(points)) < MIN_USABLE_POLYGON_AREA) {
    return { valid: false, reason: 'area-too-small' }
  }

  return { valid: true }
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

function uniquePointCount(points: Vector2[]): number {
  const unique = new Set(points.map((point) => `${point.x}:${point.y}`))
  return unique.size
}

function hasAdjacentDuplicatePoints(points: Vector2[]): boolean {
  return points.some((point, index) => {
    const next = points[index + 1]
    return next !== undefined && pointsEqual(point, next)
  })
}

function polygonArea(points: Vector2[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]
      return sum + point.x * next.y - next.x * point.y
    }, 0) / 2
  )
}

function hasSelfIntersection(points: Vector2[]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstStart = points[first]
    const firstEnd = points[(first + 1) % points.length]

    for (let second = first + 1; second < points.length; second += 1) {
      if (segmentsAreAdjacent(first, second, points.length)) {
        continue
      }

      const secondStart = points[second]
      const secondEnd = points[(second + 1) % points.length]
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return true
      }
    }
  }

  return false
}

function segmentsAreAdjacent(first: number, second: number, pointCount: number): boolean {
  return Math.abs(first - second) === 1 || (first === 0 && second === pointCount - 1)
}

function segmentsIntersect(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)

  if (abC === 0 && pointIsOnSegment(c, a, b)) return true
  if (abD === 0 && pointIsOnSegment(d, a, b)) return true
  if (cdA === 0 && pointIsOnSegment(a, c, d)) return true
  if (cdB === 0 && pointIsOnSegment(b, c, d)) return true

  return abC !== abD && cdA !== cdB
}

function orientation(a: Vector2, b: Vector2, c: Vector2): -1 | 0 | 1 {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)

  if (Math.abs(value) <= GEOMETRY_EPSILON) {
    return 0
  }

  return value > 0 ? 1 : -1
}

function pointsEqual(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) <= GEOMETRY_EPSILON && Math.abs(a.y - b.y) <= GEOMETRY_EPSILON
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
