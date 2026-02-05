<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useProjectStore } from '../stores/projectStore'
import { IconRegistry } from '../utils/iconAssets'
import { DeviceRole, DeviceType } from '../types'
import { Log } from '../utils/logger'
import { VideoCamera, MapLocation } from '@element-plus/icons-vue' // [新增]

const containerRef = ref<HTMLElement | null>(null)
const store = useProjectStore()

const floorGap = ref(50) 

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number

const textureCache: Record<string, THREE.Texture> = {}
const buildingGroup = new THREE.Group()
const nodesGroup = new THREE.Group()
const edgesGroup = new THREE.Group()

const getTexture = (url: string) => {
  if (textureCache[url]) return textureCache[url]
  const texture = new THREE.TextureLoader().load(url)
  textureCache[url] = texture
  return texture
}

const getIconTexture = (role: string, type: string) => {
  if (role === DeviceRole.LEADER) return getTexture(IconRegistry.LEADER)
  if (role === DeviceRole.ROUTER) return getTexture(IconRegistry.ROUTER)
  switch (type) {
    case DeviceType.SMOKE_DETECTOR: return getTexture(IconRegistry.SMOKE)
    case DeviceType.HEAT_DETECTOR: return getTexture(IconRegistry.HEAT)
    case DeviceType.MULT_DETECTOR: return getTexture(IconRegistry.HEAT)
    case DeviceType.MANUAL_CALL_POINT: return getTexture(IconRegistry.MCP)
    case DeviceType.IO_MODULE: return getTexture(IconRegistry.IO)
    case DeviceType.SOUNDER: return getTexture(IconRegistry.SOUNDER)
    default: return getTexture(IconRegistry.SMOKE)
  }
}

const buildFloors = () => {
  buildingGroup.clear()
  store.buildings.forEach((bld, bIndex) => {
    const bldOffsetX = bIndex * 2000 
    bld.floors.forEach((floor) => {
      const y = floor.levelIndex * floorGap.value
      if (floor.mapPath) {
        new THREE.TextureLoader().load(floor.mapPath, (tex) => {
          const width = tex.image.width
          const height = tex.image.height
          const geometry = new THREE.PlaneGeometry(width, height)
          const material = new THREE.MeshBasicMaterial({ 
            map: tex, transparent: true, opacity: store.viewSettings.mapOpacity, side: THREE.DoubleSide 
          })
          const plane = new THREE.Mesh(geometry, material)
          plane.rotation.x = -Math.PI / 2
          plane.position.set(bldOffsetX + width / 2, y, height / 2)
          plane.userData = { isFloor: true, buildingId: bld.id, floorId: floor.id }
          buildingGroup.add(plane)
        })
      } else {
        const grid = new THREE.GridHelper(1000, 10, 0x888888, 0xcccccc)
        grid.position.set(bldOffsetX + 500, y, 500)
        buildingGroup.add(grid)
      }
    })
  })
}

const buildNodes = () => {
  nodesGroup.clear()
  const placedNodes = store.nodes.filter(n => n.isPlaced)
  const baseSize = 30
  const nodeSize = baseSize * (store.viewSettings.iconScale / 100)
  
  placedNodes.forEach(node => {
    const bIndex = store.buildings.findIndex(b => b.id === node.buildingId)
    const bldOffsetX = (bIndex !== -1 ? bIndex : 0) * 2000
    const bld = store.buildings.find(b => b.id === node.buildingId)
    const floor = bld?.floors.find(f => f.id === node.floorId)
    const levelIndex = floor ? floor.levelIndex : 0
    const y = levelIndex * floorGap.value
    const x = bldOffsetX + (node.position?.x || 0)
    const z = (node.position?.y || 0)

    const map = getIconTexture(node.role, node.type)
    const material = new THREE.SpriteMaterial({ map: map })
    const sprite = new THREE.Sprite(material)
    sprite.position.set(x, y + 10, z) 
    sprite.scale.set(nodeSize, nodeSize, 1)
    sprite.userData = { id: node.id }
    nodesGroup.add(sprite)
  })
}

const buildEdges = () => {
  edgesGroup.clear()
  if (!store.viewSettings.showAllLinks) return
  const nodePosMap = new Map<string, THREE.Vector3>()
  nodesGroup.children.forEach(child => {
    if (child.userData.id) {
      nodePosMap.set(child.userData.id, child.position)
    }
  })
  const material = new THREE.LineBasicMaterial({ color: 0x409eff, opacity: 0.5, transparent: true })
  store.edges.forEach(edge => {
    const p1 = nodePosMap.get(edge.sourceId)
    const p2 = nodePosMap.get(edge.targetId)
    if (p1 && p2) {
      const points = [p1, p2]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, material)
      edgesGroup.add(line)
    }
  })
}

const init = () => {
  if (!containerRef.value) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f2f5) 
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000)
  camera.position.set(1000, 1000, 1000)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  containerRef.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
  dirLight.position.set(0, 1000, 0)
  scene.add(dirLight)
  scene.add(buildingGroup); scene.add(nodesGroup); scene.add(edgesGroup)
  rebuildAll()
  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

const rebuildAll = () => {
  buildFloors(); buildNodes(); buildEdges()
}

watch(floorGap, () => { rebuildAll() })
watch(() => store.viewSettings, () => { rebuildAll() }, { deep: true })
watch(() => store.structureVersion, () => { rebuildAll() })

const handleResize = () => {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => { init(); window.addEventListener('resize', handleResize) })
onBeforeUnmount(() => { 
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  if(renderer) { renderer.dispose(); renderer.forceContextLoss() }
})

const resetView = () => {
  camera.position.set(1000, 1000, 1000)
  controls.target.set(0, 0, 0)
}
</script>

<template>
  <div class="threed-container">
    <div class="overlay-controls">
      <!-- [新增] 视图切换器 -->
      <div class="control-item">
        <el-radio-group v-model="store.currentViewMode" size="small">
          <el-radio-button label="2D"><el-icon><MapLocation /></el-icon> 2D</el-radio-button>
          <el-radio-button label="3D"><el-icon><VideoCamera /></el-icon> 3D</el-radio-button>
        </el-radio-group>
      </div>

      <div class="divider"></div>

      <div class="control-item">
        <span class="label">Floor Gap</span>
        <input type="range" v-model.number="floorGap" min="0" max="500" step="10">
      </div>
      
      <div class="control-item">
        <span class="label">Icon Size</span>
        <input type="range" v-model.number="store.viewSettings.iconScale" min="10" max="300" step="10">
      </div>
      
      <div class="control-item">
        <span class="label">Opacity</span>
        <input type="range" v-model.number="store.viewSettings.mapOpacity" min="0" max="1" step="0.1">
      </div>

      <div class="control-item">
        <el-checkbox v-model="store.viewSettings.showAllLinks" label="Show Links" />
      </div>

      <el-button size="small" @click="resetView" style="margin-top: 5px;">Reset View</el-button>
    </div>

    <div ref="containerRef" class="scene-container"></div>
  </div>
</template>

<style scoped>
.threed-container { width: 100%; height: 100%; position: relative; overflow: hidden; }
.scene-container { width: 100%; height: 100%; }

.overlay-controls { 
  position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.9); 
  padding: 12px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
  z-index: 10; display: flex; flex-direction: column; gap: 12px; width: 180px; 
}
.control-item { display: flex; flex-direction: column; gap: 4px; }
.control-item .label { font-size: 12px; color: #606266; font-weight: bold; }
.control-item input[type=range] { width: 100%; cursor: pointer; }
.divider { height: 1px; background-color: #eee; width: 100%; }
</style>