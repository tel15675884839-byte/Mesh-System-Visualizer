<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { Moon, Sunny, Operation, VideoCamera, MapLocation, FolderOpened } from '@element-plus/icons-vue'

const store = useProjectStore()

const handleMenuCommand = async (command: string): Promise<void> => {
  switch (command) {
    case 'save':
    case 'save-as':
      await store.saveToDisk()
      break
    case 'open':
      await store.loadFromDisk()
      break
    case 'exit':
      store.closeProject() 
      break
    case 'new':
      store.closeProject() 
      break
    case 'config-building':
      store.toggleBuildingEditor(true)
      break
  }
}
</script>

<template>
  <div class="menubar-container">
    <div class="top-menu-row">
      <div class="logo-area">
        <span class="app-icon">🧊</span>
        <span class="app-title">Numens Mesh Studio</span>
        <span v-if="store.projectInfo.filePath" class="project-name">
          - {{ store.projectInfo.name }}
        </span>
      </div>
      
      <div v-if="store.isProjectLoaded" class="menus">
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <span class="menu-item">文件 (File)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="new">新建工程</el-dropdown-item>
              <el-dropdown-item command="open" :icon="FolderOpened">打开工程...</el-dropdown-item>
              <el-dropdown-item command="save" divided>保存</el-dropdown-item>
              <el-dropdown-item command="save-as">另存为...</el-dropdown-item>
              <el-dropdown-item command="exit" divided>关闭项目</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="click" @command="handleMenuCommand">
          <span class="menu-item">编辑 (Edit)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="config-building" :icon="Operation">
                建筑与图纸配置...
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
      <el-button-group class="tool-group">
        <el-tooltip content="保存当前更改" placement="bottom">
          <el-button size="small" @click="store.saveToDisk">💾</el-button>
        </el-tooltip>
        
        <el-tooltip content="配置建筑与图纸" placement="bottom">
          <el-button size="small" :icon="Operation" @click="store.toggleBuildingEditor(true)" />
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <div class="tool-group">
        <el-radio-group v-model="store.currentViewMode" size="small" class="view-switch">
          <el-radio-button label="2D"><el-icon><MapLocation /></el-icon> 2D</el-radio-button>
          <el-radio-button label="3D"><el-icon><VideoCamera /></el-icon> 3D</el-radio-button>
        </el-radio-group>
      </div>
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

.app-icon {
  font-size: 18px;
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
}

.view-switch :deep(.el-radio-button__inner) {
  border-radius: 8px !important;
  margin: 0 2px;
  border: none !important;
  background: rgba(0, 0, 0, 0.05);
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
</style>