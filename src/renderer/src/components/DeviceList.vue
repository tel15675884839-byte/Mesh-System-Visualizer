<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { computed } from 'vue'

const store = useProjectStore()

// 表格行点击事件
const handleRowClick = (row: any) => {
  store.selectNode(row.id)
}

// 格式化角色显示（截取第一个单词）
const formatRole = (role: string) => role.split(' ')[0]
</script>

<template>
  <div class="device-list-container">
    <div class="panel-header">
      <span>设备列表 ({{ store.deviceCounts.total }})</span>
      <el-button size="small" circle text>➕</el-button>
    </div>
    
    <el-table 
      :data="store.nodes" 
      style="width: 100%; height: 100%;" 
      highlight-current-row
      @current-change="handleRowClick"
      size="small"
    >
      <el-table-column prop="label" label="Name" min-width="100" show-overflow-tooltip />
      <el-table-column prop="role" label="Role" width="80">
        <template #default="scope">
          <el-tag size="small" :type="scope.row.role === 'Leader' ? 'warning' : 'info'">
            {{ formatRole(scope.row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="MAC" width="60">
        <template #default="scope">
          <span style="font-family: monospace;">{{ scope.row.mac.slice(-4) }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.device-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #dcdfe6;
  background-color: #fff;
}
.panel-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  font-weight: bold;
  font-size: 13px;
  color: #606266;
}
</style>