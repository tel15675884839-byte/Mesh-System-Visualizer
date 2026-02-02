import { Log } from './logger'

/**
 * 解析结果接口
 */
export interface IParsedData {
  nodes: any[]
  edges: any[]
}

/**
 * 从 OpenThread 导出的 HTML 文件内容中提取拓扑数据
 * @param htmlContent 文件文本内容
 */
export function parseOpenThreadHtml(htmlContent: string): IParsedData {
  try {
    // 1. 使用正则提取 nodes 和 edges 的定义部分
    // 兼容 var/let/const，兼容 new vis.DataSet([...]) 或直接 = [...]
    const nodesMatch = 
      htmlContent.match(/(?:var|let|const)?\s*nodes\s*=\s*new\s+vis\.DataSet\s*\(\s*(\[[\s\S]*?\])\s*\)/) || 
      htmlContent.match(/(?:var|let|const)?\s*nodes\s*=\s*(\[[\s\S]*?\])\s*;?/)

    const edgesMatch = 
      htmlContent.match(/(?:var|let|const)?\s*edges\s*=\s*new\s+vis\.DataSet\s*\(\s*(\[[\s\S]*?\])\s*\)/) || 
      htmlContent.match(/(?:var|let|const)?\s*edges\s*=\s*(\[[\s\S]*?\])\s*;?/)

    if (!nodesMatch || !edgesMatch) {
      throw new Error('无法在 HTML 中找到 nodes 或 edges 数据定义')
    }

    // 2. 安全地执行提取到的 JS 代码片段以获取数组对象
    // 注意：这里假设 HTML 来源是受信任的 OpenThread 工具
    const nodesRaw = new Function("return " + nodesMatch[1])()
    const edgesRaw = new Function("return " + edgesMatch[1])()

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

/**
 * 标准化 MAC 地址
 * 尝试从 id, label, mac 字段中提取 16 位 hex 字符串
 */
export function extractMac(node: any): string {
  if (node.mac) return node.mac.toLowerCase()
  
  const macRegex = /([0-9a-fA-F]{16})/
  if (typeof node.id === 'string' && node.id.match(macRegex)) return node.id.match(macRegex)[0].toLowerCase()
  if (typeof node.label === 'string' && node.label.match(macRegex)) return node.label.match(macRegex)[0].toLowerCase()
  
  // 如果都找不到，返回原始 ID (可能是短地址或自定义ID)
  return String(node.id).toLowerCase()
}