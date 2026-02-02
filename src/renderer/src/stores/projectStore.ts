import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IFloor } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State (数据状态) ---
  
  // [新增] 项目加载状态：默认为 false，显示启动页
  const isProjectLoaded = ref(false)

  const projectInfo = ref<{ name: string; version: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  const nodes = ref<INode[]>([])
  const edges = ref<IEdge[]>([])
  const floors = ref<IFloor[]>([])
  const selectedNodeId = ref<string | null>(null)
  const isDark = ref(false)

  // --- Getters (计算属性) ---
  const getNodesByFloor = (floorId: string) => {
    return nodes.value.filter(node => node.floorId === floorId)
  }

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

  // --- Actions (业务操作) ---

  function clearProject() {
    nodes.value = []
    edges.value = []
    floors.value = []
    selectedNodeId.value = null
  }

  // [新增] 新建项目动作
  function createProject() {
    clearProject()
    projectInfo.value.name = 'Untitled Project'
    isProjectLoaded.value = true // 进入工作区
  }

  // [新增] 关闭项目动作
  function closeProject() {
    isProjectLoaded.value = false // 回到启动页
  }

  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes
    edges.value = projectData.edges
    floors.value = projectData.floors
    isProjectLoaded.value = true // 加载数据后自动进入工作区
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
    isProjectLoaded, // 导出新状态
    projectInfo,
    nodes,
    edges,
    floors,
    selectedNodeId,
    selectedNode,
    isDark,
    getNodesByFloor,
    deviceCounts,
    createProject,   // 导出新建动作
    closeProject,    // 导出关闭动作
    loadProject,
    upsertNode,
    clearProject,
    selectNode,
    toggleTheme
  }
})