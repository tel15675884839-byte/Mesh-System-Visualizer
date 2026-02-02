<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed, reactive } from 'vue'
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

let network: Network | null = null
let visNodes = new DataSet<any>([])
let visEdges = new DataSet<any>([])

let floorImage: HTMLImageElement | null = null

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

const loadFloorImage = (src: string | undefined) => {
  if (!src) {
    floorImage = null
    network?.redraw()
    return
  }
  const img = new Image()
  img.src = src
  img.onload = () => {
    floorImage = img
    network?.redraw()
    network?.fit() 
  }
  img.onerror = () => {
    Log.error('Failed to load floor map image')
    floorImage = null
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
      size: 30, // 初始基准
      font: { size: 14, color: '#333', strokeWidth: 2, strokeColor: '#fff', face: 'arial' },
      borderWidth: 0, 
      shadow: false,
      brokenImage: IconRegistry.SMOKE
    },
    edges: {
      width: 2, color: { color: '#ccc', highlight: '#409eff' },
      smooth: { type: 'continuous' }
    },
    physics: { enabled: false }, 
    interaction: {
      dragNodes: true, dragView: true, zoomView: true, hover: true, selectConnectedEdges: false
    }
  }

  network = new Network(container.value, data, options)

  // 绘制底图
  network.on('beforeDrawing', (ctx) => {
    if (floorImage) {
      ctx.save()
      
      // [核心] 应用图纸透明度
      ctx.globalAlpha = store.viewSettings.mapOpacity
      
      const width = floorImage.width
      const height = floorImage.height
      ctx.drawImage(floorImage, 0, 0, width, height)
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 10
      ctx.strokeRect(0, 0, width, height)
      ctx.restore()
    } else {
      drawGrid(ctx)
    }
  })

  network.on('click', (params) => {
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
  const width = 2000
  const height = 2000
  const step = 100
  ctx.save()
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(x, 0); ctx.lineTo(x, height)
  }
  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, y); ctx.lineTo(width, y)
  }
  ctx.stroke()
  ctx.restore()
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

  // [核心] 计算基础尺寸
  const baseSize = 30
  const currentSize = baseSize * (store.viewSettings.iconScale / 100)

  const newNodes = visibleNodes.map(node => {
    let safeX = 0; let safeY = 0
    if (node.position) { safeX = node.position.x || 0; safeY = node.position.y || 0 }

    const isMissing = node.diffStatus === 'missing'
    const iconData = getIconData(node.role, node.type)

    return {
      id: node.id,
      label: node.label,
      image: iconData, 
      x: safeX,
      y: safeY,
      opacity: isMissing ? 0.6 : 1,
      shape: 'image',
      // [核心] 应用动态尺寸和颜色
      size: currentSize,
      font: { 
        color: store.viewSettings.labelColor,
        strokeWidth: 2, 
        strokeColor: '#fff' // 保持白色描边，增强对比
      }
    }
  })

  visNodes.clear()
  visNodes.add(newNodes)
  visEdges.clear() 
}

// 监听数据变化
watch(() => store.nodes, () => { updateVisData() }, { deep: true })
watch(currentFloorId, () => { updateVisData() })

// 监听视图设置变化 -> 刷新画布
watch(() => store.viewSettings, () => {
  updateVisData() // 更新节点 (尺寸/颜色)
  network?.redraw() // 触发重绘 (背景透明度)
}, { deep: true })

watch(currentFloor, (floor) => {
  floorImage = null
  if (floor && floor.mapPath) {
    loadFloorImage(floor.mapPath)
  } else {
    network?.redraw() 
  }
}, { deep: true, immediate: true })

const handleResize = () => { network?.fit() }

onMounted(() => { 
  initNetwork()
  if (currentFloor.value && currentFloor.value.mapPath) {
    loadFloorImage(currentFloor.value.mapPath)
  }
  window.addEventListener('resize', handleResize) 
})
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); if (network) network.destroy() })
</script>

<template>
  <div class="twod-container" @drop="handleDrop" @dragover="handleDragOver">
    <div class="overlay-tools">
      <!-- 1. 楼层选择 -->
      <div class="tool-group">
        <el-select v-model="currentBuildingId" placeholder="Building" size="small" style="width: 90px">
          <el-option v-for="b in store.buildings" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
        <el-select v-model="currentFloorId" placeholder="Floor" size="small" style="width: 80px; margin-left: 5px">
          <el-option v-for="f in availableFloors" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </div>

      <div class="divider"></div>

      <!-- 2. 图标缩放 -->
      <div class="tool-group">
        <span class="tool-label">图标</span>
        <input 
          type="range" 
          v-model.number="store.viewSettings.iconScale" 
          min="10" max="300" step="10" 
          class="custom-range"
          title="图标大小缩放"
        >
        <span class="value-tip">{{ store.viewSettings.iconScale }}%</span>
      </div>

      <div class="divider"></div>

      <!-- 3. 字体颜色 -->
      <div class="tool-group">
        <span class="tool-label">字体</span>
        <el-color-picker 
          v-model="store.viewSettings.labelColor" 
          size="small"
          :predefine="['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#808080']"
        />
      </div>

      <div class="divider"></div>

      <!-- 4. 图纸透明度 -->
      <div class="tool-group">
        <span class="tool-label">图纸</span>
        <input 
          type="range" 
          v-model.number="store.viewSettings.mapOpacity" 
          min="0" max="1" step="0.1" 
          class="custom-range"
          title="底图透明度"
        >
        <span class="value-tip">{{ Math.round(store.viewSettings.mapOpacity * 100) }}%</span>
      </div>
    </div>

    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container { width: 100%; height: 100%; position: relative; background-color: #eef1f5; }
.vis-network-container { width: 100%; height: 100%; outline: none; }

.overlay-tools { 
  position: absolute; top: 10px; left: 10px; z-index: 5; 
  background: rgba(255, 255, 255, 0.95); padding: 5px 10px; 
  border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); 
  display: flex; align-items: center; gap: 10px;
}

.tool-group { display: flex; align-items: center; gap: 5px; }
.tool-label { font-size: 12px; color: #606266; font-weight: bold; }
.divider { width: 1px; height: 16px; background-color: #dcdfe6; }
.value-tip { font-size: 11px; color: #909399; min-width: 30px; }

/* 自定义滑块样式 (简单版) */
.custom-range {
  width: 80px;
  cursor: pointer;
}
</style>