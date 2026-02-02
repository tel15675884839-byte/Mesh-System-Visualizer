<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Plus, Delete, Upload } from '@element-plus/icons-vue'
import { Log } from '../utils/logger'
import type { IBuilding, IFloor } from '../types'

// 定义事件：完成向导、取消
const emit = defineEmits(['finish', 'cancel'])

// 向导步骤
const activeStep = ref(0)

// 数据模型
const form = reactive({
  projectName: '未命名消防工程',
  buildings: [] as IBuilding[]
})

// --- 逻辑方法 ---

// 初始化：默认添加一个建筑和一个楼层
const initDefaultData = () => {
  if (form.buildings.length === 0) {
    addBuilding()
  }
}

// 添加建筑
const addBuilding = () => {
  const nextId = form.buildings.length + 1
  const newBuilding: IBuilding = {
    id: `${nextId}`, // 简单ID，实际可用 UUID
    name: `${nextId}号楼`,
    floors: []
  }
  form.buildings.push(newBuilding)
  // 默认给新建筑添加 1F
  addFloor(newBuilding)
}

// 删除建筑
const removeBuilding = (index: number) => {
  form.buildings.splice(index, 1)
}

// 添加楼层 (智能命名逻辑 1F -> 2F -> 3F)
const addFloor = (building: IBuilding) => {
  let nextFloorNum = 1
  if (building.floors.length > 0) {
    // 尝试解析最后一个楼层的数字
    const lastFloor = building.floors[building.floors.length - 1]
    const match = lastFloor.name.match(/(\d+)F/)
    if (match) {
      nextFloorNum = parseInt(match[1]) + 1
    } else {
      nextFloorNum = building.floors.length + 1
    }
  }
  
  const newFloor: IFloor = {
    id: `${building.id}-${Date.now()}-${Math.random()}`, // 临时唯一ID
    name: `${nextFloorNum}F`,
    levelIndex: building.floors.length,
    mapPath: '' // 待上传
  }
  building.floors.push(newFloor)
}

// 删除楼层
const removeFloor = (building: IBuilding, index: number) => {
  building.floors.splice(index, 1)
}

// 处理图片上传
const handleMapUpload = (file: any, floor: IFloor) => {
  // 将文件转为 Base64 方便预览和存储 (Electron环境下也可以用文件路径，这里为了简单先用Reader)
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      floor.mapPath = e.target.result as string
      // 可以在这里获取图片宽高
      const img = new Image()
      img.onload = () => {
        floor.mapWidth = img.width
        floor.mapHeight = img.height
      }
      img.src = floor.mapPath
    }
  }
  reader.readAsDataURL(file.raw)
}

// 导航
const nextStep = () => {
  if (!form.projectName.trim()) {
    Log.warn('请输入项目名称')
    return
  }
  if (activeStep.value === 0) {
    initDefaultData()
    activeStep.value = 1
  } else {
    // 完成
    emit('finish', { name: form.projectName, buildings: form.buildings })
  }
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
        <div v-if="activeStep === 1" class="step-content architecture-config">
          
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
                
                <el-upload
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/*"
                  @change="(file) => handleMapUpload(file, floor)"
                  class="upload-btn"
                >
                  <el-button size="small" :type="floor.mapPath ? 'success' : 'info'" plain :icon="Upload">
                    {{ floor.mapPath ? '已上传图纸' : '上传平面图' }}
                  </el-button>
                </el-upload>
                
                <el-button type="danger" link :icon="Delete" @click="removeFloor(bld, fIndex)" />
              </div>
              
              <el-button class="add-floor-btn" size="small" plain @click="addFloor(bld)">
                <el-icon><Plus /></el-icon> 添加楼层 (自动叠加)
              </el-button>
            </div>
          </div>

          <el-button type="primary" plain style="width: 100%; margin-top: 10px; border-style: dashed;" @click="addBuilding">
            <el-icon><Plus /></el-icon> 添加新建筑
          </el-button>

        </div>
      </div>

      <div class="wizard-footer">
        <el-button @click="activeStep === 0 ? emit('cancel') : activeStep--" :disabled="activeStep === 0 && false">取消</el-button>
        <el-button type="primary" @click="nextStep">
          {{ activeStep === 1 ? '创建并进入' : '下一步' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex; align-items: center; justify-content: center;
}
.wizard-card {
  width: 600px;
  background: var(--panel-bg);
  color: var(--text-color);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  display: flex; flex-direction: column;
  overflow: hidden;
  max-height: 80vh;
}
.wizard-header { padding: 20px; background: var(--bg-color); border-bottom: 1px solid var(--border-color); }
.wizard-header h2 { margin: 0; font-size: 18px; }

.wizard-body { padding: 20px; flex: 1; overflow-y: auto; }

.building-block {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 15px;
  background: rgba(0,0,0,0.02);
}
.building-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px;
  background: rgba(0,0,0,0.05);
  border-bottom: 1px solid var(--border-color);
}
.bld-title { display: flex; align-items: center; }

.floor-list { padding: 10px; }
.floor-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.floor-drag-handle { cursor: grab; color: #999; }
.upload-btn { display: inline-flex; }
.add-floor-btn { width: 100%; }

.wizard-footer {
  padding: 15px 20px;
  border-top: 1px solid var(--border-color);
  display: flex; justify-content: flex-end; gap: 10px;
  background: var(--bg-color);
}
</style>