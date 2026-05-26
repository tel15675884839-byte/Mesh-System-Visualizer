<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import { buildCpdInspectorModel } from '../../domain/fire/cpdInspectorModel'
import type { CpdInspectorDevice } from '../../domain/fire/cpdInspectorModel'

// Child components
import CpdInspectorZoneColumn from './CpdInspectorZoneColumn.vue'
import CpdInspectorGroupColumn from './CpdInspectorGroupColumn.vue'
import CpdInspectorDeviceColumn from './CpdInspectorDeviceColumn.vue'
import CpdInspectorDeviceDetails from './CpdInspectorDeviceDetails.vue'

const emit = defineEmits<{
  (e: 'locate-device', deviceId: string): void
}>()

const { t } = useI18n()
const store = useFireProjectStore()
const { project, selectedNetworkId, selectedPanelId } = storeToRefs(store)

// Selection State
const selectedZoneNumber = ref(1)
const selectedGroupId = ref<string | null>(null)
const showAllGroups = ref(false)

// Hover State
const hoveredCardId = ref<string | null>(null)

// Details Popup State
const selectedDeviceForDetails = ref<CpdInspectorDevice | null>(null)
const detailsDialogVisible = ref(false)

// DOM Refs
const svgRef = ref<SVGElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// Retrieve active network and panel from store
const activeNetwork = computed(() => {
  if (!project.value.networks || project.value.networks.length === 0) return null
  if (selectedNetworkId.value) {
    return (
      project.value.networks.find((n) => n.id === selectedNetworkId.value) ||
      project.value.networks[0]
    )
  }
  return project.value.networks[0]
})

const activePanel = computed(() => {
  const net = activeNetwork.value
  if (!net || !net.panels || net.panels.length === 0) return null
  if (selectedPanelId.value) {
    return net.panels.find((p) => p.id === selectedPanelId.value) || net.panels[0]
  }
  return net.panels[0]
})

const allDevices = computed(() => project.value.devices || [])

// Inspector View Model
const inspectorData = computed(() => {
  const panel = activePanel.value
  if (!panel) return null
  return buildCpdInspectorModel(panel, allDevices.value)
})

const selectedZoneDirectDevices = computed(() => {
  const data = inspectorData.value
  if (!data) return []
  return data.directDevices.filter(
    (device) => device.rawDevice.zoneNumber === selectedZoneNumber.value
  )
})

const selectedZoneDirectGroupIds = computed(() => {
  return [...new Set(selectedZoneDirectDevices.value.flatMap((device) => device.directGroupIds))]
})

// Auto-selections based on model changes
watch(
  inspectorData,
  (newData) => {
    if (newData) {
      // Find first configured zone, default to it
      const firstConfigured = newData.zones.find(
        (z) => z.text || z.devicesCount > 0 || z.groups.length > 0 || z.delayedSounders
      )
      selectedZoneNumber.value = firstConfigured ? firstConfigured.zoneNumber : 1

      // Select first group of that zone
      const zone = newData.zones.find((z) => z.zoneNumber === selectedZoneNumber.value)
      const linkedGroupIds = [...(zone?.groups ?? []), ...selectedZoneDirectGroupIds.value]
      if (linkedGroupIds.length > 0) {
        selectedGroupId.value = linkedGroupIds[0]
      } else {
        selectedGroupId.value = null
      }
    }
    nextTick(() => {
      drawLines()
    })
  },
  { immediate: true }
)

// Handle zone change
watch(selectedZoneNumber, (newZoneNum) => {
  const data = inspectorData.value
  if (!data) return
  const zone = data.zones.find((z) => z.zoneNumber === newZoneNum)
  const linkedGroupIds = [...(zone?.groups ?? []), ...selectedZoneDirectGroupIds.value]
  if (linkedGroupIds.length > 0) {
    if (!selectedGroupId.value || !linkedGroupIds.includes(selectedGroupId.value)) {
      selectedGroupId.value = linkedGroupIds[0]
    }
  } else {
    selectedGroupId.value = null
  }
  nextTick(() => {
    drawLines()
  })
})

// Watch layout changing factors to trigger redraw
watch(selectedGroupId, () => {
  nextTick(() => {
    drawLines()
  })
})

watch(showAllGroups, () => {
  nextTick(() => {
    drawLines()
  })
})

watch(hoveredCardId, () => {
  drawLines()
})

// Scroll capturing callback
function handleScrollCapture(): void {
  drawLines()
}

// SVG drawing logic
function drawLines(): void {
  const svg = svgRef.value
  const container = containerRef.value
  if (!svg || !container) return

  svg.innerHTML = ''
  const containerRect = container.getBoundingClientRect()

  const data = inspectorData.value
  if (!data) return

  const getPortCoords = (portId: string): { x: number; y: number } | null => {
    const portEl = document.getElementById(portId)
    if (!portEl) return null

    const cardEl = portEl.closest('.card')
    if (cardEl && isScrolledOutOfView(cardEl)) return null

    const rect = portEl.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top
    }
  }

  // 1. Draw Zone -> Group paths
  const zone = data.zones.find((z) => z.zoneNumber === selectedZoneNumber.value)
  if (zone) {
    zone.groups.forEach((groupId) => {
      const fromPortId = `zone-${zone.zoneNumber}-out`
      const toPortId = `group-${groupId}-in`

      const fromCoords = getPortCoords(fromPortId)
      const toCoords = getPortCoords(toPortId)

      if (!fromCoords || !toCoords) return

      const x1 = fromCoords.x
      const y1 = fromCoords.y
      const x2 = toCoords.x
      const y2 = toCoords.y

      const dx = x2 - x1
      const cx1 = x1 + dx * 0.45
      const cy1 = y1
      const cx2 = x2 - dx * 0.45
      const cy2 = y2

      const group = data.groups.find((g) => g.id === groupId)
      const groupType = group?.type || 'sg'
      const isGroupSelected = groupId === selectedGroupId.value
      const isHovered =
        hoveredCardId.value === `zone-${zone.zoneNumber}` ||
        hoveredCardId.value === `group-${groupId}`

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)

      let className = 'svg-path'
      if (isGroupSelected) {
        className += ` active-path active-${groupType}`
      } else {
        className += ` active-${groupType}`
      }
      if (isHovered) {
        className += ' hovered-path'
      }

      path.setAttribute('class', className)
      svg.appendChild(path)
    })
  }

  // 2. Draw Direct Device -> Group paths
  selectedZoneDirectDevices.value.forEach((dev) => {
    dev.directGroupIds.forEach((groupId) => {
      const fromPortId = `direct-device-${dev.id}-out`
      const toPortId = `group-${groupId}-in`

      const fromCoords = getPortCoords(fromPortId)
      const toCoords = getPortCoords(toPortId)

      if (!fromCoords || !toCoords) return

      const x1 = fromCoords.x
      const y1 = fromCoords.y
      const x2 = toCoords.x
      const y2 = toCoords.y

      const dx = x2 - x1
      const cx1 = x1 + dx * 0.45
      const cy1 = y1
      const cx2 = x2 - dx * 0.45
      const cy2 = y2

      const group = data.groups.find((g) => g.id === groupId)
      const groupType = group?.type || 'sg'
      const isGroupSelected = groupId === selectedGroupId.value
      const isHovered =
        hoveredCardId.value === `direct-device-${dev.id}` ||
        hoveredCardId.value === `group-${groupId}`

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)

      let className = `svg-path direct-path active-${groupType}`
      if (isGroupSelected) {
        className += ' active-path'
      }
      if (isHovered) {
        className += ' hovered-path'
      }

      path.setAttribute('class', className)
      svg.appendChild(path)
    })
  })

  // 3. Draw Group -> Device paths
  if (selectedGroupId.value) {
    const group = data.groups.find((g) => g.id === selectedGroupId.value)
    if (group) {
      data.devices.forEach((dev) => {
        if (!dev.groupIds.includes(selectedGroupId.value!)) return

        const fromPortId = `group-${selectedGroupId.value}-out`
        const toPortId = `device-${dev.id}-in`

        const fromCoords = getPortCoords(fromPortId)
        const toCoords = getPortCoords(toPortId)

        if (!fromCoords || !toCoords) return

        const x1 = fromCoords.x
        const y1 = fromCoords.y
        const x2 = toCoords.x
        const y2 = toCoords.y

        const dx = x2 - x1
        const cx1 = x1 + dx * 0.45
        const cy1 = y1
        const cx2 = x2 - dx * 0.45
        const cy2 = y2

        const isHovered =
          hoveredCardId.value === `group-${selectedGroupId.value}` ||
          hoveredCardId.value === `device-${dev.id}`

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)

        let className = `svg-path active-path active-${group.type}`
        if (isHovered) {
          className += ' hovered-path'
        }

        path.setAttribute('class', className)
        svg.appendChild(path)
      })
    }
  }
}

// Helpers
function isScrolledOutOfView(el: Element): boolean {
  const list = el.closest('.card-list')
  if (!list) return false
  const elRect = el.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()

  if (elRect.width === 0 || listRect.width === 0) return false

  const padding = 10
  return elRect.bottom < listRect.top + padding || elRect.top > listRect.bottom - padding
}

function handleSelectZone(zoneNumber: number): void {
  selectedZoneNumber.value = zoneNumber
}

function handleSelectGroup(groupId: string): void {
  selectedGroupId.value = groupId

  const data = inspectorData.value
  if (!data) return

  const group = data.groups.find((g) => g.id === groupId)
  if (group && group.zones.length > 0) {
    if (!group.zones.includes(selectedZoneNumber.value)) {
      selectedZoneNumber.value = group.zones[0]
      nextTick(() => {
        const zoneCard = document.getElementById(`zone-${selectedZoneNumber.value}`)
        if (zoneCard) {
          zoneCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
  }
}

function handleToggleAllGroups(): void {
  showAllGroups.value = !showAllGroups.value
  if (!showAllGroups.value) {
    const data = inspectorData.value
    const zone = data?.zones.find((z) => z.zoneNumber === selectedZoneNumber.value)
    const directGroupIds = selectedZoneDirectGroupIds.value
    if (
      zone &&
      (!selectedGroupId.value ||
        (!zone.groups.includes(selectedGroupId.value) &&
          !directGroupIds.includes(selectedGroupId.value)))
    ) {
      selectedGroupId.value = zone.groups[0] || directGroupIds[0] || null
    }
  }
}

function handleHoverGroup(groupId: string | null): void {
  hoveredCardId.value = groupId ? `group-${groupId}` : null
}

function handleHoverDevice(cardId: string | null): void {
  hoveredCardId.value = cardId
}

function handleSelectDevice(device: CpdInspectorDevice): void {
  selectedDeviceForDetails.value = device
  detailsDialogVisible.value = true
}

function handleLocateDevice(deviceId: string): void {
  emit('locate-device', deviceId)
}

onMounted(() => {
  window.addEventListener('resize', drawLines)
  // Re-draw double delays to ensure DOM is settled
  setTimeout(drawLines, 100)
  setTimeout(drawLines, 300)
})

onUnmounted(() => {
  window.removeEventListener('resize', drawLines)
})
</script>

<template>
  <div v-if="inspectorData" class="cpd-inspector-wrapper">
    <!-- Top Stats Banner -->
    <div class="inspector-header">
      <div class="header-title">
        <h3>{{ inspectorData.panelName }}</h3>
        <span v-if="activeNetwork?.sourceFileName" class="file-name">
          {{ activeNetwork.sourceFileName }}
        </span>
      </div>

      <div class="header-stats">
        <div class="stat-badge">
          <span>{{ t('fire.property.sounderGroup') }} Delay</span>
          <strong>{{ activePanel?.general.sounderDelaySeconds ?? 0 }}s</strong>
        </div>
        <div class="stat-badge">
          <span>{{ t('fire.property.ioGroup') }} Delay</span>
          <strong>{{ activePanel?.general.inputOutputDelaySeconds ?? 0 }}s</strong>
        </div>
        <div class="stat-badge">
          <span>{{ t('fire.cpdInspector.special') }}</span>
          <strong>{{ inspectorData.totals.specialDevices }}</strong>
        </div>
        <div class="stat-badge">
          <span>{{ t('fire.cpdInspector.devices') }}</span>
          <strong>{{ inspectorData.totals.devices }}</strong>
        </div>
      </div>
    </div>

    <!-- 3-Column Cascade Diagram Layout -->
    <section ref="containerRef" class="diagram-container" @scroll.capture="handleScrollCapture">
      <!-- SVG Canvas for connection lines -->
      <svg ref="svgRef" class="svg-canvas"></svg>

      <!-- COLUMN 1: ZONES -->
      <CpdInspectorZoneColumn
        :zones="inspectorData.zones"
        :selected-zone-number="selectedZoneNumber"
        :devices="inspectorData.devices"
        @select-zone="handleSelectZone"
        @select-device="handleSelectDevice"
        @locate-device="handleLocateDevice"
        @expand-change="drawLines"
      />

      <!-- COLUMN 2: DIRECT DEVICE ASSIGNMENTS -->
      <CpdInspectorDeviceColumn
        :devices="inspectorData.directDevices"
        :selected-group-id="selectedGroupId"
        :selected-zone-number="selectedZoneNumber"
        mode="direct"
        @select-device="handleSelectDevice"
        @hover-device="handleHoverDevice"
      />

      <!-- COLUMN 3: GROUPS -->
      <CpdInspectorGroupColumn
        :groups="inspectorData.groups"
        :selected-group-id="selectedGroupId"
        :selected-zone-number="selectedZoneNumber"
        :show-all-groups="showAllGroups"
        :direct-group-ids="selectedZoneDirectGroupIds"
        @select-group="handleSelectGroup"
        @toggle-all-groups="handleToggleAllGroups"
        @hover-group="handleHoverGroup"
      />

      <!-- COLUMN 4: OUTPUT DEVICES -->
      <CpdInspectorDeviceColumn
        :devices="inspectorData.devices"
        :selected-group-id="selectedGroupId"
        @select-device="handleSelectDevice"
        @hover-device="handleHoverDevice"
      />
    </section>

    <!-- Details Dialog Popup -->
    <CpdInspectorDeviceDetails
      v-model:visible="detailsDialogVisible"
      :device="selectedDeviceForDetails"
    />
  </div>
  <div v-else class="no-project-state">
    <div class="no-proj-content">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="info-icon"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <p>{{ t('fire.app.noProject') }}</p>
    </div>
  </div>
</template>

<style scoped>
.cpd-inspector-wrapper {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  width: 100%;
  background-color: #eef2f7;
  overflow: hidden;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: #ffffff;
  border-bottom: 1.5px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  z-index: 10;
}

.header-title {
  display: flex;
  flex-direction: column;
}

.header-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.file-name {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.header-stats {
  display: flex;
  gap: 12px;
}

.stat-badge {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
  display: flex;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
}

.stat-badge span {
  color: #64748b;
}

.stat-badge strong {
  color: #0f172a;
}

/* Diagram Container */
.diagram-container {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr);
  gap: 56px;
  padding: 20px 34px 24px;
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background-color: #eef2f7;
  background-image:
    linear-gradient(#e2e8f0 1.5px, transparent 1.5px),
    linear-gradient(90deg, #e2e8f0 1.5px, transparent 1.5px);
  background-size: 32px 32px;
  background-position: center;
}

/* SVG Connection Canvas */
.svg-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

:deep(.svg-path) {
  fill: none;
  stroke: #cbd5e1;
  stroke-width: 2;
  stroke-opacity: 0.3;
  transition:
    stroke 0.2s ease,
    stroke-width 0.2s ease,
    stroke-opacity 0.2s ease;
}

:deep(.svg-path.active-path) {
  stroke-width: 3.5;
  stroke-opacity: 1;
}

:deep(.svg-path.hovered-path) {
  stroke-width: 3.5;
  stroke-opacity: 0.85;
  stroke: #0f172a !important; /* overrides standard active colors for strongly highlighted hovered path */
}

:deep(.svg-path.active-sg) {
  stroke: #2563eb;
}

:deep(.svg-path.active-io) {
  stroke: #7c3aed;
}

.no-project-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background: #f8fafc;
}

.no-proj-content {
  text-align: center;
  color: #64748b;
}

.info-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  stroke: #94a3b8;
}

.no-proj-content p {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}
</style>
