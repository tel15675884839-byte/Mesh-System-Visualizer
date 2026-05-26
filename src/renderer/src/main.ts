import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import { i18n } from './i18n'

// [新增] 1. 引入 Element Plus 暗黑模式专用变量
import 'element-plus/theme-chalk/dark/css-vars.css'

// [新增] 2. 引入我们自定义的全局样式 (用于控制背景板颜色)
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
const fireProjectStore = useFireProjectStore(pinia)
app.use(ElementPlus)
app.use(i18n)

app.mount('#app')

void loadDevFireProjectFromQuery(fireProjectStore)

async function loadDevFireProjectFromQuery(store: typeof fireProjectStore): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  const projectUrl = new URL(window.location.href).searchParams.get('debugFireProject')
  if (!projectUrl) {
    return
  }

  const response = await fetch(projectUrl)
  if (!response.ok) {
    throw new Error(`Failed to load debug fire project: ${response.status} ${response.statusText}`)
  }

  store.loadFireProject((await response.json()) as FireProjectDocument)
}
