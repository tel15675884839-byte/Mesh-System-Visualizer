import { describe, expect, it } from 'vitest'
import type { FireDevice } from '../types'
import {
  buildBoundingAreaForDevices,
  createPolygonArea,
  createRectangleArea,
  pointInPolygon
} from '../zoneGeometry'

function createPlacedDevice(id: string, x: number, y: number): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: Number(id.at(-1) ?? 0),
    type: 'optical_det',
    friendlyTypeName: 'Optical Detector',
    zoneNumber: 1,
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
      buildingId: 'building-1',
      floorId: 'floor-1',
      position: { x, y, z: 0 }
    },
    raw: {}
  }
}

describe('zone geometry', () => {
  it('creates rectangle area points from drag start and end', () => {
    const area = createRectangleArea({
      id: 'zone-area-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 2,
      buildingId: 'building-1',
      floorId: 'floor-1',
      start: { x: 40, y: 80 },
      end: { x: 10, y: 20 },
      color: '#ff0000',
      opacity: 0.25
    })

    expect(area).toEqual({
      id: 'zone-area-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 2,
      buildingId: 'building-1',
      floorId: 'floor-1',
      kind: 'rectangle',
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 80 },
        { x: 10, y: 80 }
      ],
      color: '#ff0000',
      opacity: 0.25
    })
  })

  it('creates polygon area from clicked points', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 20, y: 35 }
    ]

    const area = createPolygonArea({
      id: 'zone-area-2',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 3,
      buildingId: 'building-1',
      floorId: 'floor-1',
      points,
      color: '#0088ff',
      opacity: 0.4
    })

    expect(area.kind).toBe('polygon')
    expect(area.points).toEqual(points)
    expect(area.points).not.toBe(points)
  })

  it('builds a temporary bounding rectangle around placed zone devices', () => {
    const devices = [
      createPlacedDevice('device-1', 15, 20),
      createPlacedDevice('device-2', 35, 45),
      { ...createPlacedDevice('device-3', 100, 100), placement: { status: 'unplaced' as const } }
    ]

    expect(buildBoundingAreaForDevices(devices, 5)).toEqual([
      { x: 10, y: 15 },
      { x: 40, y: 15 },
      { x: 40, y: 50 },
      { x: 10, y: 50 }
    ])
  })

  it('detects whether a device position is inside another zone visual polygon', () => {
    const zoneBVisualArea = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]

    expect(pointInPolygon({ x: 50, y: 60 }, zoneBVisualArea)).toBe(true)
    expect(pointInPolygon({ x: 120, y: 60 }, zoneBVisualArea)).toBe(false)
  })
})
