import { useLoggerStore } from '../stores/loggerStore'

// 简单的单例封装，方便在任何组件直接 Log.info(...)
export const Log = {
  info: (msg: string, details?: any) => useLoggerStore().addLog(msg, 'info', 'Renderer', details),
  warn: (msg: string, details?: any) => useLoggerStore().addLog(msg, 'warn', 'Renderer', details),
  error: (msg: string, details?: any) => useLoggerStore().addLog(msg, 'error', 'Renderer', details),
  success: (msg: string, details?: any) => useLoggerStore().addLog(msg, 'success', 'Renderer', details),
  debug: (msg: string, details?: any) => useLoggerStore().addLog(msg, 'debug', 'Renderer', details),
}