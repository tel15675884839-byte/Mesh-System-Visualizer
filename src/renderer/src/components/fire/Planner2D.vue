<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { OfficeBuilding, Plus, Upload, ZoomIn } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireDevice, FireFloor, FirePanel, Vector2 } from '../../domain/fire/types'
import {
  buildAdjacentCurrentFloorLoopSegments,
  buildCurrentFloorLoopSegments
} from '../../domain/fire/loopWiring'
import { createPolygonArea, createRectangleArea } from '../../domain/fire/zoneGeometry'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'
import { getDeviceIconPlanSize } from '../../domain/fire/deviceSizing'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import DeviceContextMenu from './DeviceContextMenu.vue'
import ZoneToolbar from './ZoneToolbar.vue'
import LoopWiringToolbar from './LoopWiringToolbar.vue'

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

const getFloorAbbr = (name: string): string => {
  const lower = name.toLowerCase()
  if (lower.includes('basement') || lower.includes('地下') || lower.startsWith('b')) {
    const match = name.match(/\d+/)
    if (match) return `B${match[0]}`
    if (lower.includes('一层') || lower.includes('一')) return 'B1'
    if (lower.includes('二层') || lower.includes('二')) return 'B2'
    if (lower.includes('三层') || lower.includes('三')) return 'B3'
    return 'B'
  }
  
  const match = name.match(/\d+/)
  if (match) return `${match[0]}F`
  
  if (lower.includes('一层') || lower.includes('一')) return '1F'
  if (lower.includes('二层') || lower.includes('二')) return '2F'
  if (lower.includes('三层') || lower.includes('三')) return '3F'
  if (lower.includes('四层') || lower.includes('四')) return '4F'
  if (lower.includes('五层') || lower.includes('五')) return '5F'
  if (lower.includes('六层') || lower.includes('六')) return '6F'
  if (lower.includes('七层') || lower.includes('七')) return '7F'
  if (lower.includes('八层') || lower.includes('八')) return '8F'
  if (lower.includes('九层') || lower.includes('九')) return '9F'
  if (lower.includes('十层') || lower.includes('十')) return '10F'
  
  return name.slice(0, 3)
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
    store.addZoneArea(
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
  store.selectDevice(device.id)
}

function handleDeviceClick(device: FireDevice, event: MouseEvent): void {
  event.stopPropagation()
  closeContextMenu()

  if (activeTool.value === 'manualLoopWiring') {
    appendManualLoopDevice(device)
    return
  }

  store.selectDevice(device.id)
}

function showDeviceContextMenu(device: FireDevice, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
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

  store.addZoneArea(
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
    store.activeTool = 'select'
    stopViewportPan()
    closeContextMenu()
    return
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    const deviceId = selectedDeviceId.value
    const device = deviceId ? deviceById.value.get(deviceId) : undefined
    if (device?.placement.status !== 'placed') return

    event.preventDefault()
    store.removeDeviceFromDrawing(device.id)
    closeContextMenu()
  }
}

function deviceClass(device: FireDevice): string[] {
  return [
    selectedDeviceId.value === device.id ? 'selected' : '',
    device.disabled ? 'disabled' : ''
  ].filter(Boolean)
}

function deviceIcon(device: FireDevice): string {
  return getDeviceIconHrefByType(device.type)
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
    <header class="planner-toolbar" @click.stop>
      <div class="toolbar-section floor-controls" :aria-label="t('fire.planner.floor')">
        <el-tooltip :content="t('fire.planner.importDrawing')" placement="bottom">
          <el-button :icon="Upload" size="small" @click="importDrawingForCurrentFloor" />
        </el-tooltip>
        <el-tooltip :content="t('fire.planner.addBuilding')" placement="bottom">
          <el-button :icon="OfficeBuilding" size="small" @click="addBuilding" />
        </el-tooltip>
        <el-tooltip :content="t('fire.planner.addFloor')" placement="bottom">
          <el-button :icon="Plus" size="small" @click="addFloor" />
        </el-tooltip>
      </div>

      <ZoneToolbar
        :zones="zones"
        :selected-zone-id="selectedZoneId"
        :active-tool="activeTool"
        :polygon-point-count="polygonDraft.length"
        @select-zone="selectedZoneId = $event"
        @select-tool="store.activeTool = $event"
        @cancel-polygon="polygonDraft = []"
      />

      <LoopWiringToolbar
        :loops="loops"
        :selected-loop-id="selectedLoopId"
        :active-tool="activeTool"
        :draft-order-count="draftLoopOrder.length"
        @select-loop="selectedLoopId = $event"
        @start-manual="store.activeTool = 'manualLoopWiring'"
        @save-manual="saveManualLoopOrder"
        @clear-draft="draftLoopOrder = []"
        @restore-default="restoreDefaultLoop"
      />

      <div class="toolbar-section view-controls" :aria-label="t('fire.planner.iconScale')">
        <el-tooltip :content="t('fire.planner.iconScale')" placement="bottom">
          <el-icon class="view-icon"><ZoomIn /></el-icon>
        </el-tooltip>
        <el-slider
          v-model="deviceIconScale2D"
          size="small"
          :min="0.4"
          :max="3"
          :step="0.1"
          :show-tooltip="false"
        />
        <span class="control-value">{{ deviceIconScale2D.toFixed(1) }}x</span>
        <span class="zoom-value">{{ mapZoomPercent }}%</span>
      </div>
    </header>

    <div class="canvas-shell" :class="{ 'has-map': mapAssetHref }">
      <!-- Floor Navigator Panel -->
      <div class="floor-navigator-panel" v-if="project.buildings.length > 0 && (project.buildings.length > 1 || sortedFloors.length > 0)">
        <!-- Building Selector -->
        <div class="building-tabs" v-if="project.buildings.length > 1">
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
            @click="selectedFloorId = f.id"
            :title="f.name"
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
            :points="areaPoints(area.points)"
            :fill="area.color"
            :fill-opacity="area.opacity"
            :stroke="area.color"
            stroke-width="2"
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
            :transform="`translate(${devicePoint(device).x} ${devicePoint(device).y})`"
            @mousedown="startDeviceDrag(device, $event)"
            @click="handleDeviceClick(device, $event)"
            @contextmenu="showDeviceContextMenu(device, $event)"
          >
            <circle :r="deviceRingRadius" class="device-ring" />
            <image
              :href="deviceIcon(device)"
              :x="deviceIconOffset"
              :y="deviceIconOffset"
              :width="deviceIconSize"
              :height="deviceIconSize"
            />
            <text :y="deviceLabelOffset" text-anchor="middle">
              {{ device.address ?? device.id }}
            </text>
          </g>
        </g>
      </svg>

      <div v-if="!currentFloor" class="empty-floor" @click.stop>
        <p>{{ t('fire.planner.noFloor') }}</p>
        <div>
          <el-button type="primary" :icon="OfficeBuilding" @click="addBuilding">
            {{ t('fire.planner.addBuilding') }}
          </el-button>
          <el-button :icon="Upload" @click="importDrawingForCurrentFloor">
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
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  background: #eef2f7;
  color: #172033;
}

.planner-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
  overflow-x: auto;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.floor-controls {
  max-width: 390px;
}

.floor-controls :deep(.el-select) {
  width: 118px;
}

.view-controls {
  min-width: 148px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.view-controls :deep(.el-slider) {
  width: 68px;
}

.view-icon {
  color: #334155;
  font-size: 16px;
}

.control-value,
.zoom-value {
  min-width: 34px;
  color: #172033;
  text-align: right;
}

.zoom-value {
  color: #64748b;
}

.canvas-shell {
  position: relative;
  min-height: 0;
  overflow: auto;
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

.device-node.disabled {
  opacity: 0.45;
}

.device-node.selected image {
  filter: brightness(1.08) drop-shadow(0 0 5px rgba(37, 99, 235, 0.45));
}

.device-node text {
  fill: #172033;
  font-size: 12px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
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
