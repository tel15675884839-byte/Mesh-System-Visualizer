<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  DocumentAdd,
  FolderOpened,
  Refresh
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import { adaptCpdExport } from './domain/fire/cpdAdapter'
import { createFireProjectSavePayload } from './domain/fire/projectPackagePayload'
import { resolveOpenedProjectAssetRuntimePaths } from './domain/fire/projectAssets'
import DeviceTree from './components/fire/DeviceTree.vue'
import Planner2D from './components/fire/Planner2D.vue'
import Viewer3D from './components/fire/Viewer3D.vue'
import PropertyPanel from './components/fire/PropertyPanel.vue'
import GroupInspector from './components/fire/GroupInspector.vue'
import SimulationPanel from './components/fire/SimulationPanel.vue'
import ImportDiffDialog from './components/fire/ImportDiffDialog.vue'

type ViewMode = '2d' | '3d'
type RightPanelTab = 'properties' | 'group' | 'simulation'

const store = useFireProjectStore()
const { project, pendingCpdDiff, selectedDeviceId } = storeToRefs(store)
const { t } = useI18n()
const viewMode = ref<ViewMode>('2d')
const rightPanelTab = ref<RightPanelTab>('properties')
const isRightPanelOpen = ref(false)

const hasProject = computed(() => project.value.networks.length > 0)
const projectTitle = computed(() => project.value.name || t('fire.app.name'))

watch(selectedDeviceId, (deviceId) => {
  isRightPanelOpen.value = Boolean(deviceId)
})

watch(viewMode, (mode) => {
  if (mode === '2d' && rightPanelTab.value === 'simulation') {
    rightPanelTab.value = 'properties'
  }
})

async function newFromCpd(): Promise<void> {
  try {
    const result = await window.fireApi.importCpd()
    if (result.canceled) return
    store.loadFromCpdAdapterResult(adaptCpdExport(result.data))
  } catch (error) {
    ElMessage.error(`${t('fire.app.importFailed')}: ${errorMessage(error)}`)
  }
}

async function reimportCpd(): Promise<void> {
  try {
    const result = await window.fireApi.importCpd()
    if (result.canceled) return
    const adapted = adaptCpdExport(result.data)
    if (!hasProject.value) {
      store.loadFromCpdAdapterResult(adapted)
      return
    }
    store.prepareCpdReimport(adapted)
  } catch (error) {
    ElMessage.error(`${t('fire.app.importFailed')}: ${errorMessage(error)}`)
  }
}

async function openFireProject(): Promise<void> {
  try {
    const result = await window.fireApi.openFireProject()
    if (result.canceled) return
    store.loadFireProject(
      resolveOpenedProjectAssetRuntimePaths(
        result.project as FireProjectDocument,
        result.extractedAssetRoot
      )
    )
  } catch (error) {
    ElMessage.error(`${t('fire.app.openFailed')}: ${errorMessage(error)}`)
  }
}

async function saveFireProject(): Promise<void> {
  try {
    await window.fireApi.saveFireProject(createFireProjectSavePayload(project.value))
  } catch (error) {
    ElMessage.error(`${t('fire.app.saveFailed')}: ${errorMessage(error)}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <main class="fire-app">
    <header class="app-header">
      <div class="brand">
        <strong>{{ t('fire.app.name') }}</strong>
        <span>{{ projectTitle }}</span>
      </div>

      <nav class="app-actions">
        <el-button type="primary" :icon="DocumentAdd" @click="newFromCpd">
          {{ t('fire.app.newFromCpd') }}
        </el-button>
        <el-button :icon="FolderOpened" @click="openFireProject">
          {{ t('fire.app.openProject') }}
        </el-button>
        <el-button :disabled="!hasProject" @click="saveFireProject">
          {{ t('fire.app.saveProject') }}
        </el-button>
        <el-button :disabled="!hasProject" :icon="Refresh" @click="reimportCpd">
          {{ t('fire.app.reimportCpd') }}
        </el-button>
      </nav>
    </header>

    <section v-if="hasProject" class="workspace">
      <DeviceTree
        class="device-tree-pane"
        @focus-device="store.selectDevice($event)"
        @device-context-menu="store.selectDevice($event.deviceId)"
      />

      <section class="center-pane">
        <div class="view-tabs">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="2d">
              <el-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                  <path d="M9 3v15" />
                  <path d="M15 6v15" />
                </svg>
              </el-icon>
              {{ t('fire.app.view2d') }}
            </el-radio-button>
            <el-radio-button label="3d">
              <el-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 7v10" />
                  <path d="M12 12v10" />
                  <path d="M22 7v10" />
                </svg>
              </el-icon>
            {{ t('fire.app.view3d') }}
          </el-radio-button>
        </el-radio-group>
          <el-tooltip
            :content="isRightPanelOpen ? t('fire.app.hidePanel') : t('fire.app.showPanel')"
            placement="bottom"
          >
            <el-button
              class="panel-toggle"
              :icon="isRightPanelOpen ? ArrowRight : ArrowLeft"
              size="small"
              @click="isRightPanelOpen = !isRightPanelOpen"
            />
          </el-tooltip>
        </div>

        <Planner2D
          v-if="viewMode === '2d'"
          @open-properties="rightPanelTab = 'properties'"
          @locate-device="store.selectDevice($event)"
        />
        <Viewer3D
          v-else
          @open-properties="rightPanelTab = 'properties'"
          @locate-device="store.selectDevice($event)"
        />
      </section>

      <Transition name="right-panel-slide">
        <aside v-if="isRightPanelOpen" class="right-pane">
          <el-tooltip :content="t('fire.app.hidePanel')" placement="left">
            <el-button
              class="right-pane-close"
              :icon="ArrowRight"
              size="small"
              @click="isRightPanelOpen = false"
            />
          </el-tooltip>

          <el-tabs v-model="rightPanelTab" stretch>
            <el-tab-pane :label="t('fire.app.properties')" name="properties">
              <PropertyPanel />
            </el-tab-pane>
            <el-tab-pane :label="t('fire.app.group')" name="group">
              <GroupInspector />
            </el-tab-pane>
            <el-tab-pane
              v-if="viewMode === '3d'"
              :label="t('fire.app.simulation')"
              name="simulation"
            >
              <SimulationPanel />
            </el-tab-pane>
          </el-tabs>
        </aside>
      </Transition>
    </section>

    <section v-else class="empty-state">
      <h1>{{ t('fire.app.name') }}</h1>
      <p>{{ t('fire.app.noProject') }}</p>
      <div>
        <el-button type="primary" :icon="DocumentAdd" @click="newFromCpd">
          {{ t('fire.app.newFromCpd') }}
        </el-button>
        <el-button :icon="FolderOpened" @click="openFireProject">
          {{ t('fire.app.openProject') }}
        </el-button>
      </div>
    </section>

    <ImportDiffDialog
      :visible="Boolean(pendingCpdDiff)"
      :diff="pendingCpdDiff"
      @confirm="store.applyPendingCpdDiff"
      @cancel="store.cancelPendingCpdDiff"
    />
  </main>
</template>

<style scoped>
.fire-app {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #eef2f7;
  color: #172033;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  min-height: 56px;
  padding: 8px 14px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
}

.brand {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.brand strong {
  font-size: 16px;
}

.brand span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
}

.workspace {
  position: relative;
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.device-tree-pane,
.center-pane,
.right-pane {
  min-height: 0;
}

.center-pane {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
}

.view-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
}

.view-tabs :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.panel-toggle {
  flex: 0 0 auto;
}

.right-pane {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: clamp(320px, 28vw, 380px);
  max-width: calc(100% - 280px);
  overflow: hidden;
  border-left: 1px solid #d8dee8;
  background: #ffffff;
  box-shadow: -18px 0 34px rgb(15 23 42 / 0.14);
  will-change: transform, opacity;
}

.right-pane-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
}

.right-pane :deep(.el-tabs) {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
}

.right-pane :deep(.el-tabs__header) {
  padding-right: 42px;
}

.right-pane :deep(.el-tabs__content),
.right-pane :deep(.el-tab-pane) {
  min-height: 0;
  height: 100%;
}

.right-pane :deep(.property-panel),
.right-pane :deep(.group-inspector),
.right-pane :deep(.simulation-panel) {
  border-left: 0;
}

.right-panel-slide-enter-active,
.right-panel-slide-leave-active {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}

.right-panel-slide-enter-from,
.right-panel-slide-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.right-panel-slide-enter-to,
.right-panel-slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .right-panel-slide-enter-active,
  .right-panel-slide-leave-active {
    transition: none;
  }
}

.empty-state {
  display: grid;
  place-content: center;
  gap: 18px;
  padding: 24px;
  text-align: center;
}

.empty-state h1 {
  margin: 0;
  font-size: 30px;
}

.empty-state p {
  margin: 0;
  color: #64748b;
}

.empty-state div {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
