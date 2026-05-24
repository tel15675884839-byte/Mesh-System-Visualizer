import { describe, expect, it } from 'vitest'

import type { FireDevice, FireFloor } from '../types'
import {
  getViewer3DMapOpacity,
  shouldRenderViewer3DDevice,
  shouldRenderViewer3DFloor,
  type Viewer3DScopeSelection
} from '../viewer3DViewState'

describe('viewer 3D view state', () => {
  it('uses per-floor map opacity override before the global opacity and clamps both', () => {
    expect(getViewer3DMapOpacity(0.42)).toBe(0.42)
    expect(getViewer3DMapOpacity(0.42, 0.75)).toBe(0.75)
    expect(getViewer3DMapOpacity(-1)).toBe(0)
    expect(getViewer3DMapOpacity(0.5, 3)).toBe(1)
  })

  it('isolates floors by selected building or floor', () => {
    const buildingScope: Viewer3DScopeSelection = { kind: 'building', targetId: 'building-a' }
    const floorScope: Viewer3DScopeSelection = { kind: 'floor', targetId: 'floor-a1' }

    expect(
      shouldRenderViewer3DFloor({
        floor: makeFloor('floor-a1', 'building-a'),
        scope: buildingScope,
        relationContextFloorIds: new Set()
      })
    ).toBe(true)
    expect(
      shouldRenderViewer3DFloor({
        floor: makeFloor('floor-b1', 'building-b'),
        scope: buildingScope,
        relationContextFloorIds: new Set()
      })
    ).toBe(false)
    expect(
      shouldRenderViewer3DFloor({
        floor: makeFloor('floor-a2', 'building-a'),
        scope: floorScope,
        relationContextFloorIds: new Set()
      })
    ).toBe(false)
  })

  it('keeps cross-floor relation endpoints visible inside an isolated building or floor view', () => {
    const scope: Viewer3DScopeSelection = { kind: 'floor', targetId: 'floor-a1' }
    const relationDeviceIds = new Set(['device-cross-floor'])
    const relationFloorIds = new Set(['floor-b1'])

    expect(
      shouldRenderViewer3DFloor({
        floor: makeFloor('floor-b1', 'building-b'),
        scope,
        relationContextFloorIds: relationFloorIds
      })
    ).toBe(true)
    expect(
      shouldRenderViewer3DDevice({
        device: makeDevice('device-cross-floor', 'building-b', 'floor-b1'),
        scope,
        relationContextDeviceIds: relationDeviceIds
      })
    ).toBe(true)
    expect(
      shouldRenderViewer3DDevice({
        device: makeDevice('device-unrelated', 'building-b', 'floor-b1'),
        scope,
        relationContextDeviceIds: relationDeviceIds
      })
    ).toBe(false)
  })
})

function makeFloor(id: string, buildingId: string): FireFloor {
  return {
    id,
    buildingId,
    name: id,
    levelIndex: 0
  }
}

function makeDevice(id: string, buildingId: string, floorId: string): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 1,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
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
    placement: {
      status: 'placed',
      buildingId,
      floorId,
      position: { x: 0, y: 0, z: 0 }
    },
    raw: {}
  }
}
