<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CpdInspectorDevice } from '../../domain/fire/cpdInspectorModel'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'

const props = defineProps<{
  devices: CpdInspectorDevice[]
  selectedGroupId: string | null
  mode?: 'output' | 'direct'
  selectedZoneNumber?: number
}>()

const emit = defineEmits<{
  (e: 'select-device', device: CpdInspectorDevice): void
  (e: 'hover-device', deviceId: string | null): void
}>()

const { t } = useI18n()
const searchQuery = ref('')

const filteredDevices = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return props.devices.filter((dev) => {
    if ((props.mode ?? 'output') === 'direct') {
      if (dev.directGroupIds.length === 0) {
        return false
      }
      if (
        props.selectedZoneNumber !== undefined &&
        dev.rawDevice.zoneNumber !== props.selectedZoneNumber
      ) {
        return false
      }
    } else {
      // 1. Filter out if not in the selected group
      if (!props.selectedGroupId || !dev.groupIds.includes(props.selectedGroupId)) {
        return false
      }
    }

    // 2. Apply search queries
    if (query) {
      const matchName = dev.friendlyTypeName.toLowerCase().includes(query)
      const matchId = dev.id.toLowerCase().includes(query)
      const matchDesc = dev.desc && dev.desc.toLowerCase().includes(query)
      const matchAddr = dev.address !== undefined && dev.address.toString() === query
      return matchName || matchId || matchDesc || matchAddr
    }

    return true
  })
})

const isDirectMode = computed(() => (props.mode ?? 'output') === 'direct')

function handleCardClick(dev: CpdInspectorDevice): void {
  emit('select-device', dev)
}

function handleMouseEnter(dev: CpdInspectorDevice): void {
  emit('hover-device', isDirectMode.value ? `direct-device-${dev.id}` : `device-${dev.id}`)
}

function handleMouseLeave(): void {
  emit('hover-device', null)
}

const getBadgeLabel = (badge: string): string => {
  return t(`fire.property.${badge}`)
}
</script>

<template>
  <div :id="isDirectMode ? 'col-direct-devices' : 'col-devices'" class="column">
    <div class="column-header">
      <h2>
        {{
          isDirectMode ? t('fire.cpdInspector.directDevices') : t('fire.cpdInspector.outputDevices')
        }}
      </h2>
      <span class="count-badge">
        {{ filteredDevices.length }} {{ t('fire.cpdInspector.devices') }}
      </span>
    </div>

    <!-- Search Box -->
    <div class="column-search">
      <el-input
        v-model="searchQuery"
        size="small"
        :placeholder="
          isDirectMode
            ? t('fire.cpdInspector.searchDirectDevices')
            : t('fire.cpdInspector.searchOutputDevices')
        "
        clearable
      />
    </div>

    <!-- Scrollable devices list -->
    <div id="list-devices" class="card-list">
      <div
        v-for="dev in filteredDevices"
        :id="isDirectMode ? `direct-device-${dev.id}` : `device-${dev.id}`"
        :key="dev.id"
        :class="['card', { 'selected-card': !isDirectMode || dev.directGroupIds.length > 0 }]"
        @click="handleCardClick(dev)"
        @mouseenter="handleMouseEnter(dev)"
        @mouseleave="handleMouseLeave"
      >
        <!-- Left Side Connector Port -->
        <div v-if="!isDirectMode" :id="`device-${dev.id}-in`" class="port left"></div>

        <div class="card-main-content">
          <div class="card-title">
            <div class="title-left">
              <img :src="getDeviceIconHrefByType(dev.type)" class="row-icon" alt="" />

              <span class="dev-addr">
                L{{ dev.loopId }}-{{
                  dev.address !== undefined ? dev.address.toString().padStart(3, '0') : ''
                }}
              </span>
            </div>
            <span class="dev-type">{{ dev.friendlyTypeName }}</span>
          </div>

          <div v-if="dev.desc" class="card-desc">{{ dev.desc }}</div>

          <div v-if="dev.isSpecial" class="card-tags">
            <el-tag
              v-for="badge in dev.specialBadges"
              :key="badge"
              class="row-badge"
              size="small"
              type="danger"
            >
              {{ getBadgeLabel(badge) }}
            </el-tag>
          </div>

          <div v-if="isDirectMode" class="card-tags">
            <span v-for="groupId in dev.directGroupIds" :key="groupId" class="relation-badge">
              {{ groupId.toUpperCase() }}
            </span>
          </div>
        </div>

        <div v-if="isDirectMode" :id="`direct-device-${dev.id}-out`" class="port right"></div>
      </div>

      <div v-if="filteredDevices.length === 0" class="no-data">
        {{
          isDirectMode
            ? t('fire.cpdInspector.noDirectDevices')
            : t('fire.cpdInspector.noOutputDevices')
        }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.column {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
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

.port.left {
  left: -5px;
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
  --active-color: #2563eb;
  --active-glow: rgba(37, 99, 235, 0.15);
}

.card:hover {
  background: #fafbfc;
  border-color: #64748b;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04);
}

.card.selected-card {
  border-color: var(--active-color) !important;
  box-shadow: 0 0 0 3px var(--active-glow) !important;
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
  gap: 12px;
}

.title-left {
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
  font-size: 13px;
}

.dev-type {
  color: #64748b;
  font-weight: 600;
  font-size: 11px;
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
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.row-badge {
  font-size: 9px;
  height: 18px;
  padding: 0 4px;
  font-weight: 700;
}

.relation-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  color: #0f172a;
  background: #ecfdf5;
  border: 1px solid #86efac;
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
</style>
