import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IBuilding, ILoop } from '../types'
import { Log } from '../utils/logger'
import { ElMessage } from 'element-plus'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const isProjectLoaded = ref(false)
  const projectInfo = ref<{ name: string; version: string; filePath?: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  const nodes = ref<INode[]>([])
  const edges = ref<IEdge[]>([])
  const buildings = ref<IBuilding[]>([])
  const loops = ref<ILoop[]>([])
  
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
    loops.value = []
    selectedNodeId.value = null
    projectInfo.value.filePath = undefined
  }

  function createProject(
    name: string, 
    initBuildings: IBuilding[],
    initLoops: ILoop[],
    initNodes: INode[],
    initEdges: IEdge[]
  ) {
    clearProject()
    projectInfo.value.name = name
    buildings.value = initBuildings
    loops.value = initLoops
    nodes.value = initNodes
    edges.value = initEdges
    isProjectLoaded.value = true
  }

  function closeProject() {
    isProjectLoaded.value = false
    clearProject()
  }

  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes
    edges.value = projectData.edges
    buildings.value = projectData.buildings
    loops.value = projectData.loops || []
    isProjectLoaded.value = true
  }

  // [新增] 保存到硬盘
  async function saveToDisk() {
    const data: IProject = {
      version: '1.0.0',
      name: projectInfo.value.name,
      created: Date.now(),
      updated: Date.now(),
      nodes: nodes.value,
      edges: edges.value,
      buildings: buildings.value,
      loops: loops.value,
      settings: { theme: isDark.value ? 'dark' : 'light', coordSystem: 'cartesian' }
    }

    const jsonString = JSON.stringify(data, null, 2)
    
    // @ts-ignore
    const result = await window.api.saveProject(jsonString)
    
    if (result && result.success) {
      projectInfo.value.filePath = result.filePath
      ElMessage.success('保存成功')
    }
  }

  // [新增] 从硬盘读取
  async function loadFromDisk() {
    // @ts-ignore
    const result = await window.api.openProject()
    
    if (result && result.content) {
      try {
        const data = JSON.parse(result.content) as IProject
        // 简单校验
        if (!data.nodes || !data.buildings) {
          throw new Error('无效的项目文件格式')
        }
        
        loadProject(data)
        projectInfo.value.filePath = result.filePath
        ElMessage.success(`成功加载: ${data.name}`)
        return true
      } catch (e: any) {
        Log.error('文件解析失败', e)
        ElMessage.error('文件损坏或格式错误')
        return false
      }
    }
    return false
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
    buildings,
    loops,
    selectedNodeId,
    selectedNode,
    isDark,
    deviceCounts,
    createProject,
    closeProject,
    loadProject,
    saveToDisk,   // 导出
    loadFromDisk, // 导出
    upsertNode,
    clearProject,
    selectNode,
    toggleTheme
  }
})