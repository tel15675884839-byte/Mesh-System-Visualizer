import { createApp } from 'vue'
import { createPinia } from 'pinia' // 关键：必须引入 createPinia
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

// 1. 创建 Vue 应用实例
const app = createApp(App)

// 2. 创建 Pinia 实例
const pinia = createPinia()

// 3. 关键步骤：必须在 mount 之前注册 Pinia
app.use(pinia)
app.use(ElementPlus)

// 4. 最后一步才是挂载
app.mount('#app')