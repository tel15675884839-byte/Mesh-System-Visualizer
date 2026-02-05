<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed, reactive, nextTick } from 'vue'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import { useProjectStore } from '../stores/projectStore'
import { Log } from '../utils/logger'
import { DeviceRole, DeviceType } from '../types' 
import { ElMessage } from 'element-plus'
import { IconRegistry } from '../utils/iconAssets'

const container = ref<HTMLElement | null>(null)
const store = useProjectStore()

const currentBuildingId = ref<string>('')
const currentFloorId = ref<string>('')
const currentScale = ref<number>(1.0) 

const highlightedNodeId = ref<string | null>(null)

let network: Network | null = null
let visNodes = new DataSet<any>([])
let visEdges = new DataSet<any>([])

// [修改] 不再缓存 Canvas 对象，而是直接存图片 URL 和尺寸
// 用于 CSS 渲染层
const currentMapSrc = ref<string>('')
const currentMapSize = reactive({ width: 0, height: 0 })
const mapTransform = ref({ x: 0, y: 0, scale: 1 })

const initDefaultFloor = () => {
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

// [核心优化] 仅负责加载图片 URL 和获取尺寸，不进行 Canvas 预处理
const loadFloorImage = (floorId: string, src: string | undefined) => {
  if (!src) {
    currentMapSrc.value = ''
    return
  }
  
  // 预加载以获取尺寸
  const img = new Image()
  img.src = src
  img.onload = () => {
    // 只有当加载完成且楼层未变时才应用
    if (currentFloorId.value === floorId) {
      currentMapSrc.value = src
      currentMapSize.width = img.width
      currentMapSize.height = img.height
      
      // 触发一次视图重算
      network?.redraw()
      // 初次加载适应屏幕
      setTimeout(() => network?.fit(), 50) 
    }
  }
}

// [新增] 同步 CSS 层的位置
const syncMapLayer = () => {
  if (!network) return
  
  // 获取 Vis.js 逻辑坐标系原点 (0,0) 对应在 DOM 中的像素位置
  const domPos = network.canvasToDOM({ x: 0, y: 0 })
  const scale = network.getScale()
  
  mapTransform.value = {
    x: domPos.x,
    y: domPos.y,
    scale: scale
  }
  currentScale.value = scale
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

  // [关键] 在每次重绘后，同步底层 CSS 图片的位置
  // afterDrawing 是最平滑的时机，因为它代表物理引擎和摄像机位置已计算完毕
  network.on('afterDrawing', (ctx) => {
    syncMapLayer()
    
    // 如果没有图，我们在 Canvas 层画个网格做参考
    if (!currentMapSrc.value) {
      drawGrid(ctx)
    } else {
      // 如果有图，我们在 Canvas 层画个边框，增强边界感
      // 注意：这里只画框，不画图
      ctx.save()
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 10
      // 0,0 到 width,height 是逻辑坐标
      ctx.strokeRect(0, 0, currentMapSize.width, currentMapSize.height)
      ctx.restore()
    }
  })
  
  // 额外监听，保证拖拽时也能跟手
  network.on('drag', syncMapLayer)
  network.on('zoom', syncMapLayer)

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
        size: 25, 
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

        const srcDisplay = store.getDisplayId(edge.sourceId)
        const tgtDisplay = store.getDisplayId(edge.targetId)
        const rssiText = edge.rssi !== undefined ? ` [RSSI: ${edge.rssi} dBm]` : ''
        const title = `${srcDisplay} → ${tgtDisplay}${rssiText}`

        newEdges.push({
          id: edge.id,
          from: edge.sourceId,
          to: edge.targetId,
          title: title,
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
  if (!floor || !floor.mapPath) {
    currentMapSrc.value = ''
    network?.redraw()
  } else {
    loadFloorImage(floor.id, floor.mapPath)
  }
}, { deep: true, immediate: true })

const handleResize = () => { network?.fit() }

onMounted(() => { 
  initNetwork()
  if (currentFloor.value && currentFloor.value.mapPath) {
    loadFloorImage(currentFloor.value.id, currentFloor.value.mapPath)
  }
  window.addEventListener('resize', handleResize) 
})
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); if (network) network.destroy() })
</script>

<template>
  <div class="twod-container" @drop="handleDrop" @dragover="handleDragOver">
    
    <!-- [核心优化] 独立的 CSS 图层，由 GPU 加速渲染 -->
    <div class="map-layer-container">
      <img 
        v-if="currentMapSrc"
        :src="currentMapSrc" 
        class="floor-map-image"
        :style="{
          transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.scale})`,
          width: `${currentMapSize.width}px`,
          height: `${currentMapSize.height}px`,
          opacity: store.viewSettings.mapOpacity
        }"
      />
    </div>

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

      <div class="tool-group zoom-indicator">
        <span class="tool-label">Zoom:</span>
        <span class="value-tip">{{ Math.round(currentScale * 100) }}%</span>
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Icon</span>
        <input type="range" v-model.number="store.viewSettings.iconScale" min="10" max="300" step="10" class="custom-range" title="Icon Scale">
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Font</span>
        <el-color-picker v-model="store.viewSettings.labelColor" size="small" :predefine="['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#808080']" />
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <span class="tool-label">Map</span>
        <input type="range" v-model.number="store.viewSettings.mapOpacity" min="0" max="1" step="0.1" class="custom-range" title="Map Opacity">
      </div>

      <div class="divider"></div>

      <div class="tool-group">
        <el-checkbox v-model="store.viewSettings.showAllLinks" label="Links" size="small" border />
      </div>
    </div>

    <!-- Vis.js 容器 (透明背景，只画节点和线) -->
    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container { 
  width: 100%; height: 100%; position: relative; background-color: #eef1f5; 
  overflow: hidden; /* 防止图片移出容器产生滚动条 */
}

/* [核心优化] 底图层绝对定位，位于 Canvas 之下 */
.map-layer-container {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; /* 让鼠标事件穿透到底下的 Canvas */
  z-index: 0;
}

.floor-map-image {
  position: absolute;
  top: 0; left: 0;
  transform-origin: 0 0; /* 变换基点设为左上角 */
  will-change: transform; /* 提示浏览器进行 GPU 优化 */
  /* image-rendering: pixelated; 可选：像素风格 */
}

.vis-network-container { 
  width: 100%; height: 100%; outline: none; 
  position: relative;
  z-index: 1; /* 确保 Canvas 在图片之上 */
  background: transparent; /* 确保背景透明 */
}

.overlay-tools { position: absolute; top: 10px; left: 10px; z-index: 5; background: rgba(255, 255, 255, 0.95); padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px; }
.tool-group { display: flex; align-items: center; gap: 5px; }
.tool-label { font-size: 12px; color: #606266; font-weight: bold; }
.divider { width: 1px; height: 16px; background-color: #dcdfe6; }
.value-tip { font-size: 11px; color: #909399; min-width: 30px; }
.custom-range { width: 80px; cursor: pointer; }
.zoom-indicator .value-tip { font-weight: bold; color: #409eff; }
</style>