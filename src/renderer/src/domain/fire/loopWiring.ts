import type { FireDevice, FireLoop } from './types'

export interface LoopSegment {
  fromDeviceId: string
  toDeviceId: string
}

export interface LoopSegmentsResult {
  segments: LoopSegment[]
  skippedSegments: LoopSegment[]
}

export function getEffectiveLoopOrder(loop: FireLoop, devices: FireDevice[] = []): string[] {
  if (loop.manualDeviceOrder.length > 0) {
    return loop.manualDeviceOrder
  }

  return devices
    .map((device, index) => ({ device, index }))
    .filter(
      ({ device }) =>
        device.panelId === loop.panelId && device.loopId === loop.loopId && isPlacedDevice(device)
    )
    .sort((left, right) => comparePlacementOrder(left, right))
    .map(({ device }) => device.id)
}

export function buildLoopSegments(loop: FireLoop, devices: FireDevice[]): LoopSegmentsResult {
  return buildSegments(loop, devices, () => true)
}

export function buildCurrentFloorLoopSegments(
  loop: FireLoop,
  devices: FireDevice[],
  floorId: string
): LoopSegmentsResult {
  return buildSegments(loop, devices, (fromDevice, toDevice) => {
    return fromDevice.placement.floorId === floorId && toDevice.placement.floorId === floorId
  })
}

export function buildAdjacentCurrentFloorLoopSegments(
  loop: FireLoop,
  devices: FireDevice[],
  floorId: string,
  deviceId: string
): LoopSegmentsResult {
  return buildSegments(loop, devices, (fromDevice, toDevice) => {
    return (
      (fromDevice.id === deviceId || toDevice.id === deviceId) &&
      fromDevice.placement.floorId === floorId &&
      toDevice.placement.floorId === floorId
    )
  })
}

function buildSegments(
  loop: FireLoop,
  devices: FireDevice[],
  canIncludeSegment: (fromDevice: FireDevice, toDevice: FireDevice) => boolean
): LoopSegmentsResult {
  const devicesById = new Map(devices.map((device) => [device.id, device]))
  const order = getEffectiveLoopOrder(loop, devices)
  const segments: LoopSegment[] = []
  const skippedSegments: LoopSegment[] = []

  for (let index = 0; index < order.length - 1; index += 1) {
    const segment = {
      fromDeviceId: order[index],
      toDeviceId: order[index + 1]
    }
    const fromDevice = devicesById.get(segment.fromDeviceId)
    const toDevice = devicesById.get(segment.toDeviceId)

    if (!isPlacedDevice(fromDevice) || !isPlacedDevice(toDevice)) {
      skippedSegments.push(segment)
      continue
    }

    if (canIncludeSegment(fromDevice, toDevice)) {
      segments.push(segment)
    }
  }

  return { segments, skippedSegments }
}

function isPlacedDevice(device: FireDevice | undefined): device is FireDevice {
  return device?.placement.status === 'placed' && device.placement.position !== undefined
}

function comparePlacementOrder(
  left: { device: FireDevice; index: number },
  right: { device: FireDevice; index: number }
): number {
  const leftOrder = finitePlacementOrder(left.device)
  const rightOrder = finitePlacementOrder(right.device)

  if (leftOrder !== undefined && rightOrder !== undefined) {
    return leftOrder - rightOrder || left.index - right.index
  }
  if (leftOrder !== undefined) return -1
  if (rightOrder !== undefined) return 1
  return left.index - right.index
}

function finitePlacementOrder(device: FireDevice): number | undefined {
  const order = device.placement.order
  return typeof order === 'number' && Number.isFinite(order) ? order : undefined
}
