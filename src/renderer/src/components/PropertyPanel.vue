<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { storeToRefs } from 'pinia'
import { InfoFilled, DArrowRight, CopyDocument, LocationInformation, Warning, Monitor, Connection, Place } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { DeviceRole, DeviceType } from '../types'

const emit = defineEmits(['close'])

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

const deviceCategoryLabel = computed(() => {
  if (isInfrastructure.value) return 'Node'
  return 'Device'
})

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

const copyMac = () => {
  if (selectedNode.value?.mac) {
    navigator.clipboard.writeText(selectedNode.value.mac)
    ElMessage.success('MAC 地址已复制')
  }
}
</script>

<template>
  <div class="property-panel-container">
    <!-- Header -->
    <div class="panel-header">
      <span class="header-title">属性面板</span>
      <el-button 
        link 
        size="small" 
        :icon="DArrowRight" 
        @click="emit('close')" 
        title="隐藏面板"
        class="close-btn"
      />
    </div>

    <div v-if="selectedNode" class="panel-content">
      <el-form label-position="top" size="small" class="compact-form">
        
        <!-- SECTION 1: IDENTITY -->
        <div class="group-header">
          <el-icon><Monitor /></el-icon>
          <span>基础信息 (IDENTITY)</span>
        </div>
        
        <el-form-item label="设备名称">
          <el-input v-model="selectedNode.label" placeholder="请输入设备名称" style="width: 100%" />
        </el-form-item>
        
        <el-form-item label="MAC 地址">
          <el-input v-model="selectedNode.mac" readonly style="width: 100%">
            <template #append>
              <el-button :icon="CopyDocument" @click="copyMac" title="复制" />
            </template>
          </el-input>
        </el-form-item>

        <!-- SECTION 2: NETWORK -->
        <div class="group-header">
          <el-icon><Connection /></el-icon>
          <span>网络属性 (NETWORK)</span>
        </div>

        <div class="grid-row">
          <el-form-item label="所属回路">
            <el-tag type="info" effect="light" style="width: 100%; text-align: center;">
              {{ loopName }}
            </el-tag>
          </el-form-item>
          <el-form-item label="设备类别">
            <el-tag :type="isInfrastructure ? 'danger' : 'primary'" effect="light" style="width: 100%; text-align: center;">
              {{ deviceCategoryLabel }}
            </el-tag>
          </el-form-item>
        </div>

        <el-form-item v-if="!isInfrastructure" label="设备型号 (Model)">
          <el-select v-model="selectedNode.type" placeholder="Select Model" style="width: 100%">
            <el-option
              v-for="item in deviceTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <!-- Missing Alert -->
        <div v-if="selectedNode.diffStatus === 'missing'" class="status-card missing">
          <div class="card-title">
            <el-icon><Warning /></el-icon> 设备缺失
          </div>
          <div class="card-desc">该设备在最新导入的拓扑中已不存在。</div>
        </div>

        <!-- SECTION 3: LOCATION -->
        <div class="group-header">
          <el-icon><Place /></el-icon>
          <span>位置信息 (LOCATION)</span>
        </div>

        <div v-if="selectedNode.isPlaced" class="location-card">
          <div class="loc-item">
            <span class="loc-label">建筑</span>
            <span class="loc-value">{{ buildingName }}</span>
          </div>
          <div class="loc-item">
            <span class="loc-label">楼层</span>
            <span class="loc-value">{{ floorName }}</span>
          </div>
          
          <div class="loc-actions">
            <el-button 
              v-if="selectedNode.diffStatus === 'missing'"
              type="danger" size="default" style="width: 100%" 
              @click="deletePermanently"
            >
              永久删除
            </el-button>
            <el-button 
              v-else
              type="danger" plain size="default" style="width: 100%" 
              @click="removeFromCanvas"
            >
              移出图纸 (撤销布点)
            </el-button>
          </div>
        </div>
        
        <div v-else class="empty-location">
          <div class="empty-icon-bg">
            <el-icon :size="20"><LocationInformation /></el-icon>
          </div>
          <p>未布点</p>
          <span>请从左侧列表拖拽至画布进行配置</span>
        </div>

      </el-form>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-illustration">
        <el-icon :size="48" color="#dcdfe6"><InfoFilled /></el-icon>
      </div>
      <p>未选择设备</p>
      <span>请在列表或图纸中选择一个设备查看详情</span>
    </div>
  </div>
</template>

<style scoped>
/* 核心修复：width: 100% 确保占满 flex 容器 */
.property-panel-container { 
  display: flex; 
  flex-direction: column; 
  height: 100%; 
  width: 100%; 
  background-color: var(--panel-bg); 
  /* 移除边框，防止双重边框 */
  border-left: none;
}

.panel-header { 
  height: 40px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  padding: 0 12px; 
  background-color: var(--bg-color); 
  border-bottom: 1px solid var(--border-color); 
  flex-shrink: 0;
}

.header-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-content { 
  flex: 1;
  padding: 16px; 
  overflow-y: auto; 
  overflow-x: hidden;
  color: var(--text-color); 
}

/* 分组标题样式优化 */
.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #909399;
  margin: 20px 0 10px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
  letter-spacing: 0.5px;
}
.group-header:first-child { margin-top: 0; }

/* 表单布局 */
.compact-form :deep(.el-form-item) {
  margin-bottom: 14px;
}
.compact-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.8;
}

/* Grid 布局代替 Flex，对齐更稳 */
.grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* 状态卡片 */
.status-card {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 12px;
}
.status-card.missing {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fab6b6;
}
.card-title { font-weight: bold; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }

/* 位置信息卡片 */
.location-card {
  background-color: rgba(0,0,0,0.02);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 16px;
}
.loc-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 10px;
  align-items: center;
}
.loc-label { color: #909399; font-size: 12px; }
.loc-value { font-weight: 600; color: var(--text-color); font-family: monospace; }
.loc-actions { margin-top: 16px; }

/* 空状态样式优化 */
.empty-location {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  color: #909399;
  background-color: rgba(0,0,0,0.01);
}
.empty-icon-bg {
  background: var(--bg-color);
  padding: 8px;
  border-radius: 50%;
  margin-bottom: 8px;
}
.empty-location p { font-weight: 600; margin: 0 0 4px; font-size: 13px; color: var(--text-color); }
.empty-location span { font-size: 11px; opacity: 0.7; text-align: center; }

.empty-state { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  height: 100%; 
  color: #909399; 
  text-align: center;
  padding: 20px;
}
.empty-illustration {
  margin-bottom: 16px;
  opacity: 0.5;
}
.empty-state p { margin: 0 0 6px; font-weight: 600; color: var(--text-color); font-size: 14px; }
.empty-state span { font-size: 12px; opacity: 0.7; max-width: 200px; line-height: 1.5; }
</style>