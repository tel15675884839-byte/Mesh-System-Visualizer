import type { FireDevice, FireLoop } from './types'

export interface LoopSegment {
  fromDeviceId: string
  toDeviceId: string
}

export interface LoopSegmentsResult {
  segments: LoopSegment[]
  skippedSegments: LoopSegment[]
}

export function getEffectiveLoopOrder(loop: FireLoop): string[] {
  return loop.manualDeviceOrder.length > 0 ? loop.manualDeviceOrder : loop.configuredDeviceOrder
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

function buildSegments(
  loop: FireLoop,
  devices: FireDevice[],
  canIncludeSegment: (fromDevice: FireDevice, toDevice: FireDevice) => boolean
): LoopSegmentsResult {
  const devicesById = new Map(devices.map((device) => [device.id, device]))
  const order = getEffectiveLoopOrder(loop)
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
