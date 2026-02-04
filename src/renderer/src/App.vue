<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Log } from './utils/logger'
import { useProjectStore } from './stores/projectStore'
import { DArrowLeft } from '@element-plus/icons-vue' 

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
const isRightPanelOpen = ref(true) 

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
    // 右侧宽度 = 窗口总宽 - 鼠标X位置
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= minWidth && newWidth <= maxWidth) rightWidth.value = newWidth
  }
}

const stopResize = () => {
  if (isResizingLeft || isResizingRight) {
    isResizingLeft = false
    isResizingRight = false
    document.body.style.cursor = 'default'
    // 注意：因为右侧现在是悬浮的，它改变宽度其实不影响中间画布的尺寸
    // 但左侧改变宽度依然影响，所以保留 resize 事件触发
    window.dispatchEvent(new Event('resize'))
  }
}

const toggleRightPanel = (show: boolean) => {
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
    <!-- 1. 顶部菜单栏 -->
    <MenuBar />

    <!-- 2. 主体区域 -->
    <WelcomeScreen v-if="!store.isProjectLoaded" />

    <div v-else class="workspace">
      <!-- 左侧栏 (标准流布局，挤压中间) -->
      <aside class="sidebar left" :style="{ width: leftWidth + 'px' }">
        <DeviceList />
      </aside>

      <!-- 左侧拖拽条 -->
      <div class="resizer left-resizer" @mousedown.prevent="startResizeLeft"></div>

      <!-- 中间视口 (占据剩余全部空间) -->
      <main class="viewport">
         <TwoDView />
         
         <!-- 展开按钮 (仅当面板隐藏时显示) -->
         <div v-if="!isRightPanelOpen" class="expand-btn" @click="toggleRightPanel(true)" title="展开属性面板">
           <el-icon><DArrowLeft /></el-icon>
         </div>

         <!-- [修改] 右侧面板容器 (悬浮层) -->
         <!-- 使用 v-show 或 v-if 均可，这里配合 resize 逻辑使用 v-if -->
         <div v-if="isRightPanelOpen" class="floating-right-panel" :style="{ width: rightWidth + 'px' }">
            <!-- 拖拽条放这里，相对于浮层定位 -->
            <div class="resizer right-resizer" @mousedown.prevent="startResizeRight"></div>
            <PropertyPanel @close="toggleRightPanel(false)" />
         </div>
      </main>
    </div>

    <!-- 3. 全局弹窗与调试 -->
    <BuildingEditorModal />
    <DebugConsole />
  </div>
</template>

<style scoped>
.app-root { display: flex; flex-direction: column; height: 100vh; background-color: var(--bg-color); }
.workspace { flex: 1; display: flex; overflow: hidden; position: relative; }

/* 左侧栏保持原样 */
.sidebar.left { 
  background-color: var(--panel-bg); 
  border-right: 1px solid var(--border-color); 
  display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; 
}

.resizer { 
  width: 5px; 
  background-color: transparent; 
  cursor: col-resize; 
  z-index: 20; 
  transition: background-color 0.2s; 
  flex-shrink: 0; 
}
.resizer:hover, .resizer:active { background-color: #409eff; }

/* Viewport 占据剩余所有空间 */
.viewport { 
  flex: 1; 
  background-color: var(--viewport-bg); 
  position: relative; /* 为绝对定位子元素提供锚点 */
  display: flex; 
  align-items: center; 
  justify-content: center; 
  min-width: 0; 
  padding: 0; 
  overflow: hidden; 
}

/* [新增] 右侧悬浮面板样式 */
.floating-right-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: var(--panel-bg);
  border-left: 1px solid var(--border-color);
  box-shadow: -2px 0 8px rgba(0,0,0,0.1); /* 加点阴影区分层级 */
  z-index: 15;
  display: flex;
}

/* 右侧拖拽条特殊定位 */
.right-resizer {
  position: absolute;
  left: -5px; /* 放在面板左边缘 */
  top: 0;
  bottom: 0;
  width: 5px;
}

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