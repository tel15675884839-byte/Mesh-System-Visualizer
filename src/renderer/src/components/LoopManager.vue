<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Refresh, Upload, Check, Brush } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
// [修改] 引入 extractRssi
import { parseOpenThreadHtml, extractMac, extractRssi } from '../utils/htmlParser'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ILoop, IEdge } from '../types'

const store = useProjectStore()

const getLoopStats = (loopId: string) => {
  const nodes = store.nodes.filter(n => n.loopId === loopId)
  return {
    total: nodes.length,
    new: nodes.filter(n => n.diffStatus === 'new').length,
    missing: nodes.filter(n => n.diffStatus === 'missing').length
  }
}

const processFile = (file: File, callback: (nodes: any[], edges: any[], name: string) => void) => {
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

// [修改] 使用 extractRssi 提取信号值
const convertEdges = (rawEdges: any[], rawNodes: any[]) => {
  const finalEdges: IEdge[] = []
  rawEdges.forEach(raw => {
    const fromNode = rawNodes.find(n => n.id == raw.from)
    const toNode = rawNodes.find(n => n.id == raw.to)
    if (fromNode && toNode) {
      finalEdges.push({
        id: `edge-${raw.id || Math.random()}`,
        sourceId: extractMac(fromNode),
        targetId: extractMac(toNode),
        lqi: raw.lqi,
        rssi: extractRssi(raw), // [核心修改] 调用提取函数
        isParentChild: false
      })
    }
  })
  return finalEdges
}

const handleDelete = (loop: ILoop) => {
  ElMessageBox.confirm(
    `确定要删除 ${loop.name} 吗？这将清空该回路下所有设备（包括已布点的）。`,
    '删除确认',
    { type: 'warning' }
  ).then(() => {
    store.deleteLoop(loop.id)
  })
}

const handleReplace = (file: any, loop: ILoop) => {
  processFile(file.raw, (nodes, edges, name) => {
    ElMessageBox.confirm('替换将丢失该回路所有设备的坐标和楼层信息，确定吗？', '警告', { type: 'warning' })
    .then(() => {
      const finalEdges = convertEdges(edges, nodes)
      store.replaceLoop(loop, nodes, finalEdges, name)
    })
  })
}

const handleUpdate = (file: any, loop: ILoop) => {
  processFile(file.raw, (nodes, edges, name) => {
    const finalEdges = convertEdges(edges, nodes)
    store.updateLoop(loop, nodes, finalEdges, name)
  })
}

const handlePurge = (loop: ILoop) => {
  store.purgeMissingNodes(loop.id)
}

const handleConfirm = (loop: ILoop) => {
  store.confirmLoopChanges(loop.id)
}
</script>

<template>
  <div class="loop-manager">
    <div v-for="loop in store.loops" :key="loop.id" class="loop-card">
      <div class="loop-header">
        <span class="loop-name">{{ loop.name }}</span>
        <span class="loop-file" v-if="loop.htmlSource">{{ loop.htmlSource }}</span>
      </div>
      
      <div class="loop-body">
        <div class="stats-row">
          <div class="stat-item">
            <span class="num">{{ getLoopStats(loop.id).total }}</span>
            <span class="label">设备</span>
          </div>
          <div class="stat-item new" v-if="getLoopStats(loop.id).new > 0">
            <span class="num">+{{ getLoopStats(loop.id).new }}</span>
            <span class="label">新增</span>
          </div>
          <div class="stat-item missing" v-if="getLoopStats(loop.id).missing > 0">
            <span class="num">-{{ getLoopStats(loop.id).missing }}</span>
            <span class="label">缺失</span>
          </div>
        </div>

        <div class="actions-row">
          <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".html" @change="(f) => handleUpdate(f, loop)">
            <el-button size="small" type="primary" plain :icon="Upload">更新 (Diff)</el-button>
          </el-upload>

          <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".html" @change="(f) => handleReplace(f, loop)">
            <el-button size="small" type="warning" plain :icon="Refresh">替换</el-button>
          </el-upload>

          <el-button size="small" type="danger" plain :icon="Delete" @click="handleDelete(loop)">删除</el-button>
        </div>

        <div class="quick-actions" v-if="getLoopStats(loop.id).new > 0 || getLoopStats(loop.id).missing > 0">
          <el-button 
            v-if="getLoopStats(loop.id).new > 0"
            size="small" link type="success" :icon="Check" 
            @click="handleConfirm(loop)"
          >确认变更</el-button>
          
          <el-button 
            v-if="getLoopStats(loop.id).missing > 0"
            size="small" link type="info" :icon="Brush" 
            @click="handlePurge(loop)"
          >清理缺失</el-button>
        </div>
      </div>
    </div>
    
    <div class="empty-tip" v-if="store.loops.length === 0">
      暂无回路，请新建项目添加。
    </div>
  </div>
</template>

<style scoped>
.loop-manager { padding: 10px; }
.loop-card {
  border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 15px;
  background: var(--bg-color); overflow: hidden;
}
.loop-header {
  padding: 10px 15px; background: rgba(0,0,0,0.03); border-bottom: 1px solid var(--border-color);
  display: flex; justify-content: space-between; align-items: center;
}
.loop-name { font-weight: bold; font-size: 14px; }
.loop-file { font-size: 12px; color: #909399; font-family: monospace; }

.loop-body { padding: 15px; }
.stats-row { display: flex; gap: 20px; margin-bottom: 15px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-item .num { font-size: 18px; font-weight: bold; }
.stat-item .label { font-size: 12px; color: #909399; }
.stat-item.new .num { color: #67c23a; }
.stat-item.missing .num { color: #909399; text-decoration: line-through; }

.actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
.quick-actions { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color); display: flex; gap: 15px; }

.empty-tip { text-align: center; color: #909399; padding: 40px; }
</style>