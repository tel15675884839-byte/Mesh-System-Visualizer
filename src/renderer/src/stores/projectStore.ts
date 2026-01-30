// src/renderer/src/stores/projectStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IFloor } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State (数据状态) ---
  const projectInfo = ref<{ name: string; version: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  // 核心数据：所有设备节点
  const nodes = ref<INode[]>([])
  
  // 核心数据：所有拓扑连线
  const edges = ref<IEdge[]>([])
  
  // 核心数据：楼层配置
  const floors = ref<IFloor[]>([])

  // --- Getters (计算属性) ---
  
  // 获取某个楼层的所有节点
  const getNodesByFloor = (floorId: string) => {
    return nodes.value.filter(node => node.floorId === floorId)
  }

  // 获取统计信息
  const deviceCounts = computed(() => {
    return {
      total: nodes.value.length,
      routers: nodes.value.filter(n => n.role === 'Router').length,
      leaders: nodes.value.filter(n => n.role === 'Leader').length
    }
  })

  // --- Actions (业务操作) ---

  // 初始化/加载工程
  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes
    edges.value = projectData.edges
    floors.value = projectData.floors
    console.log(`[ProjectStore] Project loaded: ${projectData.name} with ${nodes.value.length} nodes.`)
  }

  // 添加或更新节点 (用于 2D/3D 同步)
  function upsertNode(node: INode) {
    const index = nodes.value.findIndex(n => n.id === node.id)
    if (index > -1) {
      nodes.value[index] = node // 更新
    } else {
      nodes.value.push(node) // 新增
    }
  }

  // 清空数据
  function clearProject() {
    nodes.value = []
    edges.value = []
    floors.value = []
  }

  return {
    // 导出状态
    projectInfo,
    nodes,
    edges,
    floors,
    // 导出 Getters
    getNodesByFloor,
    deviceCounts,
    // 导出 Actions
    loadProject,
    upsertNode,
    clearProject
  }
})