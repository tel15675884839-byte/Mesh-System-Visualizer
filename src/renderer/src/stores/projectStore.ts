import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IProject, INode, IEdge, IBuilding, ILoop } from '../types'
import { Log } from '../utils/logger'
import { ElMessage } from 'element-plus'
import { extractMac } from '../utils/htmlParser'
import { DeviceRole, DeviceType } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const isProjectLoaded = ref(false)
  const isBuildingEditorVisible = ref(false)

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

  // --- Actions ---

  // 删除 LOOP
  function deleteLoop(loopId: string) {
    // 1. 删除节点
    nodes.value = nodes.value.filter(n => n.loopId !== loopId)
    // 2. 删除连线 (清理两端都不存在的连线)
    const validNodeIds = new Set(nodes.value.map(n => n.id))
    edges.value = edges.value.filter(e => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId))
    // 3. 删除 Loop 本身
    loops.value = loops.value.filter(l => l.id !== loopId)
    
    if (selectedNodeId.value && !validNodeIds.has(selectedNodeId.value)) {
      selectedNodeId.value = null
    }
    ElMessage.success('Loop 已删除')
  }

  // 替换 LOOP
  function replaceLoop(loop: ILoop, rawNodes: any[], rawEdges: any[], fileName: string) {
    // 1. 清理旧数据
    nodes.value = nodes.value.filter(n => n.loopId !== loop.id)
    
    // 2. 生成新节点
    const newNodes = processRawNodes(rawNodes, loop.id, 'normal')
    nodes.value.push(...newNodes)

    // 3. 替换连线
    // 先移除两端都在本 Loop 范围内的旧连线(虽然上面删了节点，这里做个清理更保险)
    const newEdges = processRawEdges(rawEdges, newNodes)
    edges.value.push(...newEdges)
    cleanInvalidEdges()

    // 4. 更新 Loop 信息
    const targetLoop = loops.value.find(l => l.id === loop.id)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = newNodes.length
    }

    ElMessage.success(`Loop 替换成功，导入 ${newNodes.length} 个设备`)
  }

  // [关键] 更新 LOOP (Diff 算法)
  function updateLoop(loop: ILoop, rawNodes: any[], rawEdges: any[], fileName: string) {
    const loopId = loop.id
    const existingNodes = nodes.value.filter(n => n.loopId === loopId)
    const otherNodes = nodes.value.filter(n => n.loopId !== loopId)
    
    // 1. 建立旧数据索引 Map<MAC, Node>
    const oldMap = new Map<string, INode>()
    existingNodes.forEach(n => oldMap.set(n.mac, n))

    // 2. 处理新数据
    const processedNewNodes: INode[] = []
    const newMacs = new Set<string>()

    rawNodes.forEach(raw => {
      const mac = extractMac(raw)
      newMacs.add(mac)
      
      const oldNode = oldMap.get(mac)
      
      if (oldNode) {
        // [保留] 更新网络属性，保留用户配置
        oldNode.shortId = raw.rloc16 || ''
        oldNode.role = parseRole(raw.role)
        oldNode.diffStatus = 'normal' 
        processedNewNodes.push(oldNode)
      } else {
        // [新增] New Node
        const newNode = createNodeFromRaw(raw, loopId)
        newNode.diffStatus = 'new'
        newNode.isPlaced = false 
        newNode.position = null
        processedNewNodes.push(newNode)
      }
    })

    // 3. 找出缺失设备 (Missing)
    const missingNodes: INode[] = []
    existingNodes.forEach(old => {
      if (!newMacs.has(old.mac)) {
        old.diffStatus = 'missing'
        missingNodes.push(old)
      }
    })

    // 4. 更新 Store
    nodes.value = [...otherNodes, ...processedNewNodes, ...missingNodes]

    // 5. 更新连线
    // 移除旧连线 (两端都在本 Loop 内的)
    const loopNodeIds = new Set([...processedNewNodes.map(n => n.id), ...missingNodes.map(n => n.id)])
    edges.value = edges.value.filter(e => !loopNodeIds.has(e.sourceId) && !loopNodeIds.has(e.targetId))
    
    // 加入新连线
    const newEdges = processRawEdges(rawEdges, processedNewNodes)
    edges.value.push(...newEdges)

    // 6. 更新 Loop 信息
    const targetLoop = loops.value.find(l => l.id === loopId)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = processedNewNodes.length + missingNodes.length
    }

    const newCount = processedNewNodes.filter(n => n.diffStatus === 'new').length
    const missingCount = missingNodes.length
    ElMessage.success(`Loop 更新完成：新增 ${newCount}，缺失 ${missingCount}`)
  }

  // 清理缺失设备
  function purgeMissingNodes(loopId: string) {
    const initialCount = nodes.value.length
    nodes.value = nodes.value.filter(n => !(n.loopId === loopId && n.diffStatus === 'missing'))
    const deletedCount = initialCount - nodes.value.length
    
    // 更新 Loop 计数
    const targetLoop = loops.value.find(l => l.id === loopId)
    if (targetLoop) {
      targetLoop.deviceCount = nodes.value.filter(n => n.loopId === loopId).length
    }
    
    ElMessage.success(`已清理 ${deletedCount} 个缺失设备`)
  }

  // 确认变更
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

  // 删除单个设备
  function deleteNode(nodeId: string) {
    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    cleanInvalidEdges()
    selectedNodeId.value = null
  }

  // --- 辅助逻辑 ---
  
  function createNodeFromRaw(raw: any, loopId: string): INode {
    const mac = extractMac(raw)
    const defaultBld = buildings.value.length > 0 ? buildings.value[0].id : '1'
    const defaultFlr = buildings.value.length > 0 && buildings.value[0].floors.length > 0 ? buildings.value[0].floors[0].id : '1'
    
    return {
      id: mac,
      mac: mac,
      shortId: raw.rloc16 || '',
      role: parseRole(raw.role),
      type: raw.deviceType || DeviceType.DEFAULT,
      label: raw.label || mac.slice(-4),
      buildingId: defaultBld,
      floorId: defaultFlr,
      position: null,
      isPlaced: false,
      loopId: loopId,
      diffStatus: 'normal'
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
    // 这里的 validNodes 已经是转换后的 INode (id=mac)
    // rawEdges 里的 from/to 是原始 HTML 里的 id (可能是数字或者mac)
    // 我们需要通过 rawNodes 的 source (如果能访问到) 或者通过 id 匹配来建立连接
    // 由于 processRawNodes 没有保留原始 ID，我们这里做一个简单的回退：
    // 假设 HTML 里的连线用的是 mac 或者 label 里的 mac。
    // 如果 HTML 里用的是数字 ID，而我们转成了 MAC，连线会断。
    // **修正方案**：为了保证连线不断，我们需要在导入时建立 ID 映射。
    // 但鉴于这里没有 rawNodes 的原始信息，我们假设 extractMac 能处理 rawEdges 里的 ID。
    // 如果 rawEdges 的 from/to 是数字，extractMac 会返回数字字符串，这与 validNodes 的 id (mac) 不匹配。
    
    // 为了简单起见，我们假设 rawEdges 里的连线关系已经在 LoopManager 中通过 convertEdges 处理过了？
    // 不，Store 接收的是 rawEdges。
    // 让我们稍微修改一下逻辑：我们不再在 Store 里重新 processRawEdges，而是要求调用者传入已经处理好的 IEdge[]。
    // 这里的参数签名是 rawEdges: any[]，我们直接当做 IEdge[] 用 (假设调用者已经转好了)。
    // 实际上 LoopManager.vue 里调用时确实用了 convertEdges。
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
  }
  function createProject(name: string, initBuildings: IBuilding[], initLoops: ILoop[], initNodes: INode[], initEdges: IEdge[]) {
    clearProject(); projectInfo.value.name = name; buildings.value = initBuildings; loops.value = initLoops; nodes.value = initNodes; edges.value = initEdges; isProjectLoaded.value = true;
  }
  
  // [关键] 更新建筑配置
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
    edges.value = projectData.edges; buildings.value = projectData.buildings; loops.value = projectData.loops || []; isProjectLoaded.value = true;
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
    const data: IProject = { version: '1.0.0', name: projectInfo.value.name, created: Date.now(), updated: Date.now(), nodes: nodes.value, edges: edges.value, buildings: buildings.value, loops: loops.value, settings: { theme: isDark.value ? 'dark' : 'light', coordSystem: 'cartesian' } };
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
    getBuildingName, getFloorName, createProject, updateBuildings, toggleBuildingEditor, closeProject, loadProject, saveToDisk, loadFromDisk,
    upsertNode, clearProject, selectNode, toggleTheme, batchPlaceNodes, unplaceNode,
    // [关键] 必须在这里导出所有新方法
    deleteLoop, replaceLoop, updateLoop, purgeMissingNodes, confirmLoopChanges, deleteNode
  }
})