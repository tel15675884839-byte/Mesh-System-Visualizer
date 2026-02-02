<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Plus, Delete, Upload, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Log } from '../utils/logger'
import { parseOpenThreadHtml, extractMac } from '../utils/htmlParser'
import { DeviceRole, DeviceType } from '../types'
import type { IBuilding, IFloor, ILoop, INode, IEdge } from '../types'

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
    rawNodes: any[]; // 暂存解析出的原始数据
    rawEdges: any[];
  }[]
})

// --- 步骤 1 & 2 逻辑 (保持不变) ---
const initDefaultData = () => {
  if (form.buildings.length === 0) addBuilding()
  if (form.loops.length === 0) addLoop() // 默认加一个 Loop
}

const addBuilding = () => {
  const nextId = form.buildings.length + 1
  const newBuilding: IBuilding = {
    id: `${nextId}`,
    name: `${nextId}号楼`,
    floors: []
  }
  form.buildings.push(newBuilding)
  addFloor(newBuilding)
}

const removeBuilding = (index: number) => { form.buildings.splice(index, 1) }

const addFloor = (building: IBuilding) => {
  let nextFloorNum = 1
  if (building.floors.length > 0) {
    const lastFloor = building.floors[building.floors.length - 1]
    const match = lastFloor.name.match(/(\d+)F/)
    if (match) nextFloorNum = parseInt(match[1]) + 1
    else nextFloorNum = building.floors.length + 1
  }
  const newFloor: IFloor = {
    id: `${building.id}-${Date.now()}-${Math.random()}`,
    name: `${nextFloorNum}F`,
    levelIndex: building.floors.length,
    mapPath: ''
  }
  building.floors.push(newFloor)
}

const removeFloor = (building: IBuilding, index: number) => { building.floors.splice(index, 1) }

const handleMapUpload = (file: any, floor: IFloor) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      floor.mapPath = e.target.result as string
      const img = new Image()
      img.onload = () => { floor.mapWidth = img.width; floor.mapHeight = img.height }
      img.src = floor.mapPath
    }
  }
  reader.readAsDataURL(file.raw)
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
  // 重命名剩下的 Loop 以保持序号连续? 工业软件通常不自动重命名，以免混淆
}

// 处理 HTML 上传与冲突检测
const handleHtmlUpload = (file: any, loop: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      // 1. 解析
      const { nodes, edges } = parseOpenThreadHtml(content)
      
      // 2. 冲突检测 (方案 B: 报错)
      // 收集当前所有其他 Loop 中已存在的 MAC
      const existingMacs = new Set<string>()
      form.loops.forEach(l => {
        if (l === loop) return // 跳过自己
        l.rawNodes.forEach(n => existingMacs.add(extractMac(n)))
      })

      // 检查新上传的节点是否有重复
      const duplicates: string[] = []
      nodes.forEach(n => {
        const mac = extractMac(n)
        if (existingMacs.has(mac)) duplicates.push(mac)
      })

      if (duplicates.length > 0) {
        ElMessage.error(`发现 ${duplicates.length} 个重复设备 (如 ${duplicates[0]})，导入失败！`)
        Log.error('导入冲突', duplicates)
        return // 终止导入
      }

      // 3. 保存数据
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

// --- 最终提交逻辑 ---
const nextStep = () => {
  if (!form.projectName.trim()) { Log.warn('请输入项目名称'); return }
  
  if (activeStep.value === 0) {
    initDefaultData()
    activeStep.value = 1
  } else if (activeStep.value === 1) {
    activeStep.value = 2
  } else {
    // Finish: 转换所有数据
    finishWizard()
  }
}

const finishWizard = () => {
  // 1. 转换 Loops
  const finalLoops: ILoop[] = form.loops.map(l => ({
    id: l.id,
    name: l.name,
    htmlSource: l.htmlSource,
    deviceCount: l.rawNodes.length
  }))

  // 2. 合并并转换所有 Nodes
  const finalNodes: INode[] = []
  const finalEdges: IEdge[] = []

  // 用于建立 ID 映射 (HTML中的ID -> 系统UUID) 如果需要的话。
  // 这里为了简单，我们假设 HTML 中的 ID 就是唯一 ID，或者使用 MAC 作为 ID。
  // 工业最佳实践：尽量使用 MAC 作为系统内 ID。
  
  form.loops.forEach(loop => {
    loop.rawNodes.forEach(raw => {
      const mac = extractMac(raw)
      const roleStr = (raw.role || '').toLowerCase()
      let role = DeviceRole.UNKNOWN
      if (roleStr.includes('leader')) role = DeviceRole.LEADER
      else if (roleStr.includes('router')) role = DeviceRole.ROUTER
      // ... 其他角色映射可以后续完善

      // 默认放入第一个建筑的第一个楼层
      const defaultBld = form.buildings[0]?.id || '1'
      const defaultFlr = form.buildings[0]?.floors[0]?.id || '1'

      finalNodes.push({
        id: mac, // 使用 MAC 作为唯一 ID
        mac: mac,
        shortId: raw.rloc16 || '',
        role: role,
        type: raw.deviceType || DeviceType.DEFAULT, // 假设 HTML 里有 deviceType，没有则默认
        label: raw.label || mac.slice(-4),
        buildingId: defaultBld, // 初始全部堆在 1F
        floorId: defaultFlr,
        position: { x: 0, y: 0, z: 0 },
        loopId: loop.id,
        diffStatus: 'unchanged'
      })
    })

    loop.rawEdges.forEach(raw => {
      // 连线也需要映射 ID
      // 假设 raw.from 和 raw.to 是 rawNode 的 ID
      // 我们需要找到对应的 MAC
      const fromNodeRaw = loop.rawNodes.find(n => n.id == raw.from)
      const toNodeRaw = loop.rawNodes.find(n => n.id == raw.to)
      
      if (fromNodeRaw && toNodeRaw) {
        finalEdges.push({
          id: `edge-${raw.id || Math.random()}`,
          sourceId: extractMac(fromNodeRaw),
          targetId: extractMac(toNodeRaw),
          lqi: raw.lqi,
          isParentChild: false // 需根据角色逻辑判断
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
        <!-- 步骤 1: 项目信息 -->
        <div v-if="activeStep === 0" class="step-content">
          <el-form label-position="top">
            <el-form-item label="项目名称">
              <el-input v-model="form.projectName" placeholder="例如：某工厂消防改造一期" size="large" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤 2: 建筑配置 -->
        <div v-if="activeStep === 1" class="step-content">
          <div v-for="(bld, bIndex) in form.buildings" :key="bIndex" class="building-block">
            <div class="building-header">
              <div class="bld-title">
                <el-icon><OfficeBuilding /></el-icon>
                <el-input v-model="bld.name" style="width: 120px; margin-left: 8px;" size="small" />
              </div>
              <el-button type="danger" link :icon="Delete" @click="removeBuilding(bIndex)" v-if="form.buildings.length > 1"/>
            </div>
            <div class="floor-list">
              <div v-for="(floor, fIndex) in bld.floors" :key="fIndex" class="floor-item">
                <span class="floor-drag-handle">::</span>
                <el-input v-model="floor.name" style="width: 80px;" size="small" />
                <el-upload action="#" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(file) => handleMapUpload(file, floor)" class="upload-btn">
                  <el-button size="small" :type="floor.mapPath ? 'success' : 'info'" plain :icon="Upload">{{ floor.mapPath ? '已上传图纸' : '上传平面图' }}</el-button>
                </el-upload>
                <el-button type="danger" link :icon="Delete" @click="removeFloor(bld, fIndex)" />
              </div>
              <el-button class="add-floor-btn" size="small" plain @click="addFloor(bld)"><el-icon><Plus /></el-icon> 添加楼层</el-button>
            </div>
          </div>
          <el-button type="primary" plain style="width: 100%; margin-top: 10px; border-style: dashed;" @click="addBuilding"><el-icon><Plus /></el-icon> 添加新建筑</el-button>
        </div>

        <!-- 步骤 3: Loop 配置 -->
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

             <!-- 添加 Loop 按钮 -->
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
  width: 700px; /* 稍微加宽以容纳 Loop Grid */
  background: var(--panel-bg); color: var(--text-color);
  border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  display: flex; flex-direction: column; overflow: hidden; max-height: 85vh;
}
.wizard-header { padding: 20px; background: var(--bg-color); border-bottom: 1px solid var(--border-color); }
.wizard-header h2 { margin: 0; font-size: 18px; }
.wizard-body { padding: 20px; flex: 1; overflow-y: auto; }

/* Building Styles */
.building-block { border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 15px; background: rgba(0,0,0,0.02); }
.building-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.05); border-bottom: 1px solid var(--border-color); }
.bld-title { display: flex; align-items: center; }
.floor-list { padding: 10px; }
.floor-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.floor-drag-handle { cursor: grab; color: #999; }
.upload-btn { display: inline-flex; }
.add-floor-btn { width: 100%; }

/* Loop Styles */
.loops-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;
}
.loop-card {
  border: 1px solid var(--border-color); border-radius: 6px; padding: 10px;
  background: var(--bg-color); display: flex; flex-direction: column; gap: 10px;
}
.loop-header { display: flex; justify-content: space-between; align-items: center; gap: 5px; }
.loop-status {
  flex: 1; border: 1px dashed var(--border-color); border-radius: 4px;
  min-height: 80px; display: flex; align-items: center; justify-content: center;
  text-align: center; background: rgba(0,0,0,0.02);
}
.loop-status.has-data { border-style: solid; border-color: #67c23a; background: rgba(103, 194, 58, 0.1); }
.stat-num { font-size: 24px; font-weight: bold; color: #67c23a; }
.stat-label { font-size: 12px; color: #666; }
.file-name { font-size: 10px; color: #999; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 5px; }
.empty-placeholder { color: #ccc; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; }

.add-card {
  border-style: dashed; cursor: pointer; justify-content: center; align-items: center;
  color: #909399; min-height: 170px;
}
.add-card:hover { border-color: #409eff; color: #409eff; background: rgba(64, 158, 255, 0.05); }

.wizard-footer {
  padding: 15px 20px; border-top: 1px solid var(--border-color);
  display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-color);
}
</style>