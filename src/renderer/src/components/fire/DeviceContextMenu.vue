<script setup lang="ts">
import {
  Bell,
  Delete,
  MuteNotification,
  Refresh,
  SwitchButton,
  WarningFilled
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { FireDevice } from '../../domain/fire/types'

defineProps<{
  visible: boolean
  x: number
  y: number
  device: FireDevice | null
  simulationMode: boolean
  inputActive: boolean
  faultActive: boolean
}>()

const emit = defineEmits<{
  close: []
  removeFromDrawing: [deviceId: string]
  startAlarm: [deviceId: string]
  restoreInput: [deviceId: string]
  triggerFault: [deviceId: string]
  restoreFault: [deviceId: string]
}>()

const { t } = useI18n()

function run(action: (deviceId: string) => void, device: FireDevice | null): void {
  if (!device) return
  action(device.id)
  emit('close')
}
</script>

<template>
  <div
    v-if="visible && device"
    class="device-context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <button type="button" @click="run((id) => emit('removeFromDrawing', id), device)">
      <el-icon><Delete /></el-icon>
      <span>{{ t('fire.contextMenu.removeFromDrawing') }}</span>
    </button>

    <div v-if="simulationMode" class="menu-separator" />

    <button
      v-if="simulationMode && device.isInputCapable && !inputActive"
      type="button"
      @click="run((id) => emit('startAlarm', id), device)"
    >
      <el-icon><Bell /></el-icon>
      <span>{{ t('fire.contextMenu.startAlarm') }}</span>
    </button>
    <button
      v-if="simulationMode && device.isInputCapable && inputActive"
      type="button"
      @click="run((id) => emit('restoreInput', id), device)"
    >
      <el-icon><SwitchButton /></el-icon>
      <span>{{ t('fire.contextMenu.restoreInput') }}</span>
    </button>
    <button
      v-if="simulationMode && !faultActive"
      type="button"
      @click="run((id) => emit('triggerFault', id), device)"
    >
      <el-icon><WarningFilled /></el-icon>
      <span>{{ t('fire.contextMenu.triggerFault') }}</span>
    </button>
    <button
      v-if="simulationMode && faultActive"
      type="button"
      @click="run((id) => emit('restoreFault', id), device)"
    >
      <el-icon><Refresh /></el-icon>
      <span>{{ t('fire.contextMenu.restoreFault') }}</span>
    </button>
    <button v-if="simulationMode" type="button" class="menu-note" disabled>
      <el-icon><MuteNotification /></el-icon>
      <span>{{ t('fire.contextMenu.simulationMode') }}</span>
    </button>
  </div>
</template>

<style scoped>
.device-context-menu {
  position: fixed;
  z-index: 50;
  display: grid;
  min-width: 210px;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
}

button {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #172033;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #eef4ff;
}

button:disabled {
  color: #64748b;
  cursor: default;
}

.menu-separator {
  height: 1px;
  margin: 5px 4px;
  background: #e2e8f0;
}

.menu-note {
  font-size: 12px;
}
</style>
