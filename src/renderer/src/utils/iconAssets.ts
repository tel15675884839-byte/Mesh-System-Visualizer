/**
 * 图标资产库 (Vite 引用版)
 * 使用 import 语法让 Vite 处理路径，避免硬编码 Base64 导致文件过大。
 * 这里的 ?url 后缀告诉 Vite：我们只想要文件的路径字符串。
 */

import leaderIcon from '../assets/icons/Leader.svg?url'
import routerIcon from '../assets/icons/Router.svg?url'
import smokeIcon from '../assets/icons/smoke.svg?url'
import heatIcon from '../assets/icons/heat-mult.svg?url'
import mcpIcon from '../assets/icons/mcp.svg?url'
import sounderIcon from '../assets/icons/sounder.svg?url'
import ioIcon from '../assets/icons/io-module.svg?url'

// 导出路径，供 Vis.js 使用
export const IconRegistry = {
  LEADER: leaderIcon,
  ROUTER: routerIcon,
  SMOKE: smokeIcon,
  HEAT: heatIcon,
  MCP: mcpIcon,
  SOUNDER: sounderIcon,
  IO: ioIcon
}