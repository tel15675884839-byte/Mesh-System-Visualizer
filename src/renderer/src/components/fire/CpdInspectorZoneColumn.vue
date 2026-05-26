<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CpdInspectorZone, CpdInspectorDevice } from '../../domain/fire/cpdInspectorModel'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'

const props = defineProps<{
  zones: CpdInspectorZone[]
  selectedZoneNumber: number
  devices: CpdInspectorDevice[]
}>()

const emit = defineEmits<{
  (e: 'select-zone', zoneNumber: number): void
  (e: 'locate-device', deviceId: string): void
  (e: 'select-device', device: CpdInspectorDevice): void
  (e: 'expand-change'): void
}>()

const { t } = useI18n()

const filterMode = ref<'configured' | 'all' | 'delayed' | 'devices' | 'outputs' | 'special'>(
  'configured'
)
const searchQuery = ref('')
const expandedZoneNumber = ref<number | null>(null)

const filteredZones = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return props.zones.filter((zone) => {
    // 1. Apply filter modes
    if (filterMode.value === 'configured') {
      const isConfig =
        zone.text || zone.devicesCount > 0 || zone.groups.length > 0 || zone.delayedSounders
      if (!isConfig) return false
    } else if (filterMode.value === 'delayed' && !zone.delayedSounders) {
      return false
    } else if (filterMode.value === 'devices' && zone.devicesCount === 0) {
      return false
    } else if (filterMode.value === 'outputs' && zone.groups.length === 0) {
      return false
    } else if (filterMode.value === 'special' && !zone.hasSpecialDevices) {
      return false
    }

    // 2. Apply search queries
    if (query) {
      const numStr = zone.zoneNumber.toString()
      const matchNum =
        numStr === query ||
        numStr.padStart(3, '0') === query ||
        `zone ${numStr}` === query ||
        `zone${numStr}` === query
      const matchText = zone.text && zone.text.toLowerCase().includes(query)
      return matchNum || matchText
    }

    return true
  })
})

const configuredCount = computed(() => {
  return props.zones.filter((zone) => {
    return zone.text || zone.devicesCount > 0 || zone.groups.length > 0 || zone.delayedSounders
  }).length
})

function handleSelectZone(zoneNumber: number): void {
  emit('select-zone', zoneNumber)
}

function toggleExpandDevices(zoneNumber: number, event: Event): void {
  event.stopPropagation()
  if (expandedZoneNumber.value === zoneNumber) {
    expandedZoneNumber.value = null
  } else {
    expandedZoneNumber.value = zoneNumber
  }
  nextTick(() => {
    emit('expand-change')
  })
}

const getZoneDevices = (zoneNumber: number): CpdInspectorDevice[] => {
  return props.devices.filter((d) => d.rawDevice.zoneNumber === zoneNumber)
}

const getBadgeLabel = (badge: string): string => {
  return t(`fire.property.${badge}`)
}
</script>

<template>
  <div id="col-zones" class="column">
    <div class="column-header">
      <h2>{{ t('fire.cpdInspector.zones') }}</h2>
      <span class="count-badge">{{ configuredCount }} {{ t('fire.cpdInspector.configured') }}</span>
    </div>

    <!-- Search Box -->
    <div class="column-search">
      <el-input v-model="searchQuery" size="small" placeholder="Search Zones..." clearable />
    </div>



    <!-- Scrollable zones list -->
    <div id="list-zones" class="card-list">
      <div
        v-for="zone in filteredZones"
        :id="`zone-${zone.zoneNumber}`"
        :key="zone.zoneNumber"
        :class="[
          'card',
          {
            'selected-card': zone.zoneNumber === selectedZoneNumber,
            'compact-empty':
              !zone.text &&
              zone.devicesCount === 0 &&
              zone.groups.length === 0 &&
              !zone.delayedSounders
          }
        ]"
        @click="handleSelectZone(zone.zoneNumber)"
      >
        <div class="card-main-content">
          <div class="card-title">
            <span class="zone-title-text"
              >Zone {{ zone.zoneNumber.toString().padStart(3, '0') }}</span
            >
          </div>
          <div v-if="zone.text" class="card-desc">{{ zone.text }}</div>

          <div
            v-if="
              zone.text || zone.devicesCount > 0 || zone.groups.length > 0 || zone.delayedSounders
            "
            class="card-tags"
          >
            <span v-if="zone.delayedSounders" class="badge delay">
              Delay
            </span>
            <span class="badge">{{ zone.devicesCount }} {{ t('fire.cpdInspector.devices') }}</span>
          </div>

          <div v-if="zone.devicesCount > 0" class="zone-actions">
            <el-button
              size="small"
              class="devices-toggle-btn"
              @click="toggleExpandDevices(zone.zoneNumber, $event)"
            >
              {{ t('fire.cpdInspector.devices') }} ({{ zone.devicesCount }})
              <span v-if="zone.hasSpecialDevices" class="special-dot"></span>
            </el-button>
          </div>
        </div>

        <!-- Embedded Zone Devices List -->
        <Transition name="expand-slide">
          <div
            v-if="expandedZoneNumber === zone.zoneNumber && zone.devicesCount > 0"
            class="zone-devices-expansion"
            @click.stop
          >
            <div
              v-for="dev in getZoneDevices(zone.zoneNumber)"
              :key="dev.id"
              class="zone-device-row"
              @click="emit('select-device', dev)"
            >
              <div class="dev-row-left">
                <!-- Inline SVGs for device categories -->
                <img :src="getDeviceIconHrefByType(dev.type)" class="row-icon" alt="" />

                <span class="dev-addr"
                  >L{{ dev.loopId }}-{{
                    dev.address !== undefined ? dev.address.toString().padStart(3, '0') : ''
                  }}</span
                >
                <span class="dev-type">{{ dev.friendlyTypeName }}</span>
              </div>
              <div class="dev-row-right">
                <el-tag
                  v-for="badge in dev.specialBadges"
                  :key="badge"
                  size="small"
                  type="danger"
                  class="row-badge"
                >
                  {{ getBadgeLabel(badge) }}
                </el-tag>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Right Side Connector Port -->
        <div :id="`zone-${zone.zoneNumber}-out`" class="port right"></div>
      </div>
      <div v-if="filteredZones.length === 0" class="no-data">No Zones matching filter</div>
    </div>
  </div>
</template>

<style scoped>
.column {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 2px solid #cbd5e1;
}

.column-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #0f172a;
}

.count-badge {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.column-search {
  position: relative;
}

.filters-bar {
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.filters-bar::-webkit-scrollbar {
  display: none;
}

.filter-group {
  display: flex;
  flex-wrap: nowrap;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 6px 20px 4px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.card-list::-webkit-scrollbar {
  width: 6px;
}

.card-list::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}

/* Connection Ports */
.port {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  transition: all 0.2s ease;
  z-index: 5;
}

.port.right {
  right: -5px;
}

/* Card Styling */
.card {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: visible;
}

.card:hover {
  background: #fafbfc;
  border-color: #64748b;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04);
}

.card.selected-card {
  border-color: #0d9488 !important;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15) !important;
}

.card.compact-empty {
  min-height: 38px;
  padding: 6px 12px;
  opacity: 0.55;
  justify-content: center;
}

.card.compact-empty .card-title {
  margin-bottom: 0;
  font-size: 13px;
}

.card.compact-empty .active-tag,
.card.compact-empty .card-desc,
.card.compact-empty .card-tags,
.card.compact-empty .zone-actions {
  display: none;
}

.card-main-content {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.zone-title-text {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
}

.active-tag {
  font-weight: 700;
  font-size: 10px;
}

.card-desc {
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  gap: 6px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #eef2f7;
  color: #475569;
}

.badge.delay {
  color: #ea580c;
  border-color: #fed7aa;
  background: #fff7ed;
}

.zone-actions {
  margin-top: 4px;
}

.devices-toggle-btn {
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  height: 26px;
  border-color: #cbd5e1;
  position: relative;
}

.special-dot {
  width: 6px;
  height: 6px;
  background: #dc2626;
  border-radius: 50%;
  position: absolute;
  top: 4px;
  right: 4px;
}

/* Zone Devices expansion list */
.zone-devices-expansion {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 8px 10px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.zone-device-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 11px;
  transition: border-color 0.15s ease;
}

.zone-device-row:hover {
  border-color: #94a3b8;
}

.dev-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-icon {
  width: 14px;
  height: 14px;
}

.alarm-icon {
  color: #2563eb;
}
.module-icon {
  color: #7c3aed;
}
.callpoint-icon {
  color: #ea580c;
}
.detector-icon {
  color: #0d9488;
}

.dev-addr {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-weight: 700;
  color: #334155;
}

.dev-type {
  color: #64748b;
  font-weight: 500;
}

.dev-row-right {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.row-badge {
  font-size: 9px;
  height: 18px;
  padding: 0 4px;
  font-weight: 700;
}

.no-data {
  padding: 20px;
  text-align: center;
  color: #64748b;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

/* Transition animations */
.expand-slide-enter-active,
.expand-slide-leave-active {
  transition:
    max-height 0.25s ease,
    opacity 0.25s ease;
  overflow: hidden;
}
.expand-slide-enter-from,
.expand-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-slide-enter-to,
.expand-slide-leave-from {
  max-height: 180px;
  opacity: 1;
}
</style>
