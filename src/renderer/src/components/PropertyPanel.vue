<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { storeToRefs } from 'pinia'

const store = useProjectStore()
// 使用 storeToRefs 保持响应性
const { selectedNode } = storeToRefs(store)
</script>

<template>
  <div class="property-panel-container">
    <div class="panel-header">
      <span>属性面板</span>
    </div>

    <div v-if="selectedNode" class="panel-content">
      <el-form label-position="top" size="small">
        <el-form-item label="设备名称 (Label)">
          <el-input v-model="selectedNode.label" />
        </el-form-item>
        
        <el-form-item label="MAC 地址">
          <el-input v-model="selectedNode.mac" disabled />
        </el-form-item>

        <div class="row">
           <el-form-item label="楼层 (Floor)" style="flex: 1; margin-right: 5px;">
            <el-input v-model="selectedNode.floorId" />
          </el-form-item>
          <el-form-item label="建筑 (Bld)" style="flex: 1;">
            <el-input v-model="selectedNode.buildingId" />
          </el-form-item>
        </div>

        <el-divider content-position="left">物理坐标 (米)</el-divider>
        
        <div class="row">
          <el-form-item label="X" style="flex: 1;">
            <el-input-number v-model="selectedNode.position.x" :precision="2" :step="0.1" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="Y" style="flex: 1; margin-left: 5px;">
            <el-input-number v-model="selectedNode.position.y" :precision="2" :step="0.1" controls-position="right" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
    </div>

    <div v-else class="empty-state">
      <el-icon :size="40" color="#909399"><InfoFilled /></el-icon>
      <p>请选择一个设备</p>
    </div>
  </div>
</template>

<style scoped>
.property-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid #dcdfe6;
  background-color: #fff;
}
.panel-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  font-weight: bold;
  font-size: 13px;
  color: #606266;
}
.panel-content {
  padding: 15px;
  overflow-y: auto;
}
.row {
  display: flex;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 13px;
}
</style>