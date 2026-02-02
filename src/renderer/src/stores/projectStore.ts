import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IFloor } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const projectInfo = ref<{ name: string; version: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  const nodes = ref<INode[]>([])
  const edges = ref<IEdge[]>([])
  const floors = ref<IFloor[]>([])

  // 新增：当前选中的节点 ID
  const selectedNodeId = ref<string | null>(null)

  // --- Getters ---
  const getNodesByFloor = (floorId: string) => {
    return nodes.value.filter(node => node.floorId === floorId)
  }

  // 新增：获取当前选中的节点对象
  const selectedNode = computed(() => {
    return nodes.value.find(n => n.id === selectedNodeId.value) || null
  })

  const deviceCounts = computed(() => {
    return {
      total: nodes.value.length,
      routers: nodes.value.filter(n => n.role === 'Router').length,
      leaders: nodes.value.filter(n => n.role === 'Leader').length
    }
  })

  // --- Actions ---
  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes
    edges.value = projectData.edges
    floors.value = projectData.floors
  }

  function upsertNode(node: INode) {
    const index = nodes.value.findIndex(n => n.id === node.id)
    if (index > -1) {
      nodes.value[index] = node
    } else {
      nodes.value.push(node)
    }
  }

  function clearProject() {
    nodes.value = []
    edges.value = []
    floors.value = []
    selectedNodeId.value = null
  }

  // 新增：选中节点
  function selectNode(id: string | null) {
    selectedNodeId.value = id
  }

  return {
    projectInfo,
    nodes,
    edges,
    floors,
    selectedNodeId,
    selectedNode,
    getNodesByFloor,
    deviceCounts,
    loadProject,
    upsertNode,
    clearProject,
    selectNode
  }
})