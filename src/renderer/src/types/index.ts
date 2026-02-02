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
 * 核心设备节点接口
 */
export interface INode {
  id: string;
  mac: string;
  shortId?: string;
  role: DeviceRole;
  type: DeviceType;
  label: string;
  buildingId: string;
  floorId: string;
  position: Vector3;
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
 * [更新] 楼层接口
 * 现在包含图片源数据，不再依赖外部 config
 */
export interface IFloor {
  id: string;      // 内部ID (如 UUID)
  name: string;    // 显示名称 (如 "1F")
  levelIndex: number; // 楼层物理顺序 (0, 1, 2...) 用于 3D 堆叠
  
  // 平面图配置
  mapPath?: string;    // 图片路径 (base64 或 file://)
  mapWidth?: number;   // 图片原始宽
  mapHeight?: number;  // 图片原始高
  pixelPerMeter?: number; // 比例尺 (像素/米)
}

/**
 * [新增] 建筑接口
 */
export interface IBuilding {
  id: string;
  name: string;
  floors: IFloor[];
}

/**
 * [更新] 工程文件结构
 */
export interface IProject {
  version: string;
  name: string;
  created: number;
  updated: number;
  
  nodes: INode[];
  edges: IEdge[];
  
  // [修改] 现在使用建筑列表替代扁平的 floors 数组
  buildings: IBuilding[];
  
  settings: {
    theme: 'light' | 'dark';
    coordSystem: 'cartesian' | 'geographic';
  };
}