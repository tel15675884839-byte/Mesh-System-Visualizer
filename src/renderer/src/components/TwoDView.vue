<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed, reactive, nextTick } from 'vue'
import { DataSet } from 'vis-data'
import { Network, IdType } from 'vis-network'
import { useProjectStore } from '../stores/projectStore'
import { Log } from '../utils/logger'
import { DeviceRole, DeviceType } from '../types'
import { ElMessage } from 'element-plus'
import { IconRegistry } from '../utils/iconAssets'
import { Plus, Minus } from '@element-plus/icons-vue'

const container = ref<HTMLElement | null>(null)
const store = useProjectStore()

const currentBuildingId = ref<string>('')
const currentFloorId = ref<string>('')

// [新增] 恢复状态标志位：防止在恢复楼层时触发 watch 导致楼层被重置
const isRestoring = ref(false)

// [状态] 缩放倍率
const currentScale = ref<number>(1.0)

// [状态] 高亮节点ID
const highlightedNodeId = ref<IdType | null>(null)

// [新增] 本地楼层缩放 (优先于全局)
const localIconScale = ref<number>(100)

let network: Network | null = null

interface VisNode {
  id: IdType
  label: string
  image: string
  x: number
  y: number
  opacity?: number
  shape: string
  size: number
  borderWidth: number
  shapeProperties?: { borderDashes: boolean | number[] }
  color: {
    border: string
    background: string
    highlight: { border: string; background: string }
  }
  font: { size: number; color: string; strokeWidth: number; strokeColor: string }
  shadow: { enabled: boolean; color: string; size: number; x: number; y: number }
  physics: boolean
}

interface VisEdge {
  id: string
  from: string
  to: string
  title?: string
  width: number
  selectionWidth: number
  hoverWidth: number
  color: { color: string; highlight: string; opacity: number }
  shadow: boolean | { enabled: boolean; color: string; size: number; x: number; y: number }
}

const visNodes = new DataSet<VisNode>([])
const visEdges = new DataSet<VisEdge>([])

const backgroundImage = ref<HTMLImageElement | null>(null)
const backgroundSize = reactive({ width: 0, height: 0 })

const currentFloor = computed(() => {
  const bld = store.buildings.find((b) => b.id === currentBuildingId.value)
  return bld?.floors.find((f) => f.id === currentFloorId.value)
})

const availableFloors = computed(() => {
  const bld = store.buildings.find((b) => b.id === currentBuildingId.value)
  return bld ? bld.floors : []
})

const isMultiColumn = computed(() => {
  return availableFloors.value.length > 8
})

const sortedFloors = computed(() => {
  return [...availableFloors.value].sort((a, b) => b.levelIndex - a.levelIndex)
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

// Temporary references to prevent unused compiler errors in Task 1
Log.debug('Floor helpers initialized', {
  isMultiColumn: isMultiColumn.value,
  sortedFloors: sortedFloors.value,
  getFloorAbbr
})

// [修改] 初始化时尝试从 Store 恢复上次所在的楼层
const initDefaultFloor = (): void => {
  // 1. 优先使用记忆的楼层
  if (store.viewSettings.lastBuildingId && store.viewSettings.lastFloorId) {
    // 验证一下该楼层是否还存在
    const bld = store.buildings.find((b) => b.id === store.viewSettings.lastBuildingId)
    const flr = bld?.floors.find((f) => f.id === store.viewSettings.lastFloorId)
    if (bld && flr) {
      // [关键修复] 标记为正在恢复，阻断 watch 的副作用
      isRestoring.value = true

      currentBuildingId.value = bld.id
      currentFloorId.value = flr.id

      // 在下一个 tick 恢复标记，允许后续的用户手动操作触发正常逻辑
      nextTick(() => {
        isRestoring.value = false
      })
      return
    }
  }

  // 2. 如果没有记忆或无效，回退到默认
  if (store.buildings.length > 0) {
    currentBuildingId.value = store.buildings[0].id
    if (store.buildings[0].floors.length > 0) {
      currentFloorId.value = store.buildings[0].floors[0].id
    }
  }
}

// [新增] 实时同步当前楼层到 store，以便保存项目时持久化
watch([currentBuildingId, currentFloorId], ([newBId, newFId]) => {
  // 如果正在恢复初始化状态，不需要同步（已经是同步过来的）
  if (isRestoring.value) return

  if (newBId && newFId) {
    store.viewSettings.lastBuildingId = newBId
    store.viewSettings.lastFloorId = newFId
    Log.info(`Last floor persisted: ${newBId} - ${newFId}`)
  }
})

watch(currentBuildingId, (newVal) => {
  // [关键修复] 如果正在恢复状态，直接跳过自动重置楼层的逻辑
  if (isRestoring.value) return

  if (!newVal) return
  const bld = store.buildings.find((b) => b.id === newVal)
  if (bld && bld.floors.length > 0) {
    currentFloorId.value = bld.floors[0].id
  } else {
    currentFloorId.value = ''
  }
})

// [修改] 视角恢复逻辑优化：优先使用楼层自带的 cameraState
const restoreViewState = (): boolean => {
  if (!network) return false

  // 1. 优先尝试楼层级别的记忆
  if (currentFloor.value?.cameraState) {
    const { x, y, scale } = currentFloor.value.cameraState
    network?.moveTo({ position: { x, y }, scale, animation: false })
    return true
  }

  // 2. 兜底使用全局记忆
  if (store.viewSettings.camera2D) {
    const { x, y, scale } = store.viewSettings.camera2D
    network?.moveTo({ position: { x, y }, scale, animation: false })
    return true
  }
  return false
}

// [新增] 切换楼层前的保存逻辑
const prepareFloorSwitch = (floorId: string): void => {
  if (!network) return
  // 查找对应的楼层对象进行保存
  for (const bld of store.buildings) {
    const floor = bld.floors.find((f) => f.id === floorId)
    if (floor) {
      const pos = network.getViewPosition()
      const scale = network.getScale()
      floor.cameraState = { x: pos.x, y: pos.y, scale }
      break
    }
  }
}

const getIconData = (role: string, type: string): string => {
  if (role === DeviceRole.LEADER) return IconRegistry.LEADER
  if (role === DeviceRole.ROUTER) return IconRegistry.ROUTER
  switch (type) {
    case DeviceType.SMOKE_DETECTOR:
      return IconRegistry.SMOKE
    case DeviceType.HEAT_DETECTOR:
      return IconRegistry.HEAT
    case DeviceType.MULT_DETECTOR:
      return IconRegistry.HEAT
    case DeviceType.MANUAL_CALL_POINT:
      return IconRegistry.MCP
    case DeviceType.IO_MODULE:
      return IconRegistry.IO
    case DeviceType.SOUNDER:
      return IconRegistry.SOUNDER
    default:
      return IconRegistry.SMOKE
  }
}

// [新增] 角色颜色常量 (与 3D 视图保持同步)
const RoleColors = {
  LEADER: '#ffd700', // 金色
  ROUTER: '#67c23a', // 绿色
  DEFAULT: '#409eff' // 蓝色
}

const updateVisData = (): void => {
  if (!currentFloorId.value) return

  const visibleNodes = store.nodes.filter((n) => n.isPlaced && n.floorId === currentFloorId.value)
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))

  const baseSize = 30
  const baseFontSize = 14
  const baseEdgeWidth = 2
  // [修改] 优先级：楼层独立缩放 > 全局缩放
  const scaleRatio = (currentFloor.value?.iconScale ?? store.viewSettings.iconScale) / 100
  const currentSize = baseSize * scaleRatio
  const currentFontSize = Math.max(8, baseFontSize * scaleRatio) // 字体随之缩放，最小不小于 8px
  // [新增] 信号线粗细与图标缩放挂钩，最小不小于 0.5px
  const currentEdgeWidth = Math.max(0.5, baseEdgeWidth * scaleRatio)

  const newNodes = visibleNodes.map((node) => {
    let safeX = 0
    let safeY = 0
    if (node.position) {
      safeX = node.position.x || 0
      safeY = node.position.y || 0
    }

    const iconData = getIconData(node.role, node.type)
    const isHighlighted = highlightedNodeId.value === node.id
    const isSelected = store.selectedNodeId === node.id

    // [新增] 根据角色和 Diff 状态确定颜色和样式
    let colorScheme = RoleColors.DEFAULT
    if (node.role === DeviceRole.LEADER) colorScheme = RoleColors.LEADER
    else if (node.role === DeviceRole.ROUTER) colorScheme = RoleColors.ROUTER

    // Diff 状态覆盖
    let borderColor = colorScheme
    let borderWidth = 2
    let opacity = 1.0
    let shapeProperties: { borderDashes: boolean | number[] } = { borderDashes: false }
    let labelSuffix = ''
    let bgColor = isSelected ? '#ffffff' : '#f0f2f5'

    if (node.diffStatus === 'new') {
      borderColor = '#67C23A' // Green
      borderWidth = 4
      bgColor = '#f0f9eb'
      labelSuffix = ' (New)'
    } else if (node.diffStatus === 'missing') {
      borderColor = '#909399' // Gray
      borderWidth = 2
      shapeProperties = { borderDashes: [5, 5] }
      opacity = 0.6
      bgColor = '#f4f4f5'
      labelSuffix = ' (Missing)'
    } else if (isSelected || isHighlighted) {
      borderWidth = 3
    }

    return {
      id: node.id,
      label: node.label + labelSuffix,
      image: iconData,
      x: safeX,
      y: safeY,
      opacity: opacity,
      shape: 'circularImage',
      size: isSelected ? currentSize * 1.2 : currentSize,
      borderWidth: borderWidth,
      shapeProperties: shapeProperties,
      color: {
        border: borderColor,
        background: bgColor,
        highlight: {
          border: borderColor,
          background: bgColor
        }
      },
      font: {
        size: currentFontSize,
        color: store.viewSettings.labelColor,
        strokeWidth: 4,
        strokeColor: '#fff'
      },
      shadow: {
        enabled: isHighlighted || isSelected,
        color: isSelected ? 'rgba(255, 51, 0, 0.4)' : 'rgba(64, 158, 255, 0.4)',
        size: 15,
        x: 0,
        y: 0
      },
      // Missing 节点禁止物理模拟 (如果有的话)，保持位置
      physics: node.diffStatus !== 'missing'
    }
  })

  const newEdges: VisEdge[] = []

  if (store.viewSettings.showAllLinks || store.selectedNodeId) {
    store.edges.forEach((edge) => {
      if (visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)) {
        // [修改] 增加对高亮路径的判断
        const isRelated =
          store.selectedNodeId === edge.sourceId || store.selectedNodeId === edge.targetId
        const isHighlightedPath = store.highlightedPath.has(edge.id)

        if (!store.viewSettings.showAllLinks && !isRelated && !isHighlightedPath) return

        // [修改] 简化 RSSI 显示，只显示 dBm 值，用于鼠标悬停 (Vis.js 'title' 属性)
        const rssiTooltip = edge.rssi !== undefined ? `${edge.rssi} dBm` : undefined

        // [新增] 高亮路径样式
        let edgeColor = '#409eff'
        let edgeWidth = currentEdgeWidth
        let edgeShadow = false

        if (isHighlightedPath) {
          edgeColor = '#ff4500' // OrangeRed
          edgeWidth = currentEdgeWidth * 2.5
          edgeShadow = true
        }

        newEdges.push({
          id: edge.id,
          from: edge.sourceId,
          to: edge.targetId,
          title: rssiTooltip, // 悬停显示内容
          width: edgeWidth, // 动态线宽
          selectionWidth: edgeWidth * 1.5,
          hoverWidth: edgeWidth * 1.5,
          color: { color: edgeColor, highlight: edgeColor, opacity: isHighlightedPath ? 1 : 0.8 },
          shadow: edgeShadow
            ? { enabled: true, color: 'rgba(255, 69, 0, 0.4)', size: 10, x: 0, y: 0 }
            : false
        })
      }
    })
  }

  visNodes.clear()
  visNodes.add(newNodes)
  visEdges.clear()
  visEdges.add(newEdges)
}

// [恢复] 意外丢失的设备定位监听已被移动到脚本末尾统一管理

const loadFloorImage = (floorId: string, src: string | undefined): void => {
  // [特别注意] 如果路径没变，直接返回。此时视角恢复由 watch(currentFloorId) 负责。
  if (backgroundImage.value && backgroundImage.value.src === src) {
    return
  }

  backgroundImage.value = null
  if (!src) {
    network?.redraw()
    return
  }

  const img = new Image()
  img.src = src
  img.onload = (): void => {
    // [修复] 增加对 network 和渲染容器的二次检查，防止组件已卸载导致的崩溃
    if (network && currentFloorId.value === floorId) {
      backgroundImage.value = img
      backgroundSize.width = img.width
      backgroundSize.height = img.height

      network.redraw()

      // [核心逻辑] 换图后的首次视角调整
      if (!restoreViewState()) {
        setTimeout(() => {
          if (network) network.fit()
        }, 50)
      }
    }
  }
}

const drawGrid = (ctx: CanvasRenderingContext2D): void => {
  const width = 2000
  const height = 2000
  const step = 100
  ctx.save()
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
  ctx.restore()
}

const initNetwork = (): void => {
  if (!container.value) return
  initDefaultFloor()
  updateVisData()

  const data = { nodes: visNodes, edges: visEdges }
  const options = {
    nodes: {
      shape: 'image',
      size: 30,
      font: { size: 14, color: '#333', strokeWidth: 2, strokeColor: '#fff', face: 'arial' },
      borderWidth: 0,
      shadow: false,
      brokenImage: IconRegistry.SMOKE
    },
    edges: {
      width: 2,
      selectionWidth: 4, // 选中时加粗
      hoverWidth: 4, // 悬停时加粗，更容易触发 Tooltip
      color: { color: '#409eff', highlight: '#409eff', opacity: 0.8 },
      smooth: false,
      arrows: { to: { enabled: true, scaleFactor: 0.5 } }
    },
    physics: { enabled: false },
    interaction: {
      dragNodes: true,
      dragView: true,
      zoomView: true,
      hover: true,
      selectConnectedEdges: false,
      hideEdgesOnDrag: true,
      hideNodesOnDrag: false,
      tooltipDelay: 50 // 近乎立即显示，提升交互感
    }
  }

  network = new Network(container.value, data, options)

  network.on('beforeDrawing', (ctx: CanvasRenderingContext2D) => {
    if (backgroundImage.value) {
      ctx.save()
      ctx.imageSmoothingEnabled = false

      ctx.globalAlpha = store.viewSettings.mapOpacity
      const width = backgroundImage.value.width
      const height = backgroundImage.value.height

      ctx.drawImage(backgroundImage.value, 0, 0, width, height)

      ctx.strokeStyle = '#999'
      ctx.lineWidth = 10
      ctx.strokeRect(0, 0, width, height)

      ctx.restore()
    } else {
      drawGrid(ctx)
    }
  })

  network.on('zoom', () => {
    currentScale.value = network?.getScale() || 1
  })

  // [修改] 使用 select 事件替代 click 处理选择，更可靠且能处理拖拽后的选择状态
  network.on('select', (params) => {
    if (params.nodes.length > 0) {
      store.selectNode(params.nodes[0])
    } else {
      store.selectNode(null)
    }
  })

  // [新增] 双击事件：触发左侧树跳转
  network.on('doubleClick', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0]
      store.triggerTreeFocus(nodeId)
    } else {
      // [新增] 双击空白地方隐藏属性面板
      store.viewSettings.isPropertyPanelOpen = false
    }
  })

  network.on('click', (params) => {
    // 如果点击了空白区域，且当前有强高亮（定位请求产生的），则清除强高亮
    if (params.nodes.length === 0 && params.edges.length === 0) {
      if (highlightedNodeId.value) {
        highlightedNodeId.value = null
        updateVisData()
      }
    }
  })

  network.on('dragEnd', (params) => {
    if (params.nodes.length > 0) {
      const positions = network?.getPositions(params.nodes)
      if (positions) {
        params.nodes.forEach((id: string) => {
          const pos = positions[id]
          const node = store.nodes.find((n) => n.id === id)
          if (node && node.isPlaced) {
            if (!node.position) node.position = { x: 0, y: 0, z: 0 }
            node.position.x = pos.x
            node.position.y = pos.y
          }
        })
      }
    }
  })

  // 如果没有背景图，立即尝试恢复视角 (有图的情况在 onload 里处理)
  if (!currentFloor.value?.mapPath) {
    restoreViewState()
  }
}

// 保存当前所有状态
const saveCurrentState = (): void => {
  if (currentFloorId.value) prepareFloorSwitch(currentFloorId.value)
  if (network) {
    const pos = network.getViewPosition()
    const scale = network.getScale()

    store.saveViewState(
      currentBuildingId.value,
      currentFloorId.value,
      { x: pos.x, y: pos.y, scale },
      undefined // 不更新 3D
    )
  }
}

const handleDrop = (e: DragEvent): void => {
  e.preventDefault()
  if (store.buildings.length === 0) {
    ElMessage.warning('请先配置建筑信息')
    return
  }
  if (!currentFloorId.value) {
    ElMessage.warning('请先选择楼层')
    return
  }
  if (!network) return

  const jsonStr = e.dataTransfer?.getData('application/json')
  if (!jsonStr) return

  try {
    const nodeIds = JSON.parse(jsonStr) as string[]
    if (!Array.isArray(nodeIds)) return

    const rect = container.value!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const canvasPos = network.DOMtoCanvas({ x, y })

    store.batchPlaceNodes(
      nodeIds,
      canvasPos.x,
      canvasPos.y,
      currentFloorId.value,
      currentBuildingId.value
    )
    Log.info(`Batch placed ${nodeIds.length} devices`)
  } catch (error) {
    Log.error('Drag error', error)
  }
}

const handleDragOver = (e: DragEvent): void => {
  e.preventDefault()
}

watch(
  () => store.nodes,
  () => {
    updateVisData()
  },
  { deep: true }
)

watch(currentFloorId, (_newId, oldId) => {
  if (oldId) prepareFloorSwitch(oldId) // 切换前保存旧楼层视角
  updateVisData()

  // [关键核心修复] 当切换到具有相同图纸的楼层时，loadFloorImage 由于路径判定相同会直接返回。
  // 我们必须在 currentFloorId 监听器中强制触发视角恢复，否则视角会停留在上个楼层。
  nextTick(() => {
    if (network && store.selectedNodeId) {
      network.selectNodes([store.selectedNodeId])
    }
    // 强制恢复该楼层特有的视角（即便图纸相同，设备布局可能完全不同）
    if (!restoreViewState()) {
      // 兜底方案：如果该楼层还没保存过视角，则 fit 一下
      network?.fit()
    }
  })
})

// [修改] 增强选择同步逻辑：Store -> Vis.js
watch(
  () => store.selectedNodeId,
  (newId) => {
    if (network) {
      const currentSelected = network.getSelectedNodes()
      if (newId) {
        // [修复] 先检查节点是否存在于当前数据集中，避开内部 body.data 访问
        const allNodeIds = visNodes.getIds()
        if (allNodeIds.includes(newId)) {
          if (!currentSelected.includes(newId)) {
            network.selectNodes([newId])
          }
        }
      } else {
        if (currentSelected.length > 0) {
          network.unselectAll()
        }
      }
    }
    updateVisData()
  }
)

// ---- iOS 风格平滑聚焦动画 ----
// cubic-bezier(0.25, 0.1, 0.25, 1.0) 即 iOS 的 ease 曲线
const iosEase = (t: number): number => {
  // 近似 cubic-bezier(0.25, 0.1, 0.25, 1.0)
  // 使用二次近似：起步快，收尾平滑
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

let focusAnimationId: number | null = null

const smoothFocusTo = (
  targetX: number,
  targetY: number,
  targetScale: number,
  duration = 600
): void => {
  if (!network) return
  // 取消上一次未完成的动画
  if (focusAnimationId !== null) {
    cancelAnimationFrame(focusAnimationId)
    focusAnimationId = null
  }

  const startPos = network.getViewPosition()
  const startScale = network.getScale()
  const startTime = performance.now()

  const animate = (now: number): void => {
    const elapsed = now - startTime
    const rawT = Math.min(elapsed / duration, 1)
    const t = iosEase(rawT)

    const x = startPos.x + (targetX - startPos.x) * t
    const y = startPos.y + (targetY - startPos.y) * t
    const scale = startScale + (targetScale - startScale) * t

    if (!network) return
    network.moveTo({ position: { x, y }, scale, animation: false })

    if (rawT < 1) {
      focusAnimationId = requestAnimationFrame(animate)
    } else {
      focusAnimationId = null
    }
  }

  focusAnimationId = requestAnimationFrame(animate)
}

// [新增] 响应来自设备树或其他组件的定位请求
watch(
  () => store.focusRequest,
  (req) => {
    if (!req) return
    const { nodeId } = req
    const node = store.nodes.find((n) => n.id === nodeId)

    if (node) {
      if (!node.isPlaced) {
        ElMessage.warning('该设备尚未放置在地图上')
        return
      }

      // 无论是否切换楼层，先确保选中
      store.selectNode(nodeId)

      const performFocus = (): void => {
        if (!network) return
        const positions = network.getPositions([nodeId])
        const pos = positions[nodeId]
        // 必须确保拿到了有效的坐标，且不为 undefined
        if (pos) {
          smoothFocusTo(pos.x, pos.y, 1.5, 600)
        } else {
          // 如果依然拿不到坐标，可能是数据还没挂载，尝试下一只要再试一次
          requestAnimationFrame(() => {
            const retryPos = network?.getPositions([nodeId])?.[nodeId]
            if (retryPos) smoothFocusTo(retryPos.x, retryPos.y, 1.5, 600)
          })
        }
      }

      const needSwitch =
        node.buildingId !== currentBuildingId.value || node.floorId !== currentFloorId.value

      if (needSwitch) {
        // [修复] 标记为正在恢复，防止普通 watch 逻辑干扰
        isRestoring.value = true

        currentBuildingId.value = node.buildingId
        nextTick(() => {
          currentFloorId.value = node.floorId

          // 切换楼层后，必须等待网络重绘完成才能获取新节点坐标
          // 使用 once 确保只执行一次
          if (network) {
            network.once('afterDrawing', () => {
              // 等待绘图稳定后，解除恢复标记并执行聚焦
              isRestoring.value = false
              // 稍微延时一帧确保坐标已更新
              requestAnimationFrame(performFocus)
            })
          } else {
            isRestoring.value = false
          }
        })
      } else {
        // 同层切换，直接执行
        performFocus()
      }
    }
  }
)

watch(
  () => store.viewSettings,
  () => {
    updateVisData()
    network?.redraw()
  },
  { deep: true }
)

// [新增] 切换楼层时同步本地缩放滑块
watch(
  currentFloorId,
  () => {
    if (currentFloor.value) {
      localIconScale.value = currentFloor.value.iconScale ?? store.viewSettings.iconScale
    }
  },
  { immediate: true }
)

// [新增] 用户调整滑块时，同步到楼层对象中
const handleLocalScaleInput = (val: number): void => {
  if (currentFloor.value) {
    currentFloor.value.iconScale = val
    updateVisData()
  }
}

const adjustIconScale = (delta: number): void => {
  const newVal = Math.min(300, Math.max(10, localIconScale.value + delta))
  localIconScale.value = newVal
  handleLocalScaleInput(newVal)
}

const adjustMapOpacity = (delta: number): void => {
  const current = store.viewSettings.mapOpacity
  const newVal = parseFloat((current + delta).toFixed(1))
  store.viewSettings.mapOpacity = Math.min(1, Math.max(0, newVal))
}

// [修改] 只在 mapPath 真正变化时才重载图片，防止调节 iconScale/opacity 时闪烁
watch(
  () => currentFloor.value?.mapPath,
  (newPath) => {
    if (container.value) {
      container.value.style.backgroundImage = 'none'
    }
    const floor = currentFloor.value
    if (!floor || !newPath) {
      loadFloorImage('', undefined)
    } else {
      loadFloorImage(floor.id, newPath)
    }
  },
  { immediate: true }
)

const handleResize = (): void => {
  network?.redraw()
}

onMounted(() => {
  initNetwork()
  if (currentFloor.value && currentFloor.value.mapPath) {
    loadFloorImage(currentFloor.value.id, currentFloor.value.mapPath)
  }
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  saveCurrentState() // [关键] 离开前保存
  window.removeEventListener('resize', handleResize)
  if (focusAnimationId !== null) {
    cancelAnimationFrame(focusAnimationId)
    focusAnimationId = null
  }
  if (network) {
    network.destroy()
    network = null // [关键修复] 设置为 null 确保异步回调不再执行
  }
})
</script>

<template>
  <div class="twod-container" @drop="handleDrop" @dragover="handleDragOver">
    <div class="overlay-tools ios-style">
      <div class="tool-group">
        <span class="tool-label">Icon</span>
        <div class="ios-stepper">
          <button class="stepper-btn" @click="adjustIconScale(-10)">
            <el-icon><Minus /></el-icon>
          </button>
          <span class="stepper-value">{{ localIconScale }}%</span>
          <button class="stepper-btn" @click="adjustIconScale(10)">
            <el-icon><Plus /></el-icon>
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Font</span>
        <el-color-picker
          v-model="store.viewSettings.labelColor"
          size="small"
          :predefine="['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#808080']"
          class="ios-color-picker"
        />
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Map</span>
        <div class="ios-stepper">
          <button class="stepper-btn" @click="adjustMapOpacity(-0.1)">
            <el-icon><Minus /></el-icon>
          </button>
          <span class="stepper-value">{{ Math.round(store.viewSettings.mapOpacity * 100) }}%</span>
          <button class="stepper-btn" @click="adjustMapOpacity(0.1)">
            <el-icon><Plus /></el-icon>
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <el-checkbox
          v-model="store.viewSettings.showAllLinks"
          label="Links"
          size="small"
          class="ios-checkbox"
        />
      </div>
    </div>

    <div class="floor-navigator-panel" v-if="store.buildings.length > 0">
      <!-- Building Selector: Only display if there are multiple buildings -->
      <div class="building-tabs" v-if="store.buildings.length > 1">
        <button
          v-for="b in store.buildings"
          :key="b.id"
          :class="['building-tab-btn', { active: currentBuildingId === b.id }]"
          @click="currentBuildingId = b.id"
        >
          {{ b.name }}
        </button>
      </div>

      <!-- Floor Buttons Stack -->
      <div :class="['floor-grid', { 'multi-column': isMultiColumn }]">
        <button
          v-for="f in sortedFloors"
          :key="f.id"
          :class="['floor-btn', { active: currentFloorId === f.id, 'rect-btn': isMultiColumn }]"
          @click="currentFloorId = f.id"
          :title="f.name"
        >
          {{ getFloorAbbr(f.name) }}
        </button>
      </div>
    </div>

    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #eef1f5;
  overflow: hidden;
}
.vis-network-container {
  width: 100%;
  height: 100%;
  outline: none;
  position: relative;
  z-index: 1;
  background: transparent;
}

/* [新增] Vis.js Tooltip 样式，确保 RSSI 悬停显示可见且美观 */
:deep(.vis-tooltip) {
  position: absolute;
  visibility: hidden;
  padding: 5px 10px;
  white-space: nowrap;
  font-family: verdana;
  font-size: 12px;
  color: #fff;
  background-color: rgba(50, 50, 50, 0.9);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 100;
  pointer-events: none;
}

.overlay-tools.ios-style {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  padding: 8px 15px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-label {
  font-size: 13px;
  color: #1d1d1f;
  font-weight: 500;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.1);
}

/* iOS Stepper Style */
.ios-stepper {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 2px;
}

.stepper-btn {
  background: transparent;
  border: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #007aff;
  font-size: 16px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.stepper-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.stepper-btn:active {
  background-color: rgba(0, 0, 0, 0.1);
}

.stepper-value {
  font-size: 12px;
  color: #1d1d1f;
  min-width: 40px;
  text-align: center;
  font-weight: 500;
}

/* iOS-like Select/ColorPicker/Checkbox adjustments */
:deep(.ios-select .el-input__wrapper) {
  background-color: rgba(0, 0, 0, 0.05) !important;
  box-shadow: none !important;
  border-radius: 8px !important;
}

:deep(.ios-color-picker .el-color-picker__trigger) {
  border: none !important;
  background-color: rgba(0, 0, 0, 0.05) !important;
  border-radius: 8px !important;
}

:deep(.ios-checkbox.el-checkbox) {
  margin-right: 0;
}

:deep(.ios-checkbox .el-checkbox__label) {
  font-size: 13px;
  color: #1d1d1f;
  font-weight: 500;
}

/* Floor Navigator Panel */
.floor-navigator-panel {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.7);
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

.floor-btn:hover {
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
