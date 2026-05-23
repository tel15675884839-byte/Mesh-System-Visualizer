import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { FireDevice, FireLoop, FireNetwork, FireProject, FireZone } from '../types'
import { useFireProjectStore } from '../../../stores/fireProjectStore'

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
})

function makeProject(): FireProject & { devices: FireDevice[] } {
  const network = makeNetwork('network-1')

  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Test Project',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [network],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#111827',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: {
      timeScale: 1,
      soundEnabled: true
    },
    devices: [
      makeDevice('device-1', network.id, 'panel-1'),
      makeDevice('device-2', network.id, 'panel-1'),
      makeDevice('device-3', network.id, 'panel-1')
    ]
  }
}

function makeNetwork(id: string): FireNetwork {
  const loop: FireLoop = {
    id: 'loop-1',
    networkId: id,
    panelId: 'panel-1',
    loopId: 1,
    name: 'Loop 1',
    configuredDeviceOrder: ['device-1', 'device-2', 'device-3'],
    manualDeviceOrder: [],
    color: '#2563eb'
  }
  const zone: FireZone = {
    id: 'zone-1',
    networkId: id,
    panelId: 'panel-1',
    zoneNumber: 1,
    text: 'Zone 1',
    enabled: true,
    delayedSounders: false,
    alarmMode: 'single',
    visualAreas: [],
    raw: {}
  }

  return {
    id,
    name: 'Network 1',
    sourceFileName: 'test.cpd',
    sourceImportedAt: 1,
    sounderMode: 'Programmed',
    panels: [
      {
        id: 'panel-1',
        networkId: id,
        panelNumber: 1,
        panelName: 'Panel 1',
        general: {
          panelNumber: 1,
          sounderMode: 'Programmed',
          evacuateDelaySeconds: 0,
          sounderDelaySeconds: 0,
          inputOutputDelaySeconds: 0,
          fireBrigadeDelaySeconds: 0,
          onManualCallPoints: false,
          onTwoDevices: false,
          delayOffAtNight: false,
          raw: {}
        },
        loops: [loop],
        zones: [zone],
        sounderGroups: [],
        ioGroups: [],
        sounders: { raw: {} }
      }
    ]
  }
}

function makeDevice(id: string, networkId: string, panelId: string): FireDevice {
  return {
    id,
    networkId,
    panelId,
    panelNumber: 1,
    loopId: 1,
    address: Number(id.replace('device-', '')),
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
    placement: { status: 'unplaced' },
    raw: {}
  }
}
