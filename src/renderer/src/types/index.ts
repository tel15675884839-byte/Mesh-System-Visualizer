// src/renderer/src/types/index.ts

/**
 * 设备角色枚举
 * 对应 OpenThread 中的 Device Role
 */
export enum DeviceRole {
  LEADER = 'Leader',
  ROUTER = 'Router',
  REED = 'REED', // Router Eligible End Device
  FED = 'FED',   // Full End Device
  MED = 'MED',   // Minimal End Device
  SED = 'SED',   // Sleepy End Device
  UNKNOWN = 'Unknown'
}

/**
 * 设备类型枚举
 * 对应具体的物理设备形态
 */
export enum DeviceType {
  SMOKE_DETECTOR = 'Smoke Detector',
  HEAT_DETECTOR = 'Heat Detector',
  MULT_DETECTOR = 'Mult Detector',
  MANUAL_CALL_POINT = 'Manual Call Point',
  IO_MODULE = 'I/O Module',
  SOUNDER = 'Sounder',
  DEFAULT = 'Default',
  // 用于标记差异对比的状态
  NEW = 'New',
  REMOVED = 'Removed'
}

/**
 * 3D 空间坐标
 * 工业软件中，我们通常使用“米”作为单位，而不是像素
 */
export interface Vector3 {
  x: number; // 相对原点的 X 偏移 (米)
  y: number; // 相对原点的 Y 偏移 (米) - 在 2D 平面中对应 Canvas 的 Y，在 3D 中对应 Z
  z: number; // 高度 (米) - 对应楼层高度
}

/**
 * 核心设备节点接口
 * 这是整个软件中最重要的数据结构
 */
export interface INode {
  // 基础标识
  id: string;          // 内部唯一 ID (通常是 MAC 地址或 hash)
  mac: string;         // 真实 MAC 地址 (如 "00124b001ca7b321")
  shortId?: string;    // RLOC16 短地址 (可选，用于调试)
  
  // 业务属性
  role: DeviceRole;
  type: DeviceType;
  label: string;       // 显示名称 (如 "Smoke-01")
  
  // 物理位置信息
  buildingId: string;  // 关联的建筑 ID
  floorId: string;     // 关联的楼层 ID
  position: Vector3;   // 归一化后的物理坐标 (不同于 Canvas 像素坐标)
  
  // 状态标记 (用于差异对比)
  diffStatus?: 'new' | 'removed' | 'unchanged';
  
  // 扩展数据 (预留给后续可能的 IP 地址、电量等)
  metadata?: Record<string, any>;
}

/**
 * 拓扑连线接口
 */
export interface IEdge {
  id: string;
  sourceId: string; // 对应 INode.id
  targetId: string; // 对应 INode.id
  
  // 链路质量指示 (Link Quality Indicator)
  lqi?: number;     
  // 是否为父子关系 (如果是 false，则是 Router-Router 邻居关系)
  isParentChild: boolean;
}

/**
 * 楼层配置接口
 * 解决 "2D 图片如何映射到 3D 空间" 的核心配置
 */
export interface IFloor {
  id: string;
  name: string;        // 如 "1F", "2F"
  buildingId: string;
  
  // 楼层图源
  mapPath: string;     // 本地图片路径 (file://...)
  
  // 3D 映射参数
  altitude: number;    // 该楼层在 3D 世界中的绝对高度 (米)
  
  // 比例尺参数 (关键难点)
  widthMeters: number; // 该图片的宽度代表实际多少米
  heightMeters: number;// 该图片的高度代表实际多少米
  
  // 像素尺寸 (用于计算比例)
  pixelWidth: number;
  pixelHeight: number;
  
  // 透明度
  opacity: number;
}

/**
 * 整个工程文件的结构
 * 对应 Save/Load 的 JSON 结构
 */
export interface IProject {
  version: string;     // 防止未来升级导致旧文件打不开
  name: string;
  created: number;
  updated: number;
  
  // 数据实体
  nodes: INode[];
  edges: IEdge[];
  floors: IFloor[];
  
  // 全局配置
  settings: {
    theme: 'light' | 'dark';
    coordSystem: 'cartesian' | 'geographic';
  };
}