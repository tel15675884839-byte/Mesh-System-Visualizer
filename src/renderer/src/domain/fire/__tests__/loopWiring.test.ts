import { describe, expect, it } from 'vitest'
import type { FireDevice, FireLoop } from '../types'
import {
  buildCurrentFloorLoopSegments,
  buildLoopSegments,
  getEffectiveLoopOrder
} from '../loopWiring'

function createLoop(overrides: Partial<FireLoop> = {}): FireLoop {
  return {
    id: 'loop-1',
    networkId: 'network-1',
    panelId: 'panel-1',
    loopId: 1,
    name: 'Loop 1',
    configuredDeviceOrder: ['device-a', 'device-b', 'device-c'],
    manualDeviceOrder: [],
    color: '#ff0000',
    ...overrides
  }
}

function createDevice(id: string, floorId?: string): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: Number(id.charCodeAt(id.length - 1)),
    type: 'optical_det',
    friendlyTypeName: 'Optical Detector',
    isInputCapable: true,
    isOutputCapable: false,
    isSounder: false,
    isWirelessType: false,
    disabled: false,
    inhibitSounders: false,
    inhibitIO: false,
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: floorId
      ? {
          status: 'placed',
          buildingId: 'building-1',
          floorId,
          position: { x: 0, y: 0, z: 0 }
        }
      : { status: 'unplaced' },
    raw: {}
  }
}

describe('loop wiring', () => {
  it('uses manual order when non-empty', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c'],
      manualDeviceOrder: ['device-c', 'device-a']
    })

    expect(getEffectiveLoopOrder(loop)).toEqual(['device-c', 'device-a'])
  })

  it('uses configured order when manual order is empty', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-b', 'device-a', 'device-c'],
      manualDeviceOrder: []
    })

    expect(getEffectiveLoopOrder(loop)).toEqual(['device-b', 'device-a', 'device-c'])
  })

  it('builds 2D segments only for same-floor placed device pairs', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d']
    })
    const devices = [
      createDevice('device-a', 'floor-1'),
      createDevice('device-b', 'floor-1'),
      createDevice('device-c', 'floor-2'),
      createDevice('device-d', 'floor-1')
    ]

    expect(buildCurrentFloorLoopSegments(loop, devices, 'floor-1')).toEqual({
      segments: [{ fromDeviceId: 'device-a', toDeviceId: 'device-b' }],
      skippedSegments: []
    })
  })

  it('builds 3D segments for placed device pairs across floors', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c']
    })
    const devices = [
      createDevice('device-a', 'floor-1'),
      createDevice('device-b', 'floor-2'),
      createDevice('device-c', 'floor-1')
    ]

    expect(buildLoopSegments(loop, devices)).toEqual({
      segments: [
        { fromDeviceId: 'device-a', toDeviceId: 'device-b' },
        { fromDeviceId: 'device-b', toDeviceId: 'device-c' }
      ],
      skippedSegments: []
    })
  })

  it('skips segments with unplaced or unknown devices and reports the skipped count', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-missing', 'device-c']
    })
    const devices = [
      createDevice('device-a', 'floor-1'),
      createDevice('device-b'),
      createDevice('device-c', 'floor-1')
    ]

    const result = buildLoopSegments(loop, devices)

    expect(result.segments).toEqual([])
    expect(result.skippedSegments).toEqual([
      { fromDeviceId: 'device-a', toDeviceId: 'device-b' },
      { fromDeviceId: 'device-b', toDeviceId: 'device-missing' },
      { fromDeviceId: 'device-missing', toDeviceId: 'device-c' }
    ])
    expect(result.skippedSegments).toHaveLength(3)
  })
})
