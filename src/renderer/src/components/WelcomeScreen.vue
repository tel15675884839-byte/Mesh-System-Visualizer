<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { DocumentAdd, FolderOpened } from '@element-plus/icons-vue'
import ProjectWizard from './ProjectWizard.vue'
import { Log } from '../utils/logger'

const store = useProjectStore()
const showWizard = ref(false)

const onNewProject = () => {
  showWizard.value = true
}

const onWizardFinish = (data: any) => {
  Log.info('向导完成，初始化数据...', { deviceCount: data.nodes.length })
  store.createProject(data.name, data.buildings, data.loops, data.nodes, data.edges)
  showWizard.value = false
  Log.success('项目初始化完成')
}

// [修改] 绑定真实的打开逻辑
const onOpenProject = async () => {
  await store.loadFromDisk()
}
</script>

<template>
  <div class="welcome-container">
    <div class="content-box">
      <div class="logo-placeholder">🧊</div>
      <h1 class="app-title">Numens Mesh Studio</h1>
      <p class="app-version">Version 1.0.0 (Alpha)</p>

      <div class="action-buttons">
        <el-button type="primary" size="large" :icon="DocumentAdd" @click="onNewProject" class="welcome-btn">
          新建项目
        </el-button>
        <el-button size="large" :icon="FolderOpened" @click="onOpenProject" class="welcome-btn">
          打开项目
        </el-button>
      </div>

      <div class="recent-projects">
        <p class="recent-label">最近文件</p>
        <div class="empty-recent">无最近打开的记录</div>
      </div>
    </div>

    <ProjectWizard 
      v-if="showWizard" 
      @finish="onWizardFinish" 
      @cancel="showWizard = false" 
    />
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
.content-box { text-align: center; max-width: 500px; padding: 40px; }
.logo-placeholder { font-size: 80px; margin-bottom: 20px; user-select: none; }
.app-title { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
.app-version { color: #909399; font-size: 14px; margin-bottom: 40px; }
.action-buttons { display: flex; flex-direction: column; gap: 15px; margin-bottom: 40px; align-items: center; }
.welcome-btn { width: 200px; height: 45px; font-size: 16px; }
.recent-projects { border-top: 1px solid var(--border-color); padding-top: 20px; text-align: left; }
.recent-label { font-size: 12px; color: #909399; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
.empty-recent { font-size: 13px; color: #606266; font-style: italic; padding: 10px 0; }
</style>