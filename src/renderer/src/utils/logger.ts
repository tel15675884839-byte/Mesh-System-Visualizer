import { useLoggerStore } from '../stores/loggerStore'

// 辅助函数：尝试发送到终端
const sendToTerminal = (level: string, msg: string, details?: any) => {
  try {
    // @ts-ignore
    if (window.api && window.api.logToTerminal) {
      // @ts-ignore
      window.api.logToTerminal(level, msg, details)
    }
  } catch (e) {
    // 忽略发送错误，防止死循环
  }
}

// 简单的单例封装，方便在任何组件直接 Log.info(...)
export const Log = {
  info: (msg: string, details?: any) => {
    useLoggerStore().addLog(msg, 'info', 'Renderer', details)
    sendToTerminal('info', msg, details)
  },
  warn: (msg: string, details?: any) => {
    useLoggerStore().addLog(msg, 'warn', 'Renderer', details)
    sendToTerminal('warn', msg, details)
  },
  error: (msg: string, details?: any) => {
    useLoggerStore().addLog(msg, 'error', 'Renderer', details)
    sendToTerminal('error', msg, details)
  },
  success: (msg: string, details?: any) => {
    useLoggerStore().addLog(msg, 'success', 'Renderer', details)
    sendToTerminal('success', msg, details)
  },
  debug: (msg: string, details?: any) => {
    useLoggerStore().addLog(msg, 'debug', 'Renderer', details)
    sendToTerminal('debug', msg, details)
  },
}