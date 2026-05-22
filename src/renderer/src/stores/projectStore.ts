import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  IProject,
  INode,
  IEdge,
  IBuilding,
  ILoop,
  IViewSettings,
  ICamera2D,
  ICamera3D
} from '../types'
import { Log } from '../utils/logger'
import { ElMessage } from 'element-plus'
import { extractMac, extractRssi } from '../utils/htmlParser'
import { DeviceRole, DeviceType } from '../types'

export const useProjectStore = defineStore('project', () => {
  // --- State ---
  const isProjectLoaded = ref(false)
  const isBuildingEditorVisible = ref(false)
  const pendingEdgesBackup = ref<Map<string, IEdge[]>>(new Map()) // [新增]

  const projectInfo = ref<{ name: string; version: string; filePath?: string }>({
    name: 'Untitled Project',
    version: '1.0.0'
  })

  // [修改] viewSettings 初始值
  const viewSettings = ref<IViewSettings>({
    iconScale: 100,
    labelColor: '#000000',
    mapOpacity: 1.0,
    showAllLinks: false,
    rightPanelWidth: 300,
    isPropertyPanelOpen: true, // [新增]

    // [新增] 3D 持久化默认值
    floorHeight3D: 5,
    iconScale3D: 100,

    // 初始化为空
    lastBuildingId: undefined,
    lastFloorId: undefined,
    camera2D: undefined,
    camera3D: undefined
  })

  const focusRequest = ref<{ nodeId: string; timestamp: number } | null>(null)
  const treeFocusRequest = ref<{ nodeId: string; timestamp: number } | null>(null)

  // [新增] 高亮路径 (Edge IDs)
  const highlightedPath = ref<Set<string>>(new Set())

  const nodes = ref<INode[]>([])
  const edges = ref<IEdge[]>([])
  const buildings = ref<IBuilding[]>([])
  const loops = ref<ILoop[]>([])

  const selectedNodeId = ref<string | null>(null)
  const isDark = ref(false)
  const currentViewMode = ref<'2D' | '3D'>('2D')

  // --- Getters ---
  const selectedNode = computed(() => {
    return nodes.value.find((n) => n.id === selectedNodeId.value) || null
  })

  // [新增] 辅助映射：构建邻接表
  const adjacencyList = computed(() => {
    const adj = new Map<string, Array<{ neighborId: string; edgeId: string }>>()
    edges.value.forEach((e) => {
      // 无向图处理
      if (!adj.has(e.sourceId)) adj.set(e.sourceId, [])
      if (!adj.has(e.targetId)) adj.set(e.targetId, [])

      adj.get(e.sourceId)!.push({ neighborId: e.targetId, edgeId: e.id })
      adj.get(e.targetId)!.push({ neighborId: e.sourceId, edgeId: e.id })
    })
    return adj
  })

  const deviceCounts = computed(() => {
    return {
      total: nodes.value.length,
      routers: nodes.value.filter((n) => n.role === 'Router').length,
      leaders: nodes.value.filter((n) => n.role === 'Leader').length
    }
  })

  const getBuildingName = (bldId: string) => {
    const bld = buildings.value.find((b) => b.id === bldId)
    return bld ? bld.name : bldId
  }

  const getFloorName = (bldId: string, floorId: string) => {
    const bld = buildings.value.find((b) => b.id === bldId)
    if (!bld) return floorId
    const floor = bld.floors.find((f) => f.id === floorId)
    return floor ? floor.name : floorId
  }

  const getDisplayId = (nodeId: string) => {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node) return 'Unknown'
    if (node.shortId && node.shortId !== '0xfffe' && node.shortId !== '')
      return node.shortId.replace('0x', '')
    return node.mac.slice(-4)
  }

  // --- Actions ---

  function triggerFocus(nodeId: string) {
    focusRequest.value = { nodeId, timestamp: Date.now() }
  }

  function triggerTreeFocus(nodeId: string) {
    treeFocusRequest.value = { nodeId, timestamp: Date.now() }
  }

  function updateViewSettings(settings: Partial<IViewSettings>) {
    Object.assign(viewSettings.value, settings)
  }

  // [新增] 保存视图状态 (楼层 + 相机)
  // 传入 undefined 的字段将保持原样，不覆盖
  function saveViewState(
    buildingId?: string,
    floorId?: string,
    cam2D?: ICamera2D,
    cam3D?: ICamera3D
  ) {
    if (buildingId) viewSettings.value.lastBuildingId = buildingId
    if (floorId) viewSettings.value.lastFloorId = floorId
    if (cam2D) viewSettings.value.camera2D = cam2D
    if (cam3D) viewSettings.value.camera3D = cam3D
  }

  function switchViewMode(mode: '2D' | '3D') {
    currentViewMode.value = mode
    viewSettings.value.lastViewMode = mode
  }

  // [新增] 专门的应用主题函数，确保逻辑复用
  function applyTheme() {
    const html = document.documentElement
    if (isDark.value) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    viewSettings.value.lastTheme = isDark.value ? 'dark' : 'light'
    applyTheme()
  }

  function addLoop(name: string, rawNodes: unknown[], processedEdges: IEdge[], fileName: string) {
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
    nodes.value = nodes.value.filter((n) => n.loopId !== loopId)
    const validNodeIds = new Set(nodes.value.map((n) => n.id))
    edges.value = edges.value.filter(
      (e) => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId)
    )
    loops.value = loops.value.filter((l) => l.id !== loopId)
    if (selectedNodeId.value && !validNodeIds.has(selectedNodeId.value)) selectedNodeId.value = null
    structureVersion.value++
    ElMessage.success('Loop 已删除')
  }

  function replaceLoop(loop: ILoop, rawNodes: unknown[], rawEdges: unknown[], fileName: string) {
    nodes.value = nodes.value.filter((n) => n.loopId !== loop.id)
    const newNodes = processRawNodes(rawNodes, loop.id, 'normal')
    nodes.value.push(...newNodes)
    const newEdges = processRawEdges(rawEdges, newNodes)
    edges.value.push(...newEdges)
    cleanInvalidEdges()
    const targetLoop = loops.value.find((l) => l.id === loop.id)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = newNodes.length
    }
    structureVersion.value++
    ElMessage.success(`Loop 替换成功`)
  }

  function updateLoop(loop: ILoop, rawNodes: unknown[], rawEdges: unknown[], fileName: string) {
    const loopId = loop.id
    const existingNodes = nodes.value.filter((n) => n.loopId === loopId)
    const otherNodes = nodes.value.filter((n) => n.loopId !== loopId)
    const oldMap = new Map<string, INode>()
    existingNodes.forEach((n) => oldMap.set(n.mac, n))
    const processedNewNodes: INode[] = []
    const newMacs = new Set<string>()
    rawNodes.forEach((raw: any) => {
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
    existingNodes.forEach((old) => {
      if (!newMacs.has(old.mac)) {
        old.diffStatus = 'missing'
        missingNodes.push(old)
      }
    })
    nodes.value = [...otherNodes, ...processedNewNodes, ...missingNodes]
    const loopNodeIds = new Set([
      ...processedNewNodes.map((n) => n.id),
      ...missingNodes.map((n) => n.id)
    ])
    edges.value = edges.value.filter(
      (e) => !loopNodeIds.has(e.sourceId) && !loopNodeIds.has(e.targetId)
    )
    const newEdges = processRawEdges(rawEdges, processedNewNodes)
    edges.value.push(...newEdges)
    const targetLoop = loops.value.find((l) => l.id === loopId)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      targetLoop.deviceCount = processedNewNodes.length + missingNodes.length
    }
    const newCount = processedNewNodes.filter((n) => n.diffStatus === 'new').length
    const missingCount = missingNodes.length
    structureVersion.value++
    ElMessage.success(`Loop 更新完成：新增 ${newCount}，缺失 ${missingCount}`)
  }

  function purgeMissingNodes(loopId: string) {
    const initialCount = nodes.value.length
    nodes.value = nodes.value.filter((n) => !(n.loopId === loopId && n.diffStatus === 'missing'))
    const deletedCount = initialCount - nodes.value.length
    const targetLoop = loops.value.find((l) => l.id === loopId)
    if (targetLoop) targetLoop.deviceCount = nodes.value.filter((n) => n.loopId === loopId).length
    structureVersion.value++
    ElMessage.success(`已清理 ${deletedCount} 个缺失设备`)
  }

  function confirmLoopChanges(loopId: string) {
    let count = 0
    // 1. 删除 Missing 节点
    const nodesToDelete = nodes.value.filter(
      (n) => n.loopId === loopId && n.diffStatus === 'missing'
    )
    const idsToDelete = new Set(nodesToDelete.map((n) => n.id))

    nodes.value = nodes.value.filter((n) => !idsToDelete.has(n.id))

    // 同时清理相关连线
    edges.value = edges.value.filter(
      (e) => !idsToDelete.has(e.sourceId) && !idsToDelete.has(e.targetId)
    )

    // 2. 重置 New / Unchanged / Normal 状态
    nodes.value.forEach((n) => {
      if (n.loopId === loopId) {
        if (n.diffStatus === 'new') count++
        n.diffStatus = undefined
      }
    })

    // 更新 Loop 设备数量
    const targetLoop = loops.value.find((l) => l.id === loopId)
    if (targetLoop) {
      targetLoop.deviceCount = nodes.value.filter((n) => n.loopId === loopId).length
    }

    structureVersion.value++
    ElMessage.success(`已确认变更，新增 ${count} 个设备`)
  }

  // [新增] 检查 Loop 是否有待确认的变更
  const hasPendingChanges = (loopId: string) => {
    return nodes.value.some(
      (n) => n.loopId === loopId && n.diffStatus !== undefined && n.diffStatus !== 'normal'
    )
  }

  // [新增] 应用拓扑更新 (计算 Diff)
  function updateLoopTopology(
    loopId: string,
    importNodes: any[],
    importEdges: any[],
    fileName: string
  ) {
    // 1. 获取当前 Loop 的所有节点
    const currentLoopNodes = nodes.value.filter((n) => n.loopId === loopId)
    const currentMacs = new Set(currentLoopNodes.map((n) => n.mac))
    const importMacs = new Set(importNodes.map((n: any) => extractMac(n)))

    // 2. 标记 "Missing" (在当前 Loop 中，但不在导入文件中)
    currentLoopNodes.forEach((node) => {
      if (!importMacs.has(node.mac)) {
        node.diffStatus = 'missing'
      } else {
        node.diffStatus = 'unchanged'
      }
    })

    // 3. 标记 "New" (在导入文件中，但不在当前 Loop 中)
    const newNodesToAdd: INode[] = []

    // 辅助：获取默认位置 (跟随 Leader 或第一个节点)
    const refNode = currentLoopNodes[0]
    const defaultBld = refNode?.buildingId || buildings.value[0]?.id || '1'
    const defaultFlr = refNode?.floorId || buildings.value[0]?.floors[0]?.id || '1'

    importNodes.forEach((raw: any) => {
      const mac = extractMac(raw)

      // 如果是现有节点，更新一些属性 (如 ShortID, Role)
      if (currentMacs.has(mac)) {
        const existingNode = currentLoopNodes.find((n) => n.mac === mac)
        if (existingNode) {
          existingNode.shortId = raw.rloc16 || existingNode.shortId
          existingNode.role = parseRole(raw.role)
          // existingNode.diffStatus = 'unchanged' // 已经在上面处理了
        }
      } else {
        // 创建新节点
        const roleStr = (raw.role || '').toLowerCase()
        let role = DeviceRole.UNKNOWN
        if (roleStr.includes('leader')) role = DeviceRole.LEADER
        else if (roleStr.includes('router')) role = DeviceRole.ROUTER

        newNodesToAdd.push({
          id: mac, // 使用 MAC 作为 ID
          mac: mac,
          shortId: raw.rloc16 || '',
          role: role,
          type: raw.deviceType || DeviceType.DEFAULT,
          label: raw.label || mac.slice(-4),
          buildingId: defaultBld,
          floorId: defaultFlr,
          position: null, // 未放置
          isPlaced: false,
          loopId: loopId,
          diffStatus: 'new'
        })
      }
    })

    // 4. 将新节点加入 Store
    nodes.value.push(...newNodesToAdd)

    // 5. 更新连线 (全量替换该 Loop 的连线)
    // 策略：删除所有 source 或 target 属于该 Loop 的连线 (除了连接到 Missing 节点的？)
    // 需求：Missing 节点虽然在图上，但连线可能已经断了或变了。为了由新拓扑决定，我们优先使用新拓扑的连线。
    // 但是 Missing 节点如果在新拓扑里不存在，自然没有连线连向它。所以它会变成孤立点，符合预期。

    const nodeIdsInLoop = new Set(nodes.value.filter((n) => n.loopId === loopId).map((n) => n.id))

    // 备份旧连线，用于 Discard
    const oldEdges = edges.value.filter(
      (e) => nodeIdsInLoop.has(e.sourceId) || nodeIdsInLoop.has(e.targetId)
    )
    pendingEdgesBackup.value.set(loopId, [...oldEdges])

    // 移除旧连线
    edges.value = edges.value.filter((e) => {
      const sIn = nodeIdsInLoop.has(e.sourceId)
      const tIn = nodeIdsInLoop.has(e.targetId)
      return !(sIn || tIn) // 只要有一端涉及本 Loop，就移除 (假设 Mesh 连线不跨 Loop，或者跨 Loop 连线也由新拓扑提供)
    })

    // 添加新连线
    const finalEdges: IEdge[] = []
    importEdges.forEach((raw: any) => {
      const fromNodeRaw = importNodes.find((n: any) => n.id == raw.from)
      const toNodeRaw = importNodes.find((n: any) => n.id == raw.to)

      if (fromNodeRaw && toNodeRaw) {
        const sMac = extractMac(fromNodeRaw)
        const tMac = extractMac(toNodeRaw)
        finalEdges.push({
          id: `edge-${raw.id || Math.random()}`,
          sourceId: sMac,
          targetId: tMac,
          lqi: raw.lqi,
          rssi: extractRssi(raw),
          isParentChild: false
        })
      }
    })
    edges.value.push(...finalEdges)

    // 更新 Loop 元数据
    const targetLoop = loops.value.find((l) => l.id === loopId)
    if (targetLoop) {
      targetLoop.htmlSource = fileName
      // 暂时显示的 count 是 current + new (missing 也在 current 里)
      targetLoop.deviceCount = nodes.value.filter((n) => n.loopId === loopId).length
    }

    structureVersion.value++
    ElMessage.success(
      `发现更新：新增 ${newNodesToAdd.length}，缺失 ${currentLoopNodes.filter((n) => n.diffStatus === 'missing').length}`
    )
  }

  // [新增] 提交拓扑变更 (兼容旧名称)
  function commitTopologyChanges(loopId: string) {
    confirmLoopChanges(loopId)
    pendingEdgesBackup.value.delete(loopId) // 清理备份
  }

  // [新增] 丢弃拓扑变更
  function discardTopologyChanges(loopId: string) {
    // 1. 移除 'new' 类型的节点
    nodes.value = nodes.value.filter((n) => !(n.loopId === loopId && n.diffStatus === 'new'))

    // 2. 恢复 'missing' 和 'unchanged' 节点的状态
    nodes.value.forEach((n) => {
      if (n.loopId === loopId) {
        n.diffStatus = undefined
      }
    })

    // 3. 恢复连线
    const nodeIdsInLoop = new Set(nodes.value.filter((n) => n.loopId === loopId).map((n) => n.id))
    // 移除当前的 (预览产生的) 连线
    edges.value = edges.value.filter(
      (e) => !nodeIdsInLoop.has(e.sourceId) && !nodeIdsInLoop.has(e.targetId)
    )
    // 恢复备份的连线
    const backup = pendingEdgesBackup.value.get(loopId)
    if (backup) {
      edges.value.push(...backup)
      pendingEdgesBackup.value.delete(loopId)
    }

    structureVersion.value++
    ElMessage.info('已丢弃变更并恢复旧拓扑')
  }

  function deleteNode(nodeId: string) {
    nodes.value = nodes.value.filter((n) => n.id !== nodeId)
    cleanInvalidEdges()
    selectedNodeId.value = null
    structureVersion.value++
  }

  function createNodeFromRaw(raw: any, loopId: string): INode {
    const mac = extractMac(raw)
    const defaultBld = buildings.value.length > 0 ? buildings.value[0].id : '1'
    const defaultFlr =
      buildings.value.length > 0 && buildings.value[0].floors.length > 0
        ? buildings.value[0].floors[0].id
        : '1'
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
  function processRawNodes(rawNodes: unknown[], loopId: string, status: 'normal' | 'new') {
    return rawNodes.map((raw) => {
      const node = createNodeFromRaw(raw as any, loopId)
      node.diffStatus = status
      return node
    })
  }
  function processRawEdges(rawEdges: unknown[], _validNodes: INode[]) {
    return rawEdges as IEdge[]
  }
  function parseRole(roleStr: string): DeviceRole {
    const r = (roleStr || '').toLowerCase()
    if (r.includes('leader')) return DeviceRole.LEADER
    if (r.includes('router')) return DeviceRole.ROUTER
    return DeviceRole.REED
  }
  function cleanInvalidEdges() {
    const validNodeIds = new Set(nodes.value.map((n) => n.id))
    edges.value = edges.value.filter(
      (e) => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId)
    )
  }

  function clearProject() {
    nodes.value = []
    edges.value = []
    buildings.value = []
    loops.value = []
    selectedNodeId.value = null
    projectInfo.value.filePath = undefined
    // 重置时保留默认值
    viewSettings.value = {
      iconScale: 100,
      labelColor: '#000000',
      mapOpacity: 1.0,
      showAllLinks: false,
      rightPanelWidth: 300,
      isPropertyPanelOpen: true,
      floorHeight3D: 30,
      iconScale3D: 100,
      lastBuildingId: undefined,
      lastFloorId: undefined,
      camera2D: undefined,
      camera3D: undefined
    }
    structureVersion.value++
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
    structureVersion.value++
  }

  // 结构版本号
  const structureVersion = ref(0)

  function updateBuildings(newBuildings: IBuilding[]) {
    const validFloorIds = new Set<string>()
    newBuildings.forEach((b) => b.floors.forEach((f) => validFloorIds.add(f.id)))
    let recoveredCount = 0
    nodes.value.forEach((node) => {
      if (node.isPlaced && !validFloorIds.has(node.floorId)) {
        node.isPlaced = false
        node.position = null
        recoveredCount++
      }
    })

    // [新增] 确保新建筑有默认位置
    newBuildings.forEach((b, index) => {
      if (!b.position) {
        // 默认按 X 轴排列，间距 80米 (映射到 3D 可能是 8000)
        // 这里的单位假设是 米，3D 中可能乘 100
        const defaultSpacing = 80
        b.position = { x: index * defaultSpacing, y: 0 }
      }
      if (!b.size) {
        b.size = { width: 60, depth: 40 } // 默认 60x40 米
      }
    })

    buildings.value = newBuildings
    if (recoveredCount > 0) ElMessage.warning(`${recoveredCount} 个设备因楼层删除已自动回收到列表`)
    else ElMessage.success('建筑配置已更新')
  }

  // [新增] 布局编辑器开关
  const isLayoutEditorVisible = ref(false)
  function toggleLayoutEditor(show: boolean) {
    isLayoutEditorVisible.value = show
  }

  function updateFloorScale3D(buildingId: string, floorId: string, scale: number) {
    const bld = buildings.value.find((b) => b.id === buildingId)
    if (!bld) return
    const floor = bld.floors.find((f) => f.id === floorId)
    if (floor) {
      floor.floorScale3D = scale
    }
  }

  function updateFloorHeight3D(buildingId: string, floorId: string, height: number) {
    const bld = buildings.value.find((b) => b.id === buildingId)
    if (!bld) return
    const floor = bld.floors.find((f) => f.id === floorId)
    if (floor) {
      floor.floorHeight3D = height
    }
  }

  function toggleBuildingEditor(show: boolean) {
    isBuildingEditorVisible.value = show
  }
  function closeProject() {
    isProjectLoaded.value = false
    clearProject()
  }
  function loadProject(projectData: IProject) {
    projectInfo.value.name = projectData.name
    nodes.value = projectData.nodes.map((n) => ({
      ...n,
      isPlaced: n.isPlaced !== undefined ? n.isPlaced : true
    }))
    edges.value = projectData.edges
    buildings.value = projectData.buildings
    loops.value = projectData.loops || []
    // [关键] 加载时合并视图设置 (兼容旧文件)
    if (projectData.viewSettings) {
      viewSettings.value = {
        ...viewSettings.value,
        ...projectData.viewSettings
      }
      // 兼容处理：如果旧文件没有 3D 设置，给默认值
      if (viewSettings.value.floorHeight3D === undefined) viewSettings.value.floorHeight3D = 30
      if (viewSettings.value.iconScale3D === undefined) viewSettings.value.iconScale3D = 100

      // [新增] 恢复视图模式
      if (viewSettings.value.lastViewMode) {
        currentViewMode.value = viewSettings.value.lastViewMode
      }
      // [新增] 恢复主题
      if (viewSettings.value.lastTheme) {
        isDark.value = viewSettings.value.lastTheme === 'dark'
        applyTheme()
      }
    }

    // 兼容处理：如果 settings 备有 theme 但 lastTheme 没有
    if (
      projectData.settings?.theme &&
      (!projectData.viewSettings || !projectData.viewSettings.lastTheme)
    ) {
      isDark.value = projectData.settings.theme === 'dark'
      applyTheme()
    }

    isProjectLoaded.value = true
    structureVersion.value++
  }
  function batchPlaceNodes(
    nodeIds: string[],
    startX: number,
    startY: number,
    floorId: string,
    buildingId: string
  ) {
    const COLS = 5
    const SPACING = 30
    nodeIds.forEach((id, index) => {
      const node = nodes.value.find((n) => n.id === id)
      if (node) {
        const offsetX = (index % COLS) * SPACING
        const offsetY = Math.floor(index / COLS) * SPACING
        node.isPlaced = true
        node.floorId = floorId
        node.buildingId = buildingId
        node.position = { x: startX + offsetX, y: startY + offsetY, z: 0 }
      }
    })
    if (nodeIds.length > 0) selectNode(nodeIds[nodeIds.length - 1])
  }
  function unplaceNode(nodeId: string) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (node) {
      node.isPlaced = false
      node.position = null
    }
  }
  async function saveToDisk(forceDialog = false) {
    const data: IProject = {
      version: '1.0.0',
      name: projectInfo.value.name,
      created: Date.now(),
      updated: Date.now(),
      nodes: nodes.value,
      edges: edges.value,
      buildings: buildings.value,
      loops: loops.value,
      viewSettings: viewSettings.value,
      settings: { theme: isDark.value ? 'dark' : 'light', coordSystem: 'cartesian' }
    }
    const jsonString = JSON.stringify(data, null, 2)
    // 如果已经有文件路径且不是强制对话框，则静默保存
    const targetPath = forceDialog ? undefined : projectInfo.value.filePath

    console.log('[ProjectStore] Saving to disk...', {
      forceDialog,
      filePath: projectInfo.value.filePath,
      targetPath
    })

    // @ts-ignore
    const result = await window.api.saveProject(jsonString, targetPath)
    if (result && result.success) {
      projectInfo.value.filePath = result.filePath
      ElMessage.success('保存成功')
    }
  }
  async function loadFromDisk() {
    // @ts-ignore
    const result = await window.api.openProject()
    if (result && result.content) {
      try {
        const data = JSON.parse(result.content) as IProject
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
    const index = nodes.value.findIndex((n) => n.id === node.id)
    if (index > -1) nodes.value[index] = node
    else nodes.value.push(node)
  }
  function selectNode(id: string | null) {
    selectedNodeId.value = id
    updateHighlightedPath(id)
  }

  // [新增] 计算到 Leader 的路径
  function updateHighlightedPath(startNodeId: string | null) {
    highlightedPath.value.clear()
    if (!startNodeId) return

    const startNode = nodes.value.find((n) => n.id === startNodeId)
    if (!startNode) return

    // 如果选中的就是 Leader，不需要路径
    if (startNode.role === DeviceRole.LEADER) return

    const loopId = startNode.loopId
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startNodeId, path: [] }]
    const visited = new Set<string>([startNodeId])

    let foundPath: string[] = []

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!
      const node = nodes.value.find((n) => n.id === nodeId)

      // 找到 Leader (且属于同一 Loop)
      if (node && node.role === DeviceRole.LEADER && node.loopId === loopId) {
        foundPath = path
        break
      }

      const neighbors = adjacencyList.value.get(nodeId) || []
      for (const { neighborId, edgeId } of neighbors) {
        if (!visited.has(neighborId)) {
          // 限制搜索范围在同一个 Loop 内 (可选，但通常 Mesh 不跨 Loop)
          // const neighborNode = nodes.value.find((n) => n.id === neighborId)
          // if (neighborNode && neighborNode.loopId === loopId) {
          visited.add(neighborId)
          queue.push({ nodeId: neighborId, path: [...path, edgeId] })
          // }
        }
      }
    }

    if (foundPath.length > 0) {
      foundPath.forEach((edgeId) => highlightedPath.value.add(edgeId))
    }
  }

  return {
    isProjectLoaded,
    isBuildingEditorVisible,
    projectInfo,
    nodes,
    edges,
    buildings,
    loops,
    selectedNodeId,
    selectedNode,
    isDark,
    deviceCounts,
    viewSettings,
    updateViewSettings,
    structureVersion,
    currentViewMode,
    switchViewMode,
    focusRequest,
    treeFocusRequest,
    getBuildingName,
    getFloorName,
    getDisplayId,
    createProject,
    updateBuildings,
    toggleBuildingEditor,
    closeProject,
    loadProject,
    saveToDisk,
    loadFromDisk,
    upsertNode,
    clearProject,
    selectNode,
    toggleTheme,
    batchPlaceNodes,
    unplaceNode,
    deleteLoop,
    replaceLoop,
    updateLoop,
    purgeMissingNodes,
    confirmLoopChanges,
    hasPendingChanges, // [新增]
    updateLoopTopology, // [新增]
    commitTopologyChanges, // [新增]
    discardTopologyChanges, // [新增]
    deleteNode,
    triggerFocus,
    triggerTreeFocus,
    addLoop,
    saveViewState,
    updateFloorScale3D,
    updateFloorHeight3D,
    isLayoutEditorVisible,
    toggleLayoutEditor, // [新增]
    highlightedPath // [新增]
  }
})
