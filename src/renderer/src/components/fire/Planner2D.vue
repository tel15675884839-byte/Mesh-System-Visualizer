<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { OfficeBuilding, Plus, Upload } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireDevice, FireFloor, FirePanel, Vector2 } from '../../domain/fire/types'
import { buildCurrentFloorLoopSegments } from '../../domain/fire/loopWiring'
import { createPolygonArea, createRectangleArea } from '../../domain/fire/zoneGeometry'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'
import DeviceContextMenu from './DeviceContextMenu.vue'
import ZoneToolbar from './ZoneToolbar.vue'
import LoopWiringToolbar from './LoopWiringToolbar.vue'

const emit = defineEmits<{
  openProperties: [deviceId: string]
  locateDevice: [deviceId: string]
}>()

const store = useFireProjectStore()
const { t } = useI18n()
const {
  project,
  selectedNetworkId,
  selectedPanelId,
  selectedDeviceId,
  simulationMode,
  simulationState,
  activeTool
} = storeToRefs(store)

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
const viewBox = computed(() => `0 0 ${mapWidth.value} ${mapHeight.value}`)

const mapAssetHref = computed(() => {
  const floor = currentFloor.value
  const asset = floor?.mapAssetId
    ? project.value.assets.find((candidate) => candidate.id === floor.mapAssetId)
    : undefined
  return asset?.runtimePath ?? asset?.packagePath
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

  return loops.value.flatMap((loop) => {
    const result = buildCurrentFloorLoopSegments(loop, panelDevices.value, floor.id)
    return result.segments.flatMap((segment) => {
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

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

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

function handleCanvasClick(event: MouseEvent): void {
  if (activeTool.value !== 'zonePolygon' || !selectedZone.value) return
  polygonDraft.value = [...polygonDraft.value, toSvgPoint(event)]
}

function handleCanvasDoubleClick(event: MouseEvent): void {
  if (activeTool.value !== 'zonePolygon') return
  event.preventDefault()
  finishPolygon()
}

function startDeviceDrag(device: FireDevice, event: MouseEvent): void {
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

function handleDeviceDoubleClick(device: FireDevice, event: MouseEvent): void {
  event.stopPropagation()
  if (!simulationMode.value || !device.isInputCapable) return
  const now = Date.now()
  store.dispatchSimulationAction({
    type: hasActiveInput(device.id) ? 'restore-input' : 'activate-input',
    deviceId: device.id,
    at: now
  })
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
  if (event.key === 'Escape') {
    polygonDraft.value = []
    rectangleStart.value = null
    rectanglePreview.value = null
    draggingDeviceId.value = null
    dragPreview.value = null
    closeContextMenu()
  }
}

function hasActiveInput(deviceId: string): boolean {
  return simulationState.value.activeInputAlarms.some((alarm) => alarm.deviceId === deviceId)
}

function hasActiveFault(deviceId: string): boolean {
  return simulationState.value.activeFaults.some((fault) => fault.deviceId === deviceId)
}

function hasActiveOutput(device: FireDevice): boolean {
  return simulationState.value.outputs.some((output) => {
    if (output.state !== 'active' && output.state !== 'delayActive') return false
    return (
      output.outputId === `device:${device.id}` ||
      (device.sounderGroupId !== undefined &&
        output.outputId === `sounder-group:${device.panelId}:${device.sounderGroupId}`) ||
      (device.ioGroupId !== undefined &&
        output.outputId === `io-group:${device.panelId}:${device.ioGroupId}`)
    )
  })
}

function deviceClass(device: FireDevice): string[] {
  return [
    selectedDeviceId.value === device.id ? 'selected' : '',
    hasActiveInput(device.id) ? 'alarm' : '',
    hasActiveFault(device.id) ? 'fault' : '',
    hasActiveOutput(device) ? 'output-active' : '',
    device.disabled ? 'disabled' : ''
  ].filter(Boolean)
}

function deviceIcon(device: FireDevice): string {
  return getDeviceIconHrefByType(device.type)
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
</script>

<template>
  <section class="planner-2d" @click="closeContextMenu">
    <header class="planner-toolbar" @click.stop>
      <div class="floor-controls">
        <el-select
          v-model="selectedBuildingId"
          size="small"
          :placeholder="t('fire.planner.building')"
        >
          <el-option
            v-for="building in project.buildings"
            :key="building.id"
            :label="building.name"
            :value="building.id"
          />
        </el-select>
        <el-select v-model="selectedFloorId" size="small" :placeholder="t('fire.planner.floor')">
          <el-option
            v-for="floor in currentBuilding?.floors ?? []"
            :key="floor.id"
            :label="floor.name"
            :value="floor.id"
          />
        </el-select>
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
    </header>

    <div class="canvas-shell">
      <svg
        ref="svgRef"
        class="planner-canvas"
        :viewBox="viewBox"
        role="img"
        @dragover.prevent
        @drop="handleDrop"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
        @click="handleCanvasClick"
        @dblclick="handleCanvasDoubleClick"
      >
        <rect class="canvas-bg" :width="mapWidth" :height="mapHeight" />
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
            @dblclick="handleDeviceDoubleClick(device, $event)"
            @contextmenu="showDeviceContextMenu(device, $event)"
          >
            <circle r="18" class="device-halo" />
            <image :href="deviceIcon(device)" x="-12" y="-12" width="24" height="24" />
            <text y="32" text-anchor="middle">{{ device.address ?? device.id }}</text>
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
      :simulation-mode="simulationMode"
      :input-active="contextDevice ? hasActiveInput(contextDevice.id) : false"
      :fault-active="contextDevice ? hasActiveFault(contextDevice.id) : false"
      @close="closeContextMenu"
      @open-properties="emit('openProperties', $event)"
      @remove-from-drawing="store.removeDeviceFromDrawing($event)"
      @locate-in-tree="emit('locateDevice', $event)"
      @start-alarm="
        store.dispatchSimulationAction({ type: 'activate-input', deviceId: $event, at: Date.now() })
      "
      @restore-input="
        store.dispatchSimulationAction({ type: 'restore-input', deviceId: $event, at: Date.now() })
      "
      @trigger-fault="
        store.dispatchSimulationAction({ type: 'trigger-fault', deviceId: $event, at: Date.now() })
      "
      @restore-fault="
        store.dispatchSimulationAction({ type: 'restore-fault', deviceId: $event, at: Date.now() })
      "
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
  gap: 12px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
  overflow-x: auto;
}

.floor-controls {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}

.floor-controls :deep(.el-select) {
  width: 150px;
}

.canvas-shell {
  position: relative;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.planner-canvas {
  display: block;
  width: min(100%, 1400px);
  min-width: 720px;
  aspect-ratio: 3 / 2;
  margin: 0 auto;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
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

.device-node {
  cursor: grab;
}

.device-node:active {
  cursor: grabbing;
}

.device-halo {
  fill: #ffffff;
  stroke: #334155;
  stroke-width: 2;
}

.device-node.selected .device-halo {
  stroke: #1d4ed8;
  stroke-width: 4;
}

.device-node.alarm .device-halo {
  fill: #fee2e2;
  stroke: #dc2626;
  animation: pulse-fire 1s infinite;
}

.device-node.fault .device-halo {
  fill: #fef3c7;
  stroke: #d97706;
}

.device-node.output-active .device-halo {
  fill: #dbeafe;
  stroke: #2563eb;
}

.device-node.disabled {
  opacity: 0.45;
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

@keyframes pulse-fire {
  0%,
  100% {
    r: 18;
  }
  50% {
    r: 23;
  }
}
</style>
