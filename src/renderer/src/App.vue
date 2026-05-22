<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DocumentAdd,
  FolderOpened,
  Refresh,
  VideoCamera,
  MapLocation
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import { adaptCpdExport } from './domain/fire/cpdAdapter'
import type { FireAsset } from './domain/fire/types'
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
const { project, pendingCpdDiff } = storeToRefs(store)
const { t } = useI18n()
const viewMode = ref<ViewMode>('2d')
const rightPanelTab = ref<RightPanelTab>('properties')

const hasProject = computed(() => project.value.networks.length > 0)
const projectTitle = computed(() => project.value.name || t('fire.app.name'))

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
      resolveOpenedAssets(result.project as FireProjectDocument, result.extractedAssetRoot)
    )
  } catch (error) {
    ElMessage.error(`${t('fire.app.openFailed')}: ${errorMessage(error)}`)
  }
}

async function saveFireProject(): Promise<void> {
  try {
    await window.fireApi.saveFireProject({
      metadata: {
        schemaVersion: 1,
        appName: 'Numens Fire Alarm Simulator',
        exportedAt: new Date().toISOString(),
        language: project.value.language
      },
      project: project.value,
      assetPaths: project.value.assets.flatMap((asset) =>
        asset.runtimePath ? [{ packagePath: asset.packagePath, sourcePath: asset.runtimePath }] : []
      ),
      suggestedFileName: `${project.value.name || 'fire-project'}.fireproj`
    })
  } catch (error) {
    ElMessage.error(`${t('fire.app.saveFailed')}: ${errorMessage(error)}`)
  }
}

function resolveOpenedAssets(
  openedProject: FireProjectDocument,
  extractedAssetRoot: string
): FireProjectDocument {
  return {
    ...openedProject,
    assets: openedProject.assets.map((asset) => ({
      ...asset,
      runtimePath: asset.runtimePath ?? resolveAssetRuntimePath(asset, extractedAssetRoot)
    }))
  }
}

function resolveAssetRuntimePath(asset: FireAsset, extractedAssetRoot: string): string | undefined {
  if (!asset.packagePath.startsWith('assets/')) {
    return asset.runtimePath
  }
  return `${extractedAssetRoot}\\${asset.packagePath.replace(/\//g, '\\')}`
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
            <el-radio-button value="2d">
              <el-icon><MapLocation /></el-icon>
              {{ t('fire.app.view2d') }}
            </el-radio-button>
            <el-radio-button value="3d">
              <el-icon><VideoCamera /></el-icon>
              {{ t('fire.app.view3d') }}
            </el-radio-button>
          </el-radio-group>
        </div>

        <Planner2D
          v-if="viewMode === '2d'"
          @open-properties="rightPanelTab = 'properties'"
          @locate-device="store.selectDevice($event)"
        />
        <Viewer3D v-else />
      </section>

      <aside class="right-pane">
        <el-tabs v-model="rightPanelTab" stretch>
          <el-tab-pane :label="t('fire.app.properties')" name="properties">
            <PropertyPanel />
          </el-tab-pane>
          <el-tab-pane :label="t('fire.app.group')" name="group">
            <GroupInspector />
          </el-tab-pane>
          <el-tab-pane :label="t('fire.app.simulation')" name="simulation">
            <SimulationPanel />
          </el-tab-pane>
        </el-tabs>
      </aside>
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
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) minmax(320px, 380px);
  min-height: 0;
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
  justify-content: flex-end;
  padding: 8px 10px;
  border-bottom: 1px solid #d8dee8;
  background: #ffffff;
}

.view-tabs :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.right-pane {
  overflow: hidden;
  border-left: 1px solid #d8dee8;
  background: #ffffff;
}

.right-pane :deep(.el-tabs) {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
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
