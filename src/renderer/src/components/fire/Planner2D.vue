<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireDevice, FireFloor, FirePanel, Vector2 } from '../../domain/fire/types'
import {
  buildAdjacentCurrentFloorLoopSegments,
  buildCurrentFloorLoopSegments
} from '../../domain/fire/loopWiring'
import {
  createPolygonArea,
  createRectangleArea,
  validateZonePolygon
} from '../../domain/fire/zoneGeometry'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'
import { getDeviceIconPlanSize } from '../../domain/fire/deviceSizing'
import { getDeviceStatusAppearance } from '../../domain/fire/deviceVisualState'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import DeviceContextMenu from './DeviceContextMenu.vue'

const emit = defineEmits<{
  openProperties: [deviceId: string]
  locateDevice: [deviceId: string]
}>()

const store = useFireProjectStore()
const { t } = useI18n()
const { project, selectedNetworkId, selectedPanelId, selectedDeviceId, activeTool } =
  storeToRefs(store)

const svgRef = ref<SVGSVGElement | null>(null)
const selectedBuildingId = ref<string | null>(null)
const selectedFloorId = ref<string | null>(null)
const selectedZoneId = ref<string | null>(null)
const selectedZoneAreaId = ref<string | null>(null)
const replacingZoneAreaId = ref<string | null>(null)
const selectedLoopId = ref<string | null>(null)
const rectangleStart = ref<Vector2 | null>(null)
const rectanglePreview = ref<Vector2[] | null>(null)
const polygonDraft = ref<Vector2[]>([])
const draggingDeviceId = ref<string | null>(null)
const dragPreview = ref<{ deviceId: string; point: Vector2 } | null>(null)
const contextMenu = ref({ visible: false, x: 0, y: 0, deviceId: null as string | null })
const draftLoopOrder = ref<string[]>([])
const viewport = ref({ x: 0, y: 0, width: 1200, height: 800 })
const isPanning = ref(false)
const panStart = ref<{
  clientX: number
  clientY: number
  viewport: { x: number; y: number; width: number; height: number }
} | null>(null)

const currentNetwork = computed(
  () =>
    project.value.networks.find((network) => network.id === selectedNetworkId.value) ??
    project.value.networks[0]
)

const currentPanel = computed<FirePanel | undefined>(() => {
  const network = currentNetwork.value
  if (!network) return undefined
  return network.panels.find((panel) => panel.id === selectedPanelId.value) ?? network.panels[0]
})

const currentBuilding = computed(
  () =>
    project.value.buildings.find((building) => building.id === selectedBuildingId.value) ??
    project.value.buildings[0]
)

const currentFloor = computed<FireFloor | undefined>(() => {
  const building = currentBuilding.value
  if (!building) return undefined
  return building.floors.find((floor) => floor.id === selectedFloorId.value) ?? building.floors[0]
})

const isMultiColumn = computed(() => {
  return (currentBuilding.value?.floors.length ?? 0) > 8
})

const sortedFloors = computed(() => {
  if (!currentBuilding.value) return []
  return [...currentBuilding.value.floors].sort((a, b) => (b.levelIndex ?? 0) - (a.levelIndex ?? 0))
})

const chineseDigitValues: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
}

const parseChineseFloorNumber = (name: string): string | null => {
  const match = name.match(/([一二三四五六七八九十]+)(?:层|楼|樓)/)
  if (!match) return null

  const value = match[1]
  if (value === '十') return '10'
  if (!value.includes('十')) return chineseDigitValues[value]?.toString() ?? null

  const [tensText, onesText] = value.split('十')
  const tens = tensText ? chineseDigitValues[tensText] : 1
  const ones = onesText ? chineseDigitValues[onesText] : 0
  if (!tens || ones === undefined) return null
  return String(tens * 10 + ones)
}

const getFloorAbbr = (name: string): string => {
  const label = name.trim()
  const lower = label.toLowerCase()
  const explicitBasement =
    lower.includes('basement') || label.includes('地下') || /^b\s*\d*$/i.test(label)

  if (explicitBasement) {
    const numericMatch = label.match(/\d+/)
    if (numericMatch) return `B${numericMatch[0]}`
    const chineseNumber = parseChineseFloorNumber(label)
    return chineseNumber ? `B${chineseNumber}` : 'B'
  }

  const numericMatch = label.match(/\d+/)
  if (numericMatch) return `${numericMatch[0]}F`

  const chineseNumber = parseChineseFloorNumber(label)
  if (chineseNumber) return `${chineseNumber}F`

  return label.slice(0, 3)
}

const currentDevices = computed(() => {
  const floor = currentFloor.value
  if (!floor) return []
  return project.value.devices.filter(
    (device) => device.placement.status === 'placed' && device.placement.floorId === floor.id
  )
})

const panelDevices = computed(() => {
  const panel = currentPanel.value
  if (!panel) return []
  return project.value.devices.filter((device) => device.panelId === panel.id)
})

const zones = computed(() => currentPanel.value?.zones ?? [])
const loops = computed(() => currentPanel.value?.loops ?? [])
const selectedZone = computed(() => zones.value.find((zone) => zone.id === selectedZoneId.value))
const selectedLoop = computed(() => loops.value.find((loop) => loop.id === selectedLoopId.value))

const mapWidth = computed(() => currentFloor.value?.mapWidth ?? 1200)
const mapHeight = computed(() => currentFloor.value?.mapHeight ?? 800)
const viewBox = computed(
  () => `${viewport.value.x} ${viewport.value.y} ${viewport.value.width} ${viewport.value.height}`
)
const mapZoomPercent = computed(() => Math.round((mapWidth.value / viewport.value.width) * 100))
const deviceIconScale2D = computed({
  get: () => project.value.viewSettings.deviceIconScale2D ?? 1,
  set: (scale: number) => store.setDeviceIconScale2D(scale)
})
const deviceIconSize = computed(() => getDeviceIconPlanSize(deviceIconScale2D.value))
const deviceIconOffset = computed(() => -deviceIconSize.value / 2)
const deviceRingRadius = computed(() => deviceIconSize.value / 2 + 5)
const deviceLabelOffset = computed(() => deviceIconSize.value / 2 + 14)
const deviceStatusBadgeRadius = computed(() => Math.max(5.5, deviceIconSize.value * 0.17))
const deviceStatusBadgeX = computed(
  () => deviceIconSize.value / 2 - deviceStatusBadgeRadius.value * 0.55
)
const deviceStatusBadgeY = computed(
  () => -deviceIconSize.value / 2 + deviceStatusBadgeRadius.value * 0.55
)

const mapAssetHref = computed(() => {
  const floor = currentFloor.value
  const asset = floor?.mapAssetId
    ? project.value.assets.find((candidate) => candidate.id === floor.mapAssetId)
    : undefined
  return getFireAssetHref(asset)
})

const deviceById = computed(
  () => new Map(project.value.devices.map((device) => [device.id, device]))
)

const zoneAreas = computed(() => {
  const floor = currentFloor.value
  if (!floor) return []
  return zones.value.flatMap((zone) =>
    zone.visualAreas.filter(
      (area) => area.buildingId === currentBuilding.value?.id && area.floorId === floor.id
    )
  )
})
const selectedZoneArea = computed(() =>
  zoneAreas.value.find((area) => area.id === selectedZoneAreaId.value)
)

const loopLines = computed(() => {
  const floor = currentFloor.value
  if (!floor) return []
  const previewDeviceId = dragPreview.value?.deviceId

  return loops.value.flatMap((loop) => {
    const result = buildCurrentFloorLoopSegments(loop, panelDevices.value, floor.id)
    return result.segments.flatMap((segment) => {
      if (previewDeviceId && segmentTouchesDevice(segment, previewDeviceId)) {
        return []
      }

      const from = deviceById.value.get(segment.fromDeviceId)
      const to = deviceById.value.get(segment.toDeviceId)
      if (!from?.placement.position || !to?.placement.position) return []
      return [
        {
          id: `${loop.id}:${segment.fromDeviceId}:${segment.toDeviceId}`,
          color: loop.color,
          x1: from.placement.position.x,
          y1: from.placement.position.y,
          x2: to.placement.position.x,
          y2: to.placement.position.y
        }
      ]
    })
  })
})

const dragPreviewLoopLines = computed(() => {
  const floor = currentFloor.value
  const preview = dragPreview.value
  if (!floor || !preview) return []

  return loops.value.flatMap((loop) => {
    const result = buildAdjacentCurrentFloorLoopSegments(
      loop,
      panelDevices.value,
      floor.id,
      preview.deviceId
    )

    return result.segments.flatMap((segment) => {
      const from = deviceById.value.get(segment.fromDeviceId)
      const to = deviceById.value.get(segment.toDeviceId)
      if (!from?.placement.position || !to?.placement.position) return []

      const fromPoint = devicePoint(from)
      const toPoint = devicePoint(to)
      return [
        {
          id: `drag-preview:${loop.id}:${segment.fromDeviceId}:${segment.toDeviceId}`,
          color: loop.color,
          x1: fromPoint.x,
          y1: fromPoint.y,
          x2: toPoint.x,
          y2: toPoint.y
        }
      ]
    })
  })
})

const draftLoopLines = computed(() =>
  draftLoopOrder.value.slice(0, -1).flatMap((deviceId, index) => {
    const from = deviceById.value.get(deviceId)
    const to = deviceById.value.get(draftLoopOrder.value[index + 1])
    if (!from?.placement.position || !to?.placement.position) return []
    return [
      {
        id: `draft:${deviceId}:${to.id}`,
        x1: from.placement.position.x,
        y1: from.placement.position.y,
        x2: to.placement.position.x,
        y2: to.placement.position.y
      }
    ]
  })
)

const contextDevice = computed(() =>
  contextMenu.value.deviceId ? (deviceById.value.get(contextMenu.value.deviceId) ?? null) : null
)

watch(
  () => project.value.buildings,
  () => {
    if (!currentBuilding.value) {
      selectedBuildingId.value = project.value.buildings[0]?.id ?? null
    } else {
      selectedBuildingId.value = currentBuilding.value.id
    }
    if (!currentFloor.value) {
      selectedFloorId.value = currentBuilding.value?.floors[0]?.id ?? null
    } else {
      selectedFloorId.value = currentFloor.value.id
    }
  },
  { immediate: true, deep: true }
)

watch(
  zones,
  (nextZones) => {
    if (!selectedZoneId.value || !nextZones.some((zone) => zone.id === selectedZoneId.value)) {
      selectedZoneId.value = nextZones[0]?.id ?? null
    }
  },
  { immediate: true }
)

watch(
  loops,
  (nextLoops) => {
    if (!selectedLoopId.value || !nextLoops.some((loop) => loop.id === selectedLoopId.value)) {
      selectedLoopId.value = nextLoops[0]?.id ?? null
    }
  },
  { immediate: true }
)

watch(
  zoneAreas,
  (nextAreas) => {
    if (
      selectedZoneAreaId.value &&
      !nextAreas.some((area) => area.id === selectedZoneAreaId.value)
    ) {
      selectedZoneAreaId.value = null
    }
    if (
      replacingZoneAreaId.value &&
      !nextAreas.some((area) => area.id === replacingZoneAreaId.value)
    ) {
      replacingZoneAreaId.value = null
    }
  },
  { immediate: true }
)

watch(
  () => `${currentFloor.value?.id ?? 'none'}:${mapWidth.value}:${mapHeight.value}`,
  () => resetViewport(),
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('mousemove', handleWindowMouseMove)
  window.addEventListener('mouseup', handleWindowMouseUp)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('mousemove', handleWindowMouseMove)
  window.removeEventListener('mouseup', handleWindowMouseUp)
})

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
    commitZoneArea(
      createRectangleArea({
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
    )
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

  if (activeTool.value === 'manualLoopWiring') {
    appendManualLoopDevice(device)
    return
  }

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

function appendManualLoopDevice(device: FireDevice): void {
  const loop = selectedLoop.value
  if (!loop || device.loopId !== loop.loopId || draftLoopOrder.value.includes(device.id)) return
  draftLoopOrder.value = [...draftLoopOrder.value, device.id]
  store.selectDevice(device.id)
}

function saveManualLoopOrder(): void {
  const loop = selectedLoop.value
  if (!loop || draftLoopOrder.value.length < 2) return
  store.setManualLoopOrder(loop.id, draftLoopOrder.value)
  store.activeTool = 'select'
}

function restoreDefaultLoop(): void {
  const loop = selectedLoop.value
  if (!loop) return
  store.restoreDefaultLoopWiring(loop.id)
  draftLoopOrder.value = []
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

  commitZoneArea(
    createPolygonArea({
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
  )
  polygonDraft.value = []
}

function commitZoneArea(area: ReturnType<typeof createRectangleArea>): void {
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
    draftLoopOrder.value = []
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

function addBuilding(): void {
  const buildingId = store.addBuilding()
  selectedBuildingId.value = buildingId
  selectedFloorId.value = currentBuilding.value?.floors[0]?.id ?? null
}

function addFloor(): void {
  const buildingId = currentBuilding.value?.id ?? selectedBuildingId.value
  const floorId = buildingId ? store.addFloor(buildingId) : null

  if (floorId) {
    selectedBuildingId.value = buildingId
    selectedFloorId.value = floorId
    return
  }

  const target = store.ensureDefaultPlanningFloor()
  selectedBuildingId.value = target.buildingId
  selectedFloorId.value = target.floorId
}

async function deleteBuilding(): Promise<void> {
  const buildingId = currentBuilding.value?.id
  if (!buildingId) return

  const confirmed = await confirmPlanningDelete('fire.planner.confirmDeleteBuilding')
  if (!confirmed) return

  store.removeBuilding(buildingId)
  selectFirstAvailablePlanningTarget()
}

async function deleteFloor(): Promise<void> {
  const buildingId = currentBuilding.value?.id
  const floorId = currentFloor.value?.id
  if (!buildingId || !floorId) return

  const confirmed = await confirmPlanningDelete('fire.planner.confirmDeleteFloor')
  if (!confirmed) return

  store.removeFloor(buildingId, floorId)
  selectFirstAvailablePlanningTarget(buildingId)
}

function clearDrawing(): void {
  const buildingId = currentBuilding.value?.id
  const floorId = currentFloor.value?.id
  if (!buildingId || !floorId || !currentFloor.value?.mapAssetId) return

  store.clearFloorMapAsset(buildingId, floorId)
}

async function confirmPlanningDelete(messageKey: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(t(messageKey), t('fire.planner.confirmDeleteTitle'), {
      type: 'warning',
      confirmButtonText: t('fire.common.apply'),
      cancelButtonText: t('fire.common.cancel')
    })
    return true
  } catch {
    return false
  }
}

function selectFirstAvailablePlanningTarget(preferredBuildingId?: string): void {
  const building =
    project.value.buildings.find((candidate) => candidate.id === preferredBuildingId) ??
    project.value.buildings[0]

  selectedBuildingId.value = building?.id ?? null
  selectedFloorId.value = building?.floors[0]?.id ?? null
}

function ensurePlanningFloorSelection(): { buildingId: string; floorId: string } | null {
  if (currentBuilding.value && currentFloor.value) {
    return { buildingId: currentBuilding.value.id, floorId: currentFloor.value.id }
  }

  const target = store.ensureDefaultPlanningFloor()
  selectedBuildingId.value = target.buildingId
  selectedFloorId.value = target.floorId
  return target
}

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
</script>

<template>
  <section class="planner-2d" @click="closeContextMenu">
    <div class="canvas-shell" :class="{ 'has-map': mapAssetHref }">
      <header class="planner-toolbar" @click.stop>
        <!-- 1. 图纸楼层 (Drawing & Floor) -->
        <div class="toolbar-section floor-controls" :aria-label="t('fire.planner.floor')">
          <span class="section-tag">图纸楼层</span>
          <div class="btn-group">
            <el-tooltip :content="t('fire.planner.importDrawing')" placement="bottom">
              <button class="toolbar-btn" @click="importDrawingForCurrentFloor">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('fire.planner.clearDrawing')" placement="bottom">
              <button
                class="toolbar-btn"
                :disabled="!currentFloor?.mapAssetId"
                @click="clearDrawing"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="m20 20-5-5" />
                  <path d="M12 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.5" />
                  <path d="m8.5 12.5 4-4" />
                  <path d="m11.5 15.5 4-4" />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('fire.planner.addBuilding')" placement="bottom">
              <button class="toolbar-btn" @click="addBuilding">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <rect x="4" y="2" width="8" height="20" rx="1" />
                  <rect x="12" y="8" width="8" height="14" rx="1" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="10" y1="6" x2="10.01" y2="6" />
                  <line x1="6" y1="10" x2="6.01" y2="10" />
                  <line x1="10" y1="10" x2="10.01" y2="10" />
                  <line x1="6" y1="14" x2="6.01" y2="14" />
                  <line x1="10" y1="14" x2="10.01" y2="14" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                  <line x1="10" y1="18" x2="10.01" y2="18" />
                  <line x1="14" y1="12" x2="14.01" y2="12" />
                  <line x1="18" y1="12" x2="18.01" y2="12" />
                  <line x1="14" y1="16" x2="14.01" y2="16" />
                  <line x1="18" y1="16" x2="18.01" y2="16" />
                  <circle cx="17" cy="4" r="3" />
                  <line x1="17" y1="2" x2="17" y2="6" />
                  <line x1="15" y1="4" x2="19" y2="4" />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('fire.planner.deleteBuilding')" placement="bottom">
              <button
                class="toolbar-btn danger"
                :disabled="!currentBuilding"
                @click="deleteBuilding"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <rect x="4" y="2" width="8" height="20" rx="1" />
                  <rect x="12" y="8" width="8" height="14" rx="1" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="10" y1="6" x2="10.01" y2="6" />
                  <line x1="6" y1="10" x2="6.01" y2="10" />
                  <line x1="10" y1="10" x2="10.01" y2="10" />
                  <line x1="6" y1="14" x2="6.01" y2="14" />
                  <line x1="10" y1="14" x2="10.01" y2="14" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                  <line x1="10" y1="18" x2="10.01" y2="18" />
                  <line x1="14" y1="12" x2="14.01" y2="12" />
                  <line x1="18" y1="12" x2="18.01" y2="12" />
                  <line x1="14" y1="16" x2="14.01" y2="16" />
                  <line x1="18" y1="16" x2="18.01" y2="16" />
                  <circle cx="17" cy="4" r="3" />
                  <line x1="15" y1="4" x2="19" y2="4" />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('fire.planner.addFloor')" placement="bottom">
              <button class="toolbar-btn" @click="addFloor">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                  <circle cx="12" cy="7" r="1.5" fill="currentColor" />
                  <line x1="12" y1="15" x2="12" y2="19" />
                  <line x1="10" y1="17" x2="14" y2="17" />
                </svg>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('fire.planner.deleteFloor')" placement="bottom">
              <button class="toolbar-btn danger" :disabled="!currentFloor" @click="deleteFloor">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                  <circle cx="12" cy="7" r="1.5" fill="currentColor" />
                  <line x1="10" y1="17" x2="14" y2="17" />
                </svg>
              </button>
            </el-tooltip>
          </div>
        </div>

        <div class="toolbar-divider"></div>

        <!-- 2. 探测防区 (Zones) -->
        <div class="toolbar-section zone-controls" :aria-label="t('fire.zoneToolbar.zone')">
          <span class="section-tag">探测防区</span>
          <div class="btn-group">
            <el-select
              :model-value="selectedZoneId"
              size="small"
              class="zone-select-dock"
              :placeholder="t('fire.zoneToolbar.zone')"
              clearable
              @update:model-value="(value) => (selectedZoneId = value || null)"
            >
              <el-option
                v-for="zone in zones"
                :key="zone.id"
                :label="`Zone ${zone.zoneNumber}${zone.text ? ` - ${zone.text}` : ''}`"
                :value="zone.id"
              />
            </el-select>

            <el-tooltip :content="t('fire.zoneToolbar.select')" placement="bottom">
              <button
                :class="['toolbar-btn', { active: activeTool === 'select' }]"
                @click="store.activeTool = 'select'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                  <path d="m13 13 6 6" />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.zoneToolbar.rectangle')" placement="bottom">
              <button
                :class="['toolbar-btn', { active: activeTool === 'zoneRectangle' }]"
                @click="store.activeTool = 'zoneRectangle'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3" />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.zoneToolbar.polygon')" placement="bottom">
              <button
                :class="['toolbar-btn', { active: activeTool === 'zonePolygon' }]"
                @click="store.activeTool = 'zonePolygon'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path
                    d="m12 3-1.912 5.886L4 10.077l5.318 4.38L7.18 21 12 17.562 16.82 21l-2.138-6.543L20 10.077l-6.088-.191L12 3z"
                  />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.zoneToolbar.cancelPolygon')" placement="bottom">
              <button
                class="toolbar-btn"
                :disabled="polygonDraft.length === 0"
                @click="polygonDraft = []"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </el-tooltip>

            <span v-if="polygonDraft.length > 0" class="point-count-badge">{{
              polygonDraft.length
            }}</span>

            <!-- Zone Area Controls -->
            <template v-if="selectedZoneAreaId">
              <div class="sub-divider"></div>
              <el-tooltip :content="t('fire.planner.replaceZoneArea')" placement="bottom">
                <button
                  :class="['toolbar-btn', { active: replacingZoneAreaId === selectedZoneAreaId }]"
                  @click="startReplaceSelectedZoneArea"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="svg-icon"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </el-tooltip>
              <el-tooltip :content="t('fire.planner.deleteZoneArea')" placement="bottom">
                <button class="toolbar-btn danger" @click="deleteSelectedZoneArea">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="svg-icon"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </el-tooltip>
            </template>
          </div>
        </div>

        <div class="toolbar-divider"></div>

        <!-- 3. 回路连线 (Loops) -->
        <div class="toolbar-section loop-controls" :aria-label="t('fire.loopToolbar.loop')">
          <span class="section-tag">回路连线</span>
          <div class="btn-group">
            <el-select
              :model-value="selectedLoopId"
              size="small"
              class="loop-select-dock"
              :placeholder="t('fire.loopToolbar.loop')"
              clearable
              @update:model-value="(value) => (selectedLoopId = value || null)"
            >
              <el-option
                v-for="loop in loops"
                :key="loop.id"
                :label="loop.name || `Loop ${loop.loopId}`"
                :value="loop.id"
              />
            </el-select>

            <el-tooltip :content="t('fire.loopToolbar.start')" placement="bottom">
              <button
                :class="['toolbar-btn', { active: activeTool === 'manualLoopWiring' }]"
                @click="store.activeTool = 'manualLoopWiring'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path
                    d="M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"
                  />
                  <circle cx="9" cy="9" r="2" />
                  <circle cx="15" cy="15" r="2" />
                  <path d="M9 11v2a2 2 0 0 0 2 2h2" />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.loopToolbar.save')" placement="bottom">
              <button
                class="toolbar-btn"
                :disabled="draftLoopOrder.length < 2"
                @click="saveManualLoopOrder"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.loopToolbar.clear')" placement="bottom">
              <button
                class="toolbar-btn danger"
                :disabled="draftLoopOrder.length === 0"
                @click="draftLoopOrder = []"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                </svg>
              </button>
            </el-tooltip>

            <el-tooltip :content="t('fire.loopToolbar.restore')" placement="bottom">
              <button class="toolbar-btn" :disabled="!selectedLoopId" @click="restoreDefaultLoop">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <polyline points="3 3 3 8 8 8" />
                </svg>
              </button>
            </el-tooltip>

            <span class="loop-badge">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-icon link-icon"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {{ draftLoopOrder.length }}
            </span>
          </div>
        </div>

        <div class="toolbar-divider"></div>

        <!-- 4. 视图缩放 (Viewport) -->
        <div
          class="toolbar-section view-controls-section"
          :aria-label="t('fire.planner.iconScale')"
        >
          <span class="section-tag">视图缩放</span>
          <div class="btn-group">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="svg-icon view-icon-svg"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>

            <el-slider
              v-model="deviceIconScale2D"
              size="small"
              :min="0.4"
              :max="3"
              :step="0.1"
              :show-tooltip="false"
              class="view-slider-dock"
            />
            <span class="control-value-dock">{{ deviceIconScale2D.toFixed(1) }}x</span>
            <span class="zoom-value-dock">{{ mapZoomPercent }}%</span>
          </div>
        </div>
      </header>
      <!-- Floor Navigator Panel -->
      <div
        v-if="
          project.buildings.length > 0 && (project.buildings.length > 1 || sortedFloors.length > 0)
        "
        class="floor-navigator-panel"
      >
        <!-- Building Selector -->
        <div v-if="project.buildings.length > 1" class="building-tabs">
          <button
            v-for="b in project.buildings"
            :key="b.id"
            :class="['building-tab-btn', { active: selectedBuildingId === b.id }]"
            @click="selectedBuildingId = b.id"
          >
            {{ b.name }}
          </button>
        </div>

        <!-- Floor Buttons Stack -->
        <div :class="['floor-grid', { 'multi-column': isMultiColumn }]">
          <button
            v-for="f in sortedFloors"
            :key="f.id"
            :class="['floor-btn', { active: selectedFloorId === f.id, 'rect-btn': isMultiColumn }]"
            :title="f.name"
            @click="selectedFloorId = f.id"
          >
            {{ getFloorAbbr(f.name) }}
          </button>
        </div>
      </div>

      <svg
        ref="svgRef"
        :class="['planner-canvas', { 'is-panning': isPanning, 'has-map': mapAssetHref }]"
        :viewBox="viewBox"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        @dragover.prevent
        @drop="handleDrop"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
        @wheel.prevent="handleCanvasWheel"
        @auxclick.prevent
        @click="handleCanvasClick"
        @dblclick="handleCanvasDoubleClick"
      >
        <rect v-if="!mapAssetHref" class="canvas-bg" :width="mapWidth" :height="mapHeight" />
        <image
          v-if="mapAssetHref"
          class="floor-map"
          x="0"
          y="0"
          :width="mapWidth"
          :height="mapHeight"
          preserveAspectRatio="xMidYMid meet"
          :href="mapAssetHref"
          :opacity="project.viewSettings.mapOpacity"
        />

        <g class="zone-layer">
          <polygon
            v-for="area in zoneAreas"
            :key="area.id"
            class="zone-area"
            :class="{
              selected: selectedZoneAreaId === area.id,
              replacing: replacingZoneAreaId === area.id
            }"
            :points="areaPoints(area.points)"
            :fill="area.color"
            :fill-opacity="area.opacity"
            :stroke="selectedZoneAreaId === area.id ? '#111827' : area.color"
            :stroke-dasharray="replacingZoneAreaId === area.id ? '9 5' : undefined"
            :stroke-width="selectedZoneAreaId === area.id ? 4 : 2"
            @click="selectZoneArea(area.id, $event)"
          />
          <polygon
            v-if="rectanglePreview"
            :points="areaPoints(rectanglePreview)"
            fill="#ef4444"
            fill-opacity="0.12"
            stroke="#ef4444"
            stroke-dasharray="8 6"
            stroke-width="2"
          />
          <polyline
            v-if="polygonDraft.length > 0"
            :points="areaPoints(polygonDraft)"
            fill="none"
            stroke="#f97316"
            stroke-dasharray="8 6"
            stroke-width="2"
          />
          <circle
            v-for="(point, index) in polygonDraft"
            :key="`poly-${index}`"
            :cx="point.x"
            :cy="point.y"
            r="5"
            fill="#f97316"
          />
        </g>

        <g v-if="project.viewSettings.showLoopLines" class="loop-layer">
          <line
            v-for="line in loopLines"
            :key="line.id"
            :x1="line.x1"
            :y1="line.y1"
            :x2="line.x2"
            :y2="line.y2"
            :stroke="line.color"
            stroke-width="3"
            stroke-linecap="round"
          />
          <line
            v-for="line in dragPreviewLoopLines"
            :key="line.id"
            :x1="line.x1"
            :y1="line.y1"
            :x2="line.x2"
            :y2="line.y2"
            :stroke="line.color"
            class="drag-preview-line"
            stroke-width="3.5"
            stroke-linecap="round"
          />
          <line
            v-for="line in draftLoopLines"
            :key="line.id"
            :x1="line.x1"
            :y1="line.y1"
            :x2="line.x2"
            :y2="line.y2"
            stroke="#0ea5e9"
            stroke-width="3"
            stroke-dasharray="9 5"
            stroke-linecap="round"
          />
        </g>

        <g class="device-layer">
          <g
            v-for="device in currentDevices"
            :key="device.id"
            class="device-node"
            :class="deviceClass(device)"
            :data-device-status="deviceStatus(device).state"
            :transform="`translate(${devicePoint(device).x} ${devicePoint(device).y})`"
            @mousedown="startDeviceDrag(device, $event)"
            @click="handleDeviceClick(device, $event)"
            @contextmenu="showDeviceContextMenu(device, $event)"
          >
            <title v-if="deviceStatus(device).title">
              {{ device.address ?? device.id }} - {{ deviceStatus(device).title }}
            </title>
            <circle :r="deviceRingRadius" class="device-ring" />
            <image
              :href="deviceIcon(device)"
              :x="deviceIconOffset"
              :y="deviceIconOffset"
              :width="deviceIconSize"
              :height="deviceIconSize"
              :opacity="deviceStatus(device).iconOpacity"
            />
            <g
              v-if="deviceStatus(device).badgeLabel"
              class="device-status-badge"
              :transform="`translate(${deviceStatusBadgeX} ${deviceStatusBadgeY})`"
            >
              <circle :r="deviceStatusBadgeRadius" :fill="deviceStatus(device).color" />
              <text class="device-status-badge-label" y="0.35em" text-anchor="middle">
                {{ deviceStatus(device).badgeLabel }}
              </text>
            </g>
            <text class="device-address-label" :y="deviceLabelOffset" text-anchor="middle">
              {{ device.address ?? device.id }}
            </text>
          </g>
        </g>
      </svg>

      <div v-if="!currentFloor" class="empty-floor" @click.stop>
        <p>{{ t('fire.planner.noFloor') }}</p>
        <div>
          <el-button type="primary" @click="addBuilding">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="svg-icon btn-inline-svg"
              style="margin-right: 6px; width: 14px; height: 14px"
            >
              <rect x="4" y="2" width="8" height="20" rx="1" />
              <rect x="12" y="8" width="8" height="14" rx="1" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="10" y1="6" x2="10.01" y2="6" />
              <line x1="6" y1="10" x2="6.01" y2="10" />
              <line x1="10" y1="10" x2="10.01" y2="10" />
              <line x1="6" y1="14" x2="6.01" y2="14" />
              <line x1="10" y1="14" x2="10.01" y2="14" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
              <line x1="10" y1="18" x2="10.01" y2="18" />
              <line x1="14" y1="12" x2="14.01" y2="12" />
              <line x1="18" y1="12" x2="18.01" y2="12" />
              <line x1="14" y1="16" x2="14.01" y2="16" />
              <line x1="18" y1="16" x2="18.01" y2="16" />
            </svg>
            {{ t('fire.planner.addBuilding') }}
          </el-button>
          <el-button @click="importDrawingForCurrentFloor">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="svg-icon btn-inline-svg"
              style="margin-right: 6px; width: 14px; height: 14px"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {{ t('fire.planner.importDrawing') }}
          </el-button>
        </div>
      </div>
    </div>

    <DeviceContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :device="contextDevice"
      :simulation-mode="false"
      :input-active="false"
      :fault-active="false"
      @close="closeContextMenu"
      @open-properties="emit('openProperties', $event)"
      @remove-from-drawing="store.removeDeviceFromDrawing($event)"
      @locate-in-tree="emit('locateDevice', $event)"
    />
  </section>
</template>

<style scoped>
.planner-2d {
  position: relative;
  height: 100%;
  background: #eef2f7;
  color: #172033;
}

/* 悬浮磨砂玻璃工具坞 */
.planner-toolbar {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  user-select: none;
  pointer-events: auto;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  justify-content: space-between;
}

.section-tag {
  font-size: 9px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.42);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  align-self: center;
  height: 28px;
  background: rgba(0, 0, 0, 0.08);
}

/* 按钮样式微调 */
.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  padding: 0;
}

.toolbar-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: #000000;
  transform: scale(1.06);
}

.toolbar-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.toolbar-btn.active:not(:disabled) {
  background: #0071e3;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 113, 227, 0.35);
}

.toolbar-btn:disabled {
  color: rgba(0, 0, 0, 0.22);
  cursor: not-allowed;
}

.toolbar-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.toolbar-btn.danger.active:not(:disabled) {
  background: #ef4444;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);
}

.svg-icon {
  width: 16px;
  height: 16px;
}

.sub-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 2px;
}

/* Select下拉框深度定制 */
.zone-select-dock,
.loop-select-dock {
  width: 105px;
  margin-right: 2px;
}

.zone-select-dock :deep(.el-select__wrapper),
.loop-select-dock :deep(.el-select__wrapper) {
  background-color: rgba(0, 0, 0, 0.03) !important;
  box-shadow: none !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: 8px !important;
  padding: 0 8px !important;
  height: 28px !important;
  line-height: 28px !important;
}

.zone-select-dock :deep(.el-select__placeholder),
.loop-select-dock :deep(.el-select__placeholder) {
  font-size: 11px !important;
  font-weight: 500 !important;
  color: #515154 !important;
}

.zone-select-dock :deep(.el-select__selected-item),
.loop-select-dock :deep(.el-select__selected-item) {
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #000000 !important;
}

/* 徽标 */
.point-count-badge {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 50%;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 10px;
  font-weight: 700;
  margin-left: 2px;
}

.loop-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 6px;
  height: 18px;
  border-radius: 99px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 10px;
  font-weight: 700;
  margin-left: 2px;
}

.link-icon {
  width: 10px;
  height: 10px;
}

/* 视图缩放样式 */
.view-controls-section {
  width: 175px;
}

.view-icon-svg {
  color: #475569;
  width: 16px;
  height: 16px;
  margin-right: 4px;
}

.view-slider-dock {
  width: 60px !important;
  margin-right: 6px;
}

.view-slider-dock :deep(.el-slider__runway) {
  height: 4px !important;
  background-color: rgba(0, 0, 0, 0.08) !important;
}

.view-slider-dock :deep(.el-slider__bar) {
  height: 4px !important;
  background-color: #0071e3 !important;
}

.view-slider-dock :deep(.el-slider__button) {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid #0071e3 !important;
  background-color: #ffffff !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15) !important;
}

.control-value-dock,
.zoom-value-dock {
  font-size: 11px;
  font-weight: 600;
  color: #1d1d1f;
  min-width: 24px;
  text-align: right;
}

.zoom-value-dock {
  color: #86868b;
  min-width: 32px;
}

.canvas-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 16px;
  background: #e8eef6;
}

.canvas-shell.has-map {
  overflow: hidden;
  padding: 0;
}

.planner-canvas {
  display: block;
}

.planner-canvas:not(.has-map) {
  width: min(100%, 1400px);
  min-width: 720px;
  aspect-ratio: 3 / 2;
  margin: 0 auto;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.planner-canvas.has-map {
  width: 100%;
  height: 100%;
  min-width: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.planner-canvas.is-panning {
  cursor: grabbing;
}

.canvas-bg {
  fill: #f8fafc;
}

.floor-map {
  pointer-events: none;
}

.zone-layer polygon,
.loop-layer line {
  pointer-events: none;
}

.zone-layer .zone-area {
  cursor: pointer;
  pointer-events: auto;
}

.zone-layer .zone-area.selected {
  filter: drop-shadow(0 0 5px rgba(15, 23, 42, 0.28));
}

.drag-preview-line {
  filter: drop-shadow(0 0 4px rgba(15, 23, 42, 0.18));
}

.device-node {
  cursor: grab;
}

.device-node:active {
  cursor: grabbing;
}

.device-ring {
  fill: rgba(37, 99, 235, 0.05);
  opacity: 0;
  pointer-events: none;
  stroke: rgba(37, 99, 235, 0.3);
  stroke-width: 1.5;
}

.device-node.selected image {
  filter: brightness(1.08) drop-shadow(0 0 5px rgba(37, 99, 235, 0.45));
}

.device-node.disabled image {
  filter: saturate(0.55) contrast(0.9);
}

.device-node.inhibited image {
  filter: saturate(0.75) contrast(0.95);
}

.device-node.selected.disabled image {
  filter: saturate(0.55) contrast(0.9) brightness(1.08) drop-shadow(0 0 5px rgba(37, 99, 235, 0.45));
}

.device-node.selected.inhibited image {
  filter: saturate(0.75) contrast(0.95) brightness(1.08)
    drop-shadow(0 0 5px rgba(37, 99, 235, 0.45));
}

.device-status-badge {
  pointer-events: none;
}

.device-status-badge circle {
  stroke: #ffffff;
  stroke-width: 2;
}

.device-node text.device-status-badge-label {
  fill: #ffffff;
  font-size: 9px;
  font-weight: 800;
  paint-order: normal;
  stroke: none;
}

.device-node text {
  fill: #172033;
  font-size: 12px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
}

.device-node.disabled .device-address-label {
  fill: #92400e;
}

.device-node.inhibited .device-address-label {
  fill: #4c1d95;
}

.empty-floor {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 12px;
  place-items: center;
  color: #64748b;
  font-weight: 700;
}

.empty-floor p {
  margin: 0;
}

.empty-floor div {
  display: flex;
  gap: 8px;
}

/* Floor Navigator Panel */
.floor-navigator-panel {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: auto;
  max-height: calc(100% - 30px);
  overflow-y: auto;
  align-items: center;
}

/* Building Tabs (Segmented Control style) */
.building-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px;
  border-radius: 8px;
  width: 100%;
}

.building-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #515154;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.building-tab-btn.active {
  background: #ffffff;
  color: #000000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Floor Grid */
.floor-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.floor-grid.multi-column {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

/* Floor Buttons */
.floor-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #ffffff;
  color: #1d1d1f;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.floor-btn:hover:not(.active) {
  background: #f5f5f7;
  transform: scale(1.05);
}

.floor-btn:active {
  transform: scale(0.95);
}

.floor-btn.active {
  background: #0071e3;
  border-color: #0071e3;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 113, 227, 0.4);
}

/* Rounded rectangle style for multi-column layout */
.floor-btn.rect-btn {
  width: 44px;
  height: 30px;
  border-radius: 6px;
  font-size: 11px;
}
</style>
