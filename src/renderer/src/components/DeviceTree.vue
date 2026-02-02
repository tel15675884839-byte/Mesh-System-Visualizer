<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { buildTopologyTree } from '../utils/treeHelper'
import { DeviceRole } from '../types'

const store = useProjectStore()
const filterText = ref('')
const treeRef = ref()

// 计算树形数据
// 监听 nodes, edges, loops 变化，自动重新计算树结构
const treeData = computed(() => {
  return buildTopologyTree(store.nodes, store.edges, store.loops)
})

// 过滤逻辑
watch(filterText, (val) => {
  treeRef.value!.filter(val)
})

const filterNode = (value: string, data: any) => {
  if (!value) return true
  // 允许搜索 Label 或 ID
  const matchLabel = data.label.toLowerCase().includes(value.toLowerCase())
  const matchId = data.id.toLowerCase().includes(value.toLowerCase())
  return matchLabel || matchId
}

// 节点点击
const handleNodeClick = (data: any) => {
  if (data.type === 'device') {
    store.selectNode(data.id)
  }
}

// 图标颜色映射
const getIconColor = (role: string) => {
  switch (role) {
    case DeviceRole.LEADER: return '#ff4d4f' // 🔴 红
    case DeviceRole.ROUTER: return '#1890ff' // 🔵 蓝
    default: return '#52c41a' // 🟢 绿 (Child/EndDevice)
  }
}

// 图标形状映射 (简单字符或 SVG)
const getIconChar = (role: string) => {
  switch (role) {
    case DeviceRole.LEADER: return '●' // 实心圆
    case DeviceRole.ROUTER: return '●'
    default: return '●'
  }
}
</script>

<template>
  <div class="device-tree-wrapper">
    <!-- 搜索框 -->
    <div class="search-box">
      <el-input
        v-model="filterText"
        placeholder="搜索设备 MAC 或名称"
        size="small"
        :prefix-icon="Search"
        clearable
      />
    </div>

    <!-- 树形控件 -->
    <div class="tree-content">
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="id"
        :filter-node-method="filterNode"
        :expand-on-click-node="false"
        :default-expand-all="true"
        highlight-current
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="custom-tree-node">
            
            <!-- Loop 节点样式 -->
            <span v-if="data.type === 'loop'" class="loop-label">
              📁 {{ node.label }}
            </span>

            <!-- 孤岛分组样式 -->
            <span v-else-if="data.type === 'orphan-group'" class="orphan-label">
              {{ node.label }}
            </span>

            <!-- 设备节点样式 -->
            <span v-else class="device-item">
              <!-- 图标 -->
              <span 
                class="status-dot" 
                :style="{ color: getIconColor(data.role) }"
              >
                {{ getIconChar(data.role) }}
              </span>
              
              <!-- 文本 -->
              <span class="device-label" :class="{ 'is-leader': data.role === DeviceRole.LEADER }">
                {{ node.label }}
              </span>
              
              <!-- MAC 后缀 (灰色小字) -->
              <span class="mac-suffix" v-if="data.data && data.data.mac">
                {{ data.data.mac.slice(-4) }}
              </span>
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
  background-color: var(--panel-bg);
}

.search-box {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color);
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px 0;
}

/* 树节点样式微调 */
.custom-tree-node {
  display: flex;
  align-items: center;
  font-size: 13px;
  width: 100%;
  overflow: hidden;
}

.loop-label {
  font-weight: bold;
  color: var(--text-color);
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

.status-dot {
  margin-right: 6px;
  font-size: 12px;
  line-height: 1;
}

.device-label {
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.device-label.is-leader {
  font-weight: bold;
  text-decoration: underline; /* 额外强调 Leader */
}

.mac-suffix {
  color: #909399;
  font-size: 11px;
  font-family: monospace;
  margin-left: auto; /* 靠右对齐 */
  margin-right: 5px;
}
</style>