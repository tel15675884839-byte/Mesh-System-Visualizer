import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { useFireProjectStore } from './stores/fireProjectStore'

// [新增] 1. 引入 Element Plus 暗黑模式专用变量
import 'element-plus/theme-chalk/dark/css-vars.css'

// [新增] 2. 引入我们自定义的全局样式 (用于控制背景板颜色)
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
useFireProjectStore(pinia)
app.use(ElementPlus)

app.mount('#app')
