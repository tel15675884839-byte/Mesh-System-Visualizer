<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed, reactive, nextTick } from 'vue'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import { useProjectStore } from '../stores/projectStore'
import { Log } from '../utils/logger'
import { DeviceRole, DeviceType } from '../types' 
import { ElMessage } from 'element-plus'
import { IconRegistry } from '../utils/iconAssets'
import { VideoCamera, MapLocation } from '@element-plus/icons-vue'

const container = ref<HTMLElement | null>(null)
const store = useProjectStore()

const currentBuildingId = ref<string>('')
const currentFloorId = ref<string>('')

// [新增] 恢复状态标志位：防止在恢复楼层时触发 watch 导致楼层被重置
const isRestoring = ref(false)

// [状态] 缩放倍率
const currentScale = ref<number>(1.0) 

// [状态] 高亮节点ID
const highlightedNodeId = ref<string | null>(null)

let network: Network | null = null
let visNodes = new DataSet<any>([])
let visEdges = new DataSet<any>([])

const backgroundImage = ref<HTMLImageElement | null>(null)
const backgroundSize = reactive({ width: 0, height: 0 })

// [修改] 初始化时尝试从 Store 恢复上次所在的楼层
const initDefaultFloor = () => {
  // 1. 优先使用记忆的楼层
  if (store.viewSettings.lastBuildingId && store.viewSettings.lastFloorId) {
    // 验证一下该楼层是否还存在
    const bld = store.buildings.find(b => b.id === store.viewSettings.lastBuildingId)
    const flr = bld?.floors.find(f => f.id === store.viewSettings.lastFloorId)
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

const currentFloor = computed(() => {
  const bld = store.buildings.find(b => b.id === currentBuildingId.value)
  return bld?.floors.find(f => f.id === currentFloorId.value)
})

const availableFloors = computed(() => {
  const bld = store.buildings.find(b => b.id === currentBuildingId.value)
  return bld ? bld.floors : []
})

watch(currentBuildingId, (newVal) => {
  // [关键修复] 如果正在恢复状态，直接跳过自动重置楼层的逻辑
  if (isRestoring.value) return

  if (!newVal) return
  const bld = store.buildings.find(b => b.id === newVal)
  if (bld && bld.floors.length > 0) {
    currentFloorId.value = bld.floors[0].id
  } else {
    currentFloorId.value = ''
  }
})

watch(() => store.focusRequest, async (req) => {
  if (!req || !network) return
  const node = store.nodes.find(n => n.id === req.nodeId)
  if (!node || !node.isPlaced) {
    ElMessage.warning('该设备未布点，无法定位')
    return
  }

  if (node.buildingId !== currentBuildingId.value || node.floorId !== currentFloorId.value) {
    currentBuildingId.value = node.buildingId
    currentFloorId.value = node.floorId
    await nextTick()
    await new Promise(r => setTimeout(r, 100))
  }

  highlightedNodeId.value = node.id
  updateVisData() 
  network.selectNodes([node.id])
  network.focus(node.id, {
    scale: 1.5,
    animation: { duration: 700, easingFunction: 'easeInOutQuad' }
  })
})

const getIconData = (role: string, type: string) => {
  if (role === DeviceRole.LEADER) return IconRegistry.LEADER
  if (role === DeviceRole.ROUTER) return IconRegistry.ROUTER
  switch (type) {
    case DeviceType.SMOKE_DETECTOR: return IconRegistry.SMOKE
    case DeviceType.HEAT_DETECTOR: return IconRegistry.HEAT
    case DeviceType.MULT_DETECTOR: return IconRegistry.HEAT
    case DeviceType.MANUAL_CALL_POINT: return IconRegistry.MCP
    case DeviceType.IO_MODULE: return IconRegistry.IO
    case DeviceType.SOUNDER: return IconRegistry.SOUNDER
    default: return IconRegistry.SMOKE 
  }
}

const loadFloorImage = (floorId: string, src: string | undefined) => {
  backgroundImage.value = null
  if (!src) {
    network?.redraw()
    return
  }
  
  const img = new Image()
  img.src = src
  img.onload = () => {
    if (currentFloorId.value === floorId) {
      backgroundImage.value = img
      backgroundSize.width = img.width
      backgroundSize.height = img.height
      
      network?.redraw()
      // [关键] 恢复视角
      if (!restoreViewState()) {
        setTimeout(() => network?.fit(), 50)
      }
    }
  }
}

const initNetwork = () => {
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
      color: { color: '#409eff', highlight: '#409eff', opacity: 0.8 },
      smooth: false, 
      arrows: { to: { enabled: true, scaleFactor: 0.5 } }
    },
    physics: { enabled: false }, 
    interaction: {
      dragNodes: true, dragView: true, zoomView: true, hover: true, selectConnectedEdges: false,
      hideEdgesOnDrag: true, 
      hideNodesOnDrag: false
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

  network.on('click', (params) => {
    if (highlightedNodeId.value) {
      highlightedNodeId.value = null
      updateVisData()
    }
    if (params.nodes.length > 0) {
      store.selectNode(params.nodes[0])
    } else {
      store.selectNode(null)
    }
  })

  network.on('dragEnd', (params) => {
    if (params.nodes.length > 0) {
      const positions = network?.getPositions(params.nodes)
      if (positions) {
        params.nodes.forEach((id: string) => {
          const pos = positions[id]
          const node = store.nodes.find(n => n.id === id)
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

// 恢复视角逻辑
const restoreViewState = () => {
  if (network && store.viewSettings.camera2D) {
    const { x, y, scale } = store.viewSettings.camera2D
    network.moveTo({
      position: { x, y },
      scale: scale,
      animation: false 
    })
    return true
  }
  return false
}

// 保存当前所有状态
const saveCurrentState = () => {
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

const drawGrid = (ctx: CanvasRenderingContext2D) => {
  const width = 2000; const height = 2000; const step = 100
  ctx.save()
  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height) }
  for (let y = 0; y <= height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y) }
  ctx.stroke(); ctx.restore()
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  if (store.buildings.length === 0) { ElMessage.warning('请先配置建筑信息'); return }
  if (!currentFloorId.value) { ElMessage.warning('请先选择楼层'); return }
  if (!network) return

  const jsonStr = e.dataTransfer?.getData('application/json')
  if (!jsonStr) return

  try {
    const nodeIds = JSON.parse(jsonStr)
    if (!Array.isArray(nodeIds)) return

    const rect = container.value!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const canvasPos = network.DOMtoCanvas({ x, y })
    
    store.batchPlaceNodes(nodeIds, canvasPos.x, canvasPos.y, currentFloorId.value, currentBuildingId.value)
    Log.info(`Batch placed ${nodeIds.length} devices`)
  } catch (error) {
    Log.error('Drag error', error)
  }
}

const handleDragOver = (e: DragEvent) => { e.preventDefault() }

const updateVisData = () => {
  if (!currentFloorId.value) return

  const visibleNodes = store.nodes.filter(
    n => n.isPlaced && n.floorId === currentFloorId.value
  )
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

  const baseSize = 30
  const currentSize = baseSize * (store.viewSettings.iconScale / 100)

  const newNodes = visibleNodes.map(node => {
    let safeX = 0; let safeY = 0
    if (node.position) { safeX = node.position.x || 0; safeY = node.position.y || 0 }

    const isMissing = node.diffStatus === 'missing'
    const iconData = getIconData(node.role, node.type)
    const isHighlighted = highlightedNodeId.value === node.id

    return {
      id: node.id,
      label: node.label,
      image: iconData, 
      x: safeX,
      y: safeY,
      opacity: isMissing ? 0.6 : 1,
      shape: 'image',
      size: currentSize,
      font: { 
        color: store.viewSettings.labelColor,
        strokeWidth: 2, 
        strokeColor: '#fff' 
      },
      shadow: isHighlighted ? {
        enabled: true,
        color: 'rgba(30, 144, 255, 0.8)', 
        size: 30, 
        x: 0,
        y: 0
      } : false
    }
  })

  const newEdges: any[] = []
  
  if (store.viewSettings.showAllLinks || store.selectedNodeId) {
    store.edges.forEach(edge => {
      if (visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)) {
        const isRelated = store.selectedNodeId === edge.sourceId || store.selectedNodeId === edge.targetId
        if (!store.viewSettings.showAllLinks && !isRelated) return

        // [修改] 简化 RSSI 显示，只显示 dBm 值，用于鼠标悬停 (Vis.js 'title' 属性)
        const rssiTooltip = edge.rssi !== undefined ? `${edge.rssi} dBm` : undefined

        newEdges.push({
          id: edge.id,
          from: edge.sourceId,
          to: edge.targetId,
          title: rssiTooltip, // 悬停显示内容
        })
      }
    })
  }

  visNodes.clear()
  visNodes.add(newNodes)
  visEdges.clear() 
  visEdges.add(newEdges) 
}

watch(() => store.nodes, () => { updateVisData() }, { deep: true })
watch(currentFloorId, () => { updateVisData() })
watch(() => store.selectedNodeId, () => { updateVisData() }) 

watch(() => store.viewSettings, () => {
  updateVisData() 
  network?.redraw() 
}, { deep: true })

watch(currentFloor, (floor) => {
  if (container.value) { container.value.style.backgroundImage = 'none' }
  if (!floor || !floor.mapPath) {
    loadFloorImage('', undefined)
  } else {
    loadFloorImage(floor.id, floor.mapPath)
  }
}, { deep: true, immediate: true })

const handleResize = () => { network?.redraw() }

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
  if (network) network.destroy() 
})
</script>

<template>
  <div class="twod-container" @drop="handleDrop" @dragover="handleDragOver">
    
    <div class="overlay-tools">
      <div class="tool-group">
        <el-select v-model="currentBuildingId" placeholder="Building" size="small" style="width: 90px">
          <el-option v-for="b in store.buildings" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
        <el-select v-model="currentFloorId" placeholder="Floor" size="small" style="width: 80px; margin-left: 5px">
          <el-option v-for="f in availableFloors" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Icon</span>
        <input 
          type="range" 
          v-model.number="store.viewSettings.iconScale" 
          min="10" max="300" step="10" 
          class="custom-range"
          title="Icon Scale"
        >
        <span class="value-tip">{{ store.viewSettings.iconScale }}%</span>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Font</span>
        <el-color-picker 
          v-model="store.viewSettings.labelColor" 
          size="small"
          :predefine="['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#808080']"
        />
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Map</span>
        <input 
          type="range" 
          v-model.number="store.viewSettings.mapOpacity" 
          min="0" max="1" step="0.1" 
          class="custom-range"
          title="Map Opacity"
        >
        <span class="value-tip">{{ Math.round(store.viewSettings.mapOpacity * 100) }}%</span>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <el-checkbox v-model="store.viewSettings.showAllLinks" label="Links" size="small" border />
      </div>
    </div>

    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container { width: 100%; height: 100%; position: relative; background-color: #eef1f5; overflow: hidden; }
.vis-network-container { width: 100%; height: 100%; outline: none; position: relative; z-index: 1; background: transparent; }

.overlay-tools { position: absolute; top: 10px; left: 10px; z-index: 5; background: rgba(255, 255, 255, 0.95); padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tool-group { display: flex; align-items: center; gap: 5px; }
.tool-label { font-size: 12px; color: #606266; font-weight: bold; }
.divider { width: 1px; height: 16px; background-color: #dcdfe6; }
.value-tip { font-size: 11px; color: #909399; min-width: 30px; }
.custom-range { width: 60px; cursor: pointer; }
</style>