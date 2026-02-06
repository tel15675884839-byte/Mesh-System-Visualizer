<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import type { IBuilding } from '../types'

const store = useProjectStore()

// 画布配置
const canvasSize = 800
const PIXELS_PER_METER = 10
const worldSize = 800
const scale = computed(() => canvasSize / worldSize)

const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const activeBuildingId = ref<string | null>(null)

// 转换 World 坐标 -> Canvas 坐标
const toCanvas = (val: number): number => (val + worldSize / 2) * scale.value

// 确保建筑有位置和尺寸
const initBuildings = (): void => {
  store.buildings.forEach((b, index) => {
    if (!b.position) {
      b.position = { x: index * 150 - 150, y: 0 }
    }
    
    const baseFloor = b.floors.find((f) => f.mapWidth && f.mapHeight)
    if (baseFloor) {
      b.size = {
        width: baseFloor.mapWidth! / PIXELS_PER_METER,
        depth: baseFloor.mapHeight! / PIXELS_PER_METER
      }
    } else if (!b.size) {
      b.size = { width: 100, depth: 70 } 
    }

    if (b.rotation === undefined) {
      b.rotation = 0
    }
  })
}

watch(() => store.isLayoutEditorVisible, (val) => {
  if (val) initBuildings()
})

const isRotating = ref(false)

// 处理开始旋转
const startRotate = (e: MouseEvent, building: IBuilding): void => {
  e.stopPropagation()
  isRotating.value = true
  activeBuildingId.value = building.id
  
  const proxyEl = (e.currentTarget as HTMLElement).parentElement
  if (!proxyEl) return
  
  const rect = proxyEl.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  
  const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
  const initialRotation = building.rotation ?? 0

  const onRotate = (moveEvent: MouseEvent): void => {
    if (!isRotating.value) return
    const currentMouseAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI)
    let deltaAngle = currentMouseAngle - startMouseAngle
    let newRotation = initialRotation + deltaAngle
    
    const snap = 90
    const threshold = 5
    const nearestSnap = Math.round(newRotation / snap) * snap
    if (Math.abs(newRotation - nearestSnap) < threshold) {
      newRotation = nearestSnap
    }
    
    building.rotation = (newRotation % 360 + 360) % 360
  }

  const stopRotate = (): void => {
    isRotating.value = false
    window.removeEventListener('mousemove', onRotate)
    window.removeEventListener('mouseup', stopRotate)
  }

  window.addEventListener('mousemove', onRotate)
  window.addEventListener('mouseup', stopRotate)
}

const handleClose = (): void => {
  store.toggleLayoutEditor(false)
}

const startDrag = (e: MouseEvent, building: IBuilding): void => {
  if (isRotating.value) return
  if (!building.position) building.position = { x: 0, y: 0 }
  isDragging.value = true
  activeBuildingId.value = building.id
  
  dragOffset.value = { x: e.clientX, y: e.clientY }
  const startX = building.position.x
  const startY = building.position.y

  const onDrag = (moveEvent: MouseEvent): void => {
    if (!isDragging.value || !activeBuildingId.value) return
    const dx = (moveEvent.clientX - dragOffset.value.x) / scale.value
    const dy = (moveEvent.clientY - dragOffset.value.y) / scale.value
    building.position!.x = startX + dx
    building.position!.y = startY + dy
  }

  const stopDrag = (): void => {
    isDragging.value = false
    activeBuildingId.value = null
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

const getBuildingStyle = (b: IBuilding): Record<string, string> => {
  const x = b.position?.x ?? 0
  const y = b.position?.y ?? 0
  
  const baseFloor = b.floors.find((f) => f.mapWidth && f.mapHeight)
  const w = baseFloor ? (baseFloor.mapWidth! / PIXELS_PER_METER) : (b.size?.width ?? 100)
  const d = baseFloor ? (baseFloor.mapHeight! / PIXELS_PER_METER) : (b.size?.depth ?? 70)
  const r = b.rotation ?? 0

  return {
    left: `${toCanvas(x - w / 2)}px`,
    top: `${toCanvas(y - d / 2)}px`,
    width: `${w * scale.value}px`,
    height: `${d * scale.value}px`,
    transform: `rotate(${r}deg)`
  }
}

onMounted(() => {
  initBuildings()
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.isLayoutEditorVisible) handleClose()
  })
})
</script>

<template>
  <el-dialog
    v-model="store.isLayoutEditorVisible"
    title="建筑布局配置 (2D Top-Down)"
    width="860px"
    :before-close="handleClose"
    align-center
    class="layout-modal"
  >
    <div class="editor-layout">
      <div class="layout-container" :style="{ width: `${canvasSize}px`, height: `${canvasSize}px` }">
        <div class="grid-bg"></div>
        <div class="axis x-axis"></div>
        <div class="axis y-axis"></div>

        <div
          v-for="b in store.buildings"
          :key="b.id"
          class="building-proxy"
          :class="{ active: activeBuildingId === b.id }"
          :style="getBuildingStyle(b)"
          @mousedown="(e) => startDrag(e, b)"
        >
          <div class="rotator tl" @mousedown.stop="(e) => startRotate(e, b)"></div>
          <div class="rotator tr" @mousedown.stop="(e) => startRotate(e, b)"></div>
          <div class="rotator bl" @mousedown.stop="(e) => startRotate(e, b)"></div>
          <div class="rotator br" @mousedown.stop="(e) => startRotate(e, b)"></div>

          <div class="b-info">
            <div class="b-name">{{ b.name }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.editor-layout {
  display: flex;
  justify-content: center;
  max-height: 85vh;
}

.layout-container {
  position: relative;
  background-color: #1e1e1e;
  overflow: hidden;
  border: 1px solid #444;
  user-select: none;
  flex-shrink: 0;
}

.grid-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    linear-gradient(#333 1px, transparent 1px),
    linear-gradient(90deg, #333 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.5;
  pointer-events: none;
}

.axis {
  position: absolute;
  background-color: #666;
  pointer-events: none;
}
.x-axis {
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
}
.y-axis {
  left: 50%;
  top: 0;
  height: 100%;
  width: 2px;
}

.building-proxy {
  position: absolute;
  background-color: rgba(64, 158, 255, 0.4);
  border: 2px solid #409eff;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
  border-radius: 4px;
  transition: box-shadow 0.2s, background-color 0.2s;
  overflow: visible;
}

.building-proxy:hover {
  background-color: rgba(64, 158, 255, 0.6);
  z-index: 100;
}

.building-proxy.active {
  box-shadow: 0 0 15px rgba(64, 158, 255, 0.8);
  background-color: rgba(64, 158, 255, 0.7);
  z-index: 200;
}

.rotator {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: #fff;
  border: 2px solid #409eff;
  border-radius: 50%;
  cursor: crosshair;
  z-index: 300;
}
.rotator:hover {
  background-color: #409eff;
  transform: scale(1.2);
}

.tl {
  top: -6px;
  left: -6px;
}
.tr {
  top: -6px;
  right: -6px;
}
.bl {
  bottom: -6px;
  left: -6px;
}
.br {
  bottom: -6px;
  right: -6px;
}

.b-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.b-name {
  font-weight: bold;
  font-size: 13px;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
</style>
