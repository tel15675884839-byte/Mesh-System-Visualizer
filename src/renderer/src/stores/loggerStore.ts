import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ILogEntry, LogLevel } from '../types'

export const useLoggerStore = defineStore('logger', () => {
  const logs = ref<ILogEntry[]>([])
  const isOpen = ref(false) // 控制台是否展开

  // 添加日志的核心动作
  function addLog(message: string, level: LogLevel = 'info', source: 'Renderer' | 'Main' = 'Renderer', details?: any) {
    const entry: ILogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      source,
      message,
      details
    }

    logs.value.push(entry)

    // 自动滚动到底部（稍微延迟等待 DOM 更新，也可以在组件里做）
    // 限制最大日志数量为 500 条，防止卡顿
    if (logs.value.length > 500) {
      logs.value.shift()
    }
  }

  function clear() {
    logs.value = []
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return {
    logs,
    isOpen,
    addLog,
    clear,
    toggle
  }
})