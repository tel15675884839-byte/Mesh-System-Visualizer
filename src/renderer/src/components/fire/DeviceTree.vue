<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import {
  Bell,
  Check,
  Close,
  Connection,
  Crop,
  Finished,
  Search,
  SwitchButton,
  WarningFilled
} from '@element-plus/icons-vue'
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

const groupModeOptions = computed<Array<{ label: string; value: GroupMode; icon: Component }>>(
  () => [
    { label: t('fire.tree.group.loop'), value: 'loop', icon: Connection },
    { label: t('fire.tree.group.zone'), value: 'zone', icon: Crop },
    { label: t('fire.tree.group.type'), value: 'type', icon: Search },
    { label: t('fire.tree.group.sounderGroup'), value: 'sounderGroup', icon: Bell },
    { label: t('fire.tree.group.ioGroup'), value: 'ioGroup', icon: SwitchButton }
  ]
)

const statusOptions = computed<
  Array<{ label: string; value: DeviceStatusFilter; icon: Component }>
>(() => [
  { label: t('fire.tree.filter.all'), value: 'all', icon: Finished },
  { label: t('fire.tree.filter.unplaced'), value: 'unplaced', icon: Close },
  { label: t('fire.tree.filter.placed'), value: 'placed', icon: Check },
  { label: t('fire.tree.filter.issues'), value: 'issues', icon: WarningFilled }
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
              <el-icon><component :is="option.icon" /></el-icon>
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
              <el-icon><component :is="option.icon" /></el-icon>
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
            <el-icon><WarningFilled /></el-icon>
            {{ data.issueCount }}
          </span>
          <el-icon v-else-if="data.placementStatus === 'placed'" class="placed-mark"
            ><Check
          /></el-icon>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.fire-device-tree {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  height: 100%;
  background: #f7f9fb;
  border-right: 1px solid #d8dee8;
  color: #172033;
}

.tree-toolbar {
  display: grid;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
}

.toolbar-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.toolbar-label {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
}

.icon-group {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(30px, 1fr);
  min-width: 0;
}

.icon-group :deep(.el-button) {
  display: inline-flex;
  width: 100%;
  min-width: 30px;
  margin: 0;
  justify-content: center;
  padding: 5px 0;
}

.icon-group :deep(.el-button .el-icon) {
  margin: 0;
}

.tree-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: auto;
  min-height: 34px;
  border-radius: 6px;
}

:deep(.el-tree-node__content:hover) {
  background: #e9eef7;
}

.tree-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px 4px 2px;
  border-radius: 6px;
  cursor: pointer;
}

.tree-row.selected {
  background: #1d4ed8;
  color: #ffffff;
}

.tree-row.device.is-missing {
  opacity: 0.62;
}

.tree-row.device.has-issues .row-label {
  color: #b45309;
}

.tree-row.selected .row-label,
.tree-row.selected .row-subtitle {
  color: #ffffff;
}

.branch-marker {
  width: 10px;
  height: 10px;
  margin-left: 6px;
  border-radius: 3px;
  background: #64748b;
}

.tree-row.panel .branch-marker {
  background: #0f766e;
}

.tree-row.group .branch-marker {
  background: #7c3aed;
}

.device-icon-wrap {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
}

.device-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.device-icon-fallback {
  width: 14px;
  height: 14px;
  border: 2px solid #475569;
  border-radius: 50%;
}

.row-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.row-label,
.row-subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-label {
  font-size: 13px;
  font-weight: 600;
  color: #172033;
}

.row-subtitle {
  font-size: 11px;
  color: #64748b;
}

.count-pill,
.issue-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 22px;
  height: 20px;
  justify-content: center;
  border-radius: 999px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 700;
}

.count-pill {
  background: #e2e8f0;
  color: #334155;
}

.issue-pill {
  background: #fef3c7;
  color: #92400e;
}

.placed-mark {
  color: #059669;
}
</style>
