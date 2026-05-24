export const DEFAULT_FLOOR_HEIGHT_3D = 36
export const MIN_FLOOR_HEIGHT_3D = 12
export const MAX_FLOOR_HEIGHT_3D = 96

export function getEffectiveFloorHeight3D(floorHeight3D: number | undefined): number {
  if (typeof floorHeight3D !== 'number' || !Number.isFinite(floorHeight3D)) {
    return DEFAULT_FLOOR_HEIGHT_3D
  }
  return Math.min(MAX_FLOOR_HEIGHT_3D, Math.max(MIN_FLOOR_HEIGHT_3D, floorHeight3D))
}
