<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Upload, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Log } from '../utils/logger'
// [修改] 引入 extractRssi
import { parseOpenThreadHtml, extractMac, extractRssi } from '../utils/htmlParser'
import { DeviceRole, DeviceType } from '../types'
import type { IBuilding, ILoop, INode, IEdge } from '../types'
import BuildingManager from './BuildingManager.vue'

const emit = defineEmits(['finish', 'cancel'])

const activeStep = ref(0)
const MAX_LOOPS = 32 // 增加上限以支持批量导入

const form = reactive({
  projectName: '未命名消防工程',
  buildings: [] as IBuilding[],
  loops: [] as {
    id: string
    name: string
    htmlSource: string
    rawNodes: any[]
    rawEdges: any[]
  }[]
})

const initDefaultData = () => {
  if (form.buildings.length === 0) {
    form.buildings.push({
      id: '1',
      name: '1号楼',
      floors: [{ id: 'f1', name: '1F', levelIndex: 0, mapPath: '' }]
    })
  }
}

// --- Step 3 Logic ---
const removeLoop = (index: number) => {
  form.loops.splice(index, 1)
}

// [新增] 批量处理文件拖拽
const handleBatchDrop = (e: DragEvent) => {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    processFiles(Array.from(files))
  }
}

// [新增] 批量处理文件选择
const handleBatchSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    processFiles(Array.from(input.files))
  }
  input.value = '' // 重置 input 以便重复选择
}

const processFiles = async (fileList: File[]) => {
  const htmlFiles = fileList.filter(
    (f) => f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm')
  )

  if (htmlFiles.length === 0) {
    ElMessage.warning('请选择 HTML 文件')
    return
  }

  if (form.loops.length + htmlFiles.length > MAX_LOOPS) {
    ElMessage.warning(
      `最多支持 ${MAX_LOOPS} 个回路，本次仅导入前 ${MAX_LOOPS - form.loops.length} 个`
    )
  }

  const remainingSlots = MAX_LOOPS - form.loops.length
  const filesToProcess = htmlFiles.slice(0, remainingSlots)

  ElMessage.info(`开始解析 ${filesToProcess.length} 个文件...`)

  const results: any[] = []

  for (const file of filesToProcess) {
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = (e) => reject(e)
        reader.readAsText(file)
      })

      const { nodes, edges } = parseOpenThreadHtml(content)

      // 实时查重，之前的成功文件带来的节点会被算进去
      const existingMacs = new Set<string>()
      form.loops.forEach((l) => l.rawNodes.forEach((n) => existingMacs.add(extractMac(n))))

      let duplicateMac = ''
      for (const n of nodes) {
        const mac = extractMac(n)
        if (existingMacs.has(mac)) {
          duplicateMac = mac
          break
        }
      }

      if (duplicateMac) {
        results.push({
          file: file.name,
          success: false,
          reason: `包含重复设备(冲突MAC: ${duplicateMac})`
        })
        continue
      }

      if (nodes.length === 0) {
        results.push({
          file: file.name,
          success: false,
          reason: `未解析到有效设备`
        })
        continue
      }

      // 导入进来的按照 Loop 1, Loop 2 来排序命名
      const loopName = `Loop ${form.loops.length + 1}`

      form.loops.push({
        id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: loopName,
        htmlSource: file.name,
        rawNodes: nodes,
        rawEdges: edges
      })

      results.push({
        file: file.name,
        success: true,
        count: nodes.length
      })
    } catch (err: any) {
      Log.error(`解析 ${file.name} 失败`, err)
      results.push({
        file: file.name,
        success: false,
        reason: err.message || '文件解析异常'
      })
    }
  }

  // 汇总结果并展示
  const successes = results.filter((r) => r.success)
  const failures = results.filter((r) => !r.success)

  if (failures.length === 0) {
    ElNotification({
      title: '导入成功',
      message: `全部 ${successes.length} 个文件导入完成！`,
      type: 'success',
      duration: 3000
    })
  } else {
    // 存在失败，构建详情模板
    let htmlContent = `<div style="font-size: 13px; max-height: 200px; overflow-y: auto;">`
    if (successes.length > 0) {
      htmlContent += `<div style="color: #67c23a; margin-bottom: 5px; font-weight: bold;">✅ 成功: ${successes.length} 个</div>`
      successes.forEach((s) => {
        htmlContent += `<div style="margin-left: 10px; margin-bottom: 3px;">• <b>${s.file}</b> (${s.count} 台)</div>`
      })
    }
    if (failures.length > 0) {
      htmlContent += `<div style="color: #f56c6c; margin-bottom: 5px; margin-top: 10px; font-weight: bold;">❌ 失败: ${failures.length} 个</div>`
      failures.forEach((f) => {
        htmlContent += `<div style="margin-left: 10px; margin-bottom: 3px; color: #f56c6c;">• <b>${f.file}</b>: ${f.reason}</div>`
      })
    }
    htmlContent += `</div>`

    ElNotification({
      title: '批量导入完毕',
      dangerouslyUseHTMLString: true,
      message: htmlContent,
      type: successes.length > 0 ? 'warning' : 'error',
      duration: 8000
    })
  }
}

const nextStep = () => {
  if (!form.projectName.trim()) {
    Log.warn('请输入项目名称')
    return
  }

  if (activeStep.value === 0) {
    // 步骤 0: 基础信息 + 建筑设置
    // 确保至少有一个默认建筑
    initDefaultData()
    activeStep.value = 1
  } else {
    finishWizard()
  }
}

const finishWizard = () => {
  const finalLoops: ILoop[] = form.loops.map((l) => ({
    id: l.id,
    name: l.name,
    htmlSource: l.htmlSource,
    deviceCount: l.rawNodes.length
  }))

  const finalNodes: INode[] = []
  const finalEdges: IEdge[] = []
  const processedMacs = new Set<string>()

  form.loops.forEach((loop) => {
    loop.rawNodes.forEach((raw) => {
      const mac = extractMac(raw)
      if (processedMacs.has(mac)) {
        Log.warn(`忽略重复设备记录: ${mac}`)
        return
      }
      processedMacs.add(mac)

      const roleStr = (raw.role || '').toLowerCase()
      let role = DeviceRole.UNKNOWN
      if (roleStr.includes('leader')) role = DeviceRole.LEADER
      else if (roleStr.includes('router')) role = DeviceRole.ROUTER

      const defaultBld = form.buildings[0]?.id || '1'
      const defaultFlr = form.buildings[0]?.floors[0]?.id || '1'

      finalNodes.push({
        id: mac,
        mac: mac,
        shortId: raw.rloc16 || '',
        role: role,
        type: raw.deviceType || DeviceType.DEFAULT,
        label: raw.label || mac.slice(-4),
        buildingId: defaultBld,
        floorId: defaultFlr,
        position: null,
        isPlaced: false,
        loopId: loop.id,
        diffStatus: undefined
      })
    })

    loop.rawEdges.forEach((raw) => {
      const fromNodeRaw = loop.rawNodes.find((n) => n.id == raw.from)
      const toNodeRaw = loop.rawNodes.find((n) => n.id == raw.to)
      if (fromNodeRaw && toNodeRaw) {
        finalEdges.push({
          id: `edge-${raw.id || Math.random()}`,
          sourceId: extractMac(fromNodeRaw),
          targetId: extractMac(toNodeRaw),
          lqi: raw.lqi,
          // [核心修复] 使用正则表达式从 title 中提取 RSSI
          rssi: extractRssi(raw),
          isParentChild: false
        })
      }
    })
  })

  emit('finish', {
    name: form.projectName,
    buildings: form.buildings,
    loops: finalLoops,
    nodes: finalNodes,
    edges: finalEdges
  })
}
</script>

<template>
  <div class="wizard-overlay">
    <div class="wizard-card-modern">
      <!-- 左侧导航 -->
      <div class="wizard-sidebar">
        <div class="sidebar-header">
          <h3>新建项目</h3>
        </div>
        <div class="step-list">
          <div
            class="step-item"
            :class="{ active: activeStep === 0, completed: activeStep > 0 }"
            @click="activeStep > 0 ? (activeStep = 0) : null"
          >
            <div class="step-icon">1</div>
            <div class="step-text">
              <div class="step-title">基础配置</div>
              <div class="step-desc">名称与建筑信息</div>
            </div>
          </div>
          <div class="step-item" :class="{ active: activeStep === 1 }">
            <div class="step-icon">2</div>
            <div class="step-text">
              <div class="step-title">拓扑导入</div>
              <div class="step-desc">批量加载 Loop 文件</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧内容 -->
      <div class="wizard-main">
        <div class="wizard-content">
          <!-- Step 1: 基础配置 -->
          <div v-if="activeStep === 0" class="step-pane">
            <div class="section-title">项目信息</div>
            <el-form label-position="top" class="compact-form">
              <el-form-item label="项目名称">
                <el-input v-model="form.projectName" placeholder="请输入项目名称..." size="large" />
              </el-form-item>
            </el-form>

            <div class="divider"></div>

            <div class="section-title">建筑配置</div>
            <div class="building-pane-wrapper">
              <BuildingManager v-model="form.buildings" />
            </div>
          </div>

          <!-- Step 2: 拓扑导入 (原有 Step 2 + Step 3) -->
          <div v-if="activeStep === 1" class="step-pane">
            <div class="section-title">
              批量导入回路
              <span class="sub-text">(支持拖拽多个 HTML 文件 / 自动解析文件名)</span>
            </div>

            <!-- 拖拽区 / 列表区 -->
            <div class="loops-container">
              <div
                class="drop-zone"
                @dragover.prevent
                @drop="handleBatchDrop"
                @click="($refs.batchInput as HTMLInputElement).click()"
              >
                <input
                  ref="batchInput"
                  type="file"
                  multiple
                  accept=".html,.htm"
                  style="display: none"
                  @change="handleBatchSelect"
                />
                <el-icon :size="48" color="#a0aec0"><Upload /></el-icon>
                <div class="drop-text">点击或将多个 HTML 文件拖拽至此</div>
                <div class="drop-hint">支持批量解析，文件名为 Loop 名称</div>
              </div>

              <div class="loops-list">
                <div v-for="(loop, index) in form.loops" :key="index" class="loop-item">
                  <div class="loop-info">
                    <el-input
                      v-model="loop.name"
                      size="small"
                      style="width: 140px; margin-right: 10px"
                    />
                    <span v-if="loop.rawNodes.length > 0" class="device-count">
                      {{ loop.rawNodes.length }} devices
                    </span>
                    <span v-if="loop.htmlSource" class="file-source">{{ loop.htmlSource }}</span>
                  </div>
                  <el-button
                    type="danger"
                    :icon="Delete"
                    circle
                    plain
                    size="small"
                    @click="removeLoop(index)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="wizard-footer">
          <el-button @click="emit('cancel')">取消</el-button>
          <div class="footer-actions">
            <el-button v-if="activeStep > 0" @click="activeStep--">上一步</el-button>
            <el-button type="primary" @click="nextStep">
              {{ activeStep === 1 ? '完成创建' : '下一步' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4); /* 更轻盈的遮罩 */
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wizard-card-modern {
  width: 900px;
  height: 600px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* 左侧边栏 */
.wizard-sidebar {
  width: 240px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
}

.sidebar-header h3 {
  margin: 0 0 30px 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.6;
}

.step-item.active {
  background: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  opacity: 1;
}

.step-item.completed .step-icon {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  background: #f8fafc;
}

.step-item.active .step-icon {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.step-text {
  display: flex;
  flex-direction: column;
}

.step-title {
  font-weight: 500;
  color: #334155;
  font-size: 14px;
}
.step-item.active .step-title {
  color: #0f172a;
}

.step-desc {
  font-size: 11px;
  color: #94a3b8;
}

/* 右侧主内容 */
.wizard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.wizard-content {
  flex: 1;
  padding: 30px 40px;
  overflow-y: auto;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sub-text {
  font-size: 12px;
  color: #94a3b8;
  font-weight: normal;
}

.compact-form {
  max-width: 600px;
}

.divider {
  height: 1px;
  background: #f1f5f9;
  margin: 30px 0;
}

/* Building Pane 适配 */
.building-pane-wrapper {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  padding: 10px;
}

/* 拖拽上传区 */
.loops-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drop-zone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 20px;
}

.drop-zone:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.drop-text {
  margin-top: 10px;
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.drop-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #94a3b8;
}

.loops-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px;
}

.loop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
}
.loop-item:last-child {
  border-bottom: none;
}
.loop-item:hover {
  background: #f8fafc;
}

.loop-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.device-count {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
  background: #ecfdf5;
  padding: 2px 8px;
  border-radius: 12px;
}

.file-source {
  font-size: 11px;
  color: #94a3b8;
}

.wizard-footer {
  padding: 20px 40px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}
</style>
