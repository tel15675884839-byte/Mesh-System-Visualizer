<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import BuildingManager from './BuildingManager.vue'
import LoopManager from './LoopManager.vue' // [新增]
import type { IBuilding } from '../types'

const store = useProjectStore()
const localBuildings = ref<IBuilding[]>([])
const activeTab = ref('building') // 控制 Tab

watch(
  () => store.isBuildingEditorVisible,
  (val) => {
    if (val) {
      localBuildings.value = JSON.parse(JSON.stringify(store.buildings))
      activeTab.value = 'building'
    }
  }
)

const handleClose = () => {
  store.toggleBuildingEditor(false)
}

const handleSave = () => {
  // 只保存建筑数据的更改 (Loop 数据的更改是即时生效的)
  store.updateBuildings(localBuildings.value)
  handleClose()
}

const handleResolutionChange = (payload: {
  floorId: string
  oldWidth: number
  oldHeight: number
  newWidth: number
  newHeight: number
}) => {
  const scaleX = payload.newWidth / payload.oldWidth
  const scaleY = payload.newHeight / payload.oldHeight

  // 遍历全局节点库，对该楼层的节点进行位移缩放
  store.nodes.forEach((node) => {
    if (node.floorId === payload.floorId && node.position) {
      node.position.x *= scaleX
      node.position.y *= scaleY
    }
  })
}
</script>

<template>
  <el-dialog
    v-model="store.isBuildingEditorVisible"
    title="配置管理"
    width="700px"
    :before-close="handleClose"
    align-center
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="建筑与图纸" name="building">
        <div class="editor-content">
          <BuildingManager
            v-model="localBuildings"
            @map-resolution-change="handleResolutionChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="拓扑数据管理" name="loop">
        <div class="editor-content">
          <LoopManager />
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <!-- 只有在建筑 Tab 才显示保存按钮，Loop 操作是即时的 -->
        <el-button v-if="activeTab === 'building'" type="primary" @click="handleSave"
          >保存建筑更改</el-button
        >
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.editor-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 5px;
}
</style>
