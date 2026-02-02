<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { Moon, Sunny, FolderOpened, RefreshRight, Rank } from '@element-plus/icons-vue'

const store = useProjectStore()

// [修改] 处理菜单点击
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
      store.closeProject() // 退回到启动页
      break
    case 'new':
      store.closeProject() // 先关闭当前，让用户回到启动页点新建
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
        <!-- 显示当前文件名 -->
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

        <el-dropdown trigger="click">
          <span class="menu-item">编辑 (Edit)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>撤销 (Undo)</el-dropdown-item>
              <el-dropdown-item>重做 (Redo)</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="click">
          <span class="menu-item">视图 (View)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>重置布局</el-dropdown-item>
              <el-dropdown-item>显示网格</el-dropdown-item>
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
          style="margin-right: 10px"
        />
      </div>
    </div>

    <!-- 工具栏只在项目加载后显示 -->
    <div class="toolbar-row" v-if="store.isProjectLoaded">
      <el-button-group class="tool-group">
        <el-tooltip content="保存当前更改" placement="bottom">
          <el-button size="small" @click="store.saveToDisk">💾</el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group class="tool-group">
        <el-tooltip content="刷新视图" placement="bottom">
          <el-button size="small" :icon="RefreshRight" />
        </el-tooltip>
      </el-button-group>
    </div>
  </div>
</template>

<style scoped>
.menubar-container {
  display: flex;
  flex-direction: column;
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s;
}
.top-menu-row {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
}
.logo-area { margin-right: 20px; font-weight: bold; color: var(--text-color); display: flex; align-items: center; gap: 6px; }
.menus { flex: 1; display: flex; gap: 15px; }
.menu-item { cursor: pointer; padding: 2px 6px; border-radius: 4px; color: var(--text-color); user-select: none; }
.menu-item:hover { background-color: rgba(128, 128, 128, 0.1); }
.window-controls { display: flex; align-items: center; margin-left: auto; }
.toolbar-row { height: 40px; display: flex; align-items: center; padding: 0 10px; gap: 10px; background-color: var(--panel-bg); }
</style>