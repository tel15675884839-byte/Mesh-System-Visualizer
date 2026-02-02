<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Log } from './utils/logger'
import { useProjectStore } from './stores/projectStore'

// 组件引入
import MenuBar from './components/MenuBar.vue'
import DeviceList from './components/DeviceList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import DebugConsole from './components/DebugConsole.vue'
import TwoDView from './components/TwoDView.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import BuildingEditorModal from './components/BuildingEditorModal.vue' // [新增]

const store = useProjectStore()

// --- 布局状态 ---
const leftWidth = ref(280)
const rightWidth = ref(300)
const minWidth = 200
const maxWidth = 500

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
      </main>

      <!-- 右侧拖拽条 -->
      <div class="resizer" @mousedown.prevent="startResizeRight"></div>

      <!-- 右侧栏 -->
      <aside class="sidebar right" :style="{ width: rightWidth + 'px' }">
        <PropertyPanel />
      </aside>
    </div>

    <!-- 3. 全局弹窗与调试 -->
    <BuildingEditorModal /> <!-- [新增] 建筑编辑器弹窗 -->
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
</style>