import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  DEFAULT_FLOOR_HEIGHT_3D,
  MAX_FLOOR_HEIGHT_3D,
  MIN_FLOOR_HEIGHT_3D
} from '../viewer3DGeometry'
import { useFireProjectStore } from '../../../stores/fireProjectStore'

import { makeDevice, makeNetwork, makeProject } from './fireProjectStore.fixture'

describe('fire project store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads CPD adapter results as a fire project document with defaults', () => {
    const store = useFireProjectStore()
    const network = makeNetwork('network-1')
    const device = makeDevice('device-1', network.id, 'panel-1')

    store.loadFromCpdAdapterResult({
      projectName: 'Imported Site',
      network,
      devices: [device],
      issues: []
    })

    expect(store.project.name).toBe('Imported Site')
    expect(store.project.language).toBe('en')
    expect(store.project.networks).toEqual([network])
    expect(store.project.devices).toEqual([device])
    expect(store.selectedNetworkId).toBe(network.id)
    expect(store.selectedPanelId).toBe('panel-1')
  })

  it('restores missing panel zones from device zone assignments when loading old projects', () => {
    const store = useFireProjectStore()
    const project = makeProject()
    project.networks[0].panels[0].zones = []
    project.devices = [
      makeDevice('device-1', 'network-1', 'panel-1', 1),
      makeDevice('device-2', 'network-1', 'panel-1', 2),
      makeDevice('device-3', 'network-1', 'panel-1', 3)
    ]

    store.loadFireProject(project)

    expect(store.project.networks[0].panels[0].zones).toMatchObject([
      { zoneNumber: 1, text: 'Zone 1' },
      { zoneNumber: 2, text: 'Zone 2' },
      { zoneNumber: 3, text: 'Zone 3' }
    ])
  })

  it('merges missing device-assigned zones into partially configured old projects', () => {
    const store = useFireProjectStore()
    const project = makeProject()
    project.networks[0].panels[0].zones = [
      {
        ...project.networks[0].panels[0].zones[0],
        zoneNumber: 99,
        text: 'Existing Zone'
      }
    ]
    project.devices = [
      makeDevice('device-1', 'network-1', 'panel-1', 1),
      makeDevice('device-2', 'network-1', 'panel-1', 99)
    ]

    store.loadFireProject(project)

    const zones = store.project.networks[0].panels[0].zones
    expect(zones.map((zone) => zone.zoneNumber)).toEqual([1, 99])
    expect(zones.find((zone) => zone.zoneNumber === 1)).toMatchObject({
      text: 'Zone 1',
      raw: { synthesizedFromDeviceZones: true }
    })
    expect(zones.find((zone) => zone.zoneNumber === 99)?.text).toBe('Existing Zone')
  })

  it('restores missing panel sounder and I/O groups from device group assignments', () => {
    const store = useFireProjectStore()
    const project = makeProject()
    project.networks[0].panels[0].sounderGroups = []
    project.networks[0].panels[0].ioGroups = []
    project.devices = [
      makeDevice('device-1', 'network-1', 'panel-1', 1, 1, 2),
      makeDevice('device-2', 'network-1', 'panel-1', 1, 3, 4)
    ]

    store.loadFireProject(project)

    expect(store.project.networks[0].panels[0].sounderGroups.map((group) => group.groupId)).toEqual(
      [1, 3]
    )
    expect(store.project.networks[0].panels[0].ioGroups.map((group) => group.groupId)).toEqual([
      2, 4
    ])
  })

  it('merges missing device-assigned groups into partially configured old projects', () => {
    const store = useFireProjectStore()
    const project = makeProject()
    project.networks[0].panels[0].sounderGroups = [
      {
        id: 'panel-1-sounder-group-99',
        networkId: 'network-1',
        panelId: 'panel-1',
        groupId: 99,
        title: 'Existing sounder group',
        addressableMembers: [],
        nonAddressableMembers: [],
        raw: {}
      }
    ]
    project.networks[0].panels[0].ioGroups = [
      {
        id: 'panel-1-io-group-88',
        networkId: 'network-1',
        panelId: 'panel-1',
        groupId: 88,
        members: [],
        raw: {}
      }
    ]
    project.devices = [
      makeDevice('device-1', 'network-1', 'panel-1', 1, 1, 2),
      makeDevice('device-2', 'network-1', 'panel-1', 1, 99, 88)
    ]

    store.loadFireProject(project)

    const panel = store.project.networks[0].panels[0]
    expect(panel.sounderGroups.map((group) => group.groupId)).toEqual([1, 99])
    expect(panel.sounderGroups.find((group) => group.groupId === 1)).toMatchObject({
      title: 'Sounder Group 1',
      addressableMembers: [expect.objectContaining({ physicalAddress: 1 })]
    })
    expect(panel.sounderGroups.find((group) => group.groupId === 99)?.title).toBe(
      'Existing sounder group'
    )
    expect(panel.ioGroups.map((group) => group.groupId)).toEqual([2, 88])
    expect(panel.ioGroups.find((group) => group.groupId === 2)?.members).toEqual([
      expect.objectContaining({ physicalAddress: 1 })
    ])
  })

  it('places devices in a grid and supports undo and redo', () => {
    const store = useFireProjectStore()
    const project = makeProject()
    store.loadFireProject(project)

    store.placeDevices(['device-1', 'device-2', 'device-3'], 'building-1', 'floor-1', {
      x: 10,
      y: 20,
      z: 0
    })

    expect(store.project.devices.map((device) => device.placement.position)).toEqual([
      { x: 10, y: 20, z: 0 },
      { x: 58, y: 20, z: 0 },
      { x: 106, y: 20, z: 0 }
    ])
    expect(
      store.project.devices.map((device) => (device.placement as { order?: number }).order)
    ).toEqual([1, 2, 3])
    expect(store.canUndo).toBe(true)

    store.undo()
    expect(store.project.devices.every((device) => device.placement.status === 'unplaced')).toBe(
      true
    )
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.project.devices[0].placement.status).toBe('placed')
  })

  it('creates configurable building and floor targets for 2D planning', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    const buildingId = store.addBuilding()
    const floorId = store.addFloor(buildingId)

    const building = store.project.buildings.find((item) => item.id === buildingId)
    expect(building?.name).toBe('Building 1')
    expect(building?.floors.map((floor) => floor.id)).toContain(floorId)
    expect(building?.floors).toHaveLength(2)
    expect(building?.floors.every((floor) => floor.floorHeight3D === DEFAULT_FLOOR_HEIGHT_3D)).toBe(
      true
    )
    expect(store.canUndo).toBe(true)
  })

  it('ensures a default planning floor when importing or dropping before setup', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    const target = store.ensureDefaultPlanningFloor()

    expect(store.project.buildings).toHaveLength(1)
    expect(store.project.buildings[0].floors).toHaveLength(1)
    expect(target).toEqual({
      buildingId: store.project.buildings[0].id,
      floorId: store.project.buildings[0].floors[0].id
    })
  })

  it('tracks zone and loop planning changes in undo history', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    store.addZoneArea({
      id: 'area-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 1,
      buildingId: 'building-1',
      floorId: 'floor-1',
      kind: 'rectangle',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ],
      color: '#ef4444',
      opacity: 0.25
    })
    store.setManualLoopOrder('loop-1', ['device-2', 'device-1'])

    expect(store.project.networks[0].panels[0].zones[0].visualAreas).toHaveLength(1)
    expect(store.project.networks[0].panels[0].loops[0].manualDeviceOrder).toEqual([
      'device-2',
      'device-1'
    ])

    store.undo()
    expect(store.project.networks[0].panels[0].loops[0].manualDeviceOrder).toEqual([])

    store.undo()
    expect(store.project.networks[0].panels[0].zones[0].visualAreas).toHaveLength(0)
  })

  it('dispatches simulation actions against the selected network', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())
    store.enterSimulationMode()

    store.dispatchSimulationAction({ type: 'activate-input', deviceId: 'device-1', at: 100 })

    expect(store.simulationState.activeInputAlarms).toEqual([
      { deviceId: 'device-1', activatedAt: 100 }
    ])
    expect(store.simulationMode).toBe(true)
  })

  it('updates global 2D device icon scale within usable bounds', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    store.setDeviceIconScale2D(2.4)
    expect(store.project.viewSettings.deviceIconScale2D).toBe(2.4)

    store.setDeviceIconScale2D(99)
    expect(store.project.viewSettings.deviceIconScale2D).toBe(3)

    store.setDeviceIconScale2D(0)
    expect(store.project.viewSettings.deviceIconScale2D).toBe(0.4)
  })

  it('updates global 3D floor spacing within usable bounds', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    store.setFloorSpacing3D(48)
    expect(store.project.viewSettings.floorSpacing3D).toBe(48)

    store.setFloorSpacing3D(999)
    expect(store.project.viewSettings.floorSpacing3D).toBe(MAX_FLOOR_HEIGHT_3D)

    store.setFloorSpacing3D(0)
    expect(store.project.viewSettings.floorSpacing3D).toBe(MIN_FLOOR_HEIGHT_3D)
  })

  it('updates the simulation sound setting', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    store.setSimulationSoundEnabled(false)
    expect(store.project.simulationSettings.soundEnabled).toBe(false)

    store.setSimulationSoundEnabled(true)
    expect(store.project.simulationSettings.soundEnabled).toBe(true)
  })

  it('records one undo snapshot for a completed device move', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())
    store.placeDevices(['device-1'], 'building-1', 'floor-1', { x: 10, y: 20, z: 0 })
    store.undo()
    store.redo()

    store.moveDevice('device-1', { x: 80, y: 90, z: 0 })

    expect(store.project.devices[0].placement.position).toEqual({ x: 80, y: 90, z: 0 })
    expect((store.project.devices[0].placement as { order?: number }).order).toBe(1)
    store.undo()
    expect(store.project.devices[0].placement.position).toEqual({ x: 10, y: 20, z: 0 })
  })

  it('assigns a new placement order when an unplaced device is placed again', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeProject())

    store.placeDevices(['device-1', 'device-2'], 'building-1', 'floor-1', { x: 10, y: 20, z: 0 })
    store.removeDeviceFromDrawing('device-1')
    store.placeDevices(['device-1'], 'building-1', 'floor-1', { x: 80, y: 90, z: 0 })

    expect(
      store.project.devices.map((device) => (device.placement as { order?: number }).order)
    ).toEqual([3, 2, undefined])
  })
})
