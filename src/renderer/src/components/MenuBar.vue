<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { Moon, Sunny, FolderOpened, RefreshRight, Rank } from '@element-plus/icons-vue'

const store = useProjectStore()

// 模拟菜单动作
const handleMenuCommand = (command: string) => {
  console.log(`Menu command: ${command}`)
}
</script>

<template>
  <div class="menubar-container">
    <!-- 第一行：文字菜单栏 (类似 VS Code / Office) -->
    <div class="top-menu-row">
      <div class="logo-area">
        <span class="app-icon">🧊</span>
        <span class="app-title">Numens Mesh Studio</span>
      </div>
      
      <div class="menus">
        <el-dropdown trigger="click" @command="handleMenuCommand">
          <span class="menu-item">文件 (File)</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="new">新建工程</el-dropdown-item>
              <el-dropdown-item command="open" icon="FolderOpened">打开工程...</el-dropdown-item>
              <el-dropdown-item command="save" divided>保存</el-dropdown-item>
              <el-dropdown-item command="save-as">另存为...</el-dropdown-item>
              <el-dropdown-item command="exit" divided>退出</el-dropdown-item>
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
      
      <!-- 右侧控制区 -->
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

    <!-- 第二行：快捷工具栏 -->
    <div class="toolbar-row">
      <el-button-group class="tool-group">
        <el-tooltip content="导入拓扑 HTML" placement="bottom">
          <el-button size="small" :icon="FolderOpened" />
        </el-tooltip>
        <el-tooltip content="保存当前更改" placement="bottom">
          <el-button size="small">💾</el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />

      <el-button-group class="tool-group">
        <el-tooltip content="选择模式" placement="bottom">
          <el-button size="small" type="primary" plain :icon="Rank" />
        </el-tooltip>
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
  background-color: var(--header-bg); /* 使用 CSS 变量 */
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s;
}

/* 第一行样式 */
.top-menu-row {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color); /* 细微分割线 */
}

.logo-area {
  margin-right: 20px;
  font-weight: bold;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

.menus {
  flex: 1;
  display: flex;
  gap: 15px;
}

.menu-item {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-color);
  user-select: none;
}
.menu-item:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.window-controls {
  display: flex;
  align-items: center;
}

/* 第二行样式 */
.toolbar-row {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 10px;
  background-color: var(--panel-bg);
}
</style>