import type { Vector2 } from '../../domain/fire/types'

interface Planner2DSubActionContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function createPlanner2DViewportActions(context: Planner2DSubActionContext): {
  resetViewport: typeof resetViewport
  startViewportPan: typeof startViewportPan
  stopViewportPan: typeof stopViewportPan
  handleWindowMouseMove: typeof handleWindowMouseMove
  handleWindowMouseUp: typeof handleWindowMouseUp
  zoomViewport: typeof zoomViewport
  clampViewport: typeof clampViewport
  clampViewportAxis: typeof clampViewportAxis
  clampNumber: typeof clampNumber
  isEditableTarget: typeof isEditableTarget
} {
  const { viewport, mapWidth, mapHeight, svgRef, isPanning, panStart } = context
  function resetViewport(): void {
    viewport.value = { x: 0, y: 0, width: mapWidth.value, height: mapHeight.value }
    stopViewportPan()
  }

  function startViewportPan(event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()
    isPanning.value = true
    panStart.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: { ...viewport.value }
    }
  }

  function stopViewportPan(): void {
    isPanning.value = false
    panStart.value = null
  }

  function handleWindowMouseMove(event: MouseEvent): void {
    if (!isPanning.value || !panStart.value) return

    const svg = svgRef.value
    const bounds = svg?.getBoundingClientRect()
    if (!bounds?.width || !bounds.height) return

    const start = panStart.value
    const deltaX = (event.clientX - start.clientX) * (start.viewport.width / bounds.width)
    const deltaY = (event.clientY - start.clientY) * (start.viewport.height / bounds.height)

    viewport.value = clampViewport({
      ...start.viewport,
      x: start.viewport.x - deltaX,
      y: start.viewport.y - deltaY
    })
  }

  function handleWindowMouseUp(event: MouseEvent): void {
    if (event.button === 1) {
      stopViewportPan()
    }
  }

  function zoomViewport(focusPoint: Vector2, factor: number): void {
    const current = viewport.value
    const nextWidth = current.width * factor
    const nextHeight = current.height * factor
    const focusRatioX = (focusPoint.x - current.x) / current.width
    const focusRatioY = (focusPoint.y - current.y) / current.height

    viewport.value = clampViewport({
      x: focusPoint.x - nextWidth * focusRatioX,
      y: focusPoint.y - nextHeight * focusRatioY,
      width: nextWidth,
      height: nextHeight
    })
  }

  function clampViewport(nextViewport: { x: number; y: number; width: number; height: number }): {
    x: number
    y: number
    width: number
    height: number
  } {
    const width = clampNumber(nextViewport.width, mapWidth.value / 8, mapWidth.value * 4)
    const height = clampNumber(nextViewport.height, mapHeight.value / 8, mapHeight.value * 4)

    return {
      x: clampViewportAxis(nextViewport.x, mapWidth.value, width),
      y: clampViewportAxis(nextViewport.y, mapHeight.value, height),
      width,
      height
    }
  }

  function clampViewportAxis(value: number, contentSize: number, viewportSize: number): number {
    const margin = viewportSize * 0.35
    const min = -margin
    const max = contentSize - viewportSize + margin
    if (min > max) return (min + max) / 2
    return clampNumber(value, min, max)
  }

  function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    const element = target instanceof HTMLElement ? target : null
    if (!element) return false
    return (
      element.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
      Boolean(element.closest('[contenteditable="true"]'))
    )
  }

  return {
    resetViewport,
    startViewportPan,
    stopViewportPan,
    handleWindowMouseMove,
    handleWindowMouseUp,
    zoomViewport,
    clampViewport,
    clampViewportAxis,
    clampNumber,
    isEditableTarget
  }
}
