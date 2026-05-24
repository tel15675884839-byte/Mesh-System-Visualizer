import { Log } from './logger'

export interface IParsedData {
  nodes: any[]
  edges: any[]
}

export function parseOpenThreadHtml(htmlContent: string): IParsedData {
  try {
    const nodesMatch =
      htmlContent.match(
        /(?:var|let|const)?\s*nodes\s*=\s*new\s+vis\.DataSet\s*\(\s*(\[[\s\S]*?\])\s*\)/
      ) || htmlContent.match(/(?:var|let|const)?\s*nodes\s*=\s*(\[[\s\S]*?\])\s*;?/)

    const edgesMatch =
      htmlContent.match(
        /(?:var|let|const)?\s*edges\s*=\s*new\s+vis\.DataSet\s*\(\s*(\[[\s\S]*?\])\s*\)/
      ) || htmlContent.match(/(?:var|let|const)?\s*edges\s*=\s*(\[[\s\S]*?\])\s*;?/)

    if (!nodesMatch || !edgesMatch) {
      throw new Error('无法在 HTML 中找到 nodes 或 edges 数据定义')
    }

    const nodesRaw = new Function('return ' + nodesMatch[1])()
    const edgesRaw = new Function('return ' + edgesMatch[1])()

    if (!Array.isArray(nodesRaw) || !Array.isArray(edgesRaw)) {
      throw new Error('解析出的数据不是有效的数组格式')
    }

    Log.debug(`HTML 解析成功: 发现 ${nodesRaw.length} 个节点, ${edgesRaw.length} 条连线`)

    return {
      nodes: nodesRaw,
      edges: edgesRaw
    }
  } catch (error: any) {
    Log.error('HTML 解析失败', error)
    throw error
  }
}

export function extractMac(node: any): string {
  if (node.mac) return node.mac.toLowerCase()
  const macRegex = /([0-9a-fA-F]{16})/
  if (typeof node.id === 'string' && node.id.match(macRegex))
    return node.id.match(macRegex)[0].toLowerCase()
  if (typeof node.label === 'string' && node.label.match(macRegex))
    return node.label.match(macRegex)[0].toLowerCase()
  if (node.title && typeof node.title === 'string' && node.title.match(macRegex))
    return node.title.match(macRegex)[0].toLowerCase()
  return String(node.id).toLowerCase()
}

// [核心修复] 从 title 中提取 RSSI
export function extractRssi(edge: any): number | undefined {
  // 1. 如果有直接字段，优先使用
  if (typeof edge.rssi === 'number') return edge.rssi
  if (typeof edge.averageRssi === 'number') return edge.averageRssi
  if (typeof edge.lastRssi === 'number') return edge.lastRssi

  // 2. 从 title 字符串提取 (例如: "3000 -> 3010: -49 dBm")
  if (edge.title && typeof edge.title === 'string') {
    // 匹配 "-数字 dBm"
    const matches = edge.title.match(/(-?\d+)\s*dBm/)
    if (matches && matches[1]) {
      return parseInt(matches[1], 10)
    }
  }
  return undefined
}
