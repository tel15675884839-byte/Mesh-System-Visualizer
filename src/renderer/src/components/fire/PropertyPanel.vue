<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type { FireDevice, FirePanel } from '../../domain/fire/types'

const store = useFireProjectStore()
const { project, selectedDeviceId } = storeToRefs(store)

const selectedDevice = computed(() =>
  selectedDeviceId.value
    ? (project.value.devices.find((device) => device.id === selectedDeviceId.value) ?? null)
    : null
)

const selectedPanel = computed<FirePanel | null>(() => {
  const device = selectedDevice.value
  if (!device) return null
  return (
    project.value.networks
      .flatMap((network) => network.panels)
      .find((panel) => panel.id === device.panelId) ?? null
  )
})

const flagRows = computed(() => {
  const device = selectedDevice.value
  if (!device) return []

  return [
    ['Disabled', device.disabled],
    ['Inhibit Sounders', device.inhibitSounders],
    ['Inhibit I/O', device.inhibitIO],
    ['Inhibit Relays', device.inhibitRelays],
    ['Evacuate I/O', device.evacuateIO],
    ['I/O Override Delay', device.ioOverrideDelay],
    ['Immediate Evacuate', device.immediateEvacuate],
    ['Set Evacuate Timer', device.setEvacuateTimer],
    ['Override Delays', device.overrideDelays]
  ] as Array<[string, boolean]>
})

function valueOrDash(value: unknown): string {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No'
}

function rawJson(device: FireDevice): string {
  return JSON.stringify(device.raw ?? {}, null, 2)
}
</script>

<template>
  <aside class="property-panel">
    <template v-if="selectedDevice">
      <header class="panel-header">
        <div>
          <h2>{{ selectedDevice.description || selectedDevice.friendlyTypeName }}</h2>
          <p>{{ selectedDevice.id }}</p>
        </div>
        <span class="status-chip" :class="selectedDevice.placement.status">
          {{ selectedDevice.placement.status }}
        </span>
      </header>

      <section class="property-section">
        <h3>Device</h3>
        <dl>
          <div>
            <dt>Panel</dt>
            <dd>{{ selectedPanel?.panelName || `Panel ${selectedDevice.panelNumber}` }}</dd>
          </div>
          <div>
            <dt>Loop</dt>
            <dd>{{ valueOrDash(selectedDevice.loopId) }}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{{ valueOrDash(selectedDevice.address) }}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{{ selectedDevice.friendlyTypeName }}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{{ valueOrDash(selectedDevice.description) }}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{{ valueOrDash(selectedDevice.location) }}</dd>
          </div>
          <div>
            <dt>Zone</dt>
            <dd>{{ valueOrDash(selectedDevice.zoneNumber) }}</dd>
          </div>
          <div>
            <dt>Sounder Group</dt>
            <dd>{{ valueOrDash(selectedDevice.sounderGroupId) }}</dd>
          </div>
          <div>
            <dt>I/O Group</dt>
            <dd>{{ valueOrDash(selectedDevice.ioGroupId) }}</dd>
          </div>
        </dl>
      </section>

      <section class="property-section">
        <h3>Disablement And Inhibit</h3>
        <dl>
          <div v-for="[label, value] in flagRows" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ formatBoolean(value) }}</dd>
          </div>
          <div>
            <dt>Selected Disablement</dt>
            <dd>{{ valueOrDash(selectedDevice.selectedDisablement) }}</dd>
          </div>
        </dl>
      </section>

      <section class="property-section">
        <h3>Reporting</h3>
        <dl>
          <div>
            <dt>Reporting Detail</dt>
            <dd>{{ valueOrDash(selectedDevice.reportingDetail) }}</dd>
          </div>
          <div>
            <dt>Smoke Sensitivity</dt>
            <dd>{{ valueOrDash(selectedDevice.smokeSensitivity) }}</dd>
          </div>
          <div>
            <dt>Heat Grade</dt>
            <dd>{{ valueOrDash(selectedDevice.heatGrade) }}</dd>
          </div>
          <div>
            <dt>Sounder Group Value</dt>
            <dd>{{ valueOrDash(selectedDevice.sounderGroupValue) }}</dd>
          </div>
          <div>
            <dt>Image Index</dt>
            <dd>{{ valueOrDash(selectedDevice.imageIndex) }}</dd>
          </div>
        </dl>
      </section>

      <details class="raw-section">
        <summary>Raw CPD</summary>
        <pre>{{ rawJson(selectedDevice) }}</pre>
      </details>
    </template>

    <div v-else class="empty-panel">No device selected</div>
  </aside>
</template>

<style scoped>
.property-panel {
  height: 100%;
  min-width: 300px;
  overflow: auto;
  border-left: 1px solid #d8dee8;
  background: #ffffff;
  color: #172033;
}

.panel-header {
  display: flex;
  align-items: flex-start;
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
  line-height: 1.25;
}

p {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.status-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 8px;
  background: #e2e8f0;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.status-chip.placed {
  background: #dcfce7;
  color: #166534;
}

.status-chip.missing {
  background: #fee2e2;
  color: #991b1b;
}

.property-section {
  padding: 13px 14px;
  border-bottom: 1px solid #edf2f7;
}

h3 {
  margin-bottom: 9px;
  color: #334155;
  font-size: 12px;
  text-transform: uppercase;
}

dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

dl > div {
  display: grid;
  grid-template-columns: minmax(116px, 0.9fr) minmax(0, 1.1fr);
  gap: 10px;
  align-items: baseline;
}

dt {
  color: #64748b;
  font-size: 12px;
}

dd {
  min-width: 0;
  margin: 0;
  color: #172033;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.raw-section {
  padding: 13px 14px 18px;
}

summary {
  cursor: pointer;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

pre {
  max-height: 240px;
  overflow: auto;
  margin: 10px 0 0;
  padding: 10px;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 11px;
}

.empty-panel {
  display: grid;
  min-height: 160px;
  place-items: center;
  color: #64748b;
  font-weight: 700;
}
</style>
