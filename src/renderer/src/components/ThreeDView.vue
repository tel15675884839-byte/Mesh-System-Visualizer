<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, reactive } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useProjectStore } from '../stores/projectStore'
import { IconRegistry } from '../utils/iconAssets'
import { DeviceRole, DeviceType } from '../types'
import { Log } from '../utils/logger'
import { Setting, Hide, View, ArrowDown, ArrowRight } from '@element-plus/icons-vue'

const containerRef = ref<HTMLElement | null>(null)
const store = useProjectStore()

// UI 面板显示状态
const showControls = ref(true)

// [新增] 折叠状态控制
const expandedSections = reactive({
  loops: true,
  buildings: true,
  floors: true
})

// [重构] 动态显隐状态字典 (Key: ID, Value: boolean)
const visibilityState = reactive({
  loops: {} as Record<string, boolean>,
  buildings: {} as Record<string, boolean>,
  floors: {} as Record<string, boolean>
})

// 初始化/同步可见性状态
const syncVisibilityState = () => {
  // Loops
  store.loops.forEach(l => {
    if (visibilityState.loops[l.id] === undefined) visibilityState.loops[l.id] = true
  })
  // Buildings
  store.buildings.forEach(b => {
    if (visibilityState.buildings[b.id] === undefined) visibilityState.buildings[b.id] = true
  })
  // Floors
  store.buildings.forEach(b => {
    b.floors.forEach(f => {
      if (visibilityState.floors[f.id] === undefined) visibilityState.floors[f.id] = true
    })
  })
}

// [新增] 辅助计算属性：为了 UI 渲染列表
const floorList = computed(() => {
  const list: { id: string, name: string, buildingId: string }[] = []
  store.buildings.forEach(b => {
    b.floors.forEach(f => {
      list.push({
        id: f.id,
        name: `${b.name} - ${f.name}`,
        buildingId: b.id
      })
    })
  })
  return list
})

// --- Three.js 核心对象 ---
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number

// --- 交互相关 ---
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// 拖拽相关状态
let isDraggingBuilding = false
let draggedBuildingId: string | null = null
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// 缓存与组
const textureCache: Record<string, THREE.Texture> = {}
const edgesGroup = new THREE.Group()
const buildingGroups = new Map<string, THREE.Group>() 
const anchorMeshes: THREE.Mesh[] = []

// --- 计算属性 ---
const selectedNodeInfo = computed(() => {
  const node = store.selectedNode
  if (!node) return null
  const loop = store.loops.find(l => l.id === node.loopId)
  const connectedEdges = store.edges.filter(e => e.sourceId === node.id || e.targetId === node.id)
  
  const rssiDetails = connectedEdges.map(e => {
    const isSource = e.sourceId === node.id
    const otherId = isSource ? e.targetId : e.sourceId
    const myName = store.getDisplayId(node.id)
    const otherName = store.getDisplayId(otherId)
    const val = e.rssi !== undefined ? e.rssi : 'N/A'
    return `${myName} → ${otherName} ${val} dBm`
  })

  let linksText = rssiDetails.length > 0 
    ? rssiDetails.slice(0, 5).join('\n') 
    : 'No Connections'
    
  if (rssiDetails.length > 5) {
    linksText += `\n... (+${rssiDetails.length - 5} more)`
  }

  return {
    name: node.label || node.mac,
    type: node.type,
    loop: loop ? loop.name : 'Unassigned',
    rssi: linksText 
  }
})

// --- 资源加载 ---
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

const createTextTexture = (text: string) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const fontSize = 48
  ctx.font = `bold ${fontSize}px Arial`
  const textWidth = ctx.measureText(text).width
  canvas.width = textWidth + 20
  canvas.height = fontSize + 20
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#333333'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return { texture, aspect: canvas.width / canvas.height }
}

// --- 场景构建 ---

const initBuildingGroups = () => {
  buildingGroups.forEach(g => scene.remove(g))
  buildingGroups.clear()
  anchorMeshes.length = 0

  store.buildings.forEach((bld, index) => {
    const group = new THREE.Group()
    const defaultX = index * 3000
    group.position.set(defaultX, 0, 0)
    group.userData = { buildingId: bld.id }
    
    scene.add(group)
    buildingGroups.set(bld.id, group)

    const anchorGroup = new THREE.Group()
    
    const dotGeo = new THREE.SphereGeometry(60, 32, 32)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff4040 })
    const dotMesh = new THREE.Mesh(dotGeo, dotMat)
    dotMesh.userData = { isAnchor: true, buildingId: bld.id }
    anchorGroup.add(dotMesh)
    anchorMeshes.push(dotMesh)

    const textData = createTextTexture(bld.name)
    if (textData) {
      const spriteMat = new THREE.SpriteMaterial({ map: textData.texture, depthTest: false })
      const sprite = new THREE.Sprite(spriteMat)
      const scaleY = 150
      sprite.scale.set(scaleY * textData.aspect, scaleY, 1)
      sprite.position.set(0, 150, 0)
      sprite.renderOrder = 999
      anchorGroup.add(sprite)
    }

    anchorGroup.position.set(500, -100, 1000) 
    group.add(anchorGroup)
  })
}

const buildFloors = () => {
  buildingGroups.forEach((group, bldId) => {
    const toRemove = group.children.filter(c => c.userData.isFloor || c.userData.isGrid)
    toRemove.forEach(c => group.remove(c))
    
    const bld = store.buildings.find(b => b.id === bldId)
    if (!bld) return

    bld.floors.forEach((floor) => {
      const y = floor.levelIndex * store.viewSettings.floorHeight3D
      
      if (floor.mapPath) {
        new THREE.TextureLoader().load(floor.mapPath, (tex) => {
          const width = tex.image.width
          const height = tex.image.height
          const geometry = new THREE.PlaneGeometry(width, height)
          const material = new THREE.MeshBasicMaterial({ 
            map: tex, 
            transparent: true, 
            opacity: store.viewSettings.mapOpacity, 
            side: THREE.DoubleSide,
            depthWrite: false 
          })
          const plane = new THREE.Mesh(geometry, material)
          plane.rotation.x = -Math.PI / 2
          plane.position.set(width / 2, y, height / 2)
          plane.userData = { isFloor: true, buildingId: bldId, floorId: floor.id }
          group.add(plane)
        })
      }

      const grid = new THREE.GridHelper(1000, 10, 0x888888, 0xcccccc)
      grid.position.set(500, y, 500)
      grid.userData = { isGrid: true, floorId: floor.id }
      group.add(grid)
    })
  })
}

const buildNodes = () => {
  buildingGroups.forEach(group => {
    const toRemove = group.children.filter(c => c.userData.isNode)
    toRemove.forEach(c => group.remove(c))
  })

  const placedNodes = store.nodes.filter(n => n.isPlaced)
  const baseSize = 30
  const nodeSize = baseSize * (store.viewSettings.iconScale3D / 100)
  
  placedNodes.forEach(node => {
    const group = buildingGroups.get(node.buildingId)
    if (!group) return

    const bld = store.buildings.find(b => b.id === node.buildingId)
    const floor = bld?.floors.find(f => f.id === node.floorId)
    const levelIndex = floor ? floor.levelIndex : 0
    const floorY = levelIndex * store.viewSettings.floorHeight3D
    
    const x = node.position?.x || 0
    const z = node.position?.y || 0

    const map = getIconTexture(node.role, node.type)
    const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff })
    const sprite = new THREE.Sprite(material)
    
    sprite.position.set(x, floorY + 20, z) 
    sprite.scale.set(nodeSize, nodeSize, 1)
    
    // 绑定 ID 用于后续查找
    sprite.userData = { id: node.id, isNode: true }
    
    group.add(sprite)
  })
  
  updateNodeVisuals()
}

// [重构] 显隐逻辑更新
const updateVisibility = () => {
  // 1. 更新 Building Group 可见性
  buildingGroups.forEach((group, bldId) => {
    // 只有当 Building 开关打开时，该组才可见
    const isBuildingVisible = visibilityState.buildings[bldId] !== false // 默认为 true
    group.visible = isBuildingVisible

    if (isBuildingVisible) {
      // 2. 遍历组内元素 (Nodes, Floors)
      group.children.forEach(child => {
        // --- 楼层 (Floor Maps & Grids) ---
        if (child.userData.isFloor || child.userData.isGrid) {
          const floorId = child.userData.floorId
          const isFloorVisible = visibilityState.floors[floorId] !== false
          child.visible = isFloorVisible
        }
        
        // --- 设备 (Nodes) ---
        else if (child.userData.isNode) {
          const node = store.nodes.find(n => n.id === child.userData.id)
          if (node) {
            // 逻辑: Building (已由parent控制) AND Floor AND Loop
            const isFloorVisible = visibilityState.floors[node.floorId] !== false
            const isLoopVisible = visibilityState.loops[node.loopId || ''] !== false
            
            // 设置 Sprite 可见性
            child.visible = isFloorVisible && isLoopVisible
          }
        }
      })
    }
  })

  // 3. 更新连线 (Edges)
  updateEdgesGeometry()
}

// [重构] 连线更新逻辑
const updateEdgesGeometry = () => {
  if (!store.viewSettings.showAllLinks && !store.selectedNodeId) {
    edgesGroup.clear()
    return
  }
  
  // 建立节点 ID 到 世界坐标 的映射 (仅包含可见节点)
  const nodeWorldPosMap = new Map<string, THREE.Vector3>()
  const tempVec = new THREE.Vector3()

  buildingGroups.forEach(group => {
    // 如果楼宇隐藏，跳过内部节点
    if (!group.visible) return

    group.children.forEach(child => {
      // 必须是节点，且节点本身可见 (implies Floor & Loop visible)
      if (child.userData.isNode && child.visible && child.userData.id) {
        child.getWorldPosition(tempVec)
        nodeWorldPosMap.set(child.userData.id, tempVec.clone())
      }
    })
  })

  edgesGroup.clear()

  const material = new THREE.LineBasicMaterial({ color: 0x409eff, opacity: 0.6, transparent: true })

  store.edges.forEach(edge => {
    if (!store.viewSettings.showAllLinks) {
      if (edge.sourceId !== store.selectedNodeId && edge.targetId !== store.selectedNodeId) return
    }

    const p1 = nodeWorldPosMap.get(edge.sourceId)
    const p2 = nodeWorldPosMap.get(edge.targetId)
    
    // [关键] 只有两端都在 map 中 (即都可见) 才绘制连线
    if (p1 && p2) {
      const points = [p1, p2]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, material)
      edgesGroup.add(line)
    }
  })
}

const updateNodeVisuals = () => {
  const selectedId = store.selectedNodeId
  const baseSize = 30 * (store.viewSettings.iconScale3D / 100)

  buildingGroups.forEach(group => {
    group.children.forEach((obj) => {
      if (obj instanceof THREE.Sprite && obj.userData.isNode) {
        const id = obj.userData.id
        const isSelected = id === selectedId

        if (isSelected) {
          obj.material.color.set(0xff3300) 
          obj.scale.set(baseSize * 1.5, baseSize * 1.5, 1) 
          obj.renderOrder = 999 
        } else {
          obj.material.color.set(0xffffff) 
          obj.scale.set(baseSize, baseSize, 1)
          obj.renderOrder = 1
        }
      }
    })
  })
}

// --- 交互事件处理 ---

const onPointerDown = (event: MouseEvent) => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)

  const anchorIntersects = raycaster.intersectObjects(anchorMeshes, false)
  if (anchorIntersects.length > 0) {
    const hit = anchorIntersects[0].object
    if (hit.userData.isAnchor) {
      isDraggingBuilding = true
      draggedBuildingId = hit.userData.buildingId
      controls.enabled = false 
      document.body.style.cursor = 'move'
      return 
    }
  }

  // 点击选择节点 (只检测可见的)
  const visibleNodes: THREE.Object3D[] = []
  buildingGroups.forEach(g => {
    if (g.visible) {
      g.children.forEach(c => { if (c.userData.isNode && c.visible) visibleNodes.push(c) })
    }
  })
  
  const nodeIntersects = raycaster.intersectObjects(visibleNodes, false)
  if (nodeIntersects.length > 0) {
    const nodeId = nodeIntersects[0].object.userData.id
    store.selectNode(nodeId)
    store.triggerFocus(nodeId)
  } else {
    store.selectNode(null)
  }
}

const onPointerMove = (event: MouseEvent) => {
  if (!isDraggingBuilding || !draggedBuildingId || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  const intersectPoint = new THREE.Vector3()
  
  raycaster.ray.intersectPlane(dragPlane, intersectPoint)
  
  if (intersectPoint) {
    const group = buildingGroups.get(draggedBuildingId)
    if (group) {
      group.position.x = intersectPoint.x - 500
      group.position.z = intersectPoint.z - 1000
      updateEdgesGeometry()
    }
  }
}

const onPointerUp = () => {
  if (isDraggingBuilding) {
    isDraggingBuilding = false
    draggedBuildingId = null
    controls.enabled = true
    document.body.style.cursor = 'default'
  }
}

// --- 初始化与生命周期 ---

const init = () => {
  if (!containerRef.value) return
  
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f2f5) 
  // [修改] 4. 彻底移除 Fog 以保证远距离清晰度
  scene.fog = null

  camera = new THREE.PerspectiveCamera(15, width / height, 100, 100000)
  
  if (store.viewSettings.camera3D) {
    const { position } = store.viewSettings.camera3D
    camera.position.set(position.x, position.y, position.z)
  } else {
    camera.position.set(5000, 8000, 5000)
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.capabilities.logarithmicDepthBuffer = true 
  containerRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2 - 0.05 
  
  if (store.viewSettings.camera3D) {
    const { target } = store.viewSettings.camera3D
    controls.target.set(target.x, target.y, target.z)
  }

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
  dirLight.position.set(5000, 10000, 5000)
  scene.add(dirLight)

  scene.add(edgesGroup)

  rebuildAll()
  
  containerRef.value.addEventListener('mousedown', onPointerDown)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)

  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

const rebuildAll = () => {
  syncVisibilityState() // 同步数据状态
  initBuildingGroups() 
  buildFloors()        
  buildNodes()         
  updateVisibility()   // 触发一次可见性检查和连线更新
}

const saveViewState = () => {
  if (camera && controls) {
    store.saveViewState(
      undefined, 
      undefined, 
      undefined,
      {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
      }
    )
  }
}

// --- 监听器 ---

// 深度监听 visibilityState 变化
watch(visibilityState, () => { updateVisibility() }, { deep: true })

watch(
  [() => store.viewSettings.floorHeight3D, () => store.viewSettings.iconScale3D], 
  () => { rebuildAll() }
)

watch(() => store.viewSettings.mapOpacity, () => { rebuildAll() })
watch(() => store.viewSettings.showAllLinks, () => { updateEdgesGeometry() })
watch(() => store.structureVersion, () => { rebuildAll() })

watch(() => store.selectedNodeId, () => { 
  updateNodeVisuals() 
  updateEdgesGeometry()
})

const handleResize = () => {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  init()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  saveViewState()
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  if (containerRef.value) {
    containerRef.value.removeEventListener('mousedown', onPointerDown)
  }
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  if(renderer) { renderer.dispose(); renderer.forceContextLoss() }
})

const resetView = () => {
  camera.position.set(5000, 8000, 5000)
  controls.target.set(0, 0, 0)
}
</script>

<template>
  <div class="threed-container">
    
    <!-- Info Panel -->
    <div v-if="selectedNodeInfo" class="info-panel">
      <div class="panel-header">Device Details</div>
      <div class="info-row"><span class="label">设备名称:</span><span class="value highlight">{{ selectedNodeInfo.name }}</span></div>
      <div class="info-row top-align"><span class="label">RSSI:</span><span class="value multiline">{{ selectedNodeInfo.rssi }}</span></div>
      <div class="info-row"><span class="label">设备类别:</span><span class="value">{{ selectedNodeInfo.type }}</span></div>
      <div class="info-row"><span class="label">所属回路:</span><span class="value">{{ selectedNodeInfo.loop }}</span></div>
    </div>

    <!-- Toggle Btn -->
    <div class="toggle-btn" @click="showControls = !showControls" :title="showControls ? 'Hide Controls' : 'Show Controls'">
      <el-icon v-if="showControls" color="#606266"><Hide /></el-icon>
      <el-icon v-else color="#606266"><View /></el-icon>
    </div>

    <!-- Controls Panel -->
    <div class="overlay-controls" v-show="showControls">
      
      <!-- Loops Section -->
      <div class="control-group-box">
        <div class="box-title" @click="expandedSections.loops = !expandedSections.loops">
          <el-icon class="icon-arrow"><component :is="expandedSections.loops ? ArrowDown : ArrowRight" /></el-icon>
          Loops ({{ store.loops.length }})
        </div>
        <div v-show="expandedSections.loops" class="checkbox-list">
          <div v-if="store.loops.length === 0" class="empty-tip">No Loops</div>
          <el-checkbox 
            v-for="loop in store.loops" 
            :key="loop.id" 
            v-model="visibilityState.loops[loop.id]" 
            :label="loop.name" 
            size="small"
          />
        </div>
      </div>

      <!-- Buildings Section -->
      <div class="control-group-box">
        <div class="box-title" @click="expandedSections.buildings = !expandedSections.buildings">
          <el-icon class="icon-arrow"><component :is="expandedSections.buildings ? ArrowDown : ArrowRight" /></el-icon>
          Buildings ({{ store.buildings.length }})
        </div>
        <div v-show="expandedSections.buildings" class="checkbox-list">
          <div v-if="store.buildings.length === 0" class="empty-tip">No Buildings</div>
          <el-checkbox 
            v-for="bld in store.buildings" 
            :key="bld.id" 
            v-model="visibilityState.buildings[bld.id]" 
            :label="bld.name" 
            size="small"
          />
        </div>
      </div>

      <!-- Floors Section -->
      <div class="control-group-box">
        <div class="box-title" @click="expandedSections.floors = !expandedSections.floors">
          <el-icon class="icon-arrow"><component :is="expandedSections.floors ? ArrowDown : ArrowRight" /></el-icon>
          Floors ({{ floorList.length }})
        </div>
        <div v-show="expandedSections.floors" class="checkbox-list scrollable">
          <div v-if="floorList.length === 0" class="empty-tip">No Floors</div>
          <el-checkbox 
            v-for="floor in floorList" 
            :key="floor.id" 
            v-model="visibilityState.floors[floor.id]" 
            :label="floor.name" 
            size="small"
            :title="floor.name"
          />
        </div>
      </div>

      <div class="divider"></div>

      <div class="control-item">
        <span class="label">Floor Height</span>
        <input class="input-num" type="number" v-model.number="store.viewSettings.floorHeight3D" step="10">
      </div>
      
      <div class="control-item">
        <span class="label">Icon Size</span>
        <input type="range" v-model.number="store.viewSettings.iconScale3D" min="10" max="300" step="10">
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
.threed-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none; 
}

.scene-container {
  width: 100%;
  height: 100%;
  cursor: default; 
}

.overlay-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 240px; 
  backdrop-filter: blur(5px);
  margin-top: 40px;
  max-height: calc(100% - 60px); /* 防止面板超出屏幕 */
  overflow-y: auto; /* 允许滚动 */
}

.control-group-box {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.box-title {
  font-size: 11px;
  color: #333;
  font-weight: bold;
  padding: 6px 8px;
  background: #f5f7fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}
.box-title:hover {
  background: #e6e8eb;
}

.checkbox-list {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.checkbox-list.scrollable {
  max-height: 150px;
  overflow-y: auto;
}

/* 覆盖 Element Checkbox 样式 */
.checkbox-list :deep(.el-checkbox) {
  margin-right: 0;
  height: 20px;
  width: 100%;
  justify-content: flex-start;
}
.checkbox-list :deep(.el-checkbox__label) {
  font-size: 11px;
  padding-left: 6px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-tip {
  font-size: 11px;
  color: #c0c4cc;
  padding: 4px;
  text-align: center;
}

.divider {
  height: 1px;
  background: #ebeef5;
  margin: 4px 0;
}

.toggle-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  z-index: 11;
  transition: transform 0.2s;
}
.toggle-btn:hover {
  background: #f5f7fa;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.control-item .label {
  font-size: 12px;
  color: #606266;
  font-weight: bold;
}
.control-item input[type=range] {
  width: 100%;
  cursor: pointer;
}

.input-num {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  box-sizing: border-box; 
}
.input-num:focus {
  border-color: #409eff;
  outline: none;
}

/* Info Panel Styles */
.info-panel {
  position: absolute;
  top: 10px;
  right: 10px; 
  width: 280px; 
  background: rgba(30, 30, 30, 0.9); 
  color: #fff;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 20;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.panel-header {
  font-size: 14px;
  font-weight: 700;
  color: #409eff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.4;
}
.info-row.top-align { align-items: flex-start; }
.info-row:last-child { margin-bottom: 0; }
.info-row .label { color: #a0a0a0; flex-shrink: 0; margin-right: 10px; }
.info-row .value { color: #e0e0e0; text-align: right; word-break: break-all; }
.info-row .value.multiline { white-space: pre-wrap; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; }
.info-row .value.highlight { color: #fff; font-weight: bold; }
</style>