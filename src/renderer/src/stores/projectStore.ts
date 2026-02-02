import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IBuilding } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const isProjectLoaded = ref(false)

  const projectInfo = ref<{ name: string; version: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  const nodes = ref<INode[]>([])
  const edges = ref<IEdge[]>([])
  
  // [新增] 建筑列表 (树状结构)
  const buildings = ref<IBuilding[]>([])
  
  const selectedNodeId = ref<string | null>(null)
  const isDark = ref(false)

  // --- Getters ---
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

  function clearProject() {
    nodes.value = []
    edges.value = []
    buildings.value = []
    selectedNodeId.value = null
  }

  // [修改] 创建项目：现在接收初始化数据
  function createProject(name: string, initBuildings: IBuilding[]) {
    clearProject()
    projectInfo.value.name = name
    buildings.value = initBuildings
    isProjectLoaded.value = true
  }

  function closeProject() {
    isProjectLoaded.value = false
  }

  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes
    edges.value = projectData.edges
    buildings.value = projectData.buildings // [修改] 加载建筑数据
    isProjectLoaded.value = true
  }

  function upsertNode(node: INode) {
    const index = nodes.value.findIndex(n => n.id === node.id)
    if (index > -1) {
      nodes.value[index] = node
    } else {
      nodes.value.push(node)
    }
  }

  function selectNode(id: string | null) {
    selectedNodeId.value = id
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    const html = document.documentElement
    if (isDark.value) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  return {
    isProjectLoaded,
    projectInfo,
    nodes,
    edges,
    buildings, // 导出
    selectedNodeId,
    selectedNode,
    isDark,
    deviceCounts,
    createProject,
    closeProject,
    loadProject,
    upsertNode,
    clearProject,
    selectNode,
    toggleTheme
  }
})