const DEVICE_ICON_BASE_PLAN_SIZE = 24
const DEVICE_ICON_WORLD_BOTTOM_GAP = 0.2
const MIN_DEVICE_ICON_SCALE = 0.4
const MAX_DEVICE_ICON_SCALE = 3

export function getDeviceIconPlanSize(scale: number): number {
  return DEVICE_ICON_BASE_PLAN_SIZE * clampDeviceIconScale(scale)
}

export function getDeviceIconWorldSize(scale: number, planScale: number): number {
  return getDeviceIconPlanSize(scale) * planScale
}

export function getDeviceIconWorldBottomGap(): number {
  return DEVICE_ICON_WORLD_BOTTOM_GAP
}

export function getDeviceIconWorldCenterHeight(iconWorldSize: number): number {
  return DEVICE_ICON_WORLD_BOTTOM_GAP + iconWorldSize / 2
}

function clampDeviceIconScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_DEVICE_ICON_SCALE, Math.max(MIN_DEVICE_ICON_SCALE, scale))
}
