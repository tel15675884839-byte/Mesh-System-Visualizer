import { describe, expect, it } from 'vitest'

import type { FireDevice, FireZone } from '../types'
import { resolveViewer3DZoneAreas } from '../viewer3DZoneArea'

describe('viewer 3D Zone area resolution', () => {
  it('returns saved visual areas without creating temporary bounds', () => {
    const zone = makeZone({
      visualAreas: [
        {
          id: 'area-1',
          networkId: 'network-1',
          panelId: 'panel-1',
          zoneNumber: 7,
          buildingId: 'building-a',
          floorId: 'floor-a1',
          kind: 'rectangle',
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 20 },
            { x: 30, y: 40 },
            { x: 10, y: 40 }
          ],
          color: '#ef4444',
          opacity: 0.25
        }
      ]
    })

    expect(resolveViewer3DZoneAreas({ zone, devices: [], includeTemporary: true })).toEqual([
      expect.objectContaining({
        id: 'area-1',
        temporary: false,
        buildingId: 'building-a',
        floorId: 'floor-a1'
      })
    ])
  })

  it('creates padded temporary bounds per floor from placed Zone devices', () => {
    const zone = makeZone({ visualAreas: [] })
    const areas = resolveViewer3DZoneAreas({
      zone,
      devices: [
        makeDevice('device-1', 7, 'building-a', 'floor-a1', 100, 200),
        makeDevice('device-2', 7, 'building-a', 'floor-a1', 160, 260),
        makeDevice('device-3', 7, 'building-a', 'floor-a2', 300, 400),
        makeDevice('device-other-zone', 8, 'building-a', 'floor-a1', 10, 20),
        makeDevice('device-unplaced', 7, 'building-a', 'floor-a1', 500, 600, false)
      ],
      includeTemporary: true,
      padding: 20
    })

    expect(areas).toHaveLength(2)
    expect(areas[0]).toMatchObject({
      temporary: true,
      buildingId: 'building-a',
      floorId: 'floor-a1',
      zoneNumber: 7,
      points: [
        { x: 80, y: 180 },
        { x: 180, y: 180 },
        { x: 180, y: 280 },
        { x: 80, y: 280 }
      ]
    })
    expect(areas[1]).toMatchObject({
      temporary: true,
      floorId: 'floor-a2',
      points: [
        { x: 280, y: 380 },
        { x: 320, y: 380 },
        { x: 320, y: 420 },
        { x: 280, y: 420 }
      ]
    })
  })

  it('does not create temporary bounds when the Zone is not the active highlight target', () => {
    expect(
      resolveViewer3DZoneAreas({
        zone: makeZone({ visualAreas: [] }),
        devices: [makeDevice('device-1', 7, 'building-a', 'floor-a1', 100, 200)],
        includeTemporary: false
      })
    ).toEqual([])
  })

  it('mixes saved areas with temporary bounds for floors that have no saved area', () => {
    const zone = makeZone({
      visualAreas: [
        {
          id: 'area-floor-a1',
          networkId: 'network-1',
          panelId: 'panel-1',
          zoneNumber: 7,
          buildingId: 'building-a',
          floorId: 'floor-a1',
          kind: 'rectangle',
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 20 },
            { x: 30, y: 40 },
            { x: 10, y: 40 }
          ],
          color: '#ef4444',
          opacity: 0.25
        }
      ]
    })

    const areas = resolveViewer3DZoneAreas({
      zone,
      devices: [
        makeDevice('device-saved-floor', 7, 'building-a', 'floor-a1', 100, 200),
        makeDevice('device-other-floor', 7, 'building-a', 'floor-a2', 300, 400)
      ],
      includeTemporary: true,
      padding: 20
    })

    expect(areas).toEqual([
      expect.objectContaining({
        id: 'area-floor-a1',
        temporary: false,
        buildingId: 'building-a',
        floorId: 'floor-a1'
      }),
      expect.objectContaining({
        temporary: true,
        buildingId: 'building-a',
        floorId: 'floor-a2',
        points: [
          { x: 280, y: 380 },
          { x: 320, y: 380 },
          { x: 320, y: 420 },
          { x: 280, y: 420 }
        ]
      })
    ])
  })
})

function makeZone(overrides: Partial<FireZone>): FireZone {
  return {
    id: 'zone-7',
    networkId: 'network-1',
    panelId: 'panel-1',
    zoneNumber: 7,
    text: 'Zone 7',
    enabled: true,
    delayedSounders: false,
    alarmMode: 'single',
    visualAreas: [],
    raw: {},
    ...overrides
  }
}

function makeDevice(
  id: string,
  zoneNumber: number,
  buildingId: string,
  floorId: string,
  x: number,
  y: number,
  placed = true
): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 1,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    zoneNumber,
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
    placement: placed
      ? {
          status: 'placed',
          buildingId,
          floorId,
          position: { x, y, z: 0 }
        }
      : { status: 'unplaced' },
    raw: {}
  }
}
