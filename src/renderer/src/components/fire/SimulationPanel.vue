<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Bell,
  MuteNotification,
  RefreshLeft,
  SwitchButton,
  Timer,
  WarningFilled
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireDevice } from '../../domain/fire/types'
import type { OutputActivation } from '../../domain/fire/simulation/types'

const store = useFireProjectStore()
const { t } = useI18n()
const { project, selectedNetworkId, simulationMode, simulationState } = storeToRefs(store)

let tickTimer: number | undefined

const currentNetwork = computed(
  () =>
    project.value.networks.find((network) => network.id === selectedNetworkId.value) ??
    project.value.networks[0]
)

const networkDevices = computed(() => {
  const network = currentNetwork.value
  if (!network) return []
  return project.value.devices.filter((device) => device.networkId === network.id)
})

const deviceById = computed(
  () => new Map(networkDevices.value.map((device) => [device.id, device]))
)
const delayedOutputs = computed(() =>
  simulationState.value.outputs.filter((output) => output.state === 'delayActive')
)
const activeOutputs = computed(() =>
  simulationState.value.outputs.filter(
    (output) => output.state !== 'normal' && output.state !== 'delayActive'
  )
)
const fireBrigadeOutput = computed(() =>
  simulationState.value.outputs.find((output) => output.outputId.startsWith('fire-brigade:'))
)
const faultIOOutput = computed(() =>
  simulationState.value.outputs.find((output) => output.outputId.startsWith('fault-io-group:'))
)
const recentEvents = computed(() => simulationState.value.eventLog.slice(-20).reverse())

const timeScaleOptions = [
  { label: '1x', value: 1 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
  { label: '30x', value: 30 }
] as const

watch(
  simulationMode,
  (enabled) => {
    stopTicking()
    if (enabled) {
      tickTimer = window.setInterval(() => {
        store.dispatchSimulationAction({
          type: 'tick',
          at: Date.now(),
          elapsedSeconds: project.value.simulationSettings.timeScale
        })
      }, 1000)
    }
  },
  { immediate: true }
)

onUnmounted(stopTicking)

function setSimulationEnabled(enabled: boolean): void {
  if (enabled) {
    store.enterSimulationMode()
  } else {
    store.exitSimulationMode()
  }
}

function dispatch(type: 'evacuate' | 'buzzer-silence' | 'system-reset'): void {
  store.dispatchSimulationAction({ type, at: Date.now() })
}

function restoreInput(deviceId: string): void {
  store.dispatchSimulationAction({ type: 'restore-input', deviceId, at: Date.now() })
}

function restoreFault(deviceId: string): void {
  store.dispatchSimulationAction({ type: 'restore-fault', deviceId, at: Date.now() })
}

function skipDelay(outputId: string): void {
  store.dispatchSimulationAction({ type: 'skip-delay', outputId, at: Date.now() })
}

function setTimeScale(value: number): void {
  if (value === 1 || value === 5 || value === 10 || value === 30) {
    store.setSimulationTimeScale(value)
  }
}

function deviceLabel(deviceId: string): string {
  const device = deviceById.value.get(deviceId)
  if (!device) return deviceId
  return `${device.description || device.friendlyTypeName} (${formatAddress(device)})`
}

function formatAddress(device: FireDevice): string {
  if (device.loopId === undefined || device.address === undefined) return device.id
  return `L${device.loopId}-${device.address}`
}

function outputLabel(output: OutputActivation): string {
  if (output.outputId.startsWith('device:')) {
    return deviceLabel(output.outputId.slice('device:'.length))
  }
  return output.outputId
}

function outputCauses(output: OutputActivation): string {
  return output.causes.map(deviceLabel).join(', ')
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function stopTicking(): void {
  if (tickTimer !== undefined) {
    window.clearInterval(tickTimer)
    tickTimer = undefined
  }
}
</script>

<template>
  <aside class="simulation-panel">
    <header class="simulation-header">
      <div>
        <h2>{{ t('fire.simulation.title') }}</h2>
        <p>{{ currentNetwork?.sounderMode ?? t('fire.simulation.noNetwork') }}</p>
      </div>
      <el-switch
        :model-value="simulationMode"
        :active-text="t('fire.simulation.on')"
        :inactive-text="t('fire.simulation.off')"
        @update:model-value="setSimulationEnabled"
      />
    </header>

    <section class="control-grid">
      <el-button type="danger" :disabled="!simulationMode" @click="dispatch('evacuate')">
        <el-icon><Bell /></el-icon>
        {{ t('fire.simulation.evacuate') }}
      </el-button>
      <el-button :disabled="!simulationMode" @click="dispatch('buzzer-silence')">
        <el-icon><MuteNotification /></el-icon>
        {{ t('fire.simulation.buzzerSilence') }}
      </el-button>
      <el-button :disabled="!simulationMode" @click="dispatch('system-reset')">
        <el-icon><RefreshLeft /></el-icon>
        {{ t('fire.simulation.systemReset') }}
      </el-button>
      <el-select
        :model-value="project.simulationSettings.timeScale"
        size="small"
        @update:model-value="setTimeScale"
      >
        <el-option
          v-for="option in timeScaleOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </section>

    <section class="state-grid">
      <div>
        <span>{{ t('fire.simulation.system') }}</span>
        <strong :class="simulationState.systemState">{{ simulationState.systemState }}</strong>
      </div>
      <div>
        <span>{{ t('fire.simulation.sound') }}</span>
        <strong :class="simulationState.soundState">{{ simulationState.soundState }}</strong>
      </div>
      <div>
        <span>{{ t('fire.simulation.buzzer') }}</span>
        <strong>{{
          simulationState.buzzerSilenced
            ? t('fire.simulation.silenced')
            : t('fire.simulation.active')
        }}</strong>
      </div>
      <div>
        <span>{{ t('fire.simulation.outputs') }}</span>
        <strong>{{ simulationState.outputs.length }}</strong>
      </div>
    </section>

    <section class="simulation-section">
      <h3>{{ t('fire.simulation.activeInputs') }}</h3>
      <ul>
        <li v-for="alarm in simulationState.activeInputAlarms" :key="alarm.deviceId">
          <span>{{ deviceLabel(alarm.deviceId) }}</span>
          <el-button :icon="SwitchButton" link size="small" @click="restoreInput(alarm.deviceId)" />
        </li>
        <li v-if="simulationState.activeInputAlarms.length === 0" class="empty-row">-</li>
      </ul>
    </section>

    <section class="simulation-section">
      <h3>{{ t('fire.simulation.activeFaults') }}</h3>
      <ul>
        <li v-for="fault in simulationState.activeFaults" :key="fault.deviceId">
          <span>{{ deviceLabel(fault.deviceId) }}</span>
          <el-button
            :icon="WarningFilled"
            link
            size="small"
            @click="restoreFault(fault.deviceId)"
          />
        </li>
        <li v-if="simulationState.activeFaults.length === 0" class="empty-row">-</li>
      </ul>
    </section>

    <section class="simulation-section">
      <h3>{{ t('fire.simulation.delayedOutputs') }}</h3>
      <ul>
        <li v-for="output in delayedOutputs" :key="output.outputId">
          <span>
            {{ outputLabel(output) }}
            <small>{{ output.reason }} · {{ output.remainingDelaySeconds ?? 0 }}s</small>
          </span>
          <el-button :icon="Timer" link size="small" @click="skipDelay(output.outputId)" />
        </li>
        <li v-if="delayedOutputs.length === 0" class="empty-row">-</li>
      </ul>
    </section>

    <section class="simulation-section">
      <h3>{{ t('fire.simulation.activeOutputs') }}</h3>
      <ul>
        <li v-for="output in activeOutputs" :key="output.outputId">
          <span>
            {{ outputLabel(output) }}
            <small>{{ output.state }} · {{ outputCauses(output) || '-' }}</small>
          </span>
        </li>
        <li v-if="activeOutputs.length === 0" class="empty-row">-</li>
      </ul>
    </section>

    <section class="state-grid compact">
      <div>
        <span>{{ t('fire.simulation.fireBrigade') }}</span>
        <strong>{{ fireBrigadeOutput?.state ?? t('fire.common.normal') }}</strong>
      </div>
      <div>
        <span>{{ t('fire.simulation.faultIO') }}</span>
        <strong>{{ faultIOOutput?.state ?? t('fire.common.normal') }}</strong>
      </div>
    </section>

    <section class="simulation-section event-log">
      <h3>{{ t('fire.simulation.eventLog') }}</h3>
      <ol>
        <li v-for="event in recentEvents" :key="event.id">
          <time>{{ formatEventTime(event.timestamp) }}</time>
          <span>{{ event.message }}</span>
        </li>
        <li v-if="recentEvents.length === 0" class="empty-row">-</li>
      </ol>
    </section>
  </aside>
</template>

<style scoped>
.simulation-panel {
  height: 100%;
  min-width: 320px;
  overflow: auto;
  border-left: 1px solid #d8dee8;
  background: #ffffff;
  color: #172033;
}

.simulation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  font-size: 16px;
}

p {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #edf2f7;
}

.control-grid :deep(.el-button) {
  margin: 0;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #edf2f7;
}

.state-grid.compact {
  grid-template-columns: 1fr 1fr;
}

.state-grid div {
  display: grid;
  gap: 3px;
  min-width: 0;
  border-radius: 7px;
  background: #f8fafc;
  padding: 8px;
}

.state-grid span,
h3 {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.state-grid strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.fireAlarm,
.fire {
  color: #dc2626;
}

.fault {
  color: #d97706;
}

.evacuate {
  color: #b91c1c;
}

.silent,
.normal {
  color: #166534;
}

.simulation-section {
  padding: 12px 14px;
  border-bottom: 1px solid #edf2f7;
}

h3 {
  margin-bottom: 8px;
}

ul,
ol {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  font-size: 13px;
}

li span {
  min-width: 0;
  overflow-wrap: anywhere;
}

small {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
}

.event-log li {
  grid-template-columns: 72px minmax(0, 1fr);
}

time {
  color: #64748b;
  font-size: 11px;
}

.empty-row {
  color: #64748b;
  font-weight: 700;
}
</style>
