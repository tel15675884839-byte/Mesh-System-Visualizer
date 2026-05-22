export type SounderMode = 'Programmed' | 'Preset'
export type PlacementStatus = 'unplaced' | 'placed' | 'missing'
export type GroupMode = 'loop' | 'zone' | 'type' | 'sounderGroup' | 'ioGroup'
export type DeviceStatusFilter = 'all' | 'unplaced' | 'placed' | 'issues'
export type ZoneAlarmMode = 'single' | 'double'
export type VisualShapeKind = 'rectangle' | 'polygon'

export interface Vector2 {
  x: number
  y: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface FireProject {
  schemaVersion: number
  projectId: string
  name: string
  createdAt: number
  updatedAt: number
  language: 'en' | 'zh'
  networks: FireNetwork[]
  buildings: FireBuilding[]
  assets: FireAsset[]
  viewSettings: FireViewSettings
  simulationSettings: SimulationSettings
}

export interface FireNetwork {
  id: string
  name: string
  sourceFileName: string
  sourceImportedAt: number
  extractorVersion?: string
  sounderMode: SounderMode
  panels: FirePanel[]
}

export interface FirePanel {
  id: string
  networkId: string
  panelNumber: number
  panelName: string
  panelModel?: string
  general: PanelGeneralConfig
  loops: FireLoop[]
  zones: FireZone[]
  sounderGroups: SounderGroup[]
  ioGroups: IOGroup[]
  sounders: PanelSounderConfig
}

export interface PanelGeneralConfig {
  panelNumber: number
  sounderMode: SounderMode
  faultIOGroup?: number
  evacuateDelaySeconds: number
  evacuateMode?: string
  sounderDelaySeconds: number
  sounderActiveOn?: string
  sounderMode1?: string
  inputOutputDelaySeconds: number
  fireBrigadeDelaySeconds: number
  fireBrigadeActiveOn?: string
  fireBrigadeMode?: string
  onManualCallPoints: boolean
  onTwoDevices: boolean
  delayOffAtNight: boolean
  raw: Record<string, unknown>
}

export interface FireLoop {
  id: string
  networkId: string
  panelId: string
  loopId: number
  name: string
  configuredDeviceOrder: string[]
  manualDeviceOrder: string[]
  color: string
}

export interface FireDevice {
  id: string
  networkId: string
  panelId: string
  panelNumber: number
  loopId?: number
  address?: number
  type: string
  friendlyTypeName: string
  description?: string
  classify?: string
  location?: string
  zoneNumber?: number
  sounderGroupId?: number
  ioGroupId?: number
  isInputCapable: boolean
  isOutputCapable: boolean
  isSounder: boolean
  isWirelessType: boolean
  disabled: boolean
  inhibitSounders: boolean
  inhibitIO: boolean
  inhibitRelays: boolean
  evacuateIO: boolean
  ioOverrideDelay: boolean
  immediateEvacuate: boolean
  setEvacuateTimer: boolean
  overrideDelays: boolean
  selectedDisablement?: string
  reportingDetail?: string
  smokeSensitivity?: string
  heatGrade?: string
  sounderGroupValue?: string
  imageIndex?: number
  placement: DevicePlacement
  raw: Record<string, unknown>
}

export interface DevicePlacement {
  status: PlacementStatus
  buildingId?: string
  floorId?: string
  position?: Vector3
  rotation?: number
}

export interface FireZone {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  text: string
  enabled: boolean
  delayedSounders: boolean
  alarmMode: ZoneAlarmMode
  sounderGroupAlarm1?: number
  sounderGroupAlarm2?: number
  ioGroup1Alarm1?: number
  ioGroup1Alarm2?: number
  ioGroup2Alarm1?: number
  ioGroup3Alarm1?: number
  ioGroup4Alarm1?: number
  visualAreas: ZoneVisualArea[]
  raw: Record<string, unknown>
}

export interface ZoneVisualArea {
  id: string
  networkId: string
  panelId: string
  zoneNumber: number
  buildingId: string
  floorId: string
  kind: VisualShapeKind
  points: Vector2[]
  color: string
  opacity: number
}

export interface SounderGroup {
  id: string
  networkId: string
  panelId: string
  groupId: number
  title?: string
  description?: string
  addressableMembers: GroupMember[]
  nonAddressableMembers: NonAddressableSounderMember[]
  raw: Record<string, unknown>
}

export interface IOGroup {
  id: string
  networkId: string
  panelId: string
  groupId: number
  members: GroupMember[]
  raw: Record<string, unknown>
}

export interface GroupMember {
  loopId?: number
  physicalAddress?: number
  description?: string
  status?: string
  raw: Record<string, unknown>
}

export interface NonAddressableSounderMember {
  cieId?: number
  nonAddressable1?: boolean
  nonAddressable2?: boolean
  raw: Record<string, unknown>
}

export interface NonAddressableSounderPoint {
  id: string
  networkId: string
  panelId: string
  sounderGroupId: number
  cieId?: number
  channel: 'nonAddressable1' | 'nonAddressable2'
  label: string
  placement: DevicePlacement
}

export interface FireBuilding {
  id: string
  name: string
  floors: FireFloor[]
  position?: Vector2
  size?: { width: number; depth: number }
  rotation?: number
}

export interface FireFloor {
  id: string
  buildingId: string
  name: string
  levelIndex: number
  mapAssetId?: string
  mapWidth?: number
  mapHeight?: number
  camera2D?: { x: number; y: number; scale: number }
  floorScale3D?: number
  floorHeight3D?: number
}

export interface FireAsset {
  id: string
  kind: 'map' | 'icon' | 'audio'
  name: string
  packagePath: string
  mimeType?: string
}

export interface FireViewSettings {
  deviceIconScale2D: number
  deviceIconScale3D: number
  mapOpacity: number
  labelColor: string
  showLoopLines: boolean
  showGroupHelperLines: boolean
}

export interface SimulationSettings {
  timeScale: 1 | 5 | 10 | 30
  soundEnabled: boolean
}

export interface PanelSounderConfig {
  raw: Record<string, unknown>
}

export type FireIssueSeverity = 'info' | 'warning' | 'error'

export interface FireIssue {
  id: string
  code: string
  severity: FireIssueSeverity
  message: string
  relatedDeviceId?: string
  relatedPanelId?: string
  relatedLoopId?: string
  relatedZoneId?: string
  relatedGroupId?: string
  targetId?: string
  raw?: Record<string, unknown>
}
