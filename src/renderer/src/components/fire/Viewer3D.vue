<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type {
  FireBuilding,
  FireDevice,
  FireFloor,
  FireLoop,
  Vector3
} from '../../domain/fire/types'
import { buildLoopSegments } from '../../domain/fire/loopWiring'
import { getDeviceIconByType } from '../../domain/fire/deviceIcons'

const store = useFireProjectStore()
const { project, selectedDeviceId, simulationState } = storeToRefs(store)
const containerRef = ref<HTMLDivElement | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0

const PLAN_SCALE = 0.08
const DEFAULT_FLOOR_WIDTH = 1200
const DEFAULT_FLOOR_DEPTH = 800
const DEFAULT_FLOOR_HEIGHT = 42

onMounted(() => {
  initScene()
  rebuildScene()
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
  clearScene()
})

watch(
  [project, selectedDeviceId, simulationState],
  () => {
    rebuildScene()
  },
  { deep: true }
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

  scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 2.2))
  const keyLight = new THREE.DirectionalLight('#ffffff', 2.4)
  keyLight.position.set(90, 150, 80)
  keyLight.castShadow = true
  scene.add(keyLight)
  scene.add(new THREE.GridHelper(260, 26, '#94a3b8', '#cbd5e1'))

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
          renderZoneArea(area.buildingId, area.floorId, area.points, area.color, area.opacity)
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

    if (asset?.packagePath) {
      material.map = new THREE.TextureLoader().load(asset.packagePath)
      material.map.colorSpace = THREE.SRGBColorSpace
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
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: getDeviceColor(device),
    depthTest: true
  })
  const sprite = new THREE.Sprite(material)
  const size = device.id === selectedDeviceId.value ? 9 : 7
  sprite.position.copy(point)
  sprite.scale.set(size, size, size)
  scene?.add(sprite)

  if (
    device.id === selectedDeviceId.value ||
    hasActiveInput(device.id) ||
    hasActiveFault(device.id)
  ) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.62, 0.22, 8, 36),
      new THREE.MeshBasicMaterial({
        color: getDeviceColor(device),
        transparent: true,
        opacity: 0.85
      })
    )
    ring.position.copy(point)
    ring.rotation.x = Math.PI / 2
    scene?.add(ring)
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

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color: loop.color, linewidth: 2 })
  scene?.add(new THREE.LineSegments(geometry, material))
}

function renderZoneArea(
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
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.42, Math.max(0.08, opacity)),
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(origin.x, origin.y + 0.12, origin.z)
  scene?.add(mesh)
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
  return new THREE.Vector3(
    origin.x + position.x * PLAN_SCALE,
    origin.y + 4,
    origin.z + position.y * PLAN_SCALE
  )
}

function getFloorOrigin(
  building: FireBuilding,
  buildingIndex: number,
  floor: FireFloor
): THREE.Vector3 {
  const baseX = (building.position?.x ?? buildingIndex * 1600) * PLAN_SCALE
  const baseZ = (building.position?.y ?? 0) * PLAN_SCALE
  const floorHeight = floor.floorHeight3D ?? DEFAULT_FLOOR_HEIGHT
  return new THREE.Vector3(baseX, floor.levelIndex * floorHeight, baseZ)
}

function getDeviceColor(device: FireDevice): THREE.ColorRepresentation {
  if (device.disabled) return '#94a3b8'
  if (hasActiveInput(device.id)) return '#dc2626'
  if (hasActiveFault(device.id)) return '#d97706'
  if (hasActiveOutput(device)) return '#2563eb'
  if (device.id === selectedDeviceId.value) return '#1d4ed8'
  return '#ffffff'
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

function resizeRenderer(): void {
  const container = containerRef.value
  if (!container || !renderer || !camera) return

  const width = Math.max(1, container.clientWidth)
  const height = Math.max(1, container.clientHeight)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate(): void {
  animationFrame = requestAnimationFrame(animate)
  controls?.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function clearScene(): void {
  if (!scene) return

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
  <section ref="containerRef" class="viewer-3d" />
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

.viewer-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
