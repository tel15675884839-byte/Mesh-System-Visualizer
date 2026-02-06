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
  background-color: var(--panel-bg);
}
.panel-header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background-color: transparent;
  font-weight: 700;
  font-size: 15px;
  color: var(--text-color);
  flex-shrink: 0;
}
.list-body {
  flex: 1;
  overflow: hidden;
  padding: 0 8px; /* 给内部树留一点呼吸空间 */
}
</style>