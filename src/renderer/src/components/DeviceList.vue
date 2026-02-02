<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import DeviceTree from './DeviceTree.vue' // [新增] 引入树组件

const store = useProjectStore()
</script>

<template>
  <div class="device-list-container">
    <div class="panel-header">
      <span>设备列表 ({{ store.deviceCounts.total }})</span>
      <el-button size="small" circle text title="刷新">🔄</el-button>
    </div>
    
    <!-- 替换为 DeviceTree 组件 -->
    <div class="list-body">
      <DeviceTree />
    </div>
  </div>
</template>

<style scoped>
.device-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: none; /* 由父布局控制边框 */
  background-color: var(--panel-bg);
}
.panel-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  font-weight: bold;
  font-size: 13px;
  color: var(--text-color);
  flex-shrink: 0;
}
.list-body {
  flex: 1;
  overflow: hidden;
}
</style>