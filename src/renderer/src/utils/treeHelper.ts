import type { INode, IEdge, ILoop } from '../types'
import { DeviceRole } from '../types'

export interface ITreeNode {
  id: string
  label: string
  type: 'loop' | 'device' | 'orphan-group'
  role?: string // 用于决定图标颜色
  children?: ITreeNode[]
  isLeaf?: boolean
  data?: INode // 原始数据引用
}

/**
 * 将扁平的拓扑数据转换为树形结构
 * 逻辑：Loop -> Leader -> (BFS Spanning Tree) -> Routers/Children
 */
export function buildTopologyTree(
  nodes: INode[],
  edges: IEdge[],
  loops: ILoop[]
): ITreeNode[] {
  const treeData: ITreeNode[] = []

  // 1. 预处理：构建邻接表 (Adjacency List) 以加速查找
  const adjList = new Map<string, string[]>()
  edges.forEach(edge => {
    if (!adjList.has(edge.sourceId)) adjList.set(edge.sourceId, [])
    if (!adjList.has(edge.targetId)) adjList.set(edge.targetId, [])
    
    // 无向图处理 (Thread 连接是双向的)
    adjList.get(edge.sourceId)?.push(edge.targetId)
    adjList.get(edge.targetId)?.push(edge.sourceId)
  })

  // 2. 遍历每个 Loop 构建子树
  loops.forEach(loop => {
    // 找出属于该 Loop 的所有节点
    const loopNodes = nodes.filter(n => n.loopId === loop.id)
    if (loopNodes.length === 0) return

    const loopRoot: ITreeNode = {
      id: `loop-root-${loop.id}`,
      label: loop.name || '未命名回路',
      type: 'loop',
      children: []
    }

    // A. 寻找 Leader (根节点)
    const leader = loopNodes.find(n => n.role === DeviceRole.LEADER)
    const visited = new Set<string>()
    
    // B. 如果有 Leader，从 Leader 开始 BFS 构建树
    if (leader) {
      const leaderNode = createTreeNode(leader)
      visited.add(leader.id)
      
      // BFS 队列: [当前树节点, 对应的设备ID]
      const queue: { treeNode: ITreeNode, deviceId: string }[] = []
      queue.push({ treeNode: leaderNode, deviceId: leader.id })

      while (queue.length > 0) {
        const { treeNode, deviceId } = queue.shift()!
        const neighbors = adjList.get(deviceId) || []
        
        // 排序：Router 优先，然后是 ID 顺序 (让列表好看点)
        const neighborNodes = neighbors
          .map(id => loopNodes.find(n => n.id === id))
          .filter(n => n !== undefined && !visited.has(n.id)) as INode[]
        
        neighborNodes.sort((a, b) => {
           // 优先级：Router > 其他
           const isARouter = a.role === DeviceRole.ROUTER
           const isBRouter = b.role === DeviceRole.ROUTER
           if (isARouter && !isBRouter) return -1
           if (!isARouter && isBRouter) return 1
           return a.id.localeCompare(b.id)
        })

        neighborNodes.forEach(neighbor => {
          visited.add(neighbor.id)
          const childTreeNode = createTreeNode(neighbor)
          
          if (!treeNode.children) treeNode.children = []
          treeNode.children.push(childTreeNode)
          
          // 继续向下探索
          queue.push({ treeNode: childTreeNode, deviceId: neighbor.id })
        })
      }

      loopRoot.children?.push(leaderNode)
    }

    // C. 处理孤岛节点 (Orphans)
    // 那些属于这个 Loop，但没被 BFS 访问到的节点
    const orphans = loopNodes.filter(n => !visited.has(n.id))
    if (orphans.length > 0) {
      const orphanGroup: ITreeNode = {
        id: `orphan-group-${loop.id}`,
        label: `❓ 未连接设备 (${orphans.length})`,
        type: 'orphan-group',
        children: orphans.map(n => createTreeNode(n))
      }
      loopRoot.children?.push(orphanGroup)
    }

    treeData.push(loopRoot)
  })

  return treeData
}

function createTreeNode(node: INode): ITreeNode {
  return {
    id: node.id,
    label: node.label || node.mac.slice(-4), // 优先显示 Label，没有则显示 MAC 后四位
    type: 'device',
    role: node.role,
    data: node,
    // 初始没有 children，el-tree 会视情况渲染展开箭头
  }
}