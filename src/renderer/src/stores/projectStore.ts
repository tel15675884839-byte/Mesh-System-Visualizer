import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IBuilding, ILoop, IViewSettings } from '../types'
import { Log } from '../utils/logger'
import { ElMessage } from 'element-plus'
import { extractMac, extractRssi } from '../utils/htmlParser' 
import { DeviceRole, DeviceType } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const isProjectLoaded = ref(false)
  const isBuildingEditorVisible = ref(false)
  
  // [新增] 视图模式状态
  const currentViewMode = ref<'2D' | '3D'>('2D')

  const structureVersion = ref(0)

  const projectInfo = ref<{ name: string; version: string; filePath?: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  const viewSettings = ref<IViewSettings>({
    iconScale: 100,      
    labelColor: '#000000', 
    mapOpacity: 1.0,
    showAllLinks: false
  })

  const focusRequest = ref<{ nodeId: string; timestamp: number } | null>(null)

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

  const getBuildingName = (bldId: string) => {
    const bld = buildings.value.find(b => b.id === bldId)
    return bld ? bld.name : bldId
  }

  const getFloorName = (bldId: string, floorId: string) => {
    const bld = buildings.value.find(b => b.id === bldId)
    if (!bld) return floorId
    const floor = bld.floors.find(f => f.id === floorId)
    return floor ? floor.name : floorId
  }

  const getDisplayId = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return 'Unknown'
    if (node.shortId && node.shortId !== '0xfffe' && node.shortId !== '') return node.shortId.replace('0x', '')
    return node.mac.slice(-4)
  }

  // --- Actions ---

  // [新增] 切换视图模式
  function switchViewMode(mode: '2D' | '3D') {
    currentViewMode.value = mode
  }

  function triggerFocus(nodeId: string) {
    focusRequest.value = { nodeId, timestamp: Date.now() }
  }

  function updateViewSettings(settings: Partial<IViewSettings>) {
    Object.assign(viewSettings.value, settings)
  }

  function addLoop(name: string, rawNodes: any[], processedEdges: IEdge[], fileName: string) {
    const newLoopId = `loop-${Date.now()}`
    const newLoop: ILoop = {
      id: newLoopId,
      name: name,
      htmlSource: fileName,
      deviceCount: rawNodes.length
    }
    const newNodes = processRawNodes(rawNodes, newLoopId, 'normal')
    
    loops.value.push(newLoop)
    nodes.value.push(...newNodes)
    edges.value.push(...processedEdges)
    
    structureVersion.value++
    ElMessage.success(`成功添加 ${name}`)
  }

  function deleteLoop(loopId: string) {
    nodes.value = nodes.value.filter(n => n.loopId !== loopId)
    const validNodeIds = new Set(nodes.value.map(n => n.id))
    edges.value = edges.value.filter(e => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId))
    loops.value = loops.value.filter(l => l.id !== loopId)
    if (selectedNodeId.value && !validNodeIds.has(selectedNodeId.value)) {
      selectedNodeId.value = null
    }
    structureVersion.value++ 
    ElMessage.success('Loop 已删除')
  }

  function replaceLoop(loop: ILoop, rawNodes: any[], rawEdges: any[], fileName: string) {
    nodes.value = nodes.value.filter(n => n.loopId !== loop.id)
    const newNodes = processRawNodes(rawNodes, loop.id, 'normal')
    nodes.value.push(...newNodes)
    const newEdges = processRawEdges(rawEdges, newNodes)
    edges.value.push(...newEdges)
    cleanInvalidEdges()
    const targetLoop = loops.value.find(l => l.id === loop.id)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = newNodes.length
    }
    structureVersion.value++
    ElMessage.success(`Loop 替换成功`)
  }

  function updateLoop(loop: ILoop, rawNodes: any[], rawEdges: any[], fileName: string) {
    const loopId = loop.id
    const existingNodes = nodes.value.filter(n => n.loopId === loopId)
    const otherNodes = nodes.value.filter(n => n.loopId !== loopId)
    
    const oldMap = new Map<string, INode>()
    existingNodes.forEach(n => oldMap.set(n.mac, n))

    const processedNewNodes: INode[] = []
    const newMacs = new Set<string>()

    rawNodes.forEach(raw => {
      const mac = extractMac(raw)
      newMacs.add(mac)
      const oldNode = oldMap.get(mac)
      if (oldNode) {
        oldNode.shortId = raw.rloc16 || ''
        oldNode.role = parseRole(raw.role)
        oldNode.diffStatus = 'normal' 
        processedNewNodes.push(oldNode)
      } else {
        const newNode = createNodeFromRaw(raw, loopId)
        newNode.diffStatus = 'new'
        newNode.isPlaced = false 
        newNode.position = null
        processedNewNodes.push(newNode)
      }
    })

    const missingNodes: INode[] = []
    existingNodes.forEach(old => {
      if (!newMacs.has(old.mac)) {
        old.diffStatus = 'missing'
        missingNodes.push(old)
      }
    })

    nodes.value = [...otherNodes, ...processedNewNodes, ...missingNodes]
    const loopNodeIds = new Set([...processedNewNodes.map(n => n.id), ...missingNodes.map(n => n.id)])
    edges.value = edges.value.filter(e => !loopNodeIds.has(e.sourceId) && !loopNodeIds.has(e.targetId))
    const newEdges = processRawEdges(rawEdges, processedNewNodes)
    edges.value.push(...newEdges)

    const targetLoop = loops.value.find(l => l.id === loopId)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = processedNewNodes.length + missingNodes.length
    }

    const newCount = processedNewNodes.filter(n => n.diffStatus === 'new').length
    const missingCount = missingNodes.length
    structureVersion.value++
    ElMessage.success(`Loop 更新完成`)
  }

  function purgeMissingNodes(loopId: string) {
    const initialCount = nodes.value.length
    nodes.value = nodes.value.filter(n => !(n.loopId === loopId && n.diffStatus === 'missing'))
    const deletedCount = initialCount - nodes.value.length
    const targetLoop = loops.value.find(l => l.id === loopId)
    if (targetLoop) {
      targetLoop.deviceCount = nodes.value.filter(n => n.loopId === loopId).length
    }
    structureVersion.value++
    ElMessage.success(`已清理 ${deletedCount} 个缺失设备`)
  }

  function confirmLoopChanges(loopId: string) {
    let count = 0
    nodes.value.forEach(n => {
      if (n.loopId === loopId && n.diffStatus === 'new') {
        n.diffStatus = 'normal'
        count++
      }
    })
    ElMessage.success(`已确认 ${count} 个新增设备`)
  }

  function deleteNode(nodeId: string) {
    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    cleanInvalidEdges()
    selectedNodeId.value = null
    structureVersion.value++ 
  }

  // --- Helpers ---
  function createNodeFromRaw(raw: any, loopId: string): INode {
    const mac = extractMac(raw)
    const defaultBld = buildings.value.length > 0 ? buildings.value[0].id : '1'
    const defaultFlr = buildings.value.length > 0 && buildings.value[0].floors.length > 0 ? buildings.value[0].floors[0].id : '1'
    return {
      id: mac, mac: mac, shortId: raw.rloc16 || '', role: parseRole(raw.role),
      type: raw.deviceType || DeviceType.DEFAULT, label: raw.label || mac.slice(-4),
      buildingId: defaultBld, floorId: defaultFlr, position: null, isPlaced: false, loopId: loopId, diffStatus: 'normal'
    }
  }
  function processRawNodes(rawNodes: any[], loopId: string, status: 'normal' | 'new') {
    return rawNodes.map(raw => {
      const node = createNodeFromRaw(raw, loopId)
      node.diffStatus = status
      return node
    })
  }
  function processRawEdges(rawEdges: any[], validNodes: INode[]) { 
    return rawEdges as IEdge[] 
  }
  function parseRole(roleStr: string): DeviceRole {
    const r = (roleStr || '').toLowerCase()
    if (r.includes('leader')) return DeviceRole.LEADER
    if (r.includes('router')) return DeviceRole.ROUTER
    return DeviceRole.REED 
  }
  function cleanInvalidEdges() {
    const validNodeIds = new Set(nodes.value.map(n => n.id))
    edges.value = edges.value.filter(e => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId))
  }

  function clearProject() {
    nodes.value = []; edges.value = []; buildings.value = []; loops.value = []; selectedNodeId.value = null; projectInfo.value.filePath = undefined;
    viewSettings.value = { iconScale: 100, labelColor: '#000000', mapOpacity: 1.0, showAllLinks: false }
    structureVersion.value++
  }
  
  function createProject(name: string, initBuildings: IBuilding[], initLoops: ILoop[], initNodes: INode[], initEdges: IEdge[]) {
    clearProject(); projectInfo.value.name = name; buildings.value = initBuildings; loops.value = initLoops; nodes.value = initNodes; edges.value = initEdges; isProjectLoaded.value = true;
    structureVersion.value++
  }
  
  function updateBuildings(newBuildings: IBuilding[]) {
    const validFloorIds = new Set<string>(); newBuildings.forEach(b => b.floors.forEach(f => validFloorIds.add(f.id)));
    let recoveredCount = 0;
    nodes.value.forEach(node => {
      if (node.isPlaced && !validFloorIds.has(node.floorId)) { node.isPlaced = false; node.position = null; recoveredCount++; }
    });
    buildings.value = newBuildings;
    if (recoveredCount > 0) ElMessage.warning(`${recoveredCount} 个设备因楼层删除已自动回收到列表`);
    else ElMessage.success('建筑配置已更新');
  }
  
  function toggleBuildingEditor(show: boolean) { isBuildingEditorVisible.value = show; }
  function closeProject() { isProjectLoaded.value = false; clearProject(); }
  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name;
    nodes.value = projectData.nodes.map(n => ({...n, isPlaced: n.isPlaced !== undefined ? n.isPlaced : true}));
    edges.value = projectData.edges; buildings.value = projectData.buildings; loops.value = projectData.loops || []; 
    if (projectData.viewSettings) viewSettings.value = projectData.viewSettings;
    isProjectLoaded.value = true;
    structureVersion.value++
  }
  function batchPlaceNodes(nodeIds: string[], startX: number, startY: number, floorId: string, buildingId: string) {
    const COLS = 5; const SPACING = 30;
    nodeIds.forEach((id, index) => {
      const node = nodes.value.find(n => n.id === id);
      if (node) {
        const offsetX = (index % COLS) * SPACING; const offsetY = Math.floor(index / COLS) * SPACING;
        node.isPlaced = true; node.floorId = floorId; node.buildingId = buildingId;
        node.position = { x: startX + offsetX, y: startY + offsetY, z: 0 };
      }
    });
    if(nodeIds.length > 0) selectNode(nodeIds[nodeIds.length - 1]);
  }
  function unplaceNode(nodeId: string) {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) { node.isPlaced = false; node.position = null; }
  }
  async function saveToDisk() {
    const data: IProject = { version: '1.0.0', name: projectInfo.value.name, created: Date.now(), updated: Date.now(), nodes: nodes.value, edges: edges.value, buildings: buildings.value, loops: loops.value, viewSettings: viewSettings.value, settings: { theme: isDark.value ? 'dark' : 'light', coordSystem: 'cartesian' } };
    const jsonString = JSON.stringify(data, null, 2);
    // @ts-ignore
    const result = await window.api.saveProject(jsonString);
    if (result && result.success) { projectInfo.value.filePath = result.filePath; ElMessage.success('保存成功'); }
  }
  async function loadFromDisk() {
    // @ts-ignore
    const result = await window.api.openProject();
    if (result && result.content) {
      try {
        const data = JSON.parse(result.content) as IProject; loadProject(data); projectInfo.value.filePath = result.filePath; ElMessage.success(`成功加载: ${data.name}`); return true;
      } catch (e: any) { Log.error('文件解析失败', e); ElMessage.error('文件损坏或格式错误'); return false; }
    } return false;
  }
  function upsertNode(node: INode) { const index = nodes.value.findIndex(n => n.id === node.id); if (index > -1) nodes.value[index] = node; else nodes.value.push(node); }
  function selectNode(id: string | null) { selectedNodeId.value = id; }
  function toggleTheme() { isDark.value = !isDark.value; const html = document.documentElement; if (isDark.value) html.classList.add('dark'); else html.classList.remove('dark'); }

  return {
    isProjectLoaded, isBuildingEditorVisible, projectInfo, nodes, edges, buildings, loops, selectedNodeId, selectedNode, isDark, deviceCounts,
    viewSettings, updateViewSettings, structureVersion,
    currentViewMode, // [导出]
    focusRequest, 
    getBuildingName, getFloorName, getDisplayId, 
    createProject, updateBuildings, toggleBuildingEditor, closeProject, loadProject, saveToDisk, loadFromDisk,
    upsertNode, clearProject, selectNode, toggleTheme, batchPlaceNodes, unplaceNode,
    deleteLoop, replaceLoop, updateLoop, purgeMissingNodes, confirmLoopChanges, deleteNode,
    triggerFocus, addLoop,
    switchViewMode // [导出]
  }
})