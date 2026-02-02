<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import { Plus, Delete, Upload } from '@element-plus/icons-vue'
import type { IBuilding, IFloor } from '../types'

// 接收父组件传递的建筑数据 (v-model)
const props = defineProps<{
  modelValue: IBuilding[]
}>()

const emit = defineEmits(['update:modelValue'])

// 获取数据的副本引用 (Vue 3 props 是只读的，但数组内部对象可变，这里直接操作数组元素是可行的，
// 但为了规范，增删操作触发 emit 更新)
// 简单起见，我们直接操作传入的 reactive 数组，因为在 Wizard 和 Modal 中都是引用传递。

// 添加建筑
const addBuilding = () => {
  const newList = [...props.modelValue]
  const nextId = newList.length + 1
  const newBuilding: IBuilding = {
    id: `bld-${Date.now()}`, // 使用时间戳确保唯一性
    name: `${nextId}号楼`,
    floors: []
  }
  newList.push(newBuilding)
  // 默认给新建筑添加 1F
  addFloor(newBuilding)
  emit('update:modelValue', newList)
}

// 删除建筑
const removeBuilding = (index: number) => {
  const newList = [...props.modelValue]
  newList.splice(index, 1)
  emit('update:modelValue', newList)
}

// 添加楼层
const addFloor = (building: IBuilding) => {
  let nextFloorNum = 1
  if (building.floors.length > 0) {
    const lastFloor = building.floors[building.floors.length - 1]
    const match = lastFloor.name.match(/(\d+)F/)
    if (match) {
      nextFloorNum = parseInt(match[1]) + 1
    } else {
      nextFloorNum = building.floors.length + 1
    }
  }
  
  const newFloor: IFloor = {
    id: `flr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${nextFloorNum}F`,
    levelIndex: building.floors.length,
    mapPath: ''
  }
  building.floors.push(newFloor)
}

// 删除楼层
const removeFloor = (building: IBuilding, index: number) => {
  building.floors.splice(index, 1)
}

// 处理图片上传
const handleMapUpload = (file: any, floor: IFloor) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      floor.mapPath = e.target.result as string
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
</script>

<template>
  <div class="building-manager">
    <div v-for="(bld, bIndex) in modelValue" :key="bld.id" class="building-block">
      <div class="building-header">
        <div class="bld-title">
          <el-icon><OfficeBuilding /></el-icon>
          <!-- 建筑名称 -->
          <el-input v-model="bld.name" style="width: 120px; margin-left: 8px;" size="small" />
        </div>
        <!-- 只有多于1个建筑时才允许删除 -->
        <el-button type="danger" link :icon="Delete" @click="removeBuilding(bIndex)" v-if="modelValue.length > 1"/>
      </div>

      <div class="floor-list">
        <div v-for="(floor, fIndex) in bld.floors" :key="floor.id" class="floor-item">
          <span class="floor-drag-handle">::</span>
          <!-- 楼层名称 -->
          <el-input v-model="floor.name" style="width: 80px;" size="small" />
          
          <!-- 图纸上传 -->
          <el-upload
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            @change="(file) => handleMapUpload(file, floor)"
            class="upload-btn"
          >
            <el-button size="small" :type="floor.mapPath ? 'success' : 'info'" plain :icon="Upload">
              {{ floor.mapPath ? '更换图纸' : '上传平面图' }}
            </el-button>
          </el-upload>
          
          <el-button type="danger" link :icon="Delete" @click="removeFloor(bld, fIndex)" />
        </div>
        
        <el-button class="add-floor-btn" size="small" plain @click="addFloor(bld)">
          <el-icon><Plus /></el-icon> 添加楼层
        </el-button>
      </div>
    </div>

    <el-button type="primary" plain style="width: 100%; margin-top: 10px; border-style: dashed;" @click="addBuilding">
      <el-icon><Plus /></el-icon> 添加新建筑
    </el-button>
  </div>
</template>

<style scoped>
.building-manager {
  width: 100%;
}
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
</style>