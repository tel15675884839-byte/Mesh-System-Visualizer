import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { Bell, MuteNotification, RefreshLeft } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireBuilding, FireFloor } from '../../domain/fire/types'
import { getEffectiveFloorHeight3D } from '../../domain/fire/viewer3DGeometry'
import {
  getViewer3DHighlightOptions,
  type Viewer3DHighlightKind,
  type Viewer3DHighlightSelection
} from '../../domain/fire/viewer3DHighlight'
import { shouldPlaySimulationAlarmAudio } from '../../domain/fire/simulationAudio'
import { createSimulationAudioRuntime } from '../../domain/fire/simulationAudioRuntime'
import { createViewer3DScene } from './Viewer3DScene'
import DeviceContextMenu from './DeviceContextMenu.vue'

export default defineComponent({
  name: 'Viewer3D',
  components: { Bell, DeviceContextMenu, MuteNotification, RefreshLeft },
  emits: ['locateDevice'],
  setup() {
    const store = useFireProjectStore()
    const { project, selectedDeviceId, simulationMode, simulationState } = storeToRefs(store)
    const { t } = useI18n()
    const containerRef = ref<HTMLDivElement | null>(null)
    const highlightKind = ref<Viewer3DHighlightKind>('none')
    const highlightTargetId = ref<string | null>(null)
    const contextMenu = ref({ visible: false, x: 0, y: 0, deviceId: null as string | null })
    let simulationTickTimer: number | undefined
    const simulationAudioRuntime = createSimulationAudioRuntime(window)

    const hiddenBuildingIds = ref(new Set<string>())
    const hiddenFloorIds = ref(new Set<string>())

    function toggleBuildingVisibility(buildingId: string): void {
      const next = new Set(hiddenBuildingIds.value)
      if (next.has(buildingId)) {
        next.delete(buildingId)
      } else {
        next.add(buildingId)
      }
      hiddenBuildingIds.value = next
    }

    function toggleFloorVisibility(floorId: string): void {
      const next = new Set(hiddenFloorIds.value)
      if (next.has(floorId)) {
        next.delete(floorId)
      } else {
        next.add(floorId)
      }
      hiddenFloorIds.value = next
    }

    function getSortedFloors(building: FireBuilding): FireFloor[] {
      return [...building.floors].sort((a, b) => b.levelIndex - a.levelIndex)
    }

    function getBuildingOpacity(building: FireBuilding): number {
      if (building.floors.length === 0) return mapOpacity3D.value
      const firstOverride = building.floors.find((f) => f.mapOpacity3D !== undefined)
      return firstOverride?.mapOpacity3D ?? mapOpacity3D.value
    }

    function setBuildingOpacity(building: FireBuilding, event: Event): void {
      const value = parseFloat((event.target as HTMLInputElement).value)
      building.floors.forEach((f) => {
        store.setFloorMapOpacity3D(f.id, value)
      })
    }

    function getFloorOpacity(floor: FireFloor): number {
      return floor.mapOpacity3D ?? mapOpacity3D.value
    }

    function setFloorOpacity(floor: FireFloor, event: Event): void {
      const value = parseFloat((event.target as HTMLInputElement).value)
      store.setFloorMapOpacity3D(floor.id, value)
    }

    function setHighlightKind(kind: Viewer3DHighlightKind): void {
      highlightKind.value = kind
    }

    function dispatchSimulation(type: 'evacuate' | 'buzzer-silence' | 'system-reset'): void {
      store.dispatchSimulationAction({ type, at: Date.now() })
    }

    function startSimulationTicking(): void {
      stopSimulationTicking()
      simulationTickTimer = window.setInterval(() => {
        if (!simulationMode.value) {
          stopSimulationTicking()
          return
        }

        store.dispatchSimulationAction({
          type: 'tick',
          at: Date.now(),
          elapsedSeconds: project.value.simulationSettings.timeScale
        })
      }, 1000)
    }

    function stopSimulationTicking(): void {
      if (simulationTickTimer === undefined) return
      window.clearInterval(simulationTickTimer)
      simulationTickTimer = undefined
    }

    const floorSpacing3D = computed({
      get: () => getEffectiveFloorHeight3D(project.value.viewSettings.floorSpacing3D),
      set: (value: number) => store.setFloorSpacing3D(value)
    })
    const mapOpacity3D = computed({
      get: () => project.value.viewSettings.mapOpacity3D ?? 1,
      set: (value: number) => store.setMapOpacity3D(value)
    })
    const highlightOptions = computed(() =>
      getViewer3DHighlightOptions(project.value, highlightKind.value)
    )
    const hasHighlightTargets = computed(() => highlightOptions.value.length > 0)
    const showHighlightTargetPicker = computed(() => highlightKind.value !== 'none')
    const highlightTargetLabel = computed(() =>
      highlightKind.value === 'zone' ? t('fire.viewer3d.zoneTarget') : t('fire.viewer3d.target')
    )
    const highlightTargetPlaceholder = computed(() =>
      highlightKind.value === 'zone'
        ? t('fire.viewer3d.selectZone')
        : t('fire.viewer3d.selectTarget')
    )
    const highlightTargetEmptyText = computed(() =>
      highlightKind.value === 'zone' ? t('fire.viewer3d.noZones') : t('fire.viewer3d.noTargets')
    )
    const deviceById = computed(
      () => new Map(project.value.devices.map((device) => [device.id, device]))
    )
    const shouldPlay3DSimulationAudio = computed(() =>
      shouldPlaySimulationAlarmAudio({
        simulationMode: simulationMode.value,
        soundEnabled: project.value.simulationSettings.soundEnabled,
        soundState: simulationState.value.soundState,
        project: project.value,
        devices: project.value.devices,
        outputs: simulationState.value.outputs
      })
    )
    const contextDevice = computed(() =>
      contextMenu.value.deviceId ? (deviceById.value.get(contextMenu.value.deviceId) ?? null) : null
    )
    function hasActiveInput(deviceId: string): boolean {
      return simulationState.value.activeInputAlarms.some((alarm) => alarm.deviceId === deviceId)
    }
    function hasActiveFault(deviceId: string): boolean {
      return simulationState.value.activeFaults.some((fault) => fault.deviceId === deviceId)
    }
    const highlightSelection = computed<Viewer3DHighlightSelection>(() => ({
      kind: highlightKind.value,
      targetId: highlightTargetId.value
    }))
    const {
      initScene,
      cleanupScene,
      rebuildScene,
      focusSelectedZone,
      handleRendererPointerDown,
      handleRendererClick,
      handleRendererDoubleClick,
      handleRendererContextMenu,
      closeContextMenu,
      animate
    } = createViewer3DScene({
      store,
      project,
      selectedDeviceId,
      simulationMode,
      simulationState,
      containerRef,
      contextMenu,
      hiddenBuildingIds,
      hiddenFloorIds,
      floorSpacing3D,
      mapOpacity3D,
      highlightKind,
      highlightTargetId,
      highlightSelection,
      deviceById
    })
    onMounted(() => {
      if (!simulationMode.value) {
        store.enterSimulationMode()
      }
      startSimulationTicking()
      initScene()
      rebuildScene()
      animate()
    })
    onUnmounted(() => {
      stopSimulationTicking()
      simulationAudioRuntime.stop()
      cleanupScene()
      store.exitSimulationMode()
    })
    watch(
      [
        project,
        selectedDeviceId,
        simulationState,
        highlightKind,
        highlightTargetId,
        hiddenBuildingIds,
        hiddenFloorIds
      ],
      () => {
        rebuildScene()
      },
      { deep: true }
    )
    watch(
      highlightKind,
      () => {
        if (highlightKind.value === 'none' || highlightKind.value === 'zone') {
          highlightTargetId.value = null
          return
        }
        highlightTargetId.value = highlightOptions.value[0]?.id ?? null
      },
      { flush: 'post' }
    )
    watch(
      highlightOptions,
      (options) => {
        if (highlightKind.value === 'none') {
          highlightTargetId.value = null
          return
        }
        if (!options.some((option) => option.id === highlightTargetId.value)) {
          highlightTargetId.value = highlightKind.value === 'zone' ? null : (options[0]?.id ?? null)
        }
      },
      { immediate: true }
    )
    watch([highlightKind, highlightTargetId], () => {
      if (highlightKind.value !== 'zone' || !highlightTargetId.value) return
      requestAnimationFrame(() => focusSelectedZone())
    })
    watch(
      [shouldPlay3DSimulationAudio, () => simulationState.value.soundState],
      ([shouldPlay, soundState]) => {
        simulationAudioRuntime.sync(shouldPlay, soundState)
      },
      { immediate: true }
    )

    return {
      store,
      t,
      project,
      simulationMode,
      containerRef,
      highlightKind,
      highlightTargetId,
      contextMenu,
      hiddenBuildingIds,
      hiddenFloorIds,
      floorSpacing3D,
      mapOpacity3D,
      highlightOptions,
      hasHighlightTargets,
      showHighlightTargetPicker,
      highlightTargetLabel,
      highlightTargetPlaceholder,
      highlightTargetEmptyText,
      deviceById,
      contextDevice,
      hasActiveInput,
      hasActiveFault,
      highlightSelection,
      toggleBuildingVisibility,
      toggleFloorVisibility,
      getSortedFloors,
      getBuildingOpacity,
      setBuildingOpacity,
      getFloorOpacity,
      setFloorOpacity,
      setHighlightKind,
      dispatchSimulation,
      initScene,
      rebuildScene,
      focusSelectedZone,
      handleRendererPointerDown,
      handleRendererClick,
      handleRendererDoubleClick,
      handleRendererContextMenu,
      closeContextMenu
    }
  }
})
