<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Log } from './utils/logger'
import { useProjectStore } from './stores/projectStore'
import { DArrowLeft } from '@element-plus/icons-vue' // [新增] 图标

import MenuBar from './components/MenuBar.vue'
import DeviceList from './components/DeviceList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import DebugConsole from './components/DebugConsole.vue'
import TwoDView from './components/TwoDView.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import BuildingEditorModal from './components/BuildingEditorModal.vue'

const store = useProjectStore()

// --- 布局状态 ---
const leftWidth = ref(280)
const rightWidth = ref(300)
const minWidth = 200
const maxWidth = 500
const isRightPanelOpen = ref(true) // [新增] 控制右侧面板显示

// --- 拖拽逻辑 ---
let isResizingLeft = false
let isResizingRight = false

const startResizeLeft = () => { isResizingLeft = true; document.body.style.cursor = 'col-resize' }
const startResizeRight = () => { isResizingRight = true; document.body.style.cursor = 'col-resize' }

const handleMouseMove = (e: MouseEvent) => {
  if (!store.isProjectLoaded) return 

  if (isResizingLeft) {
    const newWidth = e.clientX
    if (newWidth >= minWidth && newWidth <= maxWidth) leftWidth.value = newWidth
  }
  if (isResizingRight) {
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= minWidth && newWidth <= maxWidth) rightWidth.value = newWidth
  }
}

const stopResize = () => {
  if (isResizingLeft || isResizingRight) {
    isResizingLeft = false
    isResizingRight = false
    document.body.style.cursor = 'default'
    window.dispatchEvent(new Event('resize'))
  }
}

// [新增] 切换右侧面板
const toggleRightPanel = (show: boolean) => {
  isRightPanelOpen.value = show
  // 关键：等待 DOM 更新后触发 resize 事件，通知 2D 画布自适应宽度
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 100)
}

onMounted(() => {
  Log.info('UI Layout Initialized')
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="app-root">
    <!-- 1. 顶部菜单栏 -->
    <MenuBar />

    <!-- 2. 主体区域 -->
    <WelcomeScreen v-if="!store.isProjectLoaded" />

    <div v-else class="workspace">
      <!-- 左侧栏 -->
      <aside class="sidebar left" :style="{ width: leftWidth + 'px' }">
        <DeviceList />
      </aside>

      <!-- 左侧拖拽条 -->
      <div class="resizer" @mousedown.prevent="startResizeLeft"></div>

      <!-- 中间视口 -->
      <main class="viewport">
         <TwoDView />
         
         <!-- [新增] 展开按钮 (仅当面板隐藏时显示) -->
         <div v-if="!isRightPanelOpen" class="expand-btn" @click="toggleRightPanel(true)" title="展开属性面板">
           <el-icon><DArrowLeft /></el-icon>
         </div>
      </main>

      <!-- 右侧拖拽条 (仅当面板显示时存在) -->
      <div v-if="isRightPanelOpen" class="resizer" @mousedown.prevent="startResizeRight"></div>

      <!-- 右侧栏 (仅当面板显示时存在) -->
      <aside v-if="isRightPanelOpen" class="sidebar right" :style="{ width: rightWidth + 'px' }">
        <!-- 监听 close 事件 -->
        <PropertyPanel @close="toggleRightPanel(false)" />
      </aside>
    </div>

    <!-- 3. 全局弹窗与调试 -->
    <BuildingEditorModal />
    <DebugConsole />
  </div>
</template>

<style scoped>
.app-root { display: flex; flex-direction: column; height: 100vh; background-color: var(--bg-color); }
.workspace { flex: 1; display: flex; overflow: hidden; position: relative; }
.sidebar { background-color: var(--panel-bg); border-color: var(--border-color); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.sidebar.left { border-right: 1px solid var(--border-color); }
.sidebar.right { border-left: 1px solid var(--border-color); }
.resizer { width: 5px; background-color: transparent; cursor: col-resize; z-index: 10; transition: background-color 0.2s; flex-shrink: 0; }
.resizer:hover, .resizer:active { background-color: #409eff; }
.viewport { flex: 1; background-color: var(--viewport-bg); position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 0; overflow: hidden; }

/* [新增] 展开按钮样式 */
.expand-btn {
  position: absolute;
  top: 10px;
  right: 0;
  width: 24px;
  height: 40px;
  background-color: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-right: none;
  border-radius: 4px 0 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  box-shadow: -2px 0 5px rgba(0,0,0,0.1);
  color: var(--text-color);
}
.expand-btn:hover {
  background-color: #ecf5ff;
  color: #409eff;
}
</style>