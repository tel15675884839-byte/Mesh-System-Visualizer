<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, reactive } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useProjectStore } from '../stores/projectStore'
import { IconRegistry } from '../utils/iconAssets'
import { DeviceRole, DeviceType } from '../types'
import { Hide, View, ArrowDown, ArrowRight, Place, Refresh } from '@element-plus/icons-vue'

const containerRef = ref<HTMLElement | null>(null)
const store = useProjectStore()

// UI 面板显示状态
const showControls = ref(true)

// [新增] 折叠状态控制
const expandedSections = reactive({
  loops: true,
  buildings: true,
  buildingFloors: {} as Record<string, boolean> // 存储每个建筑的展开状态
})

// [重构] 动态显隐状态字典 (Key: ID, Value: boolean)
const visibilityState = reactive({
  loops: {} as Record<string, boolean>,
  buildings: {} as Record<string, boolean>,
  floors: {} as Record<string, boolean>
})

// 初始化/同步可见性状态
const syncVisibilityState = (): void => {
  // Loops
  store.loops.forEach((l) => {
    if (visibilityState.loops[l.id] === undefined) visibilityState.loops[l.id] = true
  })
  // Buildings & Floors
  store.buildings.forEach((b) => {
    if (visibilityState.buildings[b.id] === undefined) visibilityState.buildings[b.id] = true
    if (expandedSections.buildingFloors[b.id] === undefined)
      expandedSections.buildingFloors[b.id] = true

    b.floors.forEach((f) => {
      if (visibilityState.floors[f.id] === undefined) visibilityState.floors[f.id] = true
    })
  })
}

// [新增] 切换建筑可见性时同步切换其下所有楼层
const toggleBuildingVisibility = (bldId: string, val: boolean): void => {
  visibilityState.buildings[bldId] = val
  const bld = store.buildings.find((b) => b.id === bldId)
  if (bld) {
    bld.floors.forEach((f) => {
      visibilityState.floors[f.id] = val
    })
  }
}

// [新增] 楼层高度与缩放状态 (初始化从 store 加载)
const floorScales = reactive<Record<string, number>>({})
const floorHeights = reactive<Record<string, number>>({})

const initFloorData = (): void => {
  store.buildings.forEach((b) => {
    b.floors.forEach((f) => {
      floorScales[f.id] = f.floorScale3D || 1
      floorHeights[f.id] = f.floorHeight3D || store.viewSettings.floorHeight3D || 30
    })
  })
}
watch(
  () => store.buildings,
  () => {
    initFloorData()
  },
  { immediate: true, deep: true }
)

// [新增] 辅助函数：获取楼层在 3D 中的累加 Y 坐标
const getFloorY = (bldId: string, floorId: string): number => {
  const bld = store.buildings.find((b) => b.id === bldId)
  if (!bld) return 0

  // 按照 levelIndex 排序确保累加顺序正确
  const sortedFloors = [...bld.floors].sort((a, b) => (a.levelIndex || 0) - (b.levelIndex || 0))

  let y = 0
  for (const f of sortedFloors) {
    if (f.id === floorId) break
    const h = floorHeights[f.id] || store.viewSettings.floorHeight3D || 30
    y += h
  }
  return y
}

// [新增] 更新楼层高度逻辑
const updateFloorHeight = (bldId: string, floorId: string, height: number): void => {
  if (height < 0) height = 0
  floorHeights[floorId] = height
  store.updateFloorHeight3D(bldId, floorId, height)
  updateBuildingYPositions(bldId)
}

// [关键修复] 实时更新选中建筑内所有楼层的 Y 轴高度
const updateBuildingYPositions = (bldId: string): void => {
  const group = buildingGroups.get(bldId)
  if (!group) return

  const bld = store.buildings.find((b) => b.id === bldId)
  if (!bld) return

  // 1. 遍历组内所有对象
  group.children.forEach((child) => {
    // 处理 Floor Plane 和 Handle
    if (child.userData.floorId) {
      const fId = child.userData.floorId
      const newY = getFloorY(bldId, fId)
      // Plane
      if (child.userData.isFloor) {
        child.position.y = newY
      }
      // Handle
      else if (child.userData.isResizeHandle) {
        child.position.y = newY
      }
      // Nodes
      else if (child.userData.isNode || child.userData.isNodeBorder) {
        // Nodes 还要加上 3 的偏移
        child.position.y = newY + 3
      }
    }
  })

  // 2. 也是非常关键：更新连线
  updateEdgesGeometry()
}

// [新增] 拖拽状态管理
const dragState = reactive<{
  isDragging: boolean
  floorId: string | null
  buildingId: string | null
  startMouse: THREE.Vector2
  startScale: number
  // [新增] 区分点击和拖拽
  mouseDownPos: THREE.Vector2
  isClickCandidate: boolean
}>({
  isDragging: false,
  floorId: null,
  buildingId: null,
  startMouse: new THREE.Vector2(),
  startScale: 1,
  // [新增] 区分点击和拖拽
  mouseDownPos: new THREE.Vector2(),
  isClickCandidate: false
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

// 缓存与组
const textureCache: Record<string, THREE.Texture> = {}
const circleTextureCache: Record<string, THREE.Texture> = {}
const edgesGroup = new THREE.Group()
const highlightedEdgesGroup = new THREE.Group() // [新增] 高亮连线组
const buildingGroups = new Map<string, THREE.Group>()

// --- 计算属性 ---
const selectedNodeInfo = computed(() => {
  const node = store.selectedNode
  if (!node) return null
  const loop = store.loops.find((l) => l.id === node.loopId)
  const connectedEdges = store.edges.filter((e) => e.sourceId === node.id || e.targetId === node.id)

  const rssiDetails = connectedEdges.map((e) => {
    const isSource = e.sourceId === node.id
    const otherId = isSource ? e.targetId : e.sourceId
    const myName = store.getDisplayId(node.id)
    const otherName = store.getDisplayId(otherId)
    const val = e.rssi !== undefined ? e.rssi : 'N/A'
    return `${myName} → ${otherName} ${val} dBm`
  })

  let linksText = rssiDetails.length > 0 ? rssiDetails.slice(0, 5).join('\n') : 'No Connections'

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
const getTexture = (url: string): THREE.Texture => {
  if (textureCache[url]) return textureCache[url]
  const texture = new THREE.TextureLoader().load(url)
  textureCache[url] = texture
  return texture
}

const getIconTexture = (role: string, type: string): THREE.Texture => {
  if (role === DeviceRole.LEADER) return getTexture(IconRegistry.LEADER)
  if (role === DeviceRole.ROUTER) return getTexture(IconRegistry.ROUTER)
  switch (type) {
    case DeviceType.SMOKE_DETECTOR:
      return getTexture(IconRegistry.SMOKE)
    case DeviceType.HEAT_DETECTOR:
      return getTexture(IconRegistry.HEAT)
    case DeviceType.MULT_DETECTOR:
      return getTexture(IconRegistry.HEAT)
    case DeviceType.MANUAL_CALL_POINT:
      return getTexture(IconRegistry.MCP)
    case DeviceType.IO_MODULE:
      return getTexture(IconRegistry.IO)
    case DeviceType.SOUNDER:
      return getTexture(IconRegistry.SOUNDER)
    default:
      return getTexture(IconRegistry.SMOKE)
  }
}

// [新增] 生成圆形边框（作为图标背景，通过轮廓保证可见度）
const getCircleTexture = (): THREE.Texture => {
  const cacheKey = 'default_circle'
  if (circleTextureCache[cacheKey]) return circleTextureCache[cacheKey]
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.beginPath()
    ctx.arc(64, 64, 60, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  circleTextureCache[cacheKey] = texture
  return texture
}

const createTextTexture = (
  text: string
): { texture: THREE.CanvasTexture; aspect: number } | null => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const fontSize = 48
  ctx.font = `bold ${fontSize}px Arial`
  const textWidth = ctx.measureText(text).width
  canvas.width = textWidth + 20
  canvas.height = fontSize + 20

  // 绘制圆角背景以增强可读性
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.roundRect(0, 0, canvas.width, canvas.height, 10)
  ctx.fill()

  ctx.fillStyle = '#1a1a1a'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return { texture, aspect: canvas.width / canvas.height }
}

// --- 场景构建 ---

const initBuildingGroups = (): void => {
  buildingGroups.forEach((g) => scene.remove(g))
  buildingGroups.clear()

  store.buildings.forEach((bld, index) => {
    const group = new THREE.Group()

    // [修改] 使用 store 中的 position，如果没有则使用默认
    // 3D 坐标系 (x, z) 对应 2D (x, y)，这里直接映射米
    const posX = bld.position?.x ?? index * 150 - 150
    const posZ = bld.position?.y ?? 0

    group.position.set(posX, 0, posZ)
    group.rotation.y = -(bld.rotation ?? 0) * (Math.PI / 180) // 角度转弧度，反向以匹配 2D 坐标系转动
    group.userData = { buildingId: bld.id }

    scene.add(group)
    buildingGroups.set(bld.id, group)

    const labelGroup = new THREE.Group()
    labelGroup.userData = { isLabel: true }
    const textData = createTextTexture(bld.name)
    if (textData) {
      const spriteMat = new THREE.SpriteMaterial({
        map: textData.texture,
        depthTest: false,
        depthWrite: false
      })
      const sprite = new THREE.Sprite(spriteMat)
      const scaleY = 8 // 进一步缩小字体
      sprite.scale.set(scaleY * textData.aspect, scaleY, 1)
      // 放置在建筑侧方（X 轴偏移），高度略微抬升
      sprite.position.set(-60, 5, 0)
      sprite.renderOrder = 9999
      labelGroup.add(sprite)
    }

    // 默认位置：固定在 (-60, 5, 0)，不随图纸大小改变
    labelGroup.position.set(-60, 5, 0)
    group.add(labelGroup)
  })
}

const PIXELS_PER_METER = 10 // 10 像素 = 1 米，用于将 2D 像素映射为 3D 米

const buildFloors = (): void => {
  buildingGroups.forEach((group, bldId) => {
    const toRemove = group.children.filter((c) => c.userData.isFloor)
    toRemove.forEach((c) => group.remove(c))

    const bld = store.buildings.find((b) => b.id === bldId)
    if (!bld) return

    bld.floors.forEach((floor) => {
      const y = getFloorY(bldId, floor.id)

      if (floor.mapPath) {
        const cachedTex = textureCache[floor.mapPath]
        const onTexLoad = (tex: THREE.Texture): void => {
          // [核心逻辑] 建筑尺寸由底图像素决定，确保 3D 比例与 2D 底图完全一致
          // 不再由用户手动调节宽度，而是使用固定比例：10px = 1m
          const img = tex.image as HTMLImageElement
          const width = (floor.mapWidth ?? img?.width ?? 100) / PIXELS_PER_METER
          const height = (floor.mapHeight ?? img?.height ?? 70) / PIXELS_PER_METER

          const geometry = new THREE.PlaneGeometry(width, height)
          const material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: store.viewSettings.mapOpacity,
            side: THREE.DoubleSide,
            depthWrite: store.viewSettings.mapOpacity > 0.8
          })
          const plane = new THREE.Mesh(geometry, material)
          plane.rotation.x = -Math.PI / 2

          // [自动对齐] 中心对齐
          plane.position.set(0, y, 0)

          plane.userData = { isFloor: true, buildingId: bldId, floorId: floor.id }
          group.add(plane)

          // [新增] 缩放控制柄 (Cube)
          const handleGeo = new THREE.BoxGeometry(2, 2, 2)
          const handleMat = new THREE.MeshBasicMaterial({ color: 0x409eff })
          const handle = new THREE.Mesh(handleGeo, handleMat)
          // 放在右下角 (X正, Z正)
          handle.position.set(width / 2, y, height / 2)
          handle.userData = {
            isResizeHandle: true,
            floorId: floor.id,
            buildingId: bldId,
            originalWidth: width,
            originalHeight: height
          }
          group.add(handle)

          // 初始化缩放 (如果有 saved scale)
          const currentScale = floorScales[floor.id] || 1
          plane.scale.set(currentScale, currentScale, 1)
          handle.position.set((width / 2) * currentScale, y, (height / 2) * currentScale)
        }

        if (cachedTex) {
          onTexLoad(cachedTex)
        } else {
          new THREE.TextureLoader().load(floor.mapPath, onTexLoad)
        }
      }
    })
  })
}

// --- 动态更新方法 (无闪烁) ---

const updateMapOpacity = (): void => {
  const opacity = store.viewSettings.mapOpacity
  buildingGroups.forEach((group) => {
    group.children.forEach((child) => {
      if (child.userData.isFloor && child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshBasicMaterial
        mat.opacity = opacity
        mat.depthWrite = opacity > 0.8
        mat.needsUpdate = true
      }
    })
  })
}

const BASE_ICON_SIZE = 5

const updateIconScale = (): void => {
  const baseSize = BASE_ICON_SIZE * (store.viewSettings.iconScale3D / 100)
  buildingGroups.forEach((group) => {
    group.children.forEach((child) => {
      if ((child.userData.isNode || child.userData.isNodeBorder) && child instanceof THREE.Sprite) {
        const isSelected = child.userData.id === store.selectedNodeId
        const s = isSelected ? baseSize * 1.5 : baseSize
        if (child.userData.isNodeBorder) {
          child.scale.set(s * 1.3, s * 1.3, 1)
        } else {
          child.scale.set(s, s, 1)
        }
      }
    })
  })
}

const buildNodes = (): void => {
  buildingGroups.forEach((group) => {
    const toRemove = group.children.filter((c) => c.userData.isNode || c.userData.isNodeBorder)
    toRemove.forEach((c) => group.remove(c))
  })

  const placedNodes = store.nodes.filter((n) => n.isPlaced)
  const nodeSize = BASE_ICON_SIZE * (store.viewSettings.iconScale3D / 100)

  placedNodes.forEach((node) => {
    const group = buildingGroups.get(node.buildingId)
    if (!group) return

    const bld = store.buildings.find((b) => b.id === node.buildingId)
    const floor = bld?.floors.find((f) => f.id === node.floorId)
    if (!floor || !floor.mapWidth || !floor.mapHeight) return

    const floorY = getFloorY(node.buildingId, node.floorId)

    // [要求2] 设备与图纸高度改为 20 -> 用户改为 3
    const deviceY = floorY + 3

    const worldWidth = floor.mapWidth / PIXELS_PER_METER
    const worldHeight = floor.mapHeight / PIXELS_PER_METER

    // [新增] 应用缩放因子
    const scale = floorScales[floor.id] || 1

    const x = (node.position!.x / floor.mapWidth - 0.5) * worldWidth * scale
    const z = (node.position!.y / floor.mapHeight - 0.5) * worldHeight * scale

    // [要求1] 圆形颜色边框/背景
    let borderColor = 0x409eff // 默认蓝色
    if (node.role === DeviceRole.LEADER)
      borderColor = 0xffd700 // Leader 黄色
    else if (node.role === DeviceRole.ROUTER) borderColor = 0x67c23a // Router 绿色

    const borderTex = getCircleTexture()
    const borderMaterial = new THREE.SpriteMaterial({
      map: borderTex,
      color: borderColor,
      depthTest: true,
      depthWrite: false
    })
    const borderSprite = new THREE.Sprite(borderMaterial)
    borderSprite.position.set(x, deviceY, z)
    borderSprite.scale.set(nodeSize * 1.3, nodeSize * 1.3, 1)
    borderSprite.userData = { id: node.id, isNodeBorder: true }
    borderSprite.renderOrder = 10
    group.add(borderSprite)

    // 图标
    const map = getIconTexture(node.role, node.type)
    const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff })
    const sprite = new THREE.Sprite(material)

    sprite.position.set(x, deviceY, z)
    sprite.scale.set(nodeSize, nodeSize, 1)
    sprite.userData = { id: node.id, isNode: true }
    sprite.renderOrder = 11 // 确保在背景之上
    group.add(sprite)
  })

  updateNodeVisuals()
}

// [重构] 显隐逻辑更新
const updateVisibility = (): void => {
  // 1. 更新 Building Group 可见性
  buildingGroups.forEach((group, bldId) => {
    // 只有当 Building 开关打开时，该组才可见
    const isBuildingVisible = visibilityState.buildings[bldId] !== false // 默认为 true
    group.visible = isBuildingVisible

    if (isBuildingVisible) {
      // 2. 遍历组内元素 (Nodes, Floors)
      group.children.forEach((child) => {
        // --- 楼层 (Floor Maps & Grids) ---
        if (child.userData.isFloor || child.userData.isGrid) {
          const floorId = child.userData.floorId
          const isFloorVisible = visibilityState.floors[floorId] !== false
          child.visible = isFloorVisible
        }

        // --- 设备 (Nodes) ---
        else if (child.userData.isNode || child.userData.isNodeBorder) {
          const node = store.nodes.find((n) => n.id === child.userData.id)
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
  // 3. 更新连线 (Edges)
  updateEdgesGeometry()
}

// [重构] 连线更新逻辑
const updateEdgesGeometry = (): void => {
  if (!store.viewSettings.showAllLinks && !store.selectedNodeId) {
    edgesGroup.clear()
    highlightedEdgesGroup.clear()
    return
  }

  // 建立节点 ID 到 世界坐标 的映射 (仅包含可见节点)
  const nodeWorldPosMap = new Map<string, THREE.Vector3>()
  const tempVec = new THREE.Vector3()

  buildingGroups.forEach((group) => {
    // 如果楼宇隐藏，跳过内部节点
    if (!group.visible) return

    group.children.forEach((child) => {
      // 必须是节点，且节点本身可见 (implies Floor & Loop visible)
      if (child.userData.isNode && child.visible && child.userData.id) {
        child.getWorldPosition(tempVec)
        nodeWorldPosMap.set(child.userData.id, tempVec.clone())
      }
    })
  })

  edgesGroup.clear()
  highlightedEdgesGroup.clear()

  // 普通连线材质
  const material = new THREE.LineBasicMaterial({ color: 0x409eff, opacity: 0.3, transparent: true })
  // 高亮连线材质 (亮橙色，完全不透明)
  const highlightMaterial = new THREE.LineBasicMaterial({
    color: 0xff4500, // OrangeRed
    opacity: 1.0,
    linewidth: 2 // 注意：WebGL 默认不支持 linewidth > 1，但在某些实现中可能有效
  })

  const normalPoints: THREE.Vector3[] = []
  // const highlightPoints: THREE.Vector3[] = []

  // 辅助：单独绘制每条高亮线以避免各类连线混连问题 (LineSegments 更好，但为了简单逻辑先用 Line Loop 的变体或者分开画)
  // 为了性能，通常用 LineSegments。这里为了简单区分高亮，我们分开处理。

  store.edges.forEach((edge) => {
    if (!store.viewSettings.showAllLinks) {
      // 如果不是全显示模式，且并未选中相关节点，也不是高亮路径的一部分，则跳过
      const isRelated =
        edge.sourceId === store.selectedNodeId || edge.targetId === store.selectedNodeId
      const isHighlighted = store.highlightedPath.has(edge.id)

      if (!isRelated && !isHighlighted) return
    }

    const p1 = nodeWorldPosMap.get(edge.sourceId)
    const p2 = nodeWorldPosMap.get(edge.targetId)

    // [关键] 只有两端都在 map 中 (即都可见) 才绘制连线
    if (p1 && p2) {
      if (store.highlightedPath.has(edge.id)) {
        // 高亮连线独立绘制，保证层级和样式
        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2])
        const line = new THREE.Line(geo, highlightMaterial)
        // 渲染顺序调高，保证覆盖在普通线上
        line.renderOrder = 999
        // 稍微抬高一点 Y 轴避免 Z-fighting
        line.position.y += 0.5
        highlightedEdgesGroup.add(line)
      } else {
        // 普通连线收集起来批量绘制 (LineSegments)
        normalPoints.push(p1, p2)
      }
    }
  })

  if (normalPoints.length > 0) {
    const geometry = new THREE.BufferGeometry().setFromPoints(normalPoints)
    const lines = new THREE.LineSegments(geometry, material)
    edgesGroup.add(lines)
  }
}

const updateNodeVisuals = (): void => {
  const selectedId = store.selectedNodeId
  const baseSize = BASE_ICON_SIZE * (store.viewSettings.iconScale3D / 100)

  buildingGroups.forEach((group) => {
    group.children.forEach((obj) => {
      if (obj instanceof THREE.Sprite && (obj.userData.isNode || obj.userData.isNodeBorder)) {
        const id = obj.userData.id
        const isSelected = id === selectedId
        const isBorder = !!obj.userData.isNodeBorder

        const s = isSelected ? baseSize * 1.5 : baseSize

        if (isBorder) {
          // 边框逻辑
          const node = store.nodes.find((n) => n.id === id)
          let borderColor = 0x409eff
          if (node) {
            if (node.role === DeviceRole.LEADER) borderColor = 0xffd700
            else if (node.role === DeviceRole.ROUTER) borderColor = 0x67c23a
          }

          if (isSelected) {
            obj.material.color.set(0xffffff) // 选中时变成纯白背景以突出
          } else {
            obj.material.color.set(borderColor)
          }
          obj.scale.set(s * 1.3, s * 1.3, 1)
          obj.renderOrder = isSelected ? 998 : 10
        } else {
          // 图标逻辑
          if (isSelected) {
            obj.material.color.set(0xff3300)
            obj.scale.set(s, s, 1)
            obj.renderOrder = 999
          } else {
            obj.material.color.set(0xffffff)
            obj.scale.set(s, s, 1)
            obj.renderOrder = 11
          }
        }
      }
    })
  })
}

// [新增] 监听建筑位置变化，实时更新 3D 视图
watch(
  () => store.buildings,
  (newVal) => {
    newVal.forEach((bld) => {
      const group = buildingGroups.get(bld.id)
      if (group && bld.position) {
        group.position.set(bld.position.x, 0, bld.position.y)
        // 同步旋转 (Degrees -> Radians)
        // 注意：2D 的 Y 对应 3D 的 Z，旋转轴是 3D 的 Y 轴
        group.rotation.y = -(bld.rotation ?? 0) * (Math.PI / 180)
      }
    })
    updateEdgesGeometry() // 同步更新连线位置
  },
  { deep: true }
)

// [新增] 打开布局编辑器前校验
const openLayoutEditor = (): void => {
  console.log('Opening Layout Editor...')
  store.toggleLayoutEditor(true)
}

// --- 交互事件处理 ---

// [新增] 更新楼层缩放视觉效果 (重构以支持直接调用)
const updateFloorScaleVisuals = (bldId: string, floorId: string, scale: number): void => {
  const group = buildingGroups.get(bldId)
  if (!group) return

  // 1. 更新 Floor Plane Scale + Handle Position
  let originalW = 100,
    originalH = 70
  group.children.forEach((c) => {
    // Plane
    if (c.userData.isFloor && c.userData.floorId === floorId) {
      c.scale.set(scale, scale, 1)
    }
    // Handle
    if (c.userData.isResizeHandle && c.userData.floorId === floorId) {
      originalW = c.userData.originalWidth
      originalH = c.userData.originalHeight
      const y = c.position.y
      c.position.set((originalW / 2) * scale, y, (originalH / 2) * scale)
    }
  })

  // 2. 更新 Label Position - 已移除，改为固定位置

  // 3. 更新该楼层所有 Node 的 Position
  const bld = store.buildings.find((b) => b.id === bldId)
  const floor = bld?.floors.find((f) => f.id === floorId)
  if (!floor || !floor.mapWidth || !floor.mapHeight) return

  const worldWidth = floor.mapWidth / PIXELS_PER_METER
  const worldHeight = floor.mapHeight / PIXELS_PER_METER

  group.children.forEach((c) => {
    if ((c.userData.isNode || c.userData.isNodeBorder) && c instanceof THREE.Sprite) {
      const node = store.nodes.find((n) => n.id === c.userData.id)
      if (node && node.floorId === floorId && node.position) {
        const x = (node.position.x / floor.mapWidth! - 0.5) * worldWidth * scale
        const z = (node.position.y / floor.mapHeight! - 0.5) * worldHeight * scale
        c.position.x = x
        c.position.z = z
      }
    }
  })

  updateEdgesGeometry()
}

const resetFloorScale = (bldId: string, floorId: string): void => {
  floorScales[floorId] = 1
  updateFloorScaleVisuals(bldId, floorId, 1)
  store.updateFloorScale3D(bldId, floorId, 1)
}

const onPointerDown = (event: MouseEvent): void => {
  if (!containerRef.value) return

  // 记录初始位置，用于区分点击和拖拽
  dragState.mouseDownPos.set(event.clientX, event.clientY)
  dragState.isClickCandidate = true

  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // 1. 检测是否点击了 Resize Handle (依然保留 mousedown 触发，因为拖拽需要立即响应)
  const resizeHandles: THREE.Object3D[] = []
  buildingGroups.forEach((g) => {
    if (g.visible) {
      g.children.forEach((c) => {
        if (c.userData.isResizeHandle) resizeHandles.push(c)
      })
    }
  })

  const handleIntersects = raycaster.intersectObjects(resizeHandles, false)
  if (handleIntersects.length > 0) {
    const handle = handleIntersects[0].object
    dragState.isDragging = true
    dragState.floorId = handle.userData.floorId
    dragState.buildingId = handle.userData.buildingId
    dragState.startMouse.set(event.clientX, event.clientY)
    dragState.startScale = floorScales[handle.userData.floorId] || 1
    controls.enabled = false // 禁用轨道控制器
    dragState.isClickCandidate = false // 既然是拖拽 Handle，肯定不是点击设备
    return
  }

  // 注意：原有的点击选择逻辑已移除，移动到了 onPointerUp 中
}

const onDoubleClick = (): void => {
  // 双击时触发 FocusReq
  if (store.selectedNodeId) {
    store.triggerTreeFocus(store.selectedNodeId)
  }
}

const onPointerMove = (event: MouseEvent): void => {
  if (dragState.isDragging && dragState.floorId) {
    if (!event.ctrlKey) return // 必须按住 Ctrl 才能缩放

    const deltaX = event.clientX - dragState.startMouse.x
    // 简单灵敏度：每 100px 增加 0.1 倍
    const scaleDelta = deltaX * 0.005
    let newScale = dragState.startScale + scaleDelta
    if (newScale < 0.1) newScale = 0.1 // 最小限制

    floorScales[dragState.floorId] = newScale
    updateFloorScaleVisuals(dragState.buildingId!, dragState.floorId, newScale)

    // 同步到 store 中持久化
    store.updateFloorScale3D(dragState.buildingId!, dragState.floorId, newScale)
  }
}

const onPointerUp = (event: MouseEvent): void => {
  // 处理 Floor Resize 拖拽结束
  if (dragState.isDragging) {
    dragState.isDragging = false
    dragState.floorId = null
    controls.enabled = true
    dragState.isClickCandidate = false
    return
  }

  // [修改] 实现 "Click vs Drag" 逻辑
  if (dragState.isClickCandidate) {
    const dist = dragState.mouseDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY))
    // 阈值设为 5px，小幅度抖动不算拖拽
    if (dist < 5) {
      handleSelectionClick(event)
    }
    dragState.isClickCandidate = false
  }
}

// [新增] 专门处理选择的点击逻辑
const handleSelectionClick = (event: MouseEvent): void => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // 点击选择节点 (只检测可见的)
  const visibleNodes: THREE.Object3D[] = []
  buildingGroups.forEach((g) => {
    if (g.visible) {
      g.children.forEach((c) => {
        if (c.userData.isNode && c.visible) visibleNodes.push(c)
      })
    }
  })

  const nodeIntersects = raycaster.intersectObjects(visibleNodes, false)
  if (nodeIntersects.length > 0) {
    const nodeId = nodeIntersects[0].object.userData.id
    store.selectNode(nodeId)
  } else {
    // 只有明确点击了空白处且没有拖拽，才取消选择
    store.selectNode(null)
  }
}

// --- 初始化与生命周期 ---

const init = (): void => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f2f5)
  // [修改] 4. 彻底移除 Fog 以保证远距离清晰度
  scene.fog = null

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 20000)

  if (store.viewSettings.camera3D) {
    camera.position.set(150, 300, 400)
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
  dirLight.position.set(200, 500, 200)
  scene.add(dirLight)

  scene.add(edgesGroup)
  scene.add(highlightedEdgesGroup) // [新增]

  rebuildAll()

  containerRef.value.addEventListener('mousedown', onPointerDown)
  containerRef.value.addEventListener('dblclick', onDoubleClick)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)

  animate()
}

const animate = (): void => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

const rebuildAll = (): void => {
  syncVisibilityState() // 同步数据状态
  initBuildingGroups()
  buildFloors()
  buildNodes()
  updateVisibility() // 触发一次可见性检查和连线更新
}

const saveViewState = (): void => {
  if (camera && controls) {
    store.saveViewState(undefined, undefined, undefined, {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
    })
  }
}

// --- 监听器 ---

// 深度监听 visibilityState 变化
watch(
  visibilityState,
  () => {
    updateVisibility()
  },
  { deep: true }
)

// 楼层高度变化仍需重建（涉及坐标计算）
watch(
  () => store.viewSettings.floorHeight3D,
  () => {
    rebuildAll()
  }
)
watch(floorHeights, () => rebuildAll(), { deep: true })

// 图标缩放与透明度采用增量更新，防止重建导致的闪烁
watch(
  () => store.viewSettings.iconScale3D,
  () => {
    updateIconScale()
  }
)
watch(
  () => store.viewSettings.mapOpacity,
  () => {
    updateMapOpacity()
  }
)

watch(
  () => store.viewSettings.showAllLinks,
  () => {
    updateEdgesGeometry()
  }
)
watch(
  () => store.structureVersion,
  () => {
    rebuildAll()
  }
)

watch(
  () => store.selectedNodeId,
  () => {
    updateNodeVisuals() // 内部已处理缩放
    updateEdgesGeometry()
  }
)

watch(
  () => store.focusRequest,
  (req) => {
    if (!req || !camera || !controls) return
    const node = store.nodes.find((n) => n.id === req.nodeId)
    if (!node || !node.isPlaced) return

    const group = buildingGroups.get(node.buildingId)
    if (!group) return

    const sprite = group.children.find((c) => c.userData.id === node.id)
    if (!sprite) return

    const worldPos = new THREE.Vector3()
    sprite.getWorldPosition(worldPos)

    // 中平。直接跳，以后有 TWEEN 再加过渡
    controls.target.copy(worldPos)
    // 固定视角高度
    camera.position.set(worldPos.x + 50, worldPos.y + 100, worldPos.z + 50)
    controls.update()
  }
)

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
    containerRef.value.removeEventListener('dblclick', onDoubleClick)
  }
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
})

const resetView = (): void => {
  if (!camera || !controls) return
  camera.position.set(150, 300, 400)
  controls.target.set(0, 0, 0)
}

// [新增] 跳转至 2D 视图
const goToFloor2D = (bldId: string, floorId: string): void => {
  store.viewSettings.lastBuildingId = bldId
  store.viewSettings.lastFloorId = floorId
  store.switchViewMode('2D')
}
</script>

<template>
  <div class="threed-container">
    <!-- Info Panel -->
    <div v-if="selectedNodeInfo" class="info-panel">
      <div class="panel-header">Device Details</div>
      <div class="info-row">
        <span class="label">设备名称:</span
        ><span class="value highlight">{{ selectedNodeInfo.name }}</span>
      </div>
      <div class="info-row top-align">
        <span class="label">RSSI:</span
        ><span class="value multiline">{{ selectedNodeInfo.rssi }}</span>
      </div>
      <div class="info-row">
        <span class="label">设备类别:</span><span class="value">{{ selectedNodeInfo.type }}</span>
      </div>
      <div class="info-row">
        <span class="label">所属回路:</span><span class="value">{{ selectedNodeInfo.loop }}</span>
      </div>
    </div>

    <!-- Toggle Btn -->
    <div
      class="toggle-btn"
      :title="showControls ? 'Hide Controls' : 'Show Controls'"
      @click="showControls = !showControls"
    >
      <el-icon v-if="showControls" color="#606266"><Hide /></el-icon>
      <el-icon v-else color="#606266"><View /></el-icon>
    </div>

    <!-- Controls Panel -->
    <div v-show="showControls" class="overlay-controls">
      <!-- Layout Config Button -->
      <div style="margin-bottom: 5px">
        <el-button
          type="primary"
          size="small"
          :icon="Place"
          style="
            width: 100%;
            font-weight: bold;
            --el-button-text-color: #ffffff;
            --el-button-hover-text-color: #ffffff;
          "
          @click="openLayoutEditor"
        >
          布局配置 (2D)
        </el-button>
      </div>
      <!-- Loops Section -->
      <div class="control-group-box">
        <div class="box-title" @click="expandedSections.loops = !expandedSections.loops">
          <el-icon class="icon-arrow"
            ><component :is="expandedSections.loops ? ArrowDown : ArrowRight"
          /></el-icon>
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

      <!-- Buildings & Floors Section -->
      <div class="control-group-box">
        <div class="box-title" @click="expandedSections.buildings = !expandedSections.buildings">
          <el-icon class="icon-arrow"
            ><component :is="expandedSections.buildings ? ArrowDown : ArrowRight"
          /></el-icon>
          Buildings ({{ store.buildings.length }})
        </div>
        <div v-show="expandedSections.buildings" class="nested-list">
          <div v-if="store.buildings.length === 0" class="empty-tip">No Buildings</div>

          <div v-for="bld in store.buildings" :key="bld.id" class="building-item">
            <div class="building-header">
              <el-icon
                class="sub-arrow"
                @click.stop="
                  expandedSections.buildingFloors[bld.id] = !expandedSections.buildingFloors[bld.id]
                "
              >
                <component :is="expandedSections.buildingFloors[bld.id] ? ArrowDown : ArrowRight" />
              </el-icon>
              <el-checkbox
                :model-value="visibilityState.buildings[bld.id]"
                size="small"
                class="bld-checkbox"
                @change="(val: boolean) => toggleBuildingVisibility(bld.id, val)"
              >
                {{ bld.name }}
              </el-checkbox>
            </div>

            <div v-show="expandedSections.buildingFloors[bld.id]" class="floor-gap-list">
              <template
                v-for="(floor, idx) in [...bld.floors].sort(
                  (a, b) => (b.levelIndex || 0) - (a.levelIndex || 0)
                )"
                :key="floor.id"
              >
                <!-- 楼层行 -->
                <div class="floor-list-item">
                  <el-checkbox
                    v-model="visibilityState.floors[floor.id]"
                    :label="floor.name"
                    size="small"
                    class="floor-checkbox"
                  />
                  <div class="floor-actions">
                    <el-icon
                      v-if="floorScales[floor.id] && floorScales[floor.id] !== 1"
                      class="action-icon reset-icon"
                      title="重置图纸尺寸"
                      @click.stop="resetFloorScale(bld.id, floor.id)"
                    >
                      <Refresh />
                    </el-icon>
                    <el-icon
                      class="action-icon jump-icon"
                      title="跳转至 2D 配置"
                      @click.stop="goToFloor2D(bld.id, floor.id)"
                    >
                      <ArrowRight />
                    </el-icon>
                  </div>
                </div>

                <!-- 层间距控制：显示在当前层与下一层（视觉下方）之间 -->
                <div v-if="idx < bld.floors.length - 1" class="floor-gap-control">
                  <div class="gap-line"></div>
                  <div class="gap-input-wrap">
                    <span class="gap-icon">↕</span>
                    <input
                      v-model.lazy.number="
                        floorHeights[
                          [...bld.floors].sort((a, b) => (b.levelIndex || 0) - (a.levelIndex || 0))[
                            idx + 1
                          ].id
                        ]
                      "
                      type="number"
                      class="floor-h-num mini"
                      @change="
                        updateFloorHeight(
                          bld.id,
                          [...bld.floors].sort((a, b) => (b.levelIndex || 0) - (a.levelIndex || 0))[
                            idx + 1
                          ].id,
                          floorHeights[
                            [...bld.floors].sort(
                              (a, b) => (b.levelIndex || 0) - (a.levelIndex || 0)
                            )[idx + 1].id
                          ]
                        )
                      "
                    />
                    <span class="gap-unit">m</span>
                  </div>
                  <div class="gap-line"></div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="control-item">
        <span class="label">Icon Size</span>
        <input
          v-model.number="store.viewSettings.iconScale3D"
          type="range"
          min="10"
          max="300"
          step="10"
        />
      </div>

      <div class="control-item">
        <span class="label">Opacity</span>
        <input
          v-model.number="store.viewSettings.mapOpacity"
          type="range"
          min="0"
          max="1"
          step="0.1"
        />
      </div>

      <div class="control-item">
        <el-checkbox v-model="store.viewSettings.showAllLinks" label="Show Links" />
      </div>

      <el-button size="small" style="margin-top: 5px" @click="resetView">Reset View</el-button>
    </div>

    <div ref="containerRef" class="scene-container"></div>
  </div>
</template>

<style scoped>
/* [新增] 跳转图标样式 */
.jump-icon {
  margin-left: 4px;
  font-size: 14px;
  color: #c0c4cc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  transition: all 0.2s;
}

.jump-icon:hover {
  color: #409eff;
  background-color: #ecf5ff;
}

/* [新增] 动作按钮组 */
.floor-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icon {
  font-size: 14px;
  color: #c0c4cc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-icon:hover {
  color: #409eff;
  background-color: #ecf5ff;
}

.reset-icon:hover {
  color: #67c23a;
  background-color: #f0f9eb;
}

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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

.nested-list {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
}

.building-item {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f0f2f5;
}
.building-item:last-child {
  border-bottom: none;
}

.building-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 4px;
  background: #f5faff;
  border-radius: 4px;
  margin: 2px 4px;
}
.building-header:hover {
  background: #ecf5ff;
}

.sub-arrow {
  font-size: 12px;
  cursor: pointer;
  color: #909399;
  padding: 2px;
}
.sub-arrow:hover {
  color: #409eff;
}

.bld-checkbox :deep(.el-checkbox__label) {
  font-weight: bold;
}

.floor-sub-list {
  padding-left: 28px;
  padding-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.floor-checkbox :deep(.el-checkbox__label) {
  color: #606266;
  font-size: 12px;
}

.floor-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px 2px 0;
  border-radius: 4px;
}
.floor-list-item:hover {
  background: #f5f7fa;
}

.floor-gap-list {
  padding-left: 24px;
  display: flex;
  flex-direction: column;
}

.floor-gap-control {
  display: flex;
  align-items: center;
  height: 22px;
  margin: -2px 0;
  padding-left: 12px;
}

.gap-line {
  flex: 1;
  height: 1px;
  background: #ebeef5;
  opacity: 0.6;
}

.gap-input-wrap {
  display: flex;
  align-items: center;
  background: #f8f9fb;
  border-radius: 10px;
  padding: 1px 6px;
  border: 1px solid #e4e7ed;
  margin: 0 8px;
  transform: scale(0.9);
}

.gap-icon {
  font-size: 10px;
  color: #a8abb2;
  margin-right: 3px;
  font-weight: bold;
}

.gap-unit {
  font-size: 9px;
  color: #a8abb2;
  margin-left: 2px;
}

.floor-h-num.mini {
  width: 32px;
  height: 14px;
  border: none;
  background: transparent;
  font-size: 10px;
  padding: 0;
  text-align: center;
  color: #409eff;
  font-weight: bold;
}

.floor-h-num.mini:focus {
  outline: none;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
.control-item input[type='range'] {
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 20;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
.info-row.top-align {
  align-items: flex-start;
}
.info-row:last-child {
  margin-bottom: 0;
}
.info-row .label {
  color: #a0a0a0;
  flex-shrink: 0;
  margin-right: 10px;
}
.info-row .value {
  color: #e0e0e0;
  text-align: right;
  word-break: break-all;
}
.info-row .value.multiline {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}
.info-row .value.highlight {
  color: #fff;
  font-weight: bold;
}
</style>
