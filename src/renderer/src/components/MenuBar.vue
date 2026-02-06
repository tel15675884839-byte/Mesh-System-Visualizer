<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { Moon, Sunny, Operation, VideoCamera, MapLocation } from '@element-plus/icons-vue'

const store = useProjectStore()

const handleMenuCommand = async (command: string) => {
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
        <span v-if="store.projectInfo.filePath" style="font-weight: normal; font-size: 12px; margin-left: 10px; color: #909399">
          - {{ store.projectInfo.name }}
        </span>
      </div>
      
      <div class="menus" v-if="store.isProjectLoaded">
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <span class="menu-item">文件 (File)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="new">新建工程</el-dropdown-item>
              <el-dropdown-item command="open" icon="FolderOpened">打开工程...</el-dropdown-item>
              <el-dropdown-item command="save" divided>保存</el-dropdown-item>
              <el-dropdown-item command="save-as">另存为...</el-dropdown-item>
              <el-dropdown-item command="exit" divided>关闭项目</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="click" @command="handleMenuCommand">
          <span class="menu-item">编辑 (Edit)</span>
          <template #dropdown>
              <el-dropdown-item divided command="config-building" :icon="Operation">
                建筑与图纸配置...
              </el-dropdown-item>
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
          style="margin-right: 10px"
        />
      </div>
    </div>

    <div class="toolbar-row" v-if="store.isProjectLoaded">
      <el-button-group class="tool-group">
        <el-tooltip content="保存当前更改" placement="bottom">
          <el-button size="small" @click="store.saveToDisk">💾</el-button>
        </el-tooltip>
        
        <el-tooltip content="配置建筑与图纸" placement="bottom">
          <el-button size="small" @click="store.toggleBuildingEditor(true)" :icon="Operation"></el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <!-- [新增] 视图切换器移动到这里 -->
      <div class="tool-group">
        <el-radio-group v-model="store.currentViewMode" size="small">
          <el-radio-button label="2D"><el-icon><MapLocation /></el-icon> 2D</el-radio-button>
          <el-radio-button label="3D"><el-icon><VideoCamera /></el-icon> 3D</el-radio-button>
        </el-radio-group>
      </div>

    </div>
  </div>
</template>

<style scoped>
.menubar-container {
  display: flex; flex-direction: column; background-color: var(--header-bg);
  border-bottom: 1px solid var(--border-color); transition: background-color 0.3s;
}
.top-menu-row { height: 30px; display: flex; align-items: center; padding: 0 10px; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.logo-area { margin-right: 20px; font-weight: bold; color: var(--text-color); display: flex; align-items: center; gap: 6px; }
.menus { flex: 1; display: flex; gap: 15px; }
.menu-item { cursor: pointer; padding: 2px 6px; border-radius: 4px; color: var(--text-color); user-select: none; }
.menu-item:hover { background-color: rgba(128, 128, 128, 0.1); }
.window-controls { display: flex; align-items: center; margin-left: auto; }
.toolbar-row { height: 40px; display: flex; align-items: center; padding: 0 10px; gap: 10px; background-color: var(--panel-bg); }
.tool-group { display: flex; align-items: center; }
</style>