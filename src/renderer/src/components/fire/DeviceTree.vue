<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import { buildFireDeviceTree, flattenFireTree, type FireTreeNode } from '../../domain/fire/tree'
import { getPublicIconHref } from '../../domain/fire/deviceIcons'
import type { DeviceStatusFilter, GroupMode } from '../../domain/fire/types'

const emit = defineEmits<{
  focusDevice: [deviceId: string]
  deviceContextMenu: [payload: { deviceId: string; x: number; y: number }]
  dragDevices: [deviceIds: string[]]
}>()

const store = useFireProjectStore()
const { t } = useI18n()
const { project, selectedDeviceId, treeGroupMode, deviceStatusFilter, searchText } =
  storeToRefs(store)
const treeRef = ref()
const expandedKeys = ref<string[]>([])
const selectedIds = ref<Set<string>>(new Set())
const lastSelectedDeviceId = ref<string | null>(null)

const groupModeOptions = computed<Array<{ label: string; value: GroupMode }>>(() => [
  { label: t('fire.tree.group.loop'), value: 'loop' },
  { label: t('fire.tree.group.zone'), value: 'zone' },
  { label: t('fire.tree.group.type'), value: 'type' },
  { label: t('fire.tree.group.sounderGroup'), value: 'sounderGroup' },
  { label: t('fire.tree.group.ioGroup'), value: 'ioGroup' }
])

const statusOptions = computed<Array<{ label: string; value: DeviceStatusFilter }>>(() => [
  { label: t('fire.tree.filter.all'), value: 'all' },
  { label: t('fire.tree.filter.unplaced'), value: 'unplaced' },
  { label: t('fire.tree.filter.placed'), value: 'placed' },
  { label: t('fire.tree.filter.issues'), value: 'issues' }
])

const treeData = computed(() =>
  buildFireDeviceTree({
    project: project.value,
    groupMode: treeGroupMode.value,
    statusFilter: deviceStatusFilter.value,
    searchText: searchText.value
  })
)

const flattenedNodes = computed(() => flattenFireTree(treeData.value))

watch(
  treeData,
  (nodes) => {
    const nextExpanded = flattenFireTree(nodes)
      .filter((node) => node.kind === 'network' || node.kind === 'panel')
      .map((node) => node.id)
    expandedKeys.value = [...new Set([...expandedKeys.value, ...nextExpanded])]
  },
  { immediate: true }
)

watch(
  selectedDeviceId,
  async (deviceId) => {
    selectedIds.value = deviceId ? new Set([deviceId]) : new Set()

    if (!deviceId) {
      return
    }

    expandAncestors(deviceId)
    await nextTick()
    treeRef.value?.setCurrentKey(deviceId)
  },
  { immediate: true }
)

function handleNodeClick(
  data: FireTreeNode,
  _node: unknown,
  _component: unknown,
  event: MouseEvent
): void {
  store.selectedNetworkId = data.networkId ?? store.selectedNetworkId
  store.selectedPanelId = data.panelId ?? store.selectedPanelId

  if (data.kind !== 'device' || !data.deviceId) {
    store.selectDevice(null)
    selectedIds.value = new Set()
    return
  }

  updateSelection(data.deviceId, event)
  store.selectDevice(data.deviceId)
}

function handleNodeDoubleClick(data: FireTreeNode): void {
  if (data.kind === 'device' && data.deviceId) {
    emit('focusDevice', data.deviceId)
  }
}

function handleContextMenu(data: FireTreeNode, event: MouseEvent): void {
  if (data.kind !== 'device' || !data.deviceId) {
    return
  }

  event.preventDefault()
  updateSelection(data.deviceId, event)
  store.selectDevice(data.deviceId)
  emit('deviceContextMenu', { deviceId: data.deviceId, x: event.clientX, y: event.clientY })
}

function handleDragStart(data: FireTreeNode, event: DragEvent): void {
  if (data.kind !== 'device' || !data.deviceId || !event.dataTransfer) {
    return
  }

  if (!selectedIds.value.has(data.deviceId)) {
    selectedIds.value = new Set([data.deviceId])
    store.selectDevice(data.deviceId)
  }

  const deviceIds = [...selectedIds.value]
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-fire-device-ids', JSON.stringify(deviceIds))
  event.dataTransfer.setData('application/json', JSON.stringify(deviceIds))
  emit('dragDevices', deviceIds)
}

function updateSelection(deviceId: string, event: MouseEvent): void {
  const nextSelection = new Set(selectedIds.value)

  if (event.shiftKey && lastSelectedDeviceId.value) {
    const visibleDeviceIds = flattenedNodes.value
      .filter((node) => node.kind === 'device' && node.deviceId)
      .map((node) => node.deviceId as string)
    const start = visibleDeviceIds.indexOf(lastSelectedDeviceId.value)
    const end = visibleDeviceIds.indexOf(deviceId)

    if (start >= 0 && end >= 0) {
      const [from, to] = start < end ? [start, end] : [end, start]
      selectedIds.value = new Set(visibleDeviceIds.slice(from, to + 1))
      return
    }
  }

  if (event.ctrlKey || event.metaKey) {
    if (nextSelection.has(deviceId)) {
      nextSelection.delete(deviceId)
    } else {
      nextSelection.add(deviceId)
    }
    selectedIds.value = nextSelection
  } else {
    selectedIds.value = new Set([deviceId])
  }

  lastSelectedDeviceId.value = deviceId
}

function expandAncestors(deviceId: string): void {
  const ancestors: string[] = []

  function visit(nodes: FireTreeNode[], path: string[]): boolean {
    for (const node of nodes) {
      if (node.id === deviceId) {
        ancestors.push(...path)
        return true
      }
      if (visit(node.children, [...path, node.id])) {
        return true
      }
    }
    return false
  }

  visit(treeData.value, [])
  expandedKeys.value = [...new Set([...expandedKeys.value, ...ancestors])]
}

function issueClass(node: FireTreeNode): string {
  if ((node.issueCount ?? 0) > 0) return 'has-issues'
  if (node.placementStatus === 'missing') return 'is-missing'
  if (node.placementStatus === 'placed') return 'is-placed'
  return ''
}
</script>

<template>
  <aside class="fire-device-tree">
    <header class="tree-toolbar">
      <div class="toolbar-row">
        <span class="toolbar-label">{{ t('fire.tree.groupLabel') }}</span>
        <el-button-group class="icon-group" role="radiogroup">
          <el-tooltip
            v-for="option in groupModeOptions"
            :key="option.value"
            :content="option.label"
            placement="bottom"
          >
            <el-button
              :type="treeGroupMode === option.value ? 'primary' : 'default'"
              size="small"
              :aria-label="option.label"
              :aria-pressed="treeGroupMode === option.value"
              @click="treeGroupMode = option.value"
            >
              <el-icon>
                <!-- LOOP -->
                <svg
                  v-if="option.value === 'loop'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                  <circle cx="20" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="20" r="1.5" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                </svg>
                <!-- ZONE (Square) -->
                <svg
                  v-else-if="option.value === 'zone'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3.5 3.5" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                </svg>
                <!-- TYPE (Category Grid) -->
                <svg
                  v-else-if="option.value === 'type'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <circle cx="17.5" cy="17.5" r="3.5" />
                </svg>
                <!-- SOUNDER (Vibrating Bell) -->
                <svg
                  v-else-if="option.value === 'sounderGroup'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  <path d="M22 8a7.92 7.92 0 0 0-.7-3" />
                  <path d="M22 14a7.92 7.92 0 0 1-.7 3" />
                  <path d="M2 8a7.92 7.92 0 0 1 .7-3" />
                  <path d="M2 14a7.92 7.92 0 0 0 .7 3" />
                </svg>
                <!-- I/O (Relay contact switch - Option 5) -->
                <svg
                  v-else-if="option.value === 'ioGroup'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="20" cy="12" r="1.5" fill="currentColor" />
                  <line x1="5.5" y1="12" x2="11" y2="12" />
                  <line x1="11" y1="12" x2="17.5" y2="4" />
                </svg>
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">{{ t('fire.tree.filterLabel') }}</span>
        <el-button-group class="icon-group" role="radiogroup">
          <el-tooltip
            v-for="option in statusOptions"
            :key="option.value"
            :content="option.label"
            placement="bottom"
          >
            <el-button
              :type="deviceStatusFilter === option.value ? 'primary' : 'default'"
              size="small"
              :aria-label="option.label"
              :aria-pressed="deviceStatusFilter === option.value"
              @click="deviceStatusFilter = option.value"
            >
              <el-icon>
                <!-- ALL -->
                <svg
                  v-if="option.value === 'all'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 6H21" />
                  <path d="M12 12H21" />
                  <path d="M12 18H21" />
                  <path d="M3 6L4.5 7.5L8 4" />
                  <path d="M3 12L4.5 13.5L8 10" />
                  <path d="M3 18L4.5 19.5L8 16" />
                </svg>
                <!-- UNPLACED -->
                <svg
                  v-else-if="option.value === 'unplaced'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                <!-- PLACED -->
                <svg
                  v-else-if="option.value === 'placed'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <!-- ISSUES -->
                <svg
                  v-else-if="option.value === 'issues'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                  />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
      <el-input
        v-model="searchText"
        :prefix-icon="Search"
        :placeholder="t('fire.tree.search')"
        clearable
        size="small"
      />
    </header>

    <el-tree
      ref="treeRef"
      class="tree-body"
      :data="treeData"
      node-key="id"
      :default-expanded-keys="expandedKeys"
      :expand-on-click-node="false"
      :highlight-current="false"
      :empty-text="t('fire.tree.empty')"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div
          class="tree-row"
          :class="[
            data.kind,
            issueClass(data),
            { selected: data.deviceId && selectedIds.has(data.deviceId) }
          ]"
          :draggable="data.kind === 'device'"
          @dblclick.stop="handleNodeDoubleClick(data)"
          @contextmenu="handleContextMenu(data, $event)"
          @dragstart="handleDragStart(data, $event)"
        >
          <span v-if="data.kind === 'device'" class="device-icon-wrap">
            <img v-if="data.icon" class="device-icon" :src="getPublicIconHref(data.icon)" alt="" />
            <span v-else class="device-icon-fallback" />
          </span>
          <span v-else class="branch-marker" />

          <span class="row-copy">
            <span class="row-label">{{ data.label }}</span>
            <span v-if="data.subtitle" class="row-subtitle">{{ data.subtitle }}</span>
          </span>

          <span v-if="data.kind !== 'device'" class="count-pill">{{ data.count }}</span>
          <span v-else-if="data.issueCount" class="issue-pill">
            <el-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </el-icon>
            {{ data.issueCount }}
          </span>
          <el-icon v-else-if="data.placementStatus === 'placed'" class="placed-mark">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </el-icon>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped src="./DeviceTree.css"></style>
