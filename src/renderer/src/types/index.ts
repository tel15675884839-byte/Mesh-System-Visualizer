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
 * [新增] 回路接口
 */
export interface ILoop {
  id: string;        // 内部ID
  name: string;      // 显示名称 (如 "Loop 1")
  htmlSource?: string; // 来源文件名
  deviceCount: number; // 设备数量统计
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
  position: Vector3;
  
  // [新增] 逻辑归属
  loopId?: string; // 所属回路 ID
  
  diffStatus?: 'new' | 'removed' | 'unchanged';
  metadata?: Record<string, any>;
}

/**
 * 拓扑连线接口
 */
export interface IEdge {
  id: string;
  sourceId: string;
  targetId: string;
  lqi?: number;
  isParentChild: boolean;
}

/**
 * 楼层接口
 */
export interface IFloor {
  id: string;
  name: string;
  levelIndex: number;
  mapPath?: string;
  mapWidth?: number;
  mapHeight?: number;
  pixelPerMeter?: number;
}

/**
 * 建筑接口
 */
export interface IBuilding {
  id: string;
  name: string;
  floors: IFloor[];
}

/**
 * 工程文件结构
 */
export interface IProject {
  version: string;
  name: string;
  created: number;
  updated: number;
  
  nodes: INode[];
  edges: IEdge[];
  buildings: IBuilding[];
  loops: ILoop[]; // [新增] 回路列表
  
  settings: {
    theme: 'light' | 'dark';
    coordSystem: 'cartesian' | 'geographic';
  };
}