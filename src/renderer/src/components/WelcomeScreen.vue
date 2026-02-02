<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore'
import { DocumentAdd, FolderOpened } from '@element-plus/icons-vue'

const store = useProjectStore()

// 处理新建点击
const onNewProject = () => {
  store.createProject()
}

// 处理打开点击 (暂时先模拟)
const onOpenProject = () => {
  console.log('Open project clicked')
  // 这里后续接文件选择逻辑
  // 目前先直接进入
  store.createProject()
}
</script>

<template>
  <div class="welcome-container">
    <div class="content-box">
      <!-- Logo 区域 -->
      <div class="logo-placeholder">🧊</div>
      <h1 class="app-title">Numens Mesh Studio</h1>
      <p class="app-version">Version 1.0.0 (Alpha)</p>

      <!-- 按钮区域 -->
      <div class="action-buttons">
        <el-button type="primary" size="large" :icon="DocumentAdd" @click="onNewProject" class="welcome-btn">
          新建项目
        </el-button>
        <el-button size="large" :icon="FolderOpened" @click="onOpenProject" class="welcome-btn">
          打开项目
        </el-button>
      </div>

      <!-- 最近项目 (预留位置) -->
      <div class="recent-projects">
        <p class="recent-label">最近文件</p>
        <div class="empty-recent">无最近打开的记录</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color); /* 适配暗黑模式 */
  color: var(--text-color);
}

.content-box {
  text-align: center;
  max-width: 500px;
  width: 100%;
  padding: 40px;
}

.logo-placeholder {
  font-size: 80px;
  margin-bottom: 20px;
  user-select: none;
}

.app-title {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-color);
}

.app-version {
  color: #909399;
  font-size: 14px;
  margin-bottom: 40px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 40px;
  align-items: center;
}

.welcome-btn {
  width: 200px;
  height: 45px;
  font-size: 16px;
}

.recent-projects {
  border-top: 1px solid var(--border-color);
  padding-top: 20px;
  text-align: left;
}

.recent-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.empty-recent {
  font-size: 13px;
  color: #606266;
  font-style: italic;
  padding: 10px 0;
}
</style>