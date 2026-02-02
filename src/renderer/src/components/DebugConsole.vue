<script setup lang="ts">
import { useLoggerStore } from '../stores/loggerStore'
import { storeToRefs } from 'pinia'
import { nextTick, watch, ref } from 'vue'

const store = useLoggerStore()
const { logs, isOpen } = storeToRefs(store)
const logContainer = ref<HTMLElement | null>(null)

// 自动滚动到底部
watch(() => logs.value.length, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
})

const getLevelColor = (level: string) => {
  switch (level) {
    case 'error': return '#f56c6c';
    case 'warn': return '#e6a23c';
    case 'success': return '#67c23a';
    case 'debug': return '#909399';
    default: return '#409eff';
  }
}
</script>

<template>
  <div class="debug-console" :class="{ 'is-open': isOpen }">
    <!-- 顶部工具栏 -->
    <div class="console-header" @click="store.toggle">
      <div class="left">
        <el-icon><Monitor /></el-icon>
        <span>系统日志控制台 ({{ logs.length }})</span>
      </div>
      <div class="right">
        <el-button size="small" type="danger" link @click.stop="store.clear">清空</el-button>
        <el-icon :class="{ 'rotate': isOpen }"><ArrowUp /></el-icon>
      </div>
    </div>

    <!-- 日志内容区 -->
    <div class="console-body" ref="logContainer">
      <div v-for="log in logs" :key="log.id" class="log-line">
        <span class="timestamp">[{{ log.timestamp }}]</span>
        <span class="source" :class="log.source">{{ log.source }}</span>
        <span class="level" :style="{ color: getLevelColor(log.level) }">[{{ log.level.toUpperCase() }}]</span>
        <span class="message" :style="{ color: log.level === 'error' ? '#f56c6c' : '#c0c4cc' }">
          {{ log.message }}
        </span>
        <span v-if="log.details" class="details">
          {{ JSON.stringify(log.details) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-console {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background-color: #1e1e1e;
  color: #c0c4cc;
  border-top: 1px solid #333;
  transition: height 0.3s ease;
  height: 32px; /* 默认收起高度 */
  display: flex;
  flex-direction: column;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.debug-console.is-open {
  height: 250px; /* 展开高度 */
}

.console-header {
  height: 32px;
  background-color: #2d2d2d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.console-header:hover {
  background-color: #333;
}

.left { display: flex; align-items: center; gap: 8px; font-weight: bold; }
.right { display: flex; align-items: center; gap: 10px; }

.console-body {
  flex: 1;
  overflow-y: auto;
  padding: 5px 10px;
  background-color: #1e1e1e;
}

.log-line {
  margin-bottom: 4px;
  line-height: 1.4;
  border-bottom: 1px solid #2d2d2d;
  padding-bottom: 2px;
}

.timestamp { color: #606266; margin-right: 8px; }
.source { 
  display: inline-block; width: 60px; font-weight: bold; margin-right: 5px; 
}
.source.Main { color: #d683ff; } /* 后端日志紫色 */
.source.Renderer { color: #409eff; } /* 前端日志蓝色 */

.level { margin-right: 8px; font-weight: bold; min-width: 50px; display: inline-block; }
.details { color: #909399; margin-left: 10px; font-style: italic; }

.rotate { transform: rotate(180deg); transition: transform 0.3s; }
</style>