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
  FireZone,
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
import {
  getDeviceSimulationOutput,
  type SounderOutputPattern
} from '../../domain/fire/simulationOutputMapping'
import {
  getViewer3DDeviceHighlightAppearance,
  getViewer3DHighlightOptions,
  isDeviceHighlighted,
  isZoneHighlighted,
  type Viewer3DHighlightKind,
  type Viewer3DHighlightSelection
} from '../../domain/fire/viewer3DHighlight'
import {
  getViewer3DDeviceAnimationFrame,
  type Viewer3DDeviceOutputState
} from '../../domain/fire/viewer3DSimulationVisual'
import {
  getDeviceStatusAppearance,
  type DeviceStatusAppearance
} from '../../domain/fire/deviceVisualState'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import { getViewer3DMapOpacity } from '../../domain/fire/viewer3DViewState'
import { resolveViewer3DZoneAreas } from '../../domain/fire/viewer3DZoneArea'
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

const hiddenBuildingIds = ref(new Set<string>())
const hiddenFloorIds = ref(new Set<string>())

function toggleBuildingVisibility(buildingId: string) {
  const next = new Set(hiddenBuildingIds.value)
  if (next.has(buildingId)) {
    next.delete(buildingId)
  } else {
    next.add(buildingId)
  }
  hiddenBuildingIds.value = next
}

function toggleFloorVisibility(floorId: string) {
  const next = new Set(hiddenFloorIds.value)
  if (next.has(floorId)) {
    next.delete(floorId)
  } else {
    next.add(floorId)
  }
  hiddenFloorIds.value = next
}

function getSortedFloors(building: FireBuilding) {
  return [...building.floors].sort((a, b) => b.levelIndex - a.levelIndex)
}

function getBuildingOpacity(building: FireBuilding): number {
  if (building.floors.length === 0) return mapOpacity3D.value
  const firstOverride = building.floors.find((f) => f.mapOpacity3D !== undefined)
  return firstOverride?.mapOpacity3D ?? mapOpacity3D.value
}

function setBuildingOpacity(building: FireBuilding, event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value)
  building.floors.forEach((f) => {
    store.setFloorMapOpacity3D(f.id, value)
  })
}

function getFloorOpacity(floor: FireFloor): number {
  return floor.mapOpacity3D ?? mapOpacity3D.value
}

function setFloorOpacity(floor: FireFloor, event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value)
  store.setFloorMapOpacity3D(floor.id, value)
}

function setHighlightKind(kind: Viewer3DHighlightKind) {
  highlightKind.value = kind
}

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
  sounderPattern?: SounderOutputPattern
  isSounder: boolean
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
  highlightKind.value === 'zone' ? t('fire.viewer3d.selectZone') : t('fire.viewer3d.selectTarget')
)
const highlightTargetEmptyText = computed(() =>
  highlightKind.value === 'zone' ? t('fire.viewer3d.noZones') : t('fire.viewer3d.noTargets')
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
  if (highlightKind.value !== 'zone' || !highlightTargetId.value) {
    return
  }

  requestAnimationFrame(() => focusSelectedZone())
})

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
        const areas = resolveViewer3DZoneAreas({
          zone,
          devices: project.value.devices,
          includeTemporary: isZoneHighlighted(highlightSelection.value, panel, zone.zoneNumber)
        })

        for (const area of areas) {
          if (
            hiddenBuildingIds.value.has(area.buildingId) ||
            hiddenFloorIds.value.has(area.floorId)
          ) {
            continue
          }

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
  if (hiddenBuildingIds.value.has(building.id)) return
  for (const floor of building.floors) {
    if (hiddenFloorIds.value.has(floor.id)) {
      continue
    }

    const origin = getFloorOrigin(building, buildingIndex, floor)
    const width = (floor.mapWidth ?? DEFAULT_FLOOR_WIDTH) * PLAN_SCALE
    const depth = (floor.mapHeight ?? DEFAULT_FLOOR_DEPTH) * PLAN_SCALE
    const geometry = new THREE.PlaneGeometry(width, depth)
    const floorOpacity = getViewer3DMapOpacity(
      project.value.viewSettings.mapOpacity3D ?? 1,
      floor.mapOpacity3D
    )
    const material = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: floorOpacity < 1,
      opacity: floorOpacity,
      depthWrite: floorOpacity >= 1
    })
    const asset = floor.mapAssetId
      ? project.value.assets.find((candidate) => candidate.id === floor.mapAssetId)
      : undefined

    const assetHref = getFireAssetHref(asset)
    if (assetHref) {
      material.map = new THREE.TextureLoader().load(assetHref)
      material.map.colorSpace = THREE.SRGBColorSpace
      material.color = new THREE.Color('#ffffff')
      material.transparent = floorOpacity < 1
      material.opacity = floorOpacity
      material.depthWrite = floorOpacity >= 1
      material.needsUpdate = true
    }

    const floorMesh = new THREE.Mesh(geometry, material)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.set(origin.x + width / 2, origin.y, origin.z + depth / 2)
    floorMesh.receiveShadow = true
    scene?.add(floorMesh)

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: '#64748b',
        transparent: floorOpacity < 1,
        opacity: Math.max(0.24, floorOpacity)
      })
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
  const statusAppearance = getDeviceStatusAppearance(device)
  const deviceColor = getDeviceColor(device)
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: deviceColor,
    transparent: true,
    alphaTest: 0.05,
    opacity: highlightAppearance.opacity * statusAppearance.iconOpacity,
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

  if (statusAppearance.state !== 'normal') {
    renderDeviceStatusMarker(point, size, statusAppearance, highlightAppearance.opacity)
  }

  if (isSelectedOrHighlighted) {
    // Use a stronger ripple for the selected device and a softer one for grouped highlights.
    const rippleColor = device.id === selectedDeviceId.value ? '#00ff66' : '#52c41a'
    // Render three expanding radar rings around the device.
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
  } else if (hasActiveInput(device.id) || hasActiveFault(device.id) || outputState !== null) {
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
      baseOpacity: highlightAppearance.opacity * statusAppearance.iconOpacity,
      outputState: outputState.state,
      sounderPattern: outputState.sounderPattern,
      isSounder: device.isSounder
    })
  }
}

function renderDeviceStatusMarker(
  point: THREE.Vector3,
  size: number,
  appearance: DeviceStatusAppearance,
  baseOpacity: number
): void {
  const material = new THREE.MeshBasicMaterial({
    color: appearance.color,
    transparent: true,
    opacity: Math.max(0.34, baseOpacity * 0.9),
    depthWrite: false
  })
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.72, Math.max(0.04, size * 0.045), 8, 36),
    material
  )
  ring.position.copy(point)
  ring.position.y += Math.max(0.04, size * 0.04)
  ring.rotation.x = Math.PI / 2
  scene?.add(ring)
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

  if (
    hiddenBuildingIds.value.has(placement.buildingId) ||
    hiddenFloorIds.value.has(placement.floorId)
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
  if (outputState?.state === 'delayActive') return '#0ea5e9'
  if (outputState?.state === 'active' && device.isSounder) return '#ef4444'
  if (outputState?.state === 'active') return '#2563eb'
  return getDeviceStatusAppearance(device).spriteColor
}

function focusSelectedZone(): void {
  if (!camera || !controls || highlightKind.value !== 'zone' || !highlightTargetId.value) {
    return
  }

  const bounds = getSelectedZoneBounds()
  if (!bounds || bounds.isEmpty()) {
    return
  }

  const sphere = bounds.getBoundingSphere(new THREE.Sphere())
  const radius = Math.max(sphere.radius, 14)
  const target = sphere.center
  const direction = camera.position.clone().sub(controls.target)
  if (direction.lengthSq() < 0.001) {
    direction.set(1, 1.1, 1)
  }
  direction.normalize()

  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const fitDistance = radius / Math.sin(verticalFov / 2)
  camera.position.copy(target.clone().add(direction.multiplyScalar(fitDistance * 1.15)))
  camera.near = Math.max(0.1, fitDistance / 100)
  camera.far = Math.max(10000, fitDistance * 100)
  camera.updateProjectionMatrix()
  controls.target.copy(target)
  controls.update()
}

function getSelectedZoneBounds(): THREE.Box3 | null {
  const selected = findSelectedZone()
  if (!selected) {
    return null
  }

  const bounds = new THREE.Box3()
  for (const area of selected.zone.visualAreas) {
    if (
      hiddenBuildingIds.value.has(area.buildingId) ||
      hiddenFloorIds.value.has(area.floorId)
    ) {
      continue
    }

    includeZoneAreaBounds(bounds, area.buildingId, area.floorId, area.points)
  }

  const selection = highlightSelection.value
  for (const device of project.value.devices) {
    if (!isDeviceHighlighted(project.value, selection, device)) {
      continue
    }

    const point = getDevicePoint(device)
    if (!point) {
      continue
    }

    const size = getRenderedDeviceWorldSize(device)
    bounds.expandByPoint(point.clone().add(new THREE.Vector3(-size, -size, -size)))
    bounds.expandByPoint(point.clone().add(new THREE.Vector3(size, size, size)))
  }

  return bounds.isEmpty() ? null : bounds
}

function includeZoneAreaBounds(
  bounds: THREE.Box3,
  buildingId: string,
  floorId: string,
  points: Array<{ x: number; y: number }>
): void {
  const buildingIndex = project.value.buildings.findIndex((building) => building.id === buildingId)
  const building = project.value.buildings[buildingIndex]
  const floor = building?.floors.find((candidate) => candidate.id === floorId)
  if (!building || !floor || points.length === 0) {
    return
  }

  const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
  for (const point of points) {
    bounds.expandByPoint(
      new THREE.Vector3(origin.x + point.x * PLAN_SCALE, origin.y, origin.z + point.y * PLAN_SCALE)
    )
  }
}

function findSelectedZone(): { panel: FirePanel; zone: FireZone } | null {
  const targetId = highlightTargetId.value
  if (!targetId) {
    return null
  }

  for (const network of project.value.networks) {
    for (const panel of network.panels) {
      const zone = panel.zones.find((candidate) => candidate.id === targetId)
      if (zone) {
        return { panel, zone }
      }
    }
  }

  return null
}

function hasActiveInput(deviceId: string): boolean {
  return simulationState.value.activeInputAlarms.some((alarm) => alarm.deviceId === deviceId)
}

function hasActiveFault(deviceId: string): boolean {
  return simulationState.value.activeFaults.some((fault) => fault.deviceId === deviceId)
}

function getDeviceOutputState(
  device: FireDevice
): { state: 'active' | 'delayActive'; sounderPattern?: SounderOutputPattern } | null {
  return getDeviceSimulationOutput(project.value, simulationState.value.outputs, device)
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
      sounderPattern: object.sounderPattern,
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
  radarRipples.forEach((ripple) => {
    ripple.progress += deltaMs / 1800
    if (ripple.progress > 1) {
      ripple.progress = 0
    }
    const scale = 0.5 + ripple.progress * 1.8
    ripple.mesh.scale.setScalar(scale)

    const mat = ripple.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.85 * (1.0 - ripple.progress)
  })

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
    <!-- Top-left Highlight Panel -->
    <div class="viewer-highlight-panel" @pointerdown.stop @wheel.stop>
      <h4 class="panel-section-title">{{ t('fire.viewer3d.highlight') }}</h4>
      <div class="highlight-group">
        <div class="segmented-v3">
          <!-- None -->
          <button :class="['segment-btn-v3', { active: highlightKind === 'none' }]" @click="setHighlightKind('none')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            {{ t('fire.viewer3d.none') }}
          </button>
          <!-- Loop -->
          <button :class="['segment-btn-v3', { active: highlightKind === 'loop' }]" @click="setHighlightKind('loop')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="4" r="1.5" fill="currentColor" />
              <circle cx="20" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="20" r="1.5" fill="currentColor" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            </svg>
            {{ t('fire.viewer3d.loop') }}
          </button>
          <!-- Zone -->
          <button :class="['segment-btn-v3', { active: highlightKind === 'zone' }]" @click="setHighlightKind('zone')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3.5 3.5" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            </svg>
            {{ t('fire.viewer3d.zone') }}
          </button>
          <!-- Sounder Group -->
          <button :class="['segment-btn-v3', { active: highlightKind === 'sounderGroup' }]" @click="setHighlightKind('sounderGroup')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <path d="M22 8a7.92 7.92 0 0 0-.7-3" />
              <path d="M22 14a7.92 7.92 0 0 1-.7 3" />
              <path d="M2 8a7.92 7.92 0 0 1 .7-3" />
              <path d="M2 14a7.92 7.92 0 0 0 .7 3" />
            </svg>
            {{ t('fire.viewer3d.sounderGroup') }}
          </button>
          <!-- IO Group -->
          <button :class="['segment-btn-v3', { active: highlightKind === 'ioGroup' }]" @click="setHighlightKind('ioGroup')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              <circle cx="20" cy="12" r="1.5" fill="currentColor" />
              <line x1="5.5" y1="12" x2="11" y2="12" />
              <line x1="11" y1="12" x2="17.5" y2="4" />
            </svg>
            {{ t('fire.viewer3d.ioGroup') }}
          </button>
        </div>

        <!-- Target Picker Dropdown -->
        <div v-if="showHighlightTargetPicker" class="target-picker-container">
          <span class="target-label">{{ highlightTargetLabel }}</span>
          <el-select
            v-model="highlightTargetId"
            class="highlight-select"
            size="small"
            filterable
            clearable
            :disabled="!hasHighlightTargets"
            :placeholder="highlightTargetPlaceholder"
            :empty-text="highlightTargetEmptyText"
          >
            <el-option
              v-for="option in highlightOptions"
              :key="option.id"
              :label="option.label"
              :value="option.id"
            />
          </el-select>
          <span
            v-if="highlightKind === 'zone' && hasHighlightTargets && !highlightTargetId"
            class="target-hint"
          >
            {{ t('fire.viewer3d.chooseZoneHint') }}
          </span>
          <span v-else-if="!hasHighlightTargets" class="target-hint">
            {{ highlightTargetEmptyText }}
          </span>
        </div>
      </div>
    </div>

    <!-- Integrated Drawings & Floor Spacing Panel on the Left -->
    <div class="viewer-drawings-panel" @pointerdown.stop @wheel.stop>
      <div class="panel-layout-row">
        <!-- Spacing Slider (Height适中) -->
        <div class="v-slider-col">
          <span class="v-slider-label">{{ t('fire.viewer3d.floorSpacing') }}</span>
          <div class="slider-track-v">
            <input
              type="range"
              class="custom-slider-vertical"
              min="12"
              max="96"
              v-model.number="floorSpacing3D"
            />
          </div>
          <span class="v-slider-val">{{ floorSpacing3D }}</span>
        </div>

        <el-divider direction="vertical" class="col-divider" />

        <!-- Flat Drawing Control List (Narrowed Spacing) -->
        <div class="drawings-col">
          <h4 class="panel-section-title">{{ t('fire.viewer3d.drawingControl') || '图纸独立控制' }}</h4>
          <div class="drawing-list">
            <div v-for="b in project.buildings" :key="b.id" class="drawing-item">
              <div class="item-header">
                <span class="item-title-wrap">
                  <!-- Building Icon -->
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="building-icon">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <line x1="9" y1="22" x2="9" y2="16" />
                    <line x1="15" y1="22" x2="15" y2="16" />
                    <line x1="9" y1="16" x2="15" y2="16" />
                    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
                  </svg>
                  <span>{{ b.name }}</span>
                </span>
                <div class="item-actions">
                  <button
                    class="eye-btn"
                    :class="{ hidden: hiddenBuildingIds.has(b.id) }"
                    @click="toggleBuildingVisibility(b.id)"
                  >
                    <svg v-if="!hiddenBuildingIds.has(b.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  </button>
                  <div class="inline-slider-container">
                    <input
                      type="range"
                      class="inline-slider"
                      min="0"
                      max="1"
                      step="0.05"
                      :value="getBuildingOpacity(b)"
                      :disabled="hiddenBuildingIds.has(b.id)"
                      @input="setBuildingOpacity(b, $event)"
                    />
                    <span class="inline-val">{{ Math.round(getBuildingOpacity(b) * 100) }}%</span>
                  </div>
                </div>
              </div>

              <!-- Floor Sub-list -->
              <div class="floor-sublist">
                <div v-for="f in getSortedFloors(b)" :key="f.id" class="floor-item">
                  <span class="floor-title">{{ f.name }}</span>
                  <div class="item-actions">
                    <button
                      class="eye-btn"
                      :class="{ hidden: hiddenFloorIds.has(f.id) || hiddenBuildingIds.has(b.id) }"
                      :disabled="hiddenBuildingIds.has(b.id)"
                      @click="toggleFloorVisibility(f.id)"
                    >
                      <svg v-if="!hiddenFloorIds.has(f.id) && !hiddenBuildingIds.has(b.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </button>
                    <div class="inline-slider-container">
                      <input
                        type="range"
                        class="inline-slider"
                        min="0"
                        max="1"
                        step="0.05"
                        :value="getFloorOpacity(f)"
                        :disabled="hiddenFloorIds.has(f.id) || hiddenBuildingIds.has(b.id)"
                        @input="setFloorOpacity(f, $event)"
                      />
                      <span class="inline-val">{{ Math.round(getFloorOpacity(f) * 100) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

/* Top-left Highlight Panel */
.viewer-highlight-panel {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 4;
  width: 320px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Integrated Drawings & Spacing Panel on Left */
.viewer-drawings-panel {
  position: absolute;
  left: 12px;
  top: 128px;
  z-index: 4;
  width: 340px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
  box-sizing: border-box;
  max-height: calc(100% - 150px);
}

.panel-layout-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

/* Spacing slider column (limited appropriate height) */
.v-slider-col {
  width: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  box-sizing: border-box;
  flex-shrink: 0;
  height: 240px; /* Suitable height, not full screen */
}

.col-divider {
  height: auto;
  margin: 0;
  border-color: rgba(148, 163, 184, 0.25);
}

/* Drawings control list column */
.drawings-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  max-height: 380px;
  overflow-y: auto;
}

.panel-section-title {
  font-size: 10px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin: 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  padding-bottom: 6px;
}

.v-slider-label {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  writing-mode: vertical-lr;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.v-slider-val {
  font-size: 11px;
  font-weight: 700;
  color: #2563eb;
}

.slider-track-v {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.custom-slider-vertical {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  width: 170px; /* Adjusted to fit the 240px height */
  height: 20px;
  background: transparent;
  outline: none;
  cursor: pointer;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(270deg);
  margin: 0;
  padding: 0;
}

.custom-slider-vertical::-webkit-slider-runnable-track {
  width: 100%;
  height: 2px;
  background: #cbd5e1;
  border-radius: 99px;
}

.custom-slider-vertical::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  margin-top: -4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.1s ease;
}

.custom-slider-vertical::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.drawing-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawing-item {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 6px;
  padding: 6px;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.item-title-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  min-width: 0;
}

.item-title-wrap span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.building-icon {
  width: 11px;
  height: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eye-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease;
}

.eye-btn svg {
  width: 13px;
  height: 13px;
}

.eye-btn.hidden {
  color: #cbd5e1;
}

.eye-btn:hover {
  color: #2563eb;
}

.eye-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.inline-slider-container {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 80px; /* Narrowed width */
}

.inline-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 2px;
  background: #cbd5e1;
  border-radius: 99px;
  outline: none;
}

.inline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
}

.inline-slider:disabled {
  background: #f1f5f9;
  cursor: not-allowed;
}

.inline-slider:disabled::-webkit-slider-thumb {
  background: #cbd5e1;
  cursor: not-allowed;
}

.inline-val {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  min-width: 24px;
  text-align: right;
}

.floor-sublist {
  margin-top: 4px;
  padding-left: 10px;
  border-left: 1px dashed #cbd5e1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.floor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1px 0;
  font-size: 11px;
}

.floor-title {
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.highlight-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.segmented-v3 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.segment-btn-v3 {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 2px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.segment-btn-v3 svg {
  width: 13px;
  height: 13px;
}

.segment-btn-v3:hover {
  color: #2563eb;
}

.segment-btn-v3.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.target-picker-container {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.target-label {
  flex: 0 0 auto;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
}

.highlight-select {
  flex: 1;
  min-width: 0;
}

.target-hint {
  font-size: 10px;
  color: #64748b;
}

.viewer-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .viewer-drawings-panel {
    width: auto;
    left: 12px;
    right: 12px;
    bottom: 12px;
    height: auto;
    max-height: 40%;
  }
}
</style>
