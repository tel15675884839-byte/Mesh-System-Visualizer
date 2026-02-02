<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectStore } from './stores/projectStore'
import { useLoggerStore } from './stores/loggerStore'
import { Log } from './utils/logger'
import { DeviceRole, DeviceType } from './types'

// 引入组件
import DeviceList from './components/DeviceList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import DebugConsole from './components/DebugConsole.vue'

const store = useProjectStore()
const loggerStore = useLoggerStore()

// 测试用的假数据生成器
const addTestNode = () => {
  const newNode = {
    id: `test-${Date.now()}`,
    mac: `00124b00${Math.floor(Math.random()*100000000)}`,
    label: `Smoke-${Math.floor(Math.random() * 100)}`,
    role: Math.random() > 0.8 ? DeviceRole.LEADER : DeviceRole.ROUTER,
    type: DeviceType.SMOKE_DETECTOR,
    buildingId: '1',
    floorId: '1',
    position: { x: 0, y: 0, z: 0 }
  }
  
  store.upsertNode(newNode)
  // 测试日志功能：点击按钮时发送一条成功日志
  Log.success(`成功添加测试节点: ${newNode.label}`, { nodeId: newNode.id })
}

// 核心逻辑：组件挂载完成后启动监听
onMounted(() => {
  // 1. 记录前端启动日志
  Log.info('渲染进程 (Renderer) 已启动，准备就绪。')

  // 2. 监听来自 Electron 主进程 (Main) 的日志
  // 注意：window.api 是我们在 preload/index.ts 中定义的
  // @ts-ignore
  if (window.api && window.api.onSystemLog) {
    // @ts-ignore
    window.api.onSystemLog((log) => {
      // 将后端日志添加到前端的 Store 中显示
      loggerStore.addLog(log.message, log.level, 'Main', log.details)
    })
  } else {
    Log.warn('未检测到 IPC 桥接 (window.api)，后端日志将无法显示。')
  }
})
</script>

<template>
  <div class="main-layout">
    <!-- 1. 顶部标题栏 -->
    <header class="app-header">
      <div class="logo">
        <span class="icon">🧊</span> Numens Mesh Studio
      </div>
      <div class="toolbar">
        <el-button type="primary" size="small" @click="addTestNode">测试：添加节点 (生成日志)</el-button>
        <el-button size="small">保存工程</el-button>
      </div>
    </header>

    <!-- 2. 主体内容区 -->
    <div class="app-body">
      <!-- 左侧：设备列表 -->
      <aside class="left-sidebar">
        <DeviceList />
      </aside>

      <!-- 中间：2D/3D 视图工作区 -->
      <main class="center-viewport">
        <div class="viewport-placeholder">
          <h3>3D / 2D Viewport</h3>
          <p>（将在下一阶段集成 Three.js）</p>
        </div>
      </main>

      <!-- 右侧：属性面板 -->
      <aside class="right-sidebar">
        <PropertyPanel />
      </aside>
    </div>

    <!-- 3. 关键：调试控制台组件 (放在最外层，悬浮在底部) -->
    <DebugConsole />
  </div>
</template>

<style>
/* 全局重置 */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative; /* 为绝对定位的子元素提供基准 */
}

/* 顶部栏 */
.app-header {
  height: 48px;
  background-color: #2b303b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
}
.logo { font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 8px; }

/* 主体网格布局 */
.app-body {
  flex: 1;
  display: grid;
  /* 左侧 280px，中间自适应，右侧 300px */
  grid-template-columns: 280px 1fr 300px; 
  background-color: #f0f2f5;
  overflow: hidden;
}

/* 区域样式 */
.left-sidebar { border-right: 1px solid #dcdfe6; background: #fff; }
.right-sidebar { border-left: 1px solid #dcdfe6; background: #fff; }

.center-viewport {
  background-color: #eef1f5;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewport-placeholder {
  text-align: center;
  color: #909399;
  border: 2px dashed #ccc;
  padding: 40px;
  border-radius: 8px;
}
</style>