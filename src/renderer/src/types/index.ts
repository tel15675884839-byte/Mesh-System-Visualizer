/**
 * 设备角色枚举
 */
export enum DeviceRole {
  LEADER = 'Leader',
  ROUTER = 'Router',
  REED = 'REED',
  FED = 'FED',
  MED = 'MED',
  SED = 'SED',
  UNKNOWN = 'Unknown'
}

/**
 * 设备类型枚举
 */
export enum DeviceType {
  SMOKE_DETECTOR = 'Smoke Detector',
  HEAT_DETECTOR = 'Heat Detector',
  MULT_DETECTOR = 'Mult Detector',
  MANUAL_CALL_POINT = 'Manual Call Point',
  IO_MODULE = 'I/O Module',
  SOUNDER = 'Sounder',
  DEFAULT = 'Default',
  NEW = 'New',
  REMOVED = 'Removed'
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface ILogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: 'Renderer' | 'Main'
  message: string
  details?: unknown
}

export interface ILoop {
  id: string
  name: string
  htmlSource?: string
  deviceCount: number
}

// [新增] 2D 摄像机状态
export interface ICamera2D {
  x: number
  y: number
  scale: number
}

// [新增] 3D 摄像机状态
export interface ICamera3D {
  position: Vector3
  target: Vector3
}

/**
 * 视图显示设置 (持久化)
 */
export interface IViewSettings {
  iconScale: number // 2D 图标大小
  labelColor: string
  mapOpacity: number
  showAllLinks: boolean
  rightPanelWidth: number
  isPropertyPanelOpen: boolean // [新增] 属性面板显示状态

  // [新增] 3D 视图专属持久化设置
  floorHeight3D: number // 3D 层高
  iconScale3D: number // 3D 独立图标大小

  // [新增] 状态记忆
  lastBuildingId?: string
  lastFloorId?: string
  lastViewMode?: '2D' | '3D'
  lastTheme?: 'light' | 'dark'
  camera2D?: ICamera2D
  camera3D?: ICamera3D
}

export interface INode {
  id: string
  mac: string
  shortId?: string
  role: DeviceRole
  type: DeviceType
  label: string
  buildingId: string
  floorId: string
  position: Vector3 | null
  isPlaced: boolean
  loopId?: string
  diffStatus?: 'new' | 'missing' | 'unchanged' | 'normal'
  metadata?: Record<string, any>
}

export interface IEdge {
  id: string
  sourceId: string
  targetId: string
  lqi?: number
  rssi?: number
  isParentChild: boolean
}

export interface IFloor {
  id: string
  name: string
  levelIndex: number
  mapPath?: string
  mapWidth?: number
  mapHeight?: number
  iconScale?: number // [新增] 每层楼独立的图标缩放比例
  floorScale3D?: number // [新增] 每层楼独立的 3D 缩放比例
  floorHeight3D?: number // [新增] 每层楼独立的 3D 层高
  cameraState?: ICamera2D // [新增] 每层楼独立的 2D 视角记忆
}

export interface IBuilding {
  id: string
  name: string
  floors: IFloor[]
  // [新增] 2D 布局属性
  position?: { x: number; y: number }
  size?: { width: number; depth: number }
  rotation?: number
}

export interface IProject {
  version: string
  name: string
  created: number
  updated: number

  nodes: INode[]
  edges: IEdge[]
  buildings: IBuilding[]
  loops: ILoop[]

  viewSettings?: IViewSettings

  settings: {
    theme: 'light' | 'dark'
    coordSystem: 'cartesian' | 'geographic'
  }
}
