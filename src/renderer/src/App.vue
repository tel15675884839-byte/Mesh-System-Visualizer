<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Log } from './utils/logger'
import { useProjectStore } from './stores/projectStore'
import { DArrowLeft } from '@element-plus/icons-vue' 

import MenuBar from './components/MenuBar.vue'
import DeviceList from './components/DeviceList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import TwoDView from './components/TwoDView.vue'
import ThreeDView from './components/ThreeDView.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import BuildingEditorModal from './components/BuildingEditorModal.vue'
import BuildingLayoutModal from './components/BuildingLayoutModal.vue'

const store = useProjectStore()

// --- 布局状态 ---
const leftWidth = ref(280)
const minWidth = 200
const maxWidth = 800
const isRightPanelOpen = ref(true) 

let isResizingLeft = false
let isResizingRight = false

const startResizeLeft = (): void => { isResizingLeft = true; document.body.style.cursor = 'col-resize' }
const startResizeRight = (): void => { isResizingRight = true; document.body.style.cursor = 'col-resize' }

const handleMouseMove = (e: MouseEvent): void => {
  if (!store.isProjectLoaded) return 
  if (isResizingLeft) {
    const newWidth = e.clientX
    if (newWidth >= minWidth && newWidth <= maxWidth) leftWidth.value = newWidth
  }
  if (isResizingRight) {
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      store.viewSettings.rightPanelWidth = newWidth
    }
  }
}

const stopResize = (): void => {
  if (isResizingLeft || isResizingRight) {
    isResizingLeft = false
    isResizingRight = false
    document.body.style.cursor = 'default'
    window.dispatchEvent(new Event('resize'))
  }
}

const toggleRightPanel = (show: boolean): void => {
  isRightPanelOpen.value = show
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
    <MenuBar />

    <WelcomeScreen v-if="!store.isProjectLoaded" />

    <div v-else class="workspace">
      <!-- 左侧栏 -->
      <aside v-if="store.currentViewMode === '2D'" class="sidebar left" :style="{ width: leftWidth + 'px' }">
        <DeviceList />
      </aside>

      <div v-if="store.currentViewMode === '2D'" class="resizer left-resizer" @mousedown.prevent="startResizeLeft"></div>

      <!-- 中间视口 -->
      <main class="viewport">
         <TwoDView v-if="store.currentViewMode === '2D'" />
         <ThreeDView v-else />
         
         <div 
            v-if="!isRightPanelOpen && store.currentViewMode === '2D'" 
            class="expand-btn" 
            title="展开属性面板"
            @click="toggleRightPanel(true)" 
         >
           <el-icon><DArrowLeft /></el-icon>
         </div>

         <div 
            v-if="isRightPanelOpen && store.currentViewMode === '2D'" 
            class="floating-right-panel" 
            :style="{ width: store.viewSettings.rightPanelWidth + 'px' }"
         >
            <div class="resizer right-resizer" @mousedown.prevent="startResizeRight"></div>
            <PropertyPanel @close="toggleRightPanel(false)" />
         </div>
      </main>
    </div>

    <BuildingEditorModal />
    <BuildingLayoutModal />
  </div>
</template>

<style scoped>
.app-root { display: flex; flex-direction: column; height: 100vh; background-color: var(--bg-color); }
.workspace { flex: 1; display: flex; overflow: hidden; position: relative; }
.sidebar.left { background-color: var(--panel-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.resizer { width: 5px; background-color: transparent; cursor: col-resize; z-index: 20; transition: background-color 0.2s; flex-shrink: 0; }
.resizer:hover, .resizer:active { background-color: var(--ios-blue); }
.viewport { flex: 1; background-color: var(--viewport-bg); position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 0; overflow: hidden; }

.floating-right-panel { position: absolute; top: 0; right: 0; bottom: 0; background-color: var(--panel-bg); border-left: 1px solid var(--border-color); box-shadow: -4px 0 15px rgba(0,0,0,0.05); z-index: 15; display: flex; }
.right-resizer { position: absolute; left: -5px; top: 0; bottom: 0; width: 5px; }

.expand-btn { position: absolute; top: 16px; right: 0; width: 28px; height: 44px; background-color: var(--panel-bg); border: 1px solid var(--border-color); border-right: none; border-radius: 12px 0 0 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 20; box-shadow: -2px 0 10px rgba(0,0,0,0.1); color: var(--ios-blue); transition: all 0.2s ease; }
.expand-btn:hover { background-color: var(--bg-color); transform: translateX(-2px); }
</style>