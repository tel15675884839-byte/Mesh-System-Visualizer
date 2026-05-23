<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type {
  FireBuilding,
  FireDevice,
  FireFloor,
  FireLoop,
  FirePanel,
  Vector3
} from '../../domain/fire/types'
import { buildLoopSegments } from '../../domain/fire/loopWiring'
import { getDeviceIconByType } from '../../domain/fire/deviceIcons'
import {
  getDeviceIconWorldCenterHeight,
  getDeviceIconWorldSize
} from '../../domain/fire/deviceSizing'
import {
  DEFAULT_FLOOR_HEIGHT_3D,
  getEffectiveFloorHeight3D
} from '../../domain/fire/viewer3DGeometry'
import { getDeviceSimulationOutputState } from '../../domain/fire/simulationOutputMapping'
import {
  getViewer3DDeviceHighlightAppearance,
  getViewer3DHighlightOptions,
  isZoneHighlighted,
  type Viewer3DHighlightKind,
  type Viewer3DHighlightSelection
} from '../../domain/fire/viewer3DHighlight'
import {
  getViewer3DDeviceAnimationFrame,
  type Viewer3DDeviceOutputState
} from '../../domain/fire/viewer3DSimulationVisual'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import DeviceContextMenu from './DeviceContextMenu.vue'

const store = useFireProjectStore()
const { project, selectedDeviceId, simulationMode, simulationState } = storeToRefs(store)
const { t } = useI18n()
const emit = defineEmits<{
  openProperties: [deviceId: string]
  locateDevice: [deviceId: string]
}>()
const containerRef = ref<HTMLDivElement | null>(null)
const highlightKind = ref<Viewer3DHighlightKind>('none')
const highlightTargetId = ref<string | null>(null)
const contextMenu = ref({ visible: false, x: 0, y: 0, deviceId: null as string | null })

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let pointerDownPosition: { x: number; y: number } | null = null
const pickableDeviceObjects: THREE.Object3D[] = []
const animatedDeviceObjects: AnimatedDeviceObject[] = []

interface RadarRipple {
  mesh: THREE.Mesh
  progress: number
  baseScale: number
  deviceSize: number
}
interface RadarZone {
  mesh: THREE.Mesh
  baseOpacity: number
}
const radarRipples: RadarRipple[] = []
const radarZones: RadarZone[] = []

const PLAN_SCALE = 0.08
const DEFAULT_FLOOR_WIDTH = 1200
const DEFAULT_FLOOR_DEPTH = 800
const DEFAULT_FLOOR_HEIGHT = DEFAULT_FLOOR_HEIGHT_3D

interface AnimatedDeviceObject {
  sprite: THREE.Sprite
  spriteMaterial: THREE.SpriteMaterial
  ringMaterial: THREE.MeshBasicMaterial | null
  baseSize: number
  baseColor: THREE.ColorRepresentation
  baseOpacity: number
  outputState: Viewer3DDeviceOutputState
  isSounder: boolean
}

const floorSpacing3D = computed({
  get: () => getEffectiveFloorHeight3D(project.value.viewSettings.floorSpacing3D),
  set: (value: number) => store.setFloorSpacing3D(value)
})
const highlightOptions = computed(() =>
  getViewer3DHighlightOptions(project.value, highlightKind.value)
)
const deviceById = computed(
  () => new Map(project.value.devices.map((device) => [device.id, device]))
)
const contextDevice = computed(() =>
  contextMenu.value.deviceId ? (deviceById.value.get(contextMenu.value.deviceId) ?? null) : null
)
const highlightSelection = computed<Viewer3DHighlightSelection>(() => ({
  kind: highlightKind.value,
  targetId: highlightTargetId.value
}))
onMounted(() => {
  initScene()
  rebuildScene()
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.domElement.removeEventListener('pointerdown', handleRendererPointerDown)
  renderer?.domElement.removeEventListener('click', handleRendererClick)
  renderer?.domElement.removeEventListener('dblclick', handleRendererDoubleClick)
  renderer?.domElement.removeEventListener('contextmenu', handleRendererContextMenu)
  renderer?.dispose()
  clearScene()
})

watch(
  [project, selectedDeviceId, simulationState, highlightKind, highlightTargetId],
  () => {
    rebuildScene()
  },
  { deep: true }
)

watch(
  highlightKind,
  () => {
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
      highlightTargetId.value = options[0]?.id ?? null
    }
  },
  { immediate: true }
)

function initScene(): void {
  const container = containerRef.value
  if (!container) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef2f7')

  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 10000)
  camera.position.set(120, 140, 170)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.domElement.addEventListener('pointerdown', handleRendererPointerDown)
  renderer.domElement.addEventListener('click', handleRendererClick)
  renderer.domElement.addEventListener('dblclick', handleRendererDoubleClick)
  renderer.domElement.addEventListener('contextmenu', handleRendererContextMenu)
  container.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(45, 20, 35)

  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(container)
  resizeRenderer()
}

function rebuildScene(): void {
  if (!scene) return
  clearScene()
  pickableDeviceObjects.length = 0
  animatedDeviceObjects.length = 0

  scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 2.2))
  const keyLight = new THREE.DirectionalLight('#ffffff', 2.4)
  keyLight.position.set(90, 150, 80)
  keyLight.castShadow = true
  scene.add(keyLight)

  const deviceObjects = new Map<string, THREE.Vector3>()

  project.value.buildings.forEach((building, buildingIndex) => {
    renderBuilding(building, buildingIndex)
  })

  for (const device of project.value.devices) {
    const point = getDevicePoint(device)
    if (!point) continue
    deviceObjects.set(device.id, point)
    renderDevice(device, point)
  }

  for (const network of project.value.networks) {
    for (const panel of network.panels) {
      for (const loop of panel.loops) {
        renderLoop(loop, deviceObjects)
      }
      for (const zone of panel.zones) {
        for (const area of zone.visualAreas) {
          renderZoneArea(
            panel,
            area.zoneNumber,
            area.buildingId,
            area.floorId,
            area.points,
            area.color,
            area.opacity
          )
        }
      }
    }
  }
}

function renderBuilding(building: FireBuilding, buildingIndex: number): void {
  for (const floor of building.floors) {
    const origin = getFloorOrigin(building, buildingIndex, floor)
    const width = (floor.mapWidth ?? DEFAULT_FLOOR_WIDTH) * PLAN_SCALE
    const depth = (floor.mapHeight ?? DEFAULT_FLOOR_DEPTH) * PLAN_SCALE
    const geometry = new THREE.PlaneGeometry(width, depth)
    const material = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide
    })
    const asset = floor.mapAssetId
      ? project.value.assets.find((candidate) => candidate.id === floor.mapAssetId)
      : undefined

    const assetHref = getFireAssetHref(asset)
    if (assetHref) {
      material.map = new THREE.TextureLoader().load(assetHref)
      material.map.colorSpace = THREE.SRGBColorSpace
      material.color = new THREE.Color('#ffffff')
      material.needsUpdate = true
    }

    const floorMesh = new THREE.Mesh(geometry, material)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.set(origin.x + width / 2, origin.y, origin.z + depth / 2)
    floorMesh.receiveShadow = true
    scene?.add(floorMesh)

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: '#64748b' })
    )
    edge.rotation.x = -Math.PI / 2
    edge.position.copy(floorMesh.position)
    scene?.add(edge)
  }
}

function renderDevice(device: FireDevice, point: THREE.Vector3): void {
  const texture = new THREE.TextureLoader().load(`/icons/${getDeviceIconByType(device.type)}`)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  const highlightAppearance = getViewer3DDeviceHighlightAppearance(
    project.value,
    highlightSelection.value,
    device
  )
  const highlighted = highlightAppearance.highlighted
  const outputState = getDeviceOutputState(device)
  const deviceColor = getDeviceColor(device)
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: deviceColor,
    transparent: true,
    alphaTest: 0.05,
    opacity: highlightAppearance.opacity,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  })
  const sprite = new THREE.Sprite(material)
  const size = getRenderedDeviceWorldSize(device)
  sprite.position.copy(point)
  sprite.scale.set(size, size, size)
  sprite.userData.deviceId = device.id
  pickableDeviceObjects.push(sprite)
  scene?.add(sprite)

  let ringMaterial: THREE.MeshBasicMaterial | null = null
  const isSelectedOrHighlighted = device.id === selectedDeviceId.value || highlighted

  if (isSelectedOrHighlighted) {
    // 3D 声呐雷达波纹颜色：单选选中为绿色，回路等批量高亮为浅绿色
    const rippleColor = (device.id === selectedDeviceId.value) ? '#00ff66' : '#52c41a'
    // 渲染 3D 声呐雷达 3层水波纹扩散环
    for (let i = 0; i < 3; i++) {
      const rippleMat = new THREE.MeshBasicMaterial({
        color: rippleColor,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      })
      const ripple = new THREE.Mesh(new THREE.RingGeometry(size * 0.55, size * 0.6, 32), rippleMat)
      ripple.position.copy(point)
      ripple.rotation.x = Math.PI / 2
      scene?.add(ripple)
      radarRipples.push({
        mesh: ripple,
        progress: i / 3,
        baseScale: 1.0,
        deviceSize: size
      })
    }
  } else if (
    hasActiveInput(device.id) ||
    hasActiveFault(device.id) ||
    outputState !== null
  ) {
    ringMaterial = new THREE.MeshBasicMaterial({
      color: deviceColor,
      transparent: true,
      opacity: 0.85
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, 0.22, 8, 36), ringMaterial)
    ring.position.copy(point)
    ring.rotation.x = Math.PI / 2
    scene?.add(ring)
  }

  if (outputState !== null) {
    animatedDeviceObjects.push({
      sprite,
      spriteMaterial: material,
      ringMaterial,
      baseSize: size,
      baseColor: deviceColor,
      baseOpacity: highlightAppearance.opacity,
      outputState,
      isSounder: device.isSounder
    })
  }
}

function renderLoop(loop: FireLoop, deviceObjects: Map<string, THREE.Vector3>): void {
  const result = buildLoopSegments(loop, project.value.devices)
  const points = result.segments.flatMap((segment) => {
    const from = deviceObjects.get(segment.fromDeviceId)
    const to = deviceObjects.get(segment.toDeviceId)
    return from && to ? [from, to] : []
  })

  if (points.length === 0) return

  const loopHighlightActive = highlightKind.value === 'loop' && Boolean(highlightTargetId.value)
  const highlighted = loopHighlightActive && highlightTargetId.value === loop.id
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: highlighted ? '#00ff66' : loop.color,
    linewidth: highlighted ? 4 : 2,
    transparent: loopHighlightActive && !highlighted,
    opacity: loopHighlightActive && !highlighted ? 0.18 : 1
  })
  scene?.add(new THREE.LineSegments(geometry, material))
}

function renderZoneArea(
  panel: FirePanel,
  zoneNumber: number,
  buildingId: string,
  floorId: string,
  points: Array<{ x: number; y: number }>,
  color: string,
  opacity: number
): void {
  const buildingIndex = project.value.buildings.findIndex((building) => building.id === buildingId)
  const building = project.value.buildings[buildingIndex]
  const floor = building?.floors.find((candidate) => candidate.id === floorId)
  if (!building || !floor || points.length < 3) return

  const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
  const shape = new THREE.Shape(
    points.map((point) => new THREE.Vector2(point.x * PLAN_SCALE, point.y * PLAN_SCALE))
  )
  const zoneHighlightActive = highlightKind.value === 'zone' && Boolean(highlightTargetId.value)
  const highlighted = isZoneHighlighted(highlightSelection.value, panel, zoneNumber)
  const effectiveOpacity = zoneHighlightActive
    ? highlighted
      ? 0.42
      : 0.04
    : Math.min(0.42, Math.max(0.08, opacity))
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: highlighted ? '#00ff66' : color,
      transparent: true,
      opacity: effectiveOpacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(origin.x, origin.y + 0.12, origin.z)
  scene?.add(mesh)

  if (highlighted) {
    radarZones.push({ mesh, baseOpacity: effectiveOpacity })
  }
}

function getDevicePoint(device: FireDevice): THREE.Vector3 | null {
  const placement = device.placement
  if (
    placement.status !== 'placed' ||
    !placement.position ||
    !placement.buildingId ||
    !placement.floorId
  ) {
    return null
  }

  const buildingIndex = project.value.buildings.findIndex(
    (building) => building.id === placement.buildingId
  )
  const building = project.value.buildings[buildingIndex]
  const floor = building?.floors.find((candidate) => candidate.id === placement.floorId)
  if (!building || !floor) return null

  const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
  const position = placement.position as Vector3
  const iconSize = getRenderedDeviceWorldSize(device)
  return new THREE.Vector3(
    origin.x + position.x * PLAN_SCALE,
    origin.y + getDeviceIconWorldCenterHeight(iconSize),
    origin.z + position.y * PLAN_SCALE
  )
}

function getRenderedDeviceWorldSize(device: FireDevice): number {
  const scale = project.value.viewSettings.deviceIconScale2D ?? 1
  const baseSize = getDeviceIconWorldSize(scale, PLAN_SCALE)
  return device.id === selectedDeviceId.value ? baseSize * 1.2 : baseSize
}

function getFloorOrigin(
  building: FireBuilding,
  buildingIndex: number,
  floor: FireFloor
): THREE.Vector3 {
  const baseX = (building.position?.x ?? buildingIndex * 1600) * PLAN_SCALE
  const baseZ = (building.position?.y ?? 0) * PLAN_SCALE
  const floorHeight = getEffectiveFloorHeight3D(
    project.value.viewSettings.floorSpacing3D ?? floor.floorHeight3D ?? DEFAULT_FLOOR_HEIGHT
  )
  return new THREE.Vector3(baseX, floor.levelIndex * floorHeight, baseZ)
}

function getDeviceColor(device: FireDevice): THREE.ColorRepresentation {
  if (hasActiveInput(device.id)) return '#dc2626'
  if (hasActiveFault(device.id)) return '#d97706'
  const outputState = getDeviceOutputState(device)
  if (outputState === 'delayActive') return '#0ea5e9'
  if (outputState === 'active' && device.isSounder) return '#ef4444'
  if (outputState === 'active') return '#2563eb'
  // 移除了选中和批量高亮时直接改变图标自身颜色的逻辑
  if (device.disabled) return '#94a3b8'
  return '#ffffff'
}



function hasActiveInput(deviceId: string): boolean {
  return simulationState.value.activeInputAlarms.some((alarm) => alarm.deviceId === deviceId)
}

function hasActiveFault(deviceId: string): boolean {
  return simulationState.value.activeFaults.some((fault) => fault.deviceId === deviceId)
}

function getDeviceOutputState(device: FireDevice): 'active' | 'delayActive' | null {
  return getDeviceSimulationOutputState(project.value, simulationState.value.outputs, device)
}

function resizeRenderer(): void {
  const container = containerRef.value
  if (!container || !renderer || !camera) return

  const width = Math.max(1, container.clientWidth)
  const height = Math.max(1, container.clientHeight)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function handleRendererPointerDown(event: PointerEvent): void {
  pointerDownPosition = { x: event.clientX, y: event.clientY }
}

function handleRendererClick(event: MouseEvent): void {
  closeContextMenu()
  if (!pointerDownPosition) return

  const dragDistance = Math.hypot(
    event.clientX - pointerDownPosition.x,
    event.clientY - pointerDownPosition.y
  )
  pointerDownPosition = null
  if (dragDistance > 4) return

  store.selectDevice(pickDeviceIdFromEvent(event))
}

function handleRendererDoubleClick(event: MouseEvent): void {
  closeContextMenu()
  const deviceId = pickDeviceIdFromEvent(event)
  const device = deviceId ? deviceById.value.get(deviceId) : undefined
  if (!simulationMode.value || !device?.isInputCapable) return

  event.preventDefault()
  store.selectDevice(device.id)
  store.dispatchSimulationAction({
    type: hasActiveInput(device.id) ? 'restore-input' : 'activate-input',
    deviceId: device.id,
    at: Date.now()
  })
}

function handleRendererContextMenu(event: MouseEvent): void {
  event.preventDefault()
  const deviceId = pickDeviceIdFromEvent(event)
  if (!deviceId) {
    closeContextMenu()
    store.selectDevice(null)
    return
  }

  store.selectDevice(deviceId)
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    deviceId
  }
}

function pickDeviceIdFromEvent(event: MouseEvent): string | null {
  if (!renderer || !camera) return null

  const rect = renderer.domElement.getBoundingClientRect()
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(pointer, camera)

  const hit = raycaster.intersectObjects(pickableDeviceObjects, false)[0]
  const deviceId = hit?.object.userData.deviceId
  return typeof deviceId === 'string' ? deviceId : null
}

function closeContextMenu(): void {
  contextMenu.value = { visible: false, x: 0, y: 0, deviceId: null }
}

function updateDeviceAnimations(elapsedMs: number): void {
  for (const object of animatedDeviceObjects) {
    const frame = getViewer3DDeviceAnimationFrame({
      baseSize: object.baseSize,
      elapsedMs,
      outputState: object.outputState,
      isSounder: object.isSounder
    })

    object.sprite.scale.setScalar(frame.scale)
    object.spriteMaterial.color.set(frame.color ?? object.baseColor)
    object.spriteMaterial.opacity = object.baseOpacity * frame.opacity

    if (object.ringMaterial) {
      object.ringMaterial.color.set(frame.color ?? object.baseColor)
      object.ringMaterial.opacity = object.baseOpacity * frame.ringOpacity
    }
  }
}

let lastTime = 0

function updateRadarHighlightAnimations(time: number, deltaMs: number): void {
  // 1. 更新设备声呐扩散波纹
  radarRipples.forEach((ripple) => {
    ripple.progress += deltaMs / 1800 // 1.8s 为一个扩散周期
    if (ripple.progress > 1) {
      ripple.progress = 0
    }
    const scale = 0.5 + ripple.progress * 1.8
    ripple.mesh.scale.setScalar(scale)
    
    const mat = ripple.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.85 * (1.0 - ripple.progress) // 随半径增大而渐淡
  })

  // 2. 更新防火分区呼吸发光
  radarZones.forEach((zone) => {
    const pulseOpacity = zone.baseOpacity * (1.0 + Math.sin(time * 0.004) * 0.3)
    const mat = zone.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = pulseOpacity
  })
}

function animate(): void {
  animationFrame = requestAnimationFrame(animate)
  controls?.update()
  
  const now = performance.now()
  const deltaMs = lastTime === 0 ? 0 : now - lastTime
  lastTime = now

  updateDeviceAnimations(now)
  updateRadarHighlightAnimations(now, deltaMs)

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function clearScene(): void {
  if (!scene) return

  // 清空雷达动画追踪数组
  radarRipples.length = 0
  radarZones.length = 0

  for (const object of [...scene.children]) {
    scene.remove(object)
    disposeObject(object)
  }
}

function disposeObject(object: THREE.Object3D): void {
  const mesh = object as THREE.Mesh
  mesh.geometry?.dispose()
  const material = mesh.material
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
  } else if (material) {
    disposeMaterial(material)
  }
}

function disposeMaterial(material: THREE.Material): void {
  const mapMaterial = material as THREE.Material & { map?: THREE.Texture }
  mapMaterial.map?.dispose()
  material.dispose()
}
</script>

<template>
  <section ref="containerRef" class="viewer-3d">
    <div class="viewer-toolbar" @pointerdown.stop @wheel.stop>
      <div class="toolbar-row floor-row">
        <span class="toolbar-label">{{ t('fire.viewer3d.floorSpacing') }}</span>
        <el-slider
          v-model="floorSpacing3D"
          class="floor-slider"
          size="small"
          :min="12"
          :max="96"
          :step="2"
          :show-tooltip="false"
        />
        <span class="toolbar-value">{{ floorSpacing3D }}</span>
      </div>

      <div class="toolbar-row highlight-row">
        <span class="toolbar-label">{{ t('fire.viewer3d.highlight') }}</span>
        <el-radio-group v-model="highlightKind" size="small">
          <el-radio-button value="none">{{ t('fire.viewer3d.none') }}</el-radio-button>
          <el-radio-button value="loop">{{ t('fire.viewer3d.loop') }}</el-radio-button>
          <el-radio-button value="zone">{{ t('fire.viewer3d.zone') }}</el-radio-button>
          <el-radio-button value="sounderGroup">{{
            t('fire.viewer3d.sounderGroup')
          }}</el-radio-button>
          <el-radio-button value="ioGroup">{{ t('fire.viewer3d.ioGroup') }}</el-radio-button>
        </el-radio-group>
        <el-select
          v-if="highlightKind !== 'none'"
          v-model="highlightTargetId"
          class="highlight-select"
          size="small"
          filterable
          :placeholder="t('fire.viewer3d.target')"
        >
          <el-option
            v-for="option in highlightOptions"
            :key="option.id"
            :label="option.label"
            :value="option.id"
          />
        </el-select>
      </div>
    </div>
  </section>
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
</template>

<style scoped>
.viewer-3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  background: #eef2f7;
}

.viewer-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(620px, calc(100% - 24px));
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.92);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(8px);
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.toolbar-label {
  flex: 0 0 auto;
  min-width: 78px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.floor-slider {
  width: 210px;
}

.toolbar-value {
  flex: 0 0 34px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

.highlight-row {
  flex-wrap: wrap;
}

.highlight-select {
  width: 220px;
}

.viewer-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .viewer-toolbar {
    right: 8px;
    left: 8px;
    width: auto;
  }

  .toolbar-label {
    min-width: 64px;
  }

  .floor-slider,
  .highlight-select {
    width: 100%;
    min-width: 180px;
  }
}
</style>
