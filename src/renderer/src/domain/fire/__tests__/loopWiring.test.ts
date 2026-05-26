import { describe, expect, it } from 'vitest'
import type { FireDevice, FireLoop } from '../types'
import {
  buildAdjacentCurrentFloorLoopSegments,
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

function createDevice(id: string, floorId?: string, placementOrder?: number): FireDevice {
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
      ? ({
          status: 'placed',
          buildingId: 'building-1',
          floorId,
          position: { x: 0, y: 0, z: 0 },
          order: placementOrder
        } as FireDevice['placement'])
      : { status: 'unplaced' },
    raw: {}
  }
}

describe('loop wiring', () => {
  it('uses configured order even when legacy manual order is present', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c'],
      manualDeviceOrder: ['device-c', 'device-a']
    })

    expect(getEffectiveLoopOrder(loop)).toEqual(['device-a', 'device-b', 'device-c'])
  })

  it('uses configured order instead of placement order', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c'],
      manualDeviceOrder: []
    })
    const devices = [
      createDevice('device-a', 'floor-1', 20),
      createDevice('device-b', 'floor-1', 10),
      createDevice('device-c', 'floor-1', 30)
    ]

    expect(getEffectiveLoopOrder(loop, devices)).toEqual(['device-a', 'device-b', 'device-c'])
  })

  it('builds 2D segments only for adjacent same-floor pairs in configured order', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d']
    })
    const devices = [
      createDevice('device-a', 'floor-1', 40),
      createDevice('device-b', 'floor-1', 10),
      createDevice('device-c', 'floor-2', 20),
      createDevice('device-d', 'floor-1', 30)
    ]

    expect(buildCurrentFloorLoopSegments(loop, devices, 'floor-1')).toEqual({
      segments: [{ fromDeviceId: 'device-a', toDeviceId: 'device-b' }],
      skippedSegments: []
    })
  })

  it('does not shortcut over unplaced devices in configured order', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d']
    })
    const devices = [
      createDevice('device-a', 'floor-1', 1),
      createDevice('device-b'),
      createDevice('device-c'),
      createDevice('device-d', 'floor-1', 2)
    ]

    expect(buildCurrentFloorLoopSegments(loop, devices, 'floor-1')).toEqual({
      segments: [],
      skippedSegments: [
        { fromDeviceId: 'device-a', toDeviceId: 'device-b' },
        { fromDeviceId: 'device-b', toDeviceId: 'device-c' },
        { fromDeviceId: 'device-c', toDeviceId: 'device-d' }
      ]
    })
  })

  it('does not create 2D segments from Zone, Sounder Group, or I/O Group membership', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b']
    })
    const devices = [
      {
        ...createDevice('device-a', 'floor-1'),
        zoneNumber: 1,
        sounderGroupId: 3
      },
      {
        ...createDevice('device-b', 'floor-1'),
        zoneNumber: 2,
        ioGroupId: 4
      },
      {
        ...createDevice('device-c', 'floor-1'),
        loopId: 2,
        zoneNumber: 1,
        sounderGroupId: 3,
        ioGroupId: 4
      }
    ]

    expect(buildCurrentFloorLoopSegments(loop, devices, 'floor-1')).toEqual({
      segments: [{ fromDeviceId: 'device-a', toDeviceId: 'device-b' }],
      skippedSegments: []
    })
  })

  it('builds only adjacent current-floor segments for a dragged Loop device', () => {
    const loop = createLoop({
      configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d']
    })
    const devices = [
      createDevice('device-a', 'floor-1'),
      createDevice('device-b', 'floor-1'),
      createDevice('device-c', 'floor-1'),
      createDevice('device-d', 'floor-2')
    ]

    expect(buildAdjacentCurrentFloorLoopSegments(loop, devices, 'floor-1', 'device-b')).toEqual({
      segments: [
        { fromDeviceId: 'device-a', toDeviceId: 'device-b' },
        { fromDeviceId: 'device-b', toDeviceId: 'device-c' }
      ],
      skippedSegments: []
    })
    expect(buildAdjacentCurrentFloorLoopSegments(loop, devices, 'floor-1', 'device-c')).toEqual({
      segments: [{ fromDeviceId: 'device-b', toDeviceId: 'device-c' }],
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
      configuredDeviceOrder: ['device-a', 'device-c'],
      manualDeviceOrder: ['device-a', 'device-b', 'device-missing', 'device-c']
    })
    const devices = [
      createDevice('device-a', 'floor-1'),
      createDevice('device-b'),
      createDevice('device-c', 'floor-1')
    ]

    const result = buildLoopSegments(loop, devices)

    expect(result.segments).toEqual([{ fromDeviceId: 'device-a', toDeviceId: 'device-c' }])
    expect(result.skippedSegments).toEqual([])
  })
})
