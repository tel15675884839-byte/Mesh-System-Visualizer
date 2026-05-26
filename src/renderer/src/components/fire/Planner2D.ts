import { computed, defineComponent, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireFloor, FirePanel, Vector2, ZoneVisualArea } from '../../domain/fire/types'
import {
  buildAdjacentCurrentFloorLoopSegments,
  buildCurrentFloorLoopSegments
} from '../../domain/fire/loopWiring'
import { getDeviceIconPlanSize } from '../../domain/fire/deviceSizing'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import DeviceContextMenu from './DeviceContextMenu.vue'
import { createPlanner2DActions } from './Planner2DActions'
export default defineComponent({
  name: 'Planner2D',
  components: { DeviceContextMenu },
  emits: ['locateDevice'],
  setup() {
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
    const rectangleStart = ref<Vector2 | null>(null)
    const rectanglePreview = ref<Vector2[] | null>(null)
    const pendingZoneArea = ref<ZoneVisualArea | null>(null)
    const polygonDraft = ref<Vector2[]>([])
    const draggingDeviceId = ref<string | null>(null)
    const dragPreview = ref<{ deviceId: string; point: Vector2 } | null>(null)
    const contextMenu = ref({ visible: false, x: 0, y: 0, deviceId: null as string | null })
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
      return (
        building.floors.find((floor) => floor.id === selectedFloorId.value) ?? building.floors[0]
      )
    })
    const isMultiColumn = computed(() => {
      return (currentBuilding.value?.floors.length ?? 0) > 8
    })
    const sortedFloors = computed(() => {
      if (!currentBuilding.value) return []
      return [...currentBuilding.value.floors].sort(
        (a, b) => (b.levelIndex ?? 0) - (a.levelIndex ?? 0)
      )
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
    const selectedZone = computed(() =>
      zones.value.find((zone) => zone.id === selectedZoneId.value)
    )
    const mapWidth = computed(() => currentFloor.value?.mapWidth ?? 1200)
    const mapHeight = computed(() => currentFloor.value?.mapHeight ?? 800)
    const viewBox = computed(
      () =>
        `${viewport.value.x} ${viewport.value.y} ${viewport.value.width} ${viewport.value.height}`
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
    const {
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
      selectFirstAvailablePlanningTarget,
      ensurePlanningFloorSelection,
      devicePoint,
      areaPoints,
      rectanglePoints,
      toSvgPoint,
      parseDeviceIds,
      closeContextMenu,
      segmentTouchesDevice
    } = createPlanner2DActions({
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
    const pendingZoneAreaActionPoint = computed(() => {
      const area = pendingZoneArea.value
      if (!area) return null
      const maxX = Math.max(...area.points.map((point) => point.x))
      const minY = Math.min(...area.points.map((point) => point.y))
      const x = Math.min(mapWidth.value - 122, Math.max(8, maxX + 10))
      const y = Math.min(mapHeight.value - 42, Math.max(8, minY - 6))
      return { x, y }
    })
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
    const locateDevice = (deviceId: string): void => {
      const device = deviceById.value.get(deviceId)
      if (!device || device.placement.status !== 'placed') return
      if (device.placement.buildingId) {
        selectedBuildingId.value = device.placement.buildingId
      }
      if (device.placement.floorId) {
        selectedFloorId.value = device.placement.floorId
      }
      if (device.placement.position) {
        nextTick(() => {
          const x = device.placement.position!.x
          const y = device.placement.position!.y
          viewport.value = clampViewport({
            x: x - viewport.value.width / 2,
            y: y - viewport.value.height / 2,
            width: viewport.value.width,
            height: viewport.value.height
          })
        })
      }
    }
    return {
      locateDevice,
      store,
      t,
      project,
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
      currentNetwork,
      currentPanel,
      currentBuilding,
      currentFloor,
      isMultiColumn,
      sortedFloors,
      chineseDigitValues,
      parseChineseFloorNumber,
      getFloorAbbr,
      currentDevices,
      panelDevices,
      zones,
      loops,
      selectedZone,
      mapWidth,
      mapHeight,
      viewBox,
      mapZoomPercent,
      deviceIconScale2D,
      deviceIconSize,
      deviceIconOffset,
      deviceRingRadius,
      deviceLabelOffset,
      deviceStatusBadgeRadius,
      deviceStatusBadgeX,
      deviceStatusBadgeY,
      mapAssetHref,
      deviceById,
      zoneAreas,
      selectedZoneArea,
      loopLines,
      dragPreviewLoopLines,
      pendingZoneAreaActionPoint,
      contextDevice,
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
})
