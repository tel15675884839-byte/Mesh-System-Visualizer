<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CpdInspectorGroup } from '../../domain/fire/cpdInspectorModel'

const props = defineProps<{
  groups: CpdInspectorGroup[]
  selectedGroupId: string | null
  selectedZoneNumber: number
  showAllGroups: boolean
  directGroupIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'select-group', groupId: string): void
  (e: 'toggle-all-groups'): void
  (e: 'hover-group', groupId: string | null): void
}>()

const { t } = useI18n()
const searchQuery = ref('')

const filteredGroups = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return props.groups.filter((group) => {
    // 1. Filter out if not showAllGroups and not linked to the selected zone
    const isLinked =
      group.zones.includes(props.selectedZoneNumber) ||
      (props.directGroupIds ?? []).includes(group.id)
    if (!props.showAllGroups && !isLinked) {
      return false
    }

    // 2. Apply search queries
    if (query) {
      const matchName = group.name.toLowerCase().includes(query)
      const matchId = group.id.toLowerCase().includes(query)
      const matchDesc = group.desc.toLowerCase().includes(query)
      const matchMode = group.mode && group.mode.toLowerCase().includes(query)
      return matchName || matchId || matchDesc || matchMode
    }

    return true
  })
})

function handleCardClick(group: CpdInspectorGroup): void {
  emit('select-group', group.id)
}

function handleMouseEnter(group: CpdInspectorGroup): void {
  emit('hover-group', group.id)
}

function handleMouseLeave(): void {
  emit('hover-group', null)
}

const getGroupTypeLabel = (type: 'sg' | 'io'): string => {
  return type.toUpperCase()
}
</script>

<template>
  <div id="col-groups" class="column">
    <div class="column-header">
      <h2>{{ t('fire.cpdInspector.outputGroups') }}</h2>
      <el-button
        size="small"
        :type="showAllGroups ? 'primary' : 'default'"
        class="toggle-button"
        @click="emit('toggle-all-groups')"
      >
        All
      </el-button>
    </div>

    <!-- Search Box -->
    <div class="column-search">
      <el-input v-model="searchQuery" size="small" placeholder="Search Groups..." clearable />
    </div>

    <!-- Scrollable groups list -->
    <div id="list-groups" class="card-list">
      <div
        v-for="group in filteredGroups"
        :id="`group-${group.id}`"
        :key="group.id"
        :class="[
          'card',
          {
            'selected-card': group.id === selectedGroupId,
            dimmed:
              showAllGroups &&
              !group.zones.includes(selectedZoneNumber) &&
              !(directGroupIds ?? []).includes(group.id)
          }
        ]"
        @click="handleCardClick(group)"
        @mouseenter="handleMouseEnter(group)"
        @mouseleave="handleMouseLeave"
      >
        <!-- Left Side Connector Port -->
        <div :id="`group-${group.id}-in`" class="port left"></div>

        <div class="card-main-content">
          <div class="card-title">
            <span class="group-title-text">{{ group.name }}</span>
            <el-tag
              size="small"
              :type="group.type === 'sg' ? 'primary' : 'warning'"
              class="type-tag"
            >
              {{ getGroupTypeLabel(group.type) }}
            </el-tag>
          </div>

          <div class="card-desc">{{ group.desc }}</div>

          <div class="card-tags">
            <span v-if="group.delay > 0" class="badge delay"> Delay: {{ group.delay }}s </span>
            <span v-else class="badge delay"> Direct </span>

            <span v-if="group.mode" class="badge">
              {{ group.mode }}
            </span>
            <span v-else class="badge mode-unavailable">
              {{ t('fire.cpdInspector.modeUnavailable') }}
            </span>

            <span class="badge"> {{ group.count }} {{ t('fire.cpdInspector.devices') }} </span>
          </div>
        </div>

        <!-- Right Side Connector Port -->
        <div :id="`group-${group.id}-out`" class="port right"></div>
      </div>

      <div v-if="filteredGroups.length === 0" class="no-data">
        {{ t('fire.cpdInspector.noOutputDevices') }}
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

.toggle-button {
  font-weight: 700;
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
}

.card:hover {
  background: #fafbfc;
  border-color: #64748b;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04);
}

.card.selected-card {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
}

.card.dimmed {
  opacity: 0.35;
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

.group-title-text {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-tag {
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
  flex-wrap: wrap;
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

.badge.mode-unavailable {
  color: #64748b;
  border-color: #e2e8f0;
  background: #f1f5f9;
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
