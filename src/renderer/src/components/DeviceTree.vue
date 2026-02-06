<script setup lang="ts">
import { ref, watch, onMounted, shallowRef, nextTick } from 'vue'
import { Search, Check } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { buildTopologyTree, type ITreeNode } from '../utils/treeHelper'
import { DeviceRole } from '../types'

const store = useProjectStore()
const filterText = ref('')
const treeRef = ref()

// [修复] 使用 ref<string[]> 替代 Set，确保 Vue 能正确追踪变化，防止重绘时折叠
const expandedKeys = ref<string[]>([])

const selectedIds = ref<Set<string>>(new Set())
const lastFocusedId = ref<string | null>(null) 

// [优化] 使用 shallowRef，避免 Vue 对巨大的树结构进行深度代理
// 树结构本身是静态的，只有内部引用的 data (INode) 是响应式的
const treeData = shallowRef<ITreeNode[]>([])

// [核心优化] 仅当结构版本号 (structureVersion) 变化时，才重构树结构
// 拖拽设备导致的 isPlaced 变更不改变版本号，因此不会触发 buildTopologyTree 计算
// 也就不会导致 el-tree 销毁重建 DOM，从而消除卡顿
watch(() => store.structureVersion, () => {
  treeData.value = buildTopologyTree(store.nodes, store.edges, store.loops)
}, { immediate: true })

// [修改] 移除自动展开逻辑，满足“不用在LOOP列表中展开”的需求
// 不再在挂载时或新增回路时自动展开

watch(filterText, (val) => {
  treeRef.value!.filter(val)
})

const filterNode = (value: string, data: any) => {
  if (!value) return true
  const matchLabel = data.label.toLowerCase().includes(value.toLowerCase())
  const matchId = data.id.toLowerCase().includes(value.toLowerCase())
  return matchLabel || matchId
}

// [修复] 正确维护展开状态数组
const handleNodeExpand = (data: any) => { 
  if (!expandedKeys.value.includes(data.id)) expandedKeys.value.push(data.id) 
}
const handleNodeCollapse = (data: any) => { 
  const idx = expandedKeys.value.indexOf(data.id)
  if (idx > -1) expandedKeys.value.splice(idx, 1)
}

const getVisibleFlatNodes = (): ITreeNode[] => {
  const flatList: ITreeNode[] = []
  // 为了性能，将数组转为 Set 用于快速查找
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

const handleNodeClick = (data: any, node: any, prop: any, e: MouseEvent) => {
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

const handleDragStart = (node: any, e: DragEvent) => {
  if (!e.dataTransfer) return
  if (!selectedIds.value.has(node.data.id)) {
    selectedIds.value.clear()
    selectedIds.value.add(node.data.id)
    // 拖拽开始时，如果只是为了拖拽，可以不触发全局选中（避免右侧面板刷新）
    // 但为了体验一致性，通常还是选中
    store.selectNode(node.data.id)
  }
  const payload = JSON.stringify([...selectedIds.value])
  e.dataTransfer.setData('application/json', payload)
  e.dataTransfer.effectAllowed = 'copy'
}

const getIconColor = (role: string, isPlaced: boolean, diffStatus: string) => {
  if (diffStatus === 'missing') return '#909399'
  if (isPlaced) return '#909399'
  switch (role) {
    case DeviceRole.LEADER: return '#ff4d4f'
    case DeviceRole.ROUTER: return '#1890ff'
    default: return '#52c41a'
  }
}

// [新增] 自动展开逻辑：当外部选中节点时（如 2D 点击），在树中展开并选中
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
  
  // 1. 同步选中状态
  selectedIds.value.clear()
  selectedIds.value.add(nodeId)
  lastFocusedId.value = nodeId

  // 2. 找到路径并自动展开
  const path = findPathToNode(treeData.value, nodeId)
  if (path) {
    path.forEach(key => {
      if (!expandedKeys.value.includes(key)) {
        expandedKeys.value.push(key)
      }
    })
    
    // 3. 滚动到选中项 (nextTick 确保渲染完成)
    nextTick(() => {
      treeRef.value?.setCurrentKey(nodeId)
      const el = document.querySelector('.is-selected')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}, { immediate: true })
</script>

<template>
  <div class="device-tree-wrapper">
    <div class="search-box">
      <el-input v-model="filterText" placeholder="搜索设备..." size="small" :prefix-icon="Search" clearable />
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
              
              <span class="status-dot" :style="{ color: getIconColor(data.role, data.data?.isPlaced, data.data?.diffStatus) }">●</span>
              
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
  display: flex; flex-direction: column; height: 100%; background-color: var(--panel-bg); 
}
.search-box { 
  padding: 10px; border-bottom: 1px solid var(--border-color); background-color: var(--bg-color); flex-shrink: 0; 
}
.tree-content { 
  flex: 1; overflow-y: auto; min-height: 0; padding: 5px 0; 
}

.custom-tree-node {
  display: flex; align-items: center; font-size: 13px; width: 100%; overflow: hidden;
  padding: 0 5px; cursor: pointer; border-radius: 3px; height: 26px;
}
.custom-tree-node.is-selected { background-color: #d9ecff !important; }
html.dark .custom-tree-node.is-selected { background-color: #264f78 !important; }

.loop-label { font-weight: bold; color: var(--text-color); }
.orphan-label { color: #909399; font-style: italic; }
.device-item { display: flex; align-items: center; width: 100%; }
.device-item.is-missing { opacity: 0.6; text-decoration: line-through; }

.status-dot { margin-right: 6px; font-size: 12px; line-height: 1; }
.device-label { margin-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.device-label.is-leader { font-weight: bold; text-decoration: underline; }
.device-label.is-placed { color: #909399; text-decoration: line-through; } 

.placed-icon { font-size: 12px; color: #67c23a; margin-right: 4px; }
.new-dot { width: 8px; height: 8px; background-color: #67c23a; border-radius: 50%; margin-left: auto; margin-right: 5px; }
</style>