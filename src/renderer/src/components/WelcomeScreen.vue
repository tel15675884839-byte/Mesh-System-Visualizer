<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { DocumentAdd, FolderOpened } from '@element-plus/icons-vue'
import ProjectWizard from './ProjectWizard.vue'
import { Log } from '../utils/logger'
import logoImg from '../assets/logo.svg'

const store = useProjectStore()
const showWizard = ref(false)

const onNewProject = () => {
  showWizard.value = true
}

const onWizardFinish = (data: any) => {
  Log.info('Wizard completed, initializing project data...', {
    deviceCount: data.nodes.length,
    loopCount: data.loops.length
  })

  store.createProject(data.name, data.buildings, data.loops, data.nodes, data.edges)

  showWizard.value = false
  Log.success('Project initialized successfully, entering workspace')
}

const onOpenProject = async () => {
  await store.loadFromDisk()
}
</script>

<template>
  <div class="welcome-container">
    <div class="content-box">
      <div class="logo-box">
        <img :src="logoImg" alt="Logo" class="app-logo" />
      </div>
      <h1 class="app-title">Numens Mesh Studio</h1>
      <p class="app-version">Version 1.0.0 (Alpha)</p>

      <div class="action-buttons">
        <el-button
          type="primary"
          size="large"
          :icon="DocumentAdd"
          class="welcome-btn"
          @click="onNewProject"
        >
          新建项目
        </el-button>
        <el-button size="large" :icon="FolderOpened" class="welcome-btn" @click="onOpenProject">
          打开项目
        </el-button>
      </div>
    </div>

    <ProjectWizard v-if="showWizard" @finish="onWizardFinish" @cancel="showWizard = false" />
  </div>
</template>

<style scoped>
.welcome-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.content-box {
  text-align: center;
  max-width: 500px;
  width: 100%;
  padding: 40px;
}

.logo-box {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}
.app-logo {
  width: 100px;
  height: auto;
  user-select: none;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.08));
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
  width: 250px !important; /* 加长并强制统一宽度 */
  height: 54px !important;
  font-size: 16px;
  border-radius: 12px;
  margin-left: 0 !important; /* 修正 Element Plus 默认的 margin-left */
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
