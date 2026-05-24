<script setup lang="ts">
import { ref } from 'vue'
import { computed } from 'vue'
import { Delete, Check, Brush, Plus, RefreshRight } from '@element-plus/icons-vue' // [新增] Plus
import { useProjectStore } from '../stores/projectStore'
import { parseOpenThreadHtml, extractMac, extractRssi } from '../utils/htmlParser'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ILoop, IEdge } from '../types'

const store = useProjectStore()
const MAX_LOOPS = 16

const getLoopStats = (
  loopId: string
): { total: number; new: number; missing: number; unchanged: number } => {
  const loopNodes = store.nodes.filter((n) => n.loopId === loopId)
  return {
    total: loopNodes.length,
    new: loopNodes.filter((n) => n.diffStatus === 'new').length,
    missing: loopNodes.filter((n) => n.diffStatus === 'missing').length,
    unchanged: loopNodes.filter((n) => n.diffStatus === 'unchanged' || n.diffStatus === 'normal')
      .length
  }
}

// [新增] Diff 状态管理
const diffDialogVisible = ref(false)
const currentDiffLoop = ref<ILoop | null>(null)
const diffStats = computed(() => {
  if (!currentDiffLoop.value) return { new: 0, missing: 0, unchanged: 0 }
  return getLoopStats(currentDiffLoop.value.id)
})

const processFile = (
  file: File,
  callback: (nodes: any[], edges: any[], name: string) => void
): void => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const { nodes, edges } = parseOpenThreadHtml(e.target?.result as string)
      callback(nodes, edges, file.name)
    } catch (err: any) {
      ElMessage.error('解析失败: ' + err.message)
    }
  }
  reader.readAsText(file)
}

const convertEdges = (rawEdges: any[], rawNodes: any[]): IEdge[] => {
  const finalEdges: IEdge[] = []
  rawEdges.forEach((raw) => {
    const fromNode = rawNodes.find((n) => n.id == raw.from)
    const toNode = rawNodes.find((n) => n.id == raw.to)
    if (fromNode && toNode) {
      finalEdges.push({
        id: `edge-${raw.id || Math.random()}`,
        sourceId: extractMac(fromNode),
        targetId: extractMac(toNode),
        lqi: raw.lqi,
        rssi: extractRssi(raw),
        isParentChild: false
      })
    }
  })
  return finalEdges
}

const handleDelete = (loop: ILoop): void => {
  ElMessageBox.confirm(
    `确定要删除 ${loop.name} 吗？这将清空该回路下所有设备（包括已布点的）。`,
    '删除确认',
    { type: 'warning' }
  ).then(() => {
    store.deleteLoop(loop.id)
  })
}

const handleUpdate = (file: any, loop: ILoop): void => {
  processFile(file.raw, (nodes, edges, name) => {
    // 1. 调用 Store 的 Diff 逻辑
    store.updateLoopTopology(loop.id, nodes, edges, name)

    // 2. 打开确认对话框
    currentDiffLoop.value = loop
    diffDialogVisible.value = true
  })
}

const confirmUpdate = (): void => {
  if (currentDiffLoop.value) {
    store.commitTopologyChanges(currentDiffLoop.value.id)
    diffDialogVisible.value = false
    ElMessage.success('拓扑更新已确认')
  }
}

const previewChanges = (): void => {
  diffDialogVisible.value = false
  // 提示用户在 2D 视图查看
  ElMessage.info('请在 2D 视图中查看变更（绿色为新增，灰色为缺失）')
}

const cancelUpdate = (): void => {
  if (currentDiffLoop.value) {
    store.discardTopologyChanges(currentDiffLoop.value.id)
    diffDialogVisible.value = false
  }
}

// [新增] 处理添加 Loop
const handleAddLoopFile = (file: any): void => {
  if (store.loops.length >= MAX_LOOPS) {
    ElMessage.warning(`最多只能添加 ${MAX_LOOPS} 个回路`)
    return
  }

  processFile(file.raw, (nodes, edges, name) => {
    // 1. 全局重复性检查 (不允许添加已存在的设备)
    const existingMacs = new Set(store.nodes.map((n) => n.mac))
    const duplicates: string[] = []

    nodes.forEach((n) => {
      const mac = extractMac(n)
      if (existingMacs.has(mac)) duplicates.push(mac)
    })

    if (duplicates.length > 0) {
      ElMessage.error(`无法添加：发现 ${duplicates.length} 个设备已在其他 Loop 中存在`)
      return
    }

    // 2. 生成默认名称
    let loopIndex = 1
    while (store.loops.some((l) => l.name === `Loop ${loopIndex}`)) {
      loopIndex++
    }
    const loopName = `Loop ${loopIndex}`

    // 3. 调用 Store 添加
    const finalEdges = convertEdges(edges, nodes)
    store.addLoop(loopName, nodes, finalEdges, name)
  })
}

const handlePurge = (loop: ILoop): void => {
  store.purgeMissingNodes(loop.id)
}

const handleConfirm = (loop: ILoop): void => {
  store.confirmLoopChanges(loop.id)
}
</script>

<template>
  <div class="loop-manager">
    <div v-for="loop in store.loops" :key="loop.id" class="loop-card">
      <div class="loop-header">
        <span class="loop-name">{{ loop.name }}</span>
        <span v-if="loop.htmlSource" class="loop-file">{{ loop.htmlSource }}</span>
      </div>

      <div class="loop-body">
        <div class="stats-row">
          <div class="stat-item">
            <span class="num">{{ getLoopStats(loop.id).total }}</span>
            <span class="label">设备</span>
          </div>
          <div v-if="getLoopStats(loop.id).new > 0" class="stat-item new">
            <span class="num">+{{ getLoopStats(loop.id).new }}</span>
            <span class="label">新增</span>
          </div>
          <div v-if="getLoopStats(loop.id).missing > 0" class="stat-item missing">
            <span class="num">-{{ getLoopStats(loop.id).missing }}</span>
            <span class="label">缺失</span>
          </div>
        </div>

        <div class="actions-row">
          <el-upload
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            accept=".html"
            @change="(f) => handleUpdate(f, loop)"
          >
            <!-- 增强 更新 (Diff) 按钮的辨识度 -->
            <el-button size="small" type="primary" class="diff-btn" :icon="RefreshRight">
              更新 (Diff)
            </el-button>
          </el-upload>

          <!-- 移除独立的 替换 按钮 -->

          <el-button size="small" type="danger" plain :icon="Delete" @click="handleDelete(loop)"
            >删除</el-button
          >
        </div>

        <div
          v-if="getLoopStats(loop.id).new > 0 || getLoopStats(loop.id).missing > 0"
          class="quick-actions"
        >
          <el-button
            v-if="getLoopStats(loop.id).new > 0"
            size="small"
            link
            type="success"
            :icon="Check"
            @click="handleConfirm(loop)"
            >确认变更</el-button
          >

          <el-button
            v-if="getLoopStats(loop.id).missing > 0"
            size="small"
            link
            type="info"
            :icon="Brush"
            @click="handlePurge(loop)"
            >清理缺失</el-button
          >
        </div>
      </div>
    </div>

    <!-- [新增] 添加 Loop 卡片 -->
    <div v-if="store.loops.length < MAX_LOOPS" class="loop-card add-card">
      <el-upload
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".html"
        class="add-uploader"
        @change="handleAddLoopFile"
      >
        <div class="add-content">
          <el-icon :size="24"><Plus /></el-icon>
          <span>添加回路 (上传拓扑图)</span>
        </div>
      </el-upload>
    </div>

    <div v-if="store.loops.length === 0" class="empty-tip">暂无回路，请点击上方添加。</div>

    <!-- [新增] Diff 确认对话框 -->
    <el-dialog v-model="diffDialogVisible" title="拓扑变更确认" width="400px" append-to-body>
      <div class="diff-summary-content">
        <p>检测到拓扑变更，请确认：</p>
        <div class="diff-stats-box">
          <div class="stat-box-item new">
            <span class="val">+{{ diffStats.new }}</span>
            <span class="lbl">新增</span>
          </div>
          <div class="stat-box-item missing">
            <span class="val">-{{ diffStats.missing }}</span>
            <span class="lbl">缺失</span>
          </div>
          <div class="stat-box-item unchanged">
            <span class="val">{{ diffStats.unchanged }}</span>
            <span class="lbl">未变更</span>
          </div>
        </div>
        <el-alert
          v-if="diffStats.missing > 0"
          title="注意：确认后缺失设备将被删除"
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 10px"
        />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelUpdate">取消并还原</el-button>
          <el-button type="primary" plain @click="previewChanges">预览变更</el-button>
          <el-button type="success" @click="confirmUpdate">确认更新</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.loop-manager {
  padding: 10px;
}
.loop-card {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 15px;
  background: var(--bg-color);
  overflow: hidden;
}
.loop-header {
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.loop-name {
  font-weight: bold;
  font-size: 14px;
}
.loop-file {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.loop-body {
  padding: 15px;
}
.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-item .num {
  font-size: 18px;
  font-weight: bold;
}
.stat-item .label {
  font-size: 12px;
  color: #909399;
}
.stat-item.new .num {
  color: #67c23a;
}
.stat-item.missing .num {
  color: #909399;
  text-decoration: line-through;
}

.actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.quick-actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
  display: flex;
  gap: 15px;
}

.empty-tip {
  text-align: center;
  color: #909399;
  padding: 40px;
}

/* Add Card Style */
.add-card {
  border-style: dashed;
  transition: all 0.2s;
}
.add-card:hover {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}
.add-uploader {
  width: 100%;
}
.add-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  cursor: pointer;
  color: #909399;
}
.add-content span {
  margin-top: 8px;
  font-size: 13px;
}
.add-card:hover .add-content {
  color: #409eff;
}
.add-card:hover .add-content {
  color: #409eff;
}

/* Diff Stats Styles */
.diff-summary-content {
  text-align: center;
}
.diff-stats-box {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
}
.stat-box-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
  min-width: 70px;
}
.stat-box-item .val {
  font-size: 20px;
  font-weight: bold;
}
.stat-box-item .lbl {
  font-size: 12px;
  color: #909399;
}
.stat-box-item.new .val {
  color: #67c23a;
}
.stat-box-item.missing .val {
  color: #f56c6c;
}
</style>
