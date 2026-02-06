<script setup lang="ts">
import { ref, watch, shallowRef, nextTick } from 'vue'
import { Search, Check } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { buildTopologyTree, type ITreeNode } from '../utils/treeHelper'
import { DeviceRole } from '../types'

const store = useProjectStore()
const filterText = ref('')
const treeRef = ref()

const expandedKeys = ref<string[]>([])
const selectedIds = ref<Set<string>>(new Set())
const lastFocusedId = ref<string | null>(null) 

const treeData = shallowRef<ITreeNode[]>([])

watch(() => store.structureVersion, async () => {
  treeData.value = buildTopologyTree(store.nodes, store.edges, store.loops)
  // [关键修复] 树结构重建后，Element Plus 会丢失当前的 selection 状态
  // 需要在下个 tick 重新设置一次当前 Key，确保高亮和内部状态同步
  await nextTick()
  if (store.selectedNodeId) {
    treeRef.value?.setCurrentKey(store.selectedNodeId)
  }
}, { immediate: true })

watch(filterText, (val) => {
  treeRef.value!.filter(val)
})

const filterNode = (value: string, data: any): boolean => {
  if (!value) return true
  const matchLabel = data.label.toLowerCase().includes(value.toLowerCase())
  const matchId = data.id.toLowerCase().includes(value.toLowerCase())
  return matchLabel || matchId
}

const handleNodeExpand = (data: any): void => { 
  if (!expandedKeys.value.includes(data.id)) expandedKeys.value.push(data.id) 
}
const handleNodeCollapse = (data: any): void => { 
  const idx = expandedKeys.value.indexOf(data.id)
  if (idx > -1) expandedKeys.value.splice(idx, 1)
}

const getVisibleFlatNodes = (): ITreeNode[] => {
  const flatList: ITreeNode[] = []
  const expandedSet = new Set(expandedKeys.value)
  
  const traverse = (nodes: ITreeNode[]) => {
    for (const node of nodes) {
      flatList.push(node)
      if (node.children && node.children.length > 0 && expandedSet.has(node.id)) {
        traverse(node.children)
      }
    }
  }
  traverse(treeData.value)
  return flatList
}

const handleNodeClick = (data: any, _node: any, _prop: any, e: MouseEvent): void => {
  if (data.type !== 'device') return

  if (e && e.shiftKey && lastFocusedId.value) {
    const flatNodes = getVisibleFlatNodes()
    const startIndex = flatNodes.findIndex(n => n.id === lastFocusedId.value)
    const endIndex = flatNodes.findIndex(n => n.id === data.id)

    if (startIndex !== -1 && endIndex !== -1) {
      const min = Math.min(startIndex, endIndex)
      const max = Math.max(startIndex, endIndex)
      
      if (!e.ctrlKey) {
        selectedIds.value.clear()
      }

      for (let i = min; i <= max; i++) {
        const curr = flatNodes[i]
        if (curr.type === 'device') {
          selectedIds.value.add(curr.id)
        }
      }
    }
  }
  else if (e && (e.ctrlKey || e.metaKey)) {
    if (selectedIds.value.has(data.id)) {
      selectedIds.value.delete(data.id)
    } else {
      selectedIds.value.add(data.id)
    }
    lastFocusedId.value = data.id 
  } 
  else {
    selectedIds.value.clear()
    selectedIds.value.add(data.id)
    lastFocusedId.value = data.id 
  }

  if (selectedIds.value.size === 1) {
    store.selectNode([...selectedIds.value][0])
  } else if (selectedIds.value.size > 1) {
    store.selectNode(data.id) 
  } else {
    store.selectNode(null)
  }
}

const handleDragStart = (node: any, e: DragEvent): void => {
  if (!e.dataTransfer) return
  if (!selectedIds.value.has(node.data.id)) {
    selectedIds.value.clear()
    selectedIds.value.add(node.data.id)
    store.selectNode(node.data.id)
  }
  const payload = JSON.stringify([...selectedIds.value])
  e.dataTransfer.setData('application/json', payload)
  e.dataTransfer.effectAllowed = 'copy'
}

const getIconColor = (role: string, isPlaced: boolean, diffStatus: string): string => {
  if (diffStatus === 'missing') return '#909399'
  if (isPlaced) return '#909399'
  switch (role) {
    case DeviceRole.LEADER: return '#ff4d4f'
    case DeviceRole.ROUTER: return '#1890ff'
    default: return '#52c41a'
  }
}

const findPathToNode = (nodes: ITreeNode[], targetId: string, path: string[] = []): string[] | null => {
  for (const node of nodes) {
    if (node.id === targetId) return path
    if (node.children) {
      const result = findPathToNode(node.children, targetId, [...path, node.id])
      if (result) return result
    }
  }
  return null
}

watch(() => store.selectedNodeId, (nodeId) => {
  if (!nodeId) {
    selectedIds.value.clear()
    return
  }
  
  selectedIds.value.clear()
  selectedIds.value.add(nodeId)
  lastFocusedId.value = nodeId

  const path = findPathToNode(treeData.value, nodeId)
  if (path) {
    path.forEach(key => {
      if (!expandedKeys.value.includes(key)) {
        expandedKeys.value.push(key)
      }
    })
    
    nextTick(() => {
      treeRef.value?.setCurrentKey(nodeId)
      const el = document.querySelector('.is-selected')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}, { immediate: true })

// [新增] 专门处理树聚焦请求（如从2D视图双击触发）
watch(() => store.treeFocusRequest, (req) => {
  if (!req) return
  const { nodeId } = req
  
  // 同步本地选择状态
  selectedIds.value.clear()
  selectedIds.value.add(nodeId)
  lastFocusedId.value = nodeId

  // 确保 Store 状态也同步
  if (store.selectedNodeId !== nodeId) {
    store.selectNode(nodeId)
  }

  // 展开路径并滚动到视图中心
  const path = findPathToNode(treeData.value, nodeId)
  if (path) {
    path.forEach(key => {
      if (!expandedKeys.value.includes(key)) {
        expandedKeys.value.push(key)
      }
    })
    
    nextTick(() => {
      treeRef.value?.setCurrentKey(nodeId)
      // 给一点延迟或者多次尝试，确保 Element Plus 渲染完成
      setTimeout(() => {
        const el = document.querySelector('.el-tree-node.is-current') || document.querySelector('.is-selected')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    })
  }
})
</script>

<template>
  <div class="device-tree-wrapper">
    <div class="search-box">
      <el-input 
        v-model="filterText" 
        placeholder="搜索设备..." 
        size="small" 
        :prefix-icon="Search" 
        clearable 
        class="ios-search"
      />
    </div>

    <div class="tree-content">
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="id"
        :default-expanded-keys="expandedKeys"
        :filter-node-method="filterNode"
        :expand-on-click-node="false"
        :highlight-current="false" 
        @node-click="handleNodeClick"
        @node-expand="handleNodeExpand"
        @node-collapse="handleNodeCollapse"
      >
        <template #default="{ node, data }">
          <div 
            class="custom-tree-node"
            :class="{ 'is-selected': selectedIds.has(data.id) }"
            :draggable="data.type === 'device'"
            @dragstart="(e) => handleDragStart(node, e)"
          >
            <span v-if="data.type === 'loop'" class="loop-label">📁 {{ node.label }}</span>
            <span v-else-if="data.type === 'orphan-group'" class="orphan-label">{{ node.label }}</span>
            <span v-else class="device-item" :class="{ 'is-missing': data.data?.diffStatus === 'missing' }">
              <el-icon v-if="data.data?.isPlaced" class="placed-icon"><Check /></el-icon>
              
              <span 
                class="status-dot" 
                :style="{ color: getIconColor(data.role, data.data?.isPlaced, data.data?.diffStatus) }"
              >●</span>
              
              <span 
                class="device-label" 
                :class="{ 
                  'is-leader': data.role === DeviceRole.LEADER,
                  'is-placed': data.data?.isPlaced 
                }"
              >
                {{ node.label }}
              </span>
              
              <span v-if="data.data?.diffStatus === 'new'" class="new-dot"></span>
            </span>
          </div>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<style scoped>
.device-tree-wrapper { 
  display: flex; 
  flex-direction: column; 
  height: 100%; 
  background-color: transparent; 
}
.search-box { 
  padding: 10px 16px; 
  flex-shrink: 0; 
}
:deep(.ios-search .el-input__wrapper) {
  background-color: rgba(0, 0, 0, 0.05) !important;
  box-shadow: none !important;
  border-radius: 10px !important;
  padding-left: 12px;
}
html.dark :deep(.ios-search .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.tree-content { 
  flex: 1; 
  overflow-y: auto; 
  min-height: 0; 
  padding: 0 8px;
}

:deep(.el-tree) {
  background: transparent !important;
  --el-tree-node-hover-bg-color: rgba(0, 0, 0, 0.04);
}
html.dark :deep(.el-tree) {
  --el-tree-node-hover-bg-color: rgba(255, 255, 255, 0.05);
}

:deep(.el-tree-node__content) {
  height: auto !important;
  padding: 2px 0;
}

.custom-tree-node {
  display: flex; 
  align-items: center; 
  font-size: 13px; 
  width: 100%; 
  overflow: hidden;
  padding: 6px 10px; 
  cursor: pointer; 
  border-radius: 8px; 
  transition: background-color 0.2s, color 0.2s;
  margin: 1px 0;
}
.custom-tree-node.is-selected { 
  background-color: #007aff !important; 
  color: #ffffff !important;
}

.loop-label { 
  font-weight: 600; 
  color: var(--text-color); 
}
.custom-tree-node.is-selected .loop-label { 
  color: #ffffff; 
}

.orphan-label { 
  color: #909399; 
  font-style: italic; 
}

.device-item { 
  display: flex; 
  align-items: center; 
  width: 100%; 
}
.device-item.is-missing { 
  opacity: 0.6; 
  text-decoration: line-through; 
}

.status-dot { 
  margin-right: 8px; 
  font-size: 10px; 
  line-height: 1; 
}
.device-label { 
  margin-right: 8px; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  font-weight: 400; 
}
.device-label.is-leader { 
  font-weight: 600; 
}
.device-label.is-placed { 
  color: #909399; 
  opacity: 0.7; 
} 
.custom-tree-node.is-selected .device-label.is-placed { 
  color: rgba(255, 255, 255, 0.8); 
}

.placed-icon { 
  font-size: 12px; 
  color: #34c759; 
  margin-right: 6px; 
}
.custom-tree-node.is-selected .status-dot,
.custom-tree-node.is-selected .placed-icon { 
  color: #ffffff !important; 
}

.new-dot { 
  width: 6px; 
  height: 6px; 
  background-color: #34c759; 
  border-radius: 50%; 
  margin-left: auto; 
  margin-right: 2px; 
}
</style>
