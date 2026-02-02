<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { storeToRefs } from 'pinia'
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { DeviceRole, DeviceType } from '../types'

const store = useProjectStore()
const { selectedNode } = storeToRefs(store)

const buildingName = computed(() => {
  if (!selectedNode.value) return ''
  return store.getBuildingName(selectedNode.value.buildingId)
})

const floorName = computed(() => {
  if (!selectedNode.value) return ''
  return store.getFloorName(selectedNode.value.buildingId, selectedNode.value.floorId)
})

const loopName = computed(() => {
  if (!selectedNode.value || !selectedNode.value.loopId) return '未分配'
  const loop = store.loops.find(l => l.id === selectedNode.value!.loopId)
  return loop ? loop.name : '未知回路'
})

const isInfrastructure = computed(() => {
  if (!selectedNode.value) return false
  return selectedNode.value.role === DeviceRole.LEADER || selectedNode.value.role === DeviceRole.ROUTER
})

// 设备型号选项
const deviceTypeOptions = [
  { label: 'Smoke Detector (烟感)', value: DeviceType.SMOKE_DETECTOR },
  { label: 'Heat Detector (温感)', value: DeviceType.HEAT_DETECTOR },
  { label: 'Multi Sensor (复合)', value: DeviceType.MULT_DETECTOR },
  { label: 'Manual Call Point (手报)', value: DeviceType.MANUAL_CALL_POINT },
  { label: 'Sounder (声光)', value: DeviceType.SOUNDER },
  { label: 'I/O Module (模块)', value: DeviceType.IO_MODULE },
  { label: 'Default (默认)', value: DeviceType.DEFAULT }
]

const removeFromCanvas = () => {
  if (selectedNode.value) {
    store.unplaceNode(selectedNode.value.id)
  }
}

const deletePermanently = () => {
  if (!selectedNode.value) return
  ElMessageBox.confirm(
    '确定要永久删除该设备吗？此操作无法撤销。',
    '确认删除',
    { type: 'warning' }
  ).then(() => {
    store.deleteNode(selectedNode.value!.id)
  })
}
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
          <el-form-item label="所属回路" style="flex: 1; margin-right: 5px;">
            <el-tag type="info" size="small">{{ loopName }}</el-tag>
          </el-form-item>
          <el-form-item label="角色" style="flex: 1;">
            <el-tag :type="selectedNode.role === 'Leader' ? 'danger' : 'primary'" size="small">
              {{ selectedNode.role }}
            </el-tag>
          </el-form-item>
        </div>

        <!-- [新增] 设备型号选择 (仅对终端设备显示) -->
        <el-form-item v-if="!isInfrastructure" label="设备型号 (Model)">
          <el-select v-model="selectedNode.type" placeholder="Select Model">
            <el-option
              v-for="item in deviceTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <div v-if="selectedNode.diffStatus === 'missing'" class="missing-alert">
          <el-icon><InfoFilled /></el-icon> 该设备在最新拓扑中已缺失
        </div>

        <el-divider content-position="left">位置信息</el-divider>

        <div v-if="selectedNode.isPlaced">
          <div class="info-row">
            <span class="label">建筑：</span>
            <span class="value">{{ buildingName }}</span>
          </div>
          <div class="info-row">
            <span class="label">楼层：</span>
            <span class="value">{{ floorName }}</span>
          </div>
          
          <el-button 
            v-if="selectedNode.diffStatus === 'missing'"
            type="danger" size="small" style="width: 100%; margin-top: 15px;" 
            @click="deletePermanently"
          >
            永久删除 (Missing Device)
          </el-button>
          <el-button 
            v-else
            type="danger" plain size="small" style="width: 100%; margin-top: 15px;" 
            @click="removeFromCanvas"
          >
            从当前图纸移除
          </el-button>
        </div>
        
        <div v-else class="empty-state-mini">
          <el-icon><InfoFilled /></el-icon>
          <span>该设备尚未放置在图纸上</span>
          <p class="hint">请从左侧列表拖拽至画布</p>
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
.property-panel-container { display: flex; flex-direction: column; height: 100%; border-left: none; background-color: var(--panel-bg); }
.panel-header { height: 40px; display: flex; align-items: center; padding: 0 10px; background-color: var(--bg-color); border-bottom: 1px solid var(--border-color); color: var(--text-color); font-weight: bold; font-size: 13px; }
.panel-content { padding: 15px; overflow-y: auto; color: var(--text-color); }
.row { display: flex; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-color); opacity: 0.5; font-size: 13px; }
.empty-state-mini { background: rgba(0,0,0,0.03); padding: 15px; border-radius: 4px; text-align: center; color: #909399; font-size: 12px; }
.hint { margin: 5px 0 0; font-size: 11px; }
.info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px; }
.info-row .label { color: #909399; }
.info-row .value { font-weight: bold; }
.missing-alert { background-color: #fef0f0; color: #f56c6c; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
</style>