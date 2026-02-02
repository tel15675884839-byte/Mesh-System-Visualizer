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

/**
 * 3D 空间坐标 (米)
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 回路接口
 */
export interface ILoop {
  id: string;
  name: string;
  htmlSource?: string;
  deviceCount: number;
}

/**
 * 核心设备节点接口
 */
export interface INode {
  id: string;
  mac: string;
  shortId?: string;
  role: DeviceRole;
  type: DeviceType;
  label: string;
  
  // 物理位置
  buildingId: string;
  floorId: string;
  position: Vector3 | null;
  
  // 是否已布点
  isPlaced: boolean;

  // 逻辑归属
  loopId?: string;
  
  // [修改] 差异状态: 
  // 'new': 新增未确认 (绿点)
  // 'missing': 缺失 (幽灵)
  // 'unchanged': 本次更新中存在的旧设备
  // 'normal': 普通状态 (无特殊显示)
  diffStatus?: 'new' | 'missing' | 'unchanged' | 'normal';
  
  metadata?: Record<string, any>;
}

export interface IEdge {
  id: string;
  sourceId: string;
  targetId: string;
  lqi?: number;
  isParentChild: boolean;
}

export interface IFloor {
  id: string;
  name: string;
  levelIndex: number;
  mapPath?: string;
  mapWidth?: number;
  mapHeight?: number;
  pixelPerMeter?: number;
}

export interface IBuilding {
  id: string;
  name: string;
  floors: IFloor[];
}

export interface IProject {
  version: string;
  name: string;
  created: number;
  updated: number;
  
  nodes: INode[];
  edges: IEdge[];
  buildings: IBuilding[];
  loops: ILoop[];
  
  settings: {
    theme: 'light' | 'dark';
    coordSystem: 'cartesian' | 'geographic';
  };
}