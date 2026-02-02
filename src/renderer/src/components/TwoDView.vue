<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import { useProjectStore } from '../stores/projectStore'
import { Log } from '../utils/logger'
import { DeviceRole, DeviceType } from '../types' 
import { ElMessage } from 'element-plus'
// [引用] 直接引用刚才创建的静态资产
import { IconRegistry } from '../utils/iconAssets'

const container = ref<HTMLElement | null>(null)
const store = useProjectStore()

const currentBuildingId = ref<string>('')
const currentFloorId = ref<string>('')

let network: Network | null = null
let visNodes = new DataSet<any>([])
let visEdges = new DataSet<any>([])

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

// [简化] 直接从注册表取值，不再需要文件路径
const getIconData = (role: string, type: string) => {
  // 1. 基础设施
  if (role === DeviceRole.LEADER) return IconRegistry.LEADER
  if (role === DeviceRole.ROUTER) return IconRegistry.ROUTER

  // 2. 终端设备
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
      // 备用图标 (红点)
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

  const newNodes = visibleNodes.map(node => {
    let safeX = 0; let safeY = 0
    if (node.position) { safeX = node.position.x || 0; safeY = node.position.y || 0 }

    const isMissing = node.diffStatus === 'missing'
    // [使用] 直接从资产库获取字符串
    const iconData = getIconData(node.role, node.type)

    return {
      id: node.id,
      label: node.label,
      image: iconData, 
      x: safeX,
      y: safeY,
      opacity: isMissing ? 0.6 : 1,
      shape: 'image', 
    }
  })

  visNodes.clear()
  visNodes.add(newNodes)
  visEdges.clear() 
}

watch(() => store.nodes, () => { updateVisData() }, { deep: true })
watch(currentFloorId, () => { updateVisData() })

watch(currentFloor, (floor) => {
  if (container.value && floor && floor.mapPath) {
    container.value.style.backgroundImage = `url(${floor.mapPath})`
    container.value.style.backgroundSize = 'contain' 
    container.value.style.backgroundRepeat = 'no-repeat'
    container.value.style.backgroundPosition = 'center'
  } else if (container.value) {
    container.value.style.backgroundImage = 'none'
  }
}, { deep: true, immediate: true })

const handleResize = () => { network?.fit() }

onMounted(() => { 
  initNetwork()
  // 移除 preloadAllIcons，因为现在图标是同步常量的
  window.addEventListener('resize', handleResize) 
})
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); if (network) network.destroy() })
</script>

<template>
  <div class="twod-container" @drop="handleDrop" @dragover="handleDragOver">
    <div class="overlay-tools">
      <el-select v-model="currentBuildingId" placeholder="Select Building" size="small" style="width: 100px">
        <el-option v-for="b in store.buildings" :key="b.id" :label="b.name" :value="b.id" />
      </el-select>
      <el-select v-model="currentFloorId" placeholder="Select Floor" size="small" style="width: 100px; margin-left: 5px">
        <el-option v-for="f in availableFloors" :key="f.id" :label="f.name" :value="f.id" />
      </el-select>
    </div>
    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container { width: 100%; height: 100%; position: relative; background-color: #eef1f5; }
.vis-network-container { width: 100%; height: 100%; outline: none; }
.overlay-tools { position: absolute; top: 10px; left: 10px; z-index: 5; background: rgba(255, 255, 255, 0.9); padding: 5px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; }
</style>