<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import {
  Moon,
  Sunny,
  Operation,
  VideoCamera,
  MapLocation,
  FolderOpened,
  Plus,
  DocumentChecked,
  Download,
  SwitchButton,
  Check,
  RefreshLeft
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import logoImg from '../assets/logo.svg'

const store = useProjectStore()

const confirmAndNew = async (): Promise<void> => {
  try {
    const action = await ElMessageBox({
      title: '确认新建',
      message: '新建工程将关闭当前项目。是否保存当前更改后再继续？',
      confirmButtonText: '保存并继续',
      cancelButtonText: '直接继续',
      showCancelButton: true,
      distinguishCancelAndClose: true,
      type: 'warning'
    })
    if (action === 'confirm') await store.saveToDisk()
    store.closeProject()
  } catch (action) {
    if (action === 'cancel') store.closeProject()
  }
}

const confirmAndOpen = async (): Promise<void> => {
  try {
    const action = await ElMessageBox({
      title: '确认打开',
      message: '打开新工程将关闭当前项目。是否保存当前更改后再继续？',
      confirmButtonText: '保存并继续',
      cancelButtonText: '直接继续',
      showCancelButton: true,
      distinguishCancelAndClose: true,
      type: 'warning'
    })
    if (action === 'confirm') await store.saveToDisk()
    await store.loadFromDisk()
  } catch (action) {
    if (action === 'cancel') await store.loadFromDisk()
  }
}

const confirmAndClose = async (): Promise<void> => {
  try {
    const action = await ElMessageBox({
      title: '确认退出',
      message: '确定要退出当前项目吗？您可以选择保存当前更改或直接退出。',
      confirmButtonText: '保存并退出',
      cancelButtonText: '直接退出',
      showCancelButton: true,
      distinguishCancelAndClose: true,
      type: 'warning'
    })
    if (action === 'confirm') await store.saveToDisk()
    store.closeProject()
  } catch (action) {
    if (action === 'cancel') store.closeProject()
  }
}

// [新增] 拓扑变动待确认的回路
const pendingLoops = computed(() => {
  return store.loops.filter((l) => store.hasPendingChanges(l.id))
})

const handleConfirmTopology = (loopId: string): void => {
  store.commitTopologyChanges(loopId)
}

const handleDiscardTopology = (loopId: string): void => {
  store.discardTopologyChanges(loopId)
}
</script>

<template>
  <div class="menubar-container">
    <div class="top-menu-row">
      <div class="logo-area">
        <img :src="logoImg" alt="Logo" class="header-logo" />
        <span class="app-title">Numens Mesh Studio</span>
        <span v-if="store.projectInfo.filePath" class="project-name">
          - {{ store.projectInfo.name }}
        </span>
      </div>

      <div v-if="store.isProjectLoaded" class="menus">
        <!-- 菜单已移至下方工具栏 -->
      </div>

      <div class="window-controls">
        <el-switch
          v-model="store.isDark"
          inline-prompt
          :active-icon="Moon"
          :inactive-icon="Sunny"
          @change="store.toggleTheme"
        />
      </div>
    </div>

    <div v-if="store.isProjectLoaded" class="toolbar-row">
      <div class="tool-group">
        <el-tooltip content="新建项目" placement="bottom">
          <el-button class="square-btn" size="small" :icon="Plus" @click="confirmAndNew" />
        </el-tooltip>
        <el-tooltip content="打开项目" placement="bottom">
          <el-button class="square-btn" size="small" :icon="FolderOpened" @click="confirmAndOpen" />
        </el-tooltip>
        <el-tooltip content="保存当前更改" placement="bottom">
          <el-button
            class="square-btn"
            size="small"
            :icon="DocumentChecked"
            @click="store.saveToDisk(false)"
          />
        </el-tooltip>
        <el-tooltip content="另存为..." placement="bottom">
          <el-button
            class="square-btn"
            size="small"
            :icon="Download"
            @click="store.saveToDisk(true)"
          />
        </el-tooltip>
        <el-tooltip content="配置建筑与图纸" placement="bottom">
          <el-button
            class="square-btn"
            size="small"
            :icon="Operation"
            @click="store.toggleBuildingEditor(true)"
          />
        </el-tooltip>
        <el-tooltip content="退出当前项目" placement="bottom">
          <el-button
            class="square-btn"
            size="small"
            type="danger"
            plain
            :icon="SwitchButton"
            @click="confirmAndClose"
          />
        </el-tooltip>
      </div>

      <el-divider direction="vertical" />

      <div class="tool-group">
        <el-radio-group v-model="store.currentViewMode" size="small" class="view-switch">
          <el-radio-button value="2D"
            ><el-icon><MapLocation /></el-icon> 2D</el-radio-button
          >
          <el-radio-button value="3D"
            ><el-icon><VideoCamera /></el-icon> 3D</el-radio-button
          >
        </el-radio-group>
      </div>

      <!-- [新增] 拓扑预览确认胶囊 (位置对应用户图示红框) -->
      <transition name="review-fade">
        <div v-if="pendingLoops.length > 0" class="review-capsule">
          <div v-for="loop in pendingLoops" :key="loop.id" class="review-item">
            <span class="review-text">预览: {{ loop.name }} 变更</span>
            <el-divider direction="vertical" />
            <el-button
              type="success"
              size="small"
              circle
              :icon="Check"
              @click="handleConfirmTopology(loop.id)"
            />
            <el-button
              type="info"
              size="small"
              circle
              plain
              :icon="RefreshLeft"
              @click="handleDiscardTopology(loop.id)"
            />
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.menubar-container {
  display: flex;
  flex-direction: column;
  background-color: var(--header-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 100;
}

.top-menu-row {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-color);
}

.logo-area {
  margin-right: 30px;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-logo {
  width: 20px;
  height: auto;
  user-select: none;
}

.project-name {
  font-weight: normal;
  font-size: 12px;
  margin-left: 10px;
  color: var(--secondary-text);
}

.menus {
  flex: 1;
  display: flex;
  gap: 20px;
}

.menu-item {
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  color: var(--text-color);
  user-select: none;
  font-weight: 500;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

html.dark .menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.window-controls {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.toolbar-row {
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 15px;
  background-color: transparent;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 0.5px; /* 增加图标之间的间距 */
}

.square-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px !important; /* 圆角正方形 */
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.square-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.view-switch :deep(.el-radio-button__inner) {
  border-radius: 8px !important;
  margin: 0 4px; /* 增加间距 */
  border: none !important;
  background: rgba(0, 0, 0, 0.05);
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
}

html.dark .view-switch :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.1);
}

.view-switch :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--ios-blue) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3) !important;
}

.el-divider--vertical {
  height: 24px;
  border-color: var(--border-color);
}

/* Review Capsule Styles */
.review-capsule {
  margin-left: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-item {
  display: flex;
  align-items: center;
  background: rgba(103, 194, 58, 0.1);
  border: 1px solid rgba(103, 194, 58, 0.3);
  padding: 2px 12px;
  border-radius: 20px;
  height: 32px;
}

.review-text {
  font-size: 12px;
  font-weight: 600;
  color: #67c23a;
  margin-right: 4px;
}

/* Animations */
.review-fade-enter-active,
.review-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.review-fade-enter-from,
.review-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
