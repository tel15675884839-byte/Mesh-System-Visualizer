import type { FireDevice, FireFloor } from './types'

export type Viewer3DScopeKind = 'all' | 'building' | 'floor'

export interface Viewer3DScopeSelection {
  kind: Viewer3DScopeKind
  targetId: string | null
}

export interface Viewer3DFloorVisibilityArgs {
  floor: FireFloor
  scope: Viewer3DScopeSelection
  relationContextFloorIds: Set<string>
}

export interface Viewer3DDeviceVisibilityArgs {
  device: FireDevice
  scope: Viewer3DScopeSelection
  relationContextDeviceIds: Set<string>
}

export function getViewer3DMapOpacity(globalOpacity: number, floorOverride?: number): number {
  return clampOpacity(floorOverride ?? globalOpacity)
}

export function shouldRenderViewer3DFloor({
  floor,
  scope,
  relationContextFloorIds
}: Viewer3DFloorVisibilityArgs): boolean {
  if (relationContextFloorIds.has(floor.id)) {
    return true
  }

  if (scope.kind === 'all' || !scope.targetId) {
    return true
  }

  if (scope.kind === 'building') {
    return floor.buildingId === scope.targetId
  }

  return floor.id === scope.targetId
}

export function shouldRenderViewer3DDevice({
  device,
  scope,
  relationContextDeviceIds
}: Viewer3DDeviceVisibilityArgs): boolean {
  if (relationContextDeviceIds.has(device.id)) {
    return true
  }

  if (scope.kind === 'all' || !scope.targetId) {
    return true
  }

  if (scope.kind === 'building') {
    return device.placement.buildingId === scope.targetId
  }

  return device.placement.floorId === scope.targetId
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(1, Math.max(0, value))
}
