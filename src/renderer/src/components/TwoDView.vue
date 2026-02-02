<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import { useProjectStore } from '../stores/projectStore'
import { Log } from '../utils/logger'
import { DeviceRole } from '../types'

// 容器引用
const container = ref<HTMLElement | null>(null)
const store = useProjectStore()

// Vis.js 实例变量
let network: Network | null = null
let visNodes = new DataSet<any>([])
let visEdges = new DataSet<any>([])

// 节点样式映射 (根据之前的 HTML 代码还原)
const getNodeColor = (role: string) => {
  if (role === DeviceRole.LEADER) return '#FF8F00' // 橙色
  if (role === DeviceRole.ROUTER) return '#FFD600' // 黄色
  return '#2962FF' // 默认为蓝色 (End Device)
}

// 初始化 2D 网络图
const initNetwork = () => {
  if (!container.value) return

  // 1. 准备 Vis.js 数据
  // 我们使用 DataSet，这样可以动态增删改查而不需要重绘整个网络
  updateVisData()

  const data = {
    nodes: visNodes,
    edges: visEdges
  }

  // 2. 配置选项 (复刻之前的 floor 模式体验)
  const options = {
    // 节点样式
    nodes: {
      shape: 'dot',
      size: 20,
      font: { size: 14, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
      borderWidth: 2,
      shadow: true
    },
    // 连线样式
    edges: {
      width: 2,
      color: { color: '#ccc', highlight: '#409eff' },
      smooth: { type: 'continuous' }
    },
    // 物理引擎：配置模式下通常关闭物理模拟，方便手动摆放位置
    physics: {
      enabled: false 
    },
    // 交互设置
    interaction: {
      dragNodes: true, // 允许拖拽
      dragView: true,  // 允许平移画布
      zoomView: true,  // 允许缩放
      hover: true,
      selectConnectedEdges: false
    }
  }

  // 3. 创建实例
  network = new Network(container.value, data, options)

  // 4. 绑定事件：点击选中
  network.on('click', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0]
      store.selectNode(nodeId)
      Log.debug(`[2D] 选中节点: ${nodeId}`)
    } else {
      store.selectNode(null)
    }
  })

  // 5. 绑定事件：拖拽结束 (更新坐标)
  network.on('dragEnd', (params) => {
    if (params.nodes.length > 0) {
      const positions = network?.getPositions(params.nodes)
      if (positions) {
        params.nodes.forEach((id: string) => {
          const pos = positions[id]
          const node = store.nodes.find(n => n.id === id)
          if (node) {
            // 更新 Store 中的数据 (注意：这里我们把 Canvas 坐标直接存入，后续可能需要转为米)
            node.position.x = pos.x
            node.position.y = pos.y
            Log.debug(`[2D] 节点 ${id} 移动到 (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`)
          }
        })
      }
    }
  })
}

// 将 Store 数据同步到 Vis.js DataSet
const updateVisData = () => {
  // 转换节点
  const newNodes = store.nodes.map(node => ({
    id: node.id,
    label: node.label, // 显示名字
    color: getNodeColor(node.role),
    x: node.position.x,
    y: node.position.y
  }))
  
  // 简单粗暴的全量更新 (生产环境可以做 Diff 优化)
  visNodes.clear()
  visNodes.add(newNodes)

  // 转换连线 (暂时留空，后续对接)
  visEdges.clear()
}

// 监听 Store 变化，自动重绘
// deep: true 确保如果节点位置变了也能感知到
watch(() => store.nodes, () => {
  updateVisData()
}, { deep: true })

// 监听外部传来的 Resize 事件 (比如拖拽侧边栏)
const handleResize = () => {
  if (network) {
    network.fit() // 自动适应窗口
  }
}

onMounted(() => {
  initNetwork()
  window.addEventListener('resize', handleResize)
  
  // 打印一条日志证明组件加载了
  Log.info('2D 组态编辑器已加载 (Vis.js Core)')
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (network) network.destroy()
})
</script>

<template>
  <div class="twod-container">
    <!-- 工具栏悬浮层 (后续可以加放缩按钮、背景图上传按钮) -->
    <div class="overlay-tools">
      <span class="view-label">2D 视图模式</span>
    </div>

    <!-- 绘图核心区 -->
    <div ref="container" class="vis-network-container"></div>
  </div>
</template>

<style scoped>
.twod-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #f0f2f5; /* 画布背景色 */
}

.vis-network-container {
  width: 100%;
  height: 100%;
  outline: none;
}

.overlay-tools {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none; /* 让鼠标穿透，不影响下方操作 */
  border: 1px solid #ccc;
}
</style>