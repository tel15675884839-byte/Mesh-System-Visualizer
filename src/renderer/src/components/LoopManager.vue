<script setup lang="ts">
import { ref } from 'vue'
import { computed } from 'vue'
import { Delete, Refresh, Upload, Check, Brush, Plus } from '@element-plus/icons-vue' // [新增] Plus
import { useProjectStore } from '../stores/projectStore'
import { parseOpenThreadHtml, extractMac, extractRssi } from '../utils/htmlParser'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ILoop, IEdge } from '../types'

const store = useProjectStore()
const MAX_LOOPS = 16

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
        rssi: extractRssi(raw), 
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

// [新增] 处理添加 Loop
const handleAddLoopFile = (file: any) => {
  if (store.loops.length >= MAX_LOOPS) {
    ElMessage.warning(`最多只能添加 ${MAX_LOOPS} 个回路`)
    return
  }

  processFile(file.raw, (nodes, edges, name) => {
    // 1. 全局重复性检查 (不允许添加已存在的设备)
    const existingMacs = new Set(store.nodes.map(n => n.mac))
    const duplicates: string[] = []
    
    nodes.forEach(n => {
      const mac = extractMac(n)
      if (existingMacs.has(mac)) duplicates.push(mac)
    })

    if (duplicates.length > 0) {
      ElMessage.error(`无法添加：发现 ${duplicates.length} 个设备已在其他 Loop 中存在`)
      return
    }

    // 2. 生成默认名称
    let loopIndex = 1
    while (store.loops.some(l => l.name === `Loop ${loopIndex}`)) {
      loopIndex++
    }
    const loopName = `Loop ${loopIndex}`

    // 3. 调用 Store 添加
    const finalEdges = convertEdges(edges, nodes)
    store.addLoop(loopName, nodes, finalEdges, name)
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
    
    <!-- [新增] 添加 Loop 卡片 -->
    <div class="loop-card add-card" v-if="store.loops.length < MAX_LOOPS">
      <el-upload 
        action="#" 
        :auto-upload="false" 
        :show-file-list="false" 
        accept=".html" 
        @change="handleAddLoopFile"
        class="add-uploader"
      >
        <div class="add-content">
          <el-icon :size="24"><Plus /></el-icon>
          <span>添加回路 (上传拓扑图)</span>
        </div>
      </el-upload>
    </div>
    
    <div class="empty-tip" v-if="store.loops.length === 0">
      暂无回路，请点击上方添加。
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
</style>