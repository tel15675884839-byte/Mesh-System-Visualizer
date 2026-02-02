<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Search, Check } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { buildTopologyTree, type ITreeNode } from '../utils/treeHelper'
import { DeviceRole } from '../types'

const store = useProjectStore()
const filterText = ref('')
const treeRef = ref()
const containerRef = ref<HTMLElement | null>(null)

const expandedKeySet = ref<Set<string>>(new Set())
const expandedKeysArray = computed(() => Array.from(expandedKeySet.value))

const selectedIds = ref<Set<string>>(new Set())
const lastFocusedId = ref<string | null>(null) 

const treeData = computed(() => {
  return buildTopologyTree(store.nodes, store.edges, store.loops)
})

watch(() => store.loops, (loops) => {
  loops.forEach(l => expandedKeySet.value.add(`loop-root-${l.id}`))
}, { immediate: true, deep: true })

watch(filterText, (val) => {
  treeRef.value!.filter(val)
})

const filterNode = (value: string, data: any) => {
  if (!value) return true
  const matchLabel = data.label.toLowerCase().includes(value.toLowerCase())
  const matchId = data.id.toLowerCase().includes(value.toLowerCase())
  return matchLabel || matchId
}

const handleNodeExpand = (data: any) => { expandedKeySet.value.add(data.id) }
const handleNodeCollapse = (data: any) => { expandedKeySet.value.delete(data.id) }

const getVisibleFlatNodes = (): ITreeNode[] => {
  const flatList: ITreeNode[] = []
  const traverse = (nodes: ITreeNode[]) => {
    for (const node of nodes) {
      flatList.push(node)
      if (node.children && node.children.length > 0 && expandedKeySet.value.has(node.id)) {
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
      selectedIds.value.clear() 
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
    store.selectNode(node.data.id)
  }
  const payload = JSON.stringify([...selectedIds.value])
  e.dataTransfer.setData('application/json', payload)
  e.dataTransfer.effectAllowed = 'copy'
}

const getIconColor = (role: string, isPlaced: boolean, diffStatus: string) => {
  if (diffStatus === 'missing') return '#909399' // 缺失变灰
  if (isPlaced) return '#909399'
  switch (role) {
    case DeviceRole.LEADER: return '#ff4d4f'
    case DeviceRole.ROUTER: return '#1890ff'
    default: return '#52c41a'
  }
}

onMounted(() => {})
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
        :default-expanded-keys="expandedKeysArray"
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
              
              <!-- [新增] 绿色圆点提示新增设备 -->
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
.custom-tree-node.is-selected { background-color: #d9ecff; }
html.dark .custom-tree-node.is-selected { background-color: #264f78; }

.loop-label { font-weight: bold; color: var(--text-color); }
.orphan-label { color: #909399; font-style: italic; }
.device-item { display: flex; align-items: center; width: 100%; }
.device-item.is-missing { opacity: 0.6; text-decoration: line-through; } /* 缺失设备样式 */

.status-dot { margin-right: 6px; font-size: 12px; line-height: 1; }
.device-label { margin-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.device-label.is-leader { font-weight: bold; text-decoration: underline; }
.device-label.is-placed { color: #909399; text-decoration: line-through; } 

.placed-icon { font-size: 12px; color: #67c23a; margin-right: 4px; }
.new-dot { width: 8px; height: 8px; background-color: #67c23a; border-radius: 50%; margin-left: auto; margin-right: 5px; }
</style>