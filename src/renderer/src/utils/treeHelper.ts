import type { INode, IEdge, ILoop } from '../types'
import { DeviceRole } from '../types'

export interface ITreeNode {
  id: string
  label: string
  type: 'loop' | 'device' | 'orphan-group'
  role?: string
  children?: ITreeNode[]
  isLeaf?: boolean
  data?: INode
}

/**
 * 构建逻辑层级树：扁平化骨干网，层级化终端
 * 结构：Leader -> [Direct Children] + [All Routers -> Their Children]
 */
export function buildTopologyTree(nodes: INode[], edges: IEdge[], loops: ILoop[]): ITreeNode[] {
  const treeData: ITreeNode[] = []

  // 1. 预处理：构建邻接表，方便查找 Child 连接了谁
  // Map<ChildID, Set<ParentID>>
  const connections = new Map<string, Set<string>>()

  edges.forEach((edge) => {
    if (!edge.sourceId || !edge.targetId) return

    // 记录双向连接
    if (!connections.has(edge.sourceId)) connections.set(edge.sourceId, new Set())
    if (!connections.has(edge.targetId)) connections.set(edge.targetId, new Set())

    connections.get(edge.sourceId)?.add(edge.targetId)
    connections.get(edge.targetId)?.add(edge.sourceId)
  })

  // 2. 遍历每个 Loop
  loops.forEach((loop) => {
    const loopNodes = nodes.filter((n) => n.loopId === loop.id)

    const loopRoot: ITreeNode = {
      id: `loop-root-${loop.id}`,
      label: loop.name || `Loop ${loop.id}`,
      type: 'loop',
      children: []
    }

    if (loopNodes.length === 0) {
      treeData.push(loopRoot)
      return
    }

    // 3. 角色分类
    const leaders = loopNodes.filter((n) => n.role === DeviceRole.LEADER)
    const routers = loopNodes.filter((n) => n.role === DeviceRole.ROUTER)
    const children = loopNodes.filter(
      (n) => n.role !== DeviceRole.LEADER && n.role !== DeviceRole.ROUTER
    )

    // 4. 建立逻辑归属关系 (Child -> ParentID)
    const parentMap = new Map<string, string>() // ChildID -> ParentID
    const assignedChildren = new Set<string>()

    children.forEach((child) => {
      const neighbors = connections.get(child.id)
      if (!neighbors) return // 孤儿

      let chosenParentId: string | null = null

      // 优先级检查：
      // 1. 优先找 Leader
      for (const neighborId of neighbors) {
        const neighbor = loopNodes.find((n) => n.id === neighborId)
        if (neighbor && neighbor.role === DeviceRole.LEADER) {
          chosenParentId = neighbor.id
          break // 找到 Leader 就定下来
        }
      }

      // 2. 没连 Leader，找任意 Router
      if (!chosenParentId) {
        for (const neighborId of neighbors) {
          const neighbor = loopNodes.find((n) => n.id === neighborId)
          if (neighbor && neighbor.role === DeviceRole.ROUTER) {
            chosenParentId = neighbor.id
            break // 找到第一个 Router 就定下来 (简化逻辑)
          }
        }
      }

      if (chosenParentId) {
        parentMap.set(child.id, chosenParentId)
        assignedChildren.add(child.id)
      }
    })

    // 辅助函数：创建树节点
    const createTreeNode = (n: INode): ITreeNode => ({
      id: n.id,
      label: n.label || n.mac.slice(-4),
      type: 'device',
      role: n.role,
      data: n,
      children: [] // 默认为空数组，el-tree 会处理
    })

    // 辅助函数：排序 (按名称)
    const sortNodes = (a: ITreeNode, b: ITreeNode) => a.label.localeCompare(b.label)

    // 5. 组装树结构

    // A. 处理 Routers 及其下级
    // 先把所有 Router 包装成树节点，并填入它们的 Child
    const routerTreeNodes = routers
      .map((r) => {
        const rNode = createTreeNode(r)
        // 找到归属这个 Router 的 Children
        const myChildren = children.filter((c) => parentMap.get(c.id) === r.id)
        rNode.children = myChildren.map(createTreeNode).sort(sortNodes)
        return rNode
      })
      .sort(sortNodes)

    // B. 处理 Leader 及其下级
    if (leaders.length > 0) {
      leaders.forEach((leader) => {
        const leaderNode = createTreeNode(leader)

        // 1. 先加：直连 Leader 的 Children
        const directChildren = children.filter((c) => parentMap.get(c.id) === leader.id)
        const directChildrenNodes = directChildren.map(createTreeNode).sort(sortNodes)
        leaderNode.children!.push(...directChildrenNodes)

        // 2. 后加：所有 Routers (扁平化)
        leaderNode.children!.push(...routerTreeNodes)

        loopRoot.children?.push(leaderNode)
      })
    } else {
      // 异常情况：没有 Leader
      // 直接把 Routers 放在 Loop 下面
      loopRoot.children?.push(...routerTreeNodes)
    }

    // C. 处理孤岛 (既没连 Leader 也没连 Router)
    const orphans = children.filter((c) => !assignedChildren.has(c.id))
    if (orphans.length > 0) {
      const orphanGroup: ITreeNode = {
        id: `orphan-${loop.id}`,
        label: `⚠️ 离线/孤立设备 (${orphans.length})`,
        type: 'orphan-group',
        children: orphans.map(createTreeNode).sort(sortNodes)
      }
      loopRoot.children?.push(orphanGroup)
    }

    treeData.push(loopRoot)
  })

  return treeData
}
