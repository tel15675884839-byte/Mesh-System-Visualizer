<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Plus, Delete, Upload, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Log } from '../utils/logger'
import { parseOpenThreadHtml, extractMac } from '../utils/htmlParser'
import { DeviceRole, DeviceType } from '../types'
import type { IBuilding, IFloor, ILoop, INode, IEdge } from '../types'
import BuildingManager from './BuildingManager.vue' // [新增] 引入组件

const emit = defineEmits(['finish', 'cancel'])

const activeStep = ref(0)
const MAX_LOOPS = 16

const form = reactive({
  projectName: '未命名消防工程',
  buildings: [] as IBuilding[],
  loops: [] as { 
    id: string; 
    name: string; 
    htmlSource: string;
    rawNodes: any[];
    rawEdges: any[];
  }[]
})

// --- 步骤 1 逻辑 ---
const initDefaultData = () => {
  // BuildingManager 会自动处理空列表，这里只需确保 loops 有默认值
  if (form.buildings.length === 0) {
    // 预填充一个默认建筑供 BuildingManager 显示，或者让 BuildingManager 处理
    // 为了简单，我们手动加一个默认的
    form.buildings.push({
      id: '1', name: '1号楼', floors: [{ id: 'f1', name: '1F', levelIndex: 0, mapPath: '' }]
    })
  }
  if (form.loops.length === 0) addLoop()
}

// --- 步骤 3: Loop 逻辑 ---
const addLoop = () => {
  if (form.loops.length >= MAX_LOOPS) {
    ElMessage.warning(`最多只能添加 ${MAX_LOOPS} 个回路`)
    return
  }
  const id = (form.loops.length + 1).toString()
  form.loops.push({
    id: `loop-${Date.now()}`,
    name: `Loop ${id}`,
    htmlSource: '',
    rawNodes: [],
    rawEdges: []
  })
}

const removeLoop = (index: number) => {
  form.loops.splice(index, 1)
}

const handleHtmlUpload = (file: any, loop: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const { nodes, edges } = parseOpenThreadHtml(content)
      
      const existingMacs = new Set<string>()
      form.loops.forEach(l => {
        if (l === loop) return 
        l.rawNodes.forEach(n => existingMacs.add(extractMac(n)))
      })

      const duplicates: string[] = []
      nodes.forEach(n => {
        const mac = extractMac(n)
        if (existingMacs.has(mac)) duplicates.push(mac)
      })

      if (duplicates.length > 0) {
        ElMessage.error(`发现 ${duplicates.length} 个重复设备，导入失败！`)
        return
      }

      loop.rawNodes = nodes
      loop.rawEdges = edges
      loop.htmlSource = file.name
      ElMessage.success(`成功导入 ${nodes.length} 个设备`)

    } catch (err: any) {
      ElMessage.error('解析失败: ' + err.message)
    }
  }
  reader.readAsText(file.raw)
}

const nextStep = () => {
  if (!form.projectName.trim()) { Log.warn('请输入项目名称'); return }
  
  if (activeStep.value === 0) {
    initDefaultData()
    activeStep.value = 1
  } else if (activeStep.value === 1) {
    activeStep.value = 2
  } else {
    finishWizard()
  }
}

const finishWizard = () => {
  const finalLoops: ILoop[] = form.loops.map(l => ({
    id: l.id,
    name: l.name,
    htmlSource: l.htmlSource,
    deviceCount: l.rawNodes.length
  }))

  const finalNodes: INode[] = []
  const finalEdges: IEdge[] = []
  const processedMacs = new Set<string>()

  form.loops.forEach(loop => {
    loop.rawNodes.forEach(raw => {
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

      // 默认放入第一个建筑的第一个楼层
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
        diffStatus: 'unchanged'
      })
    })

    loop.rawEdges.forEach(raw => {
      const fromNodeRaw = loop.rawNodes.find(n => n.id == raw.from)
      const toNodeRaw = loop.rawNodes.find(n => n.id == raw.to)
      
      if (fromNodeRaw && toNodeRaw) {
        finalEdges.push({
          id: `edge-${raw.id || Math.random()}`,
          sourceId: extractMac(fromNodeRaw),
          targetId: extractMac(toNodeRaw),
          lqi: raw.lqi,
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
    <div class="wizard-card">
      <div class="wizard-header">
        <h2>新建项目向导</h2>
        <el-steps :active="activeStep" finish-status="success" simple style="margin-top: 10px">
          <el-step title="基本信息" />
          <el-step title="建筑与楼层" />
          <el-step title="拓扑回路" />
        </el-steps>
      </div>

      <div class="wizard-body">
        <!-- 步骤 1 -->
        <div v-if="activeStep === 0" class="step-content">
          <el-form label-position="top">
            <el-form-item label="项目名称">
              <el-input v-model="form.projectName" placeholder="例如：某工厂消防改造一期" size="large" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤 2: 复用 BuildingManager 组件 -->
        <div v-if="activeStep === 1" class="step-content">
          <BuildingManager v-model="form.buildings" />
        </div>

        <!-- 步骤 3 -->
        <div v-if="activeStep === 2" class="step-content">
           <div class="loops-grid">
             <div v-for="(loop, index) in form.loops" :key="index" class="loop-card">
               <div class="loop-header">
                 <el-input v-model="loop.name" size="small" />
                 <el-button type="danger" circle size="small" :icon="Delete" @click="removeLoop(index)" />
               </div>
               
               <div class="loop-status" :class="{ 'has-data': loop.rawNodes.length > 0 }">
                 <div v-if="loop.rawNodes.length > 0">
                   <div class="stat-num">{{ loop.rawNodes.length }}</div>
                   <div class="stat-label">设备</div>
                   <div class="file-name" :title="loop.htmlSource">{{ loop.htmlSource }}</div>
                 </div>
                 <div v-else class="empty-placeholder">
                   <el-icon :size="20"><Warning /></el-icon>
                   <span>暂无数据</span>
                 </div>
               </div>

               <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".html" @change="(file) => handleHtmlUpload(file, loop)" style="width: 100%">
                 <el-button style="width: 100%" type="primary" plain :icon="Upload">导入拓扑 HTML</el-button>
               </el-upload>
             </div>

             <div class="loop-card add-card" @click="addLoop" v-if="form.loops.length < MAX_LOOPS">
               <el-icon :size="24"><Plus /></el-icon>
               <span>添加回路</span>
             </div>
           </div>
        </div>

      </div>

      <div class="wizard-footer">
        <el-button @click="activeStep === 0 ? emit('cancel') : activeStep--" :disabled="activeStep === 0 && false">取消</el-button>
        <el-button type="primary" @click="nextStep">
          {{ activeStep === 2 ? '完成创建' : '下一步' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6); z-index: 2000;
  display: flex; align-items: center; justify-content: center;
}
.wizard-card {
  width: 700px; 
  background: var(--panel-bg); color: var(--text-color);
  border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  display: flex; flex-direction: column; overflow: hidden; max-height: 85vh;
}
.wizard-header { padding: 20px; background: var(--bg-color); border-bottom: 1px solid var(--border-color); }
.wizard-header h2 { margin: 0; font-size: 18px; }
.wizard-body { padding: 20px; flex: 1; overflow-y: auto; }

.loops-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
.loop-card { border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; background: var(--bg-color); display: flex; flex-direction: column; gap: 10px; }
.loop-header { display: flex; justify-content: space-between; align-items: center; gap: 5px; }
.loop-status { flex: 1; border: 1px dashed var(--border-color); border-radius: 4px; min-height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; background: rgba(0,0,0,0.02); }
.loop-status.has-data { border-style: solid; border-color: #67c23a; background: rgba(103, 194, 58, 0.1); }
.stat-num { font-size: 24px; font-weight: bold; color: #67c23a; }
.stat-label { font-size: 12px; color: #666; }
.file-name { font-size: 10px; color: #999; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 5px; }
.empty-placeholder { color: #ccc; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; }
.add-card { border-style: dashed; cursor: pointer; justify-content: center; align-items: center; color: #909399; min-height: 170px; }
.add-card:hover { border-color: #409eff; color: #409eff; background: rgba(64, 158, 255, 0.05); }
.wizard-footer { padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-color); }
</style>