import { ElMessage } from 'element-plus'
import type { FireDevice, ZoneVisualArea } from '../../domain/fire/types'
import {
  createPolygonArea,
  createRectangleArea,
  validateZonePolygon
} from '../../domain/fire/zoneGeometry'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'
import { getDeviceStatusAppearance } from '../../domain/fire/deviceVisualState'
import { createPlanner2DGeometryActions } from './Planner2DGeometryActions'
import { createPlanner2DPlanningActions } from './Planner2DPlanningActions'
import { createPlanner2DViewportActions } from './Planner2DViewportActions'
interface Planner2DActionsContext {
  // Shared bridge for split action modules; concrete refs stay owned by Planner2D.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
export function createPlanner2DActions(context: Planner2DActionsContext): {
  handleDrop: typeof handleDrop
  handleCanvasMouseDown: typeof handleCanvasMouseDown
  handleCanvasMouseMove: typeof handleCanvasMouseMove
  handleCanvasMouseUp: typeof handleCanvasMouseUp
  handleCanvasWheel: typeof handleCanvasWheel
  handleCanvasClick: typeof handleCanvasClick
  handleCanvasDoubleClick: typeof handleCanvasDoubleClick
  startDeviceDrag: typeof startDeviceDrag
  handleDeviceClick: typeof handleDeviceClick
  showDeviceContextMenu: typeof showDeviceContextMenu
  importDrawingForCurrentFloor: typeof importDrawingForCurrentFloor
  finishPolygon: typeof finishPolygon
  confirmPendingZoneArea: typeof confirmPendingZoneArea
  cancelPendingZoneArea: typeof cancelPendingZoneArea
  commitZoneArea: typeof commitZoneArea
  handleKeyDown: typeof handleKeyDown
  selectZoneArea: typeof selectZoneArea
  deleteSelectedZoneArea: typeof deleteSelectedZoneArea
  startReplaceSelectedZoneArea: typeof startReplaceSelectedZoneArea
  deviceClass: typeof deviceClass
  deviceIcon: typeof deviceIcon
  deviceStatus: typeof deviceStatus
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
  addBuilding: typeof addBuilding
  addFloor: typeof addFloor
  deleteBuilding: typeof deleteBuilding
  deleteFloor: typeof deleteFloor
  clearDrawing: typeof clearDrawing
  confirmPlanningDelete: typeof confirmPlanningDelete
  selectFirstAvailablePlanningTarget: typeof selectFirstAvailablePlanningTarget
  ensurePlanningFloorSelection: typeof ensurePlanningFloorSelection
  devicePoint: typeof devicePoint
  areaPoints: typeof areaPoints
  rectanglePoints: typeof rectanglePoints
  toSvgPoint: typeof toSvgPoint
  parseDeviceIds: typeof parseDeviceIds
  closeContextMenu: typeof closeContextMenu
  segmentTouchesDevice: typeof segmentTouchesDevice
} {
  const {
    store,
    t,
    project,
    selectedDeviceId,
    activeTool,
    svgRef,
    selectedBuildingId,
    selectedFloorId,
    selectedZoneId,
    selectedZoneAreaId,
    replacingZoneAreaId,
    rectangleStart,
    rectanglePreview,
    pendingZoneArea,
    polygonDraft,
    draggingDeviceId,
    dragPreview,
    contextMenu,
    viewport,
    isPanning,
    panStart,
    currentBuilding,
    currentFloor,
    zones,
    selectedZone,
    mapWidth,
    mapHeight,
    deviceById,
    selectedZoneArea
  } = context
  const {
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
  } = createPlanner2DViewportActions({ viewport, mapWidth, mapHeight, svgRef, isPanning, panStart })
  const {
    addBuilding,
    addFloor,
    deleteBuilding,
    deleteFloor,
    clearDrawing,
    confirmPlanningDelete,
    selectFirstAvailablePlanningTarget,
    ensurePlanningFloorSelection
  } = createPlanner2DPlanningActions({
    store,
    project,
    currentBuilding,
    currentFloor,
    selectedBuildingId,
    selectedFloorId,
    t
  })
  const {
    devicePoint,
    areaPoints,
    rectanglePoints,
    toSvgPoint,
    parseDeviceIds,
    closeContextMenu,
    segmentTouchesDevice
  } = createPlanner2DGeometryActions({ svgRef, dragPreview, mapWidth, mapHeight, contextMenu })
  function handleDrop(event: DragEvent): void {
    event.preventDefault()
    const target = ensurePlanningFloorSelection()
    const floor = currentFloor.value
    const building = currentBuilding.value
    if (!target || !floor || !building) return
    const raw =
      event.dataTransfer?.getData('application/x-fire-device-ids') ||
      event.dataTransfer?.getData('application/json')
    const deviceIds = parseDeviceIds(raw)
    if (deviceIds.length === 0) return
    const point = toSvgPoint(event)
    store.placeDevices(deviceIds, building.id, floor.id, { x: point.x, y: point.y, z: 0 })
  }
  function handleCanvasMouseDown(event: MouseEvent): void {
    closeContextMenu()
    if (event.button === 1) {
      startViewportPan(event)
      return
    }
    if (event.button !== 0) return
    if (
      activeTool.value === 'zoneRectangle' &&
      selectedZone.value &&
      currentFloor.value &&
      currentBuilding.value
    ) {
      pendingZoneArea.value = null
      rectangleStart.value = toSvgPoint(event)
      rectanglePreview.value = null
    }
  }
  function handleCanvasMouseMove(event: MouseEvent): void {
    if (isPanning.value) return
    const point = toSvgPoint(event)
    if (draggingDeviceId.value) {
      dragPreview.value = { deviceId: draggingDeviceId.value, point }
      return
    }
    if (rectangleStart.value) {
      rectanglePreview.value = rectanglePoints(rectangleStart.value, point)
    }
  }
  function handleCanvasMouseUp(event: MouseEvent): void {
    if (event.button !== 0 || isPanning.value) return
    if (draggingDeviceId.value) {
      const preview = dragPreview.value
      if (preview && preview.deviceId === draggingDeviceId.value) {
        store.moveDevice(draggingDeviceId.value, { x: preview.point.x, y: preview.point.y, z: 0 })
      }
      draggingDeviceId.value = null
      dragPreview.value = null
      return
    }
    if (
      !rectangleStart.value ||
      !rectanglePreview.value ||
      !selectedZone.value ||
      !currentFloor.value ||
      !currentBuilding.value
    ) {
      rectangleStart.value = null
      rectanglePreview.value = null
      return
    }
    const end = toSvgPoint(event)
    if (
      Math.abs(end.x - rectangleStart.value.x) > 4 &&
      Math.abs(end.y - rectangleStart.value.y) > 4
    ) {
      pendingZoneArea.value = createRectangleArea({
        id: `zone-area-${Date.now()}`,
        networkId: selectedZone.value.networkId,
        panelId: selectedZone.value.panelId,
        zoneNumber: selectedZone.value.zoneNumber,
        buildingId: currentBuilding.value.id,
        floorId: currentFloor.value.id,
        start: rectangleStart.value,
        end,
        color: '#ef4444',
        opacity: 0.18
      })
    }
    rectangleStart.value = null
    rectanglePreview.value = null
  }
  function handleCanvasWheel(event: WheelEvent): void {
    event.preventDefault()
    const focusPoint = toSvgPoint(event)
    zoomViewport(focusPoint, event.deltaY > 0 ? 1.12 : 0.88)
  }
  function handleCanvasClick(event: MouseEvent): void {
    if (activeTool.value === 'zonePolygon' && selectedZone.value) {
      polygonDraft.value = [...polygonDraft.value, toSvgPoint(event)]
      return
    }
    selectedZoneAreaId.value = null
    replacingZoneAreaId.value = null
    store.selectDevice(null)
  }
  function handleCanvasDoubleClick(event: MouseEvent): void {
    if (activeTool.value !== 'zonePolygon') return
    event.preventDefault()
    finishPolygon()
  }
  function startDeviceDrag(device: FireDevice, event: MouseEvent): void {
    if (event.button !== 0) return
    if (activeTool.value !== 'select' && activeTool.value !== 'placeDevice') return
    event.stopPropagation()
    draggingDeviceId.value = device.id
    if (device.placement.position) {
      dragPreview.value = {
        deviceId: device.id,
        point: { x: device.placement.position.x, y: device.placement.position.y }
      }
    }
    selectedZoneAreaId.value = null
    replacingZoneAreaId.value = null
    store.selectDevice(device.id)
  }
  function handleDeviceClick(device: FireDevice, event: MouseEvent): void {
    event.stopPropagation()
    closeContextMenu()
    selectedZoneAreaId.value = null
    replacingZoneAreaId.value = null
    store.selectDevice(device.id)
  }
  function showDeviceContextMenu(device: FireDevice, event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()
    selectedZoneAreaId.value = null
    replacingZoneAreaId.value = null
    store.selectDevice(device.id)
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      deviceId: device.id
    }
  }
  async function importDrawingForCurrentFloor(): Promise<void> {
    const target = ensurePlanningFloorSelection()
    const building = currentBuilding.value
    const floor = currentFloor.value
    if (!target || !building || !floor) return
    const result = await window.fireApi.importDrawing()
    if (result.canceled) return
    store.assignFloorMapAsset({
      asset: {
        id: result.asset.id,
        kind: result.asset.kind,
        name: result.asset.name,
        packagePath: result.asset.packagePath,
        runtimePath: result.asset.runtimePath,
        mimeType: result.asset.mimeType
      },
      buildingId: building.id,
      floorId: floor.id,
      mapWidth: result.asset.mapWidth,
      mapHeight: result.asset.mapHeight
    })
  }
  function finishPolygon(): void {
    if (
      !selectedZone.value ||
      !currentFloor.value ||
      !currentBuilding.value ||
      polygonDraft.value.length < 3
    )
      return
    const validation = validateZonePolygon(polygonDraft.value)
    if (!validation.valid) {
      ElMessage.warning(t('fire.planner.invalidPolygon'))
      return
    }
    pendingZoneArea.value = createPolygonArea({
      id: `zone-area-${Date.now()}`,
      networkId: selectedZone.value.networkId,
      panelId: selectedZone.value.panelId,
      zoneNumber: selectedZone.value.zoneNumber,
      buildingId: currentBuilding.value.id,
      floorId: currentFloor.value.id,
      points: polygonDraft.value,
      color: '#f97316',
      opacity: 0.18
    })
    polygonDraft.value = []
  }
  function confirmPendingZoneArea(): void {
    const area = pendingZoneArea.value
    if (!area) return
    commitZoneArea(area)
    pendingZoneArea.value = null
    ElMessage.success(t('fire.planner.zoneAreaSaved'))
  }
  function cancelPendingZoneArea(showMessage = true): void {
    if (!pendingZoneArea.value) return
    pendingZoneArea.value = null
    rectangleStart.value = null
    rectanglePreview.value = null
    polygonDraft.value = []
    if (showMessage) {
      ElMessage.info(t('fire.planner.zoneAreaCanceled'))
    }
  }
  function commitZoneArea(area: ZoneVisualArea): void {
    if (replacingZoneAreaId.value) {
      const replacement = { ...area, id: replacingZoneAreaId.value }
      store.replaceZoneArea(replacingZoneAreaId.value, replacement)
      selectedZoneAreaId.value = replacement.id
      replacingZoneAreaId.value = null
      store.activeTool = 'select'
      return
    }
    store.addZoneArea(area)
    selectedZoneAreaId.value = area.id
  }
  function handleKeyDown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target) && event.key !== 'Escape') return
    if (event.key === 'Escape') {
      event.preventDefault()
      polygonDraft.value = []
      rectangleStart.value = null
      rectanglePreview.value = null
      draggingDeviceId.value = null
      dragPreview.value = null
      cancelPendingZoneArea(false)
      replacingZoneAreaId.value = null
      store.activeTool = 'select'
      stopViewportPan()
      closeContextMenu()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedZoneAreaId.value) {
        event.preventDefault()
        deleteSelectedZoneArea()
        return
      }
      const deviceId = selectedDeviceId.value
      const device = deviceId ? deviceById.value.get(deviceId) : undefined
      if (device?.placement.status !== 'placed') return
      event.preventDefault()
      store.removeDeviceFromDrawing(device.id)
      closeContextMenu()
    }
  }
  function selectZoneArea(areaId: string, event: MouseEvent): void {
    event.stopPropagation()
    closeContextMenu()
    store.selectDevice(null)
    selectedZoneAreaId.value = areaId
  }
  function deleteSelectedZoneArea(): void {
    const areaId = selectedZoneAreaId.value
    if (!areaId) return
    store.removeZoneArea(areaId)
    selectedZoneAreaId.value = null
    if (replacingZoneAreaId.value === areaId) {
      replacingZoneAreaId.value = null
    }
    closeContextMenu()
  }
  function startReplaceSelectedZoneArea(): void {
    const area = selectedZoneArea.value
    if (!area) return
    const zone = zones.value.find(
      (candidate) => candidate.panelId === area.panelId && candidate.zoneNumber === area.zoneNumber
    )
    selectedZoneId.value = zone?.id ?? selectedZoneId.value
    selectedBuildingId.value = area.buildingId
    selectedFloorId.value = area.floorId
    replacingZoneAreaId.value = area.id
    polygonDraft.value = []
    rectangleStart.value = null
    rectanglePreview.value = null
    pendingZoneArea.value = null
    store.activeTool = 'zoneRectangle'
  }
  function deviceClass(device: FireDevice): string[] {
    const status = getDeviceStatusAppearance(device).state
    return [
      selectedDeviceId.value === device.id ? 'selected' : '',
      status === 'normal' ? '' : status
    ].filter(Boolean)
  }
  function deviceIcon(device: FireDevice): string {
    return getDeviceIconHrefByType(device.type)
  }
  function deviceStatus(device: FireDevice): ReturnType<typeof getDeviceStatusAppearance> {
    return getDeviceStatusAppearance(device)
  }
  return {
    handleDrop,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasWheel,
    handleCanvasClick,
    handleCanvasDoubleClick,
    startDeviceDrag,
    handleDeviceClick,
    showDeviceContextMenu,
    importDrawingForCurrentFloor,
    finishPolygon,
    confirmPendingZoneArea,
    cancelPendingZoneArea,
    commitZoneArea,
    handleKeyDown,
    selectZoneArea,
    deleteSelectedZoneArea,
    startReplaceSelectedZoneArea,
    deviceClass,
    deviceIcon,
    deviceStatus,
    resetViewport,
    startViewportPan,
    stopViewportPan,
    handleWindowMouseMove,
    handleWindowMouseUp,
    zoomViewport,
    clampViewport,
    clampViewportAxis,
    clampNumber,
    isEditableTarget,
    addBuilding,
    addFloor,
    deleteBuilding,
    deleteFloor,
    clearDrawing,
    confirmPlanningDelete,
    selectFirstAvailablePlanningTarget,
    ensurePlanningFloorSelection,
    devicePoint,
    areaPoints,
    rectanglePoints,
    toSvgPoint,
    parseDeviceIds,
    closeContextMenu,
    segmentTouchesDevice
  }
}
