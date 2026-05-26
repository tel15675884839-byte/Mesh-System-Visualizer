import type { FireDevice, Vector2 } from '../../domain/fire/types'

interface Planner2DSubActionContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function createPlanner2DGeometryActions(context: Planner2DSubActionContext): {
  devicePoint: typeof devicePoint
  areaPoints: typeof areaPoints
  rectanglePoints: typeof rectanglePoints
  toSvgPoint: typeof toSvgPoint
  parseDeviceIds: typeof parseDeviceIds
  closeContextMenu: typeof closeContextMenu
  segmentTouchesDevice: typeof segmentTouchesDevice
} {
  const { svgRef, dragPreview, mapWidth, mapHeight, contextMenu } = context
  function devicePoint(device: FireDevice): Vector2 {
    if (dragPreview.value?.deviceId === device.id) {
      return dragPreview.value.point
    }

    return {
      x: device.placement.position?.x ?? 0,
      y: device.placement.position?.y ?? 0
    }
  }

  function areaPoints(points: Vector2[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ')
  }

  function rectanglePoints(start: Vector2, end: Vector2): Vector2[] {
    return [
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y },
      { x: start.x, y: end.y }
    ]
  }

  function toSvgPoint(event: MouseEvent | DragEvent): Vector2 {
    const svg = svgRef.value
    if (!svg) return { x: 0, y: 0 }

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: point.x, y: point.y }
    const transformed = point.matrixTransform(matrix.inverse())
    return {
      x: Math.max(0, Math.min(mapWidth.value, transformed.x)),
      y: Math.max(0, Math.min(mapHeight.value, transformed.y))
    }
  }

  function parseDeviceIds(raw: string | undefined): string[] {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch {
      return []
    }
  }

  function closeContextMenu(): void {
    contextMenu.value = { visible: false, x: 0, y: 0, deviceId: null }
  }

  function segmentTouchesDevice(
    segment: { fromDeviceId: string; toDeviceId: string },
    deviceId: string
  ): boolean {
    return segment.fromDeviceId === deviceId || segment.toDeviceId === deviceId
  }

  return {
    devicePoint,
    areaPoints,
    rectanglePoints,
    toSvgPoint,
    parseDeviceIds,
    closeContextMenu,
    segmentTouchesDevice
  }
}
