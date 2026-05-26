import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFireProjectStore } from '../../../stores/fireProjectStore'

import { makeLifecycleProject, makeZoneArea } from './fireProjectStore.fixture'

describe('fire project store planning cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('removes a building and cleans dependent planning references without touching other buildings', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeLifecycleProject())
    store.selectDevice('device-2')

    store.removeBuilding('building-a')

    expect(store.project.buildings.map((building) => building.id)).toEqual(['building-b'])
    expect(store.project.buildings[0].floors.map((floor) => floor.id)).toEqual(['floor-b1'])
    expect(store.project.devices).toMatchObject([
      { id: 'device-1', placement: { status: 'unplaced' } },
      { id: 'device-2', placement: { status: 'unplaced' } },
      {
        id: 'device-3',
        placement: {
          status: 'placed',
          buildingId: 'building-b',
          floorId: 'floor-b1',
          position: { x: 300, y: 300, z: 0 }
        }
      }
    ])
    expect(store.selectedDeviceId).toBeNull()
    expect(store.project.networks[0].panels[0].zones[0].visualAreas).toEqual([
      expect.objectContaining({ id: 'area-b1', buildingId: 'building-b', floorId: 'floor-b1' })
    ])
    expect(store.project.assets.map((asset) => asset.id)).toEqual(['asset-a1', 'asset-b1'])

    store.undo()
    expect(store.project.buildings.map((building) => building.id)).toEqual([
      'building-a',
      'building-b'
    ])
    expect(store.project.devices[1].placement.status).toBe('placed')

    store.redo()
    expect(store.project.buildings.map((building) => building.id)).toEqual(['building-b'])
  })

  it('removes a floor, cleans dependent references, and keeps a valid floor target', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeLifecycleProject())
    store.selectDevice('device-1')

    store.removeFloor('building-a', 'floor-a1')

    const buildingA = store.project.buildings.find((building) => building.id === 'building-a')
    expect(buildingA?.floors.map((floor) => floor.id)).toEqual(['floor-a2'])
    expect(store.project.devices).toMatchObject([
      { id: 'device-1', placement: { status: 'unplaced' } },
      {
        id: 'device-2',
        placement: {
          status: 'placed',
          buildingId: 'building-a',
          floorId: 'floor-a2',
          position: { x: 200, y: 200, z: 0 }
        }
      },
      {
        id: 'device-3',
        placement: {
          status: 'placed',
          buildingId: 'building-b',
          floorId: 'floor-b1',
          position: { x: 300, y: 300, z: 0 }
        }
      }
    ])
    expect(store.selectedDeviceId).toBeNull()
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a2', 'area-b1']
    )

    store.removeFloor('building-a', 'floor-a2')
    const remainingBuildingA = store.project.buildings.find(
      (building) => building.id === 'building-a'
    )
    expect(remainingBuildingA?.floors).toHaveLength(1)
    expect(remainingBuildingA?.floors[0].id).not.toBe('floor-a2')

    store.undo()
    expect(
      store.project.buildings
        .find((building) => building.id === 'building-a')
        ?.floors.map((floor) => floor.id)
    ).toEqual(['floor-a2'])
  })

  it('clears a floor map asset without deleting the asset or layout data', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeLifecycleProject())

    store.clearFloorMapAsset('building-a', 'floor-a1')

    const floor = store.project.buildings[0].floors[0]
    expect(floor).toMatchObject({
      id: 'floor-a1',
      mapWidth: 1200,
      mapHeight: 800
    })
    expect(floor.mapAssetId).toBeUndefined()
    expect(store.project.assets.map((asset) => asset.id)).toEqual(['asset-a1', 'asset-b1'])
    expect(store.project.devices[0].placement).toMatchObject({
      status: 'placed',
      buildingId: 'building-a',
      floorId: 'floor-a1',
      position: { x: 100, y: 100, z: 0 }
    })
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1', 'area-a2', 'area-b1']
    )

    store.undo()
    expect(store.project.buildings[0].floors[0]).toMatchObject({
      id: 'floor-a1',
      mapAssetId: 'asset-a1',
      mapWidth: 900,
      mapHeight: 600
    })

    store.redo()
    expect(store.project.buildings[0].floors[0].mapAssetId).toBeUndefined()
  })

  it('deletes and replaces zone visual areas without changing CPD zone assignments', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeLifecycleProject())

    store.removeZoneArea('area-a1')
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a2', 'area-b1']
    )
    expect(store.project.networks[0].panels[0].zones[0].zoneNumber).toBe(1)
    expect(store.project.devices.map((device) => device.zoneNumber)).toEqual([1, 1, 1])

    store.undo()
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1', 'area-a2', 'area-b1']
    )

    store.replaceZoneArea('area-a1', makeZoneArea('area-a1-replacement', 'building-a', 'floor-a1'))

    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1-replacement', 'area-a2', 'area-b1']
    )
    expect(store.project.networks[0].panels[0].zones[0].zoneNumber).toBe(1)
    expect(store.project.devices.map((device) => device.zoneNumber)).toEqual([1, 1, 1])

    store.undo()
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1', 'area-a2', 'area-b1']
    )
  })

  it('does not persist invalid polygon zone visual areas', () => {
    const store = useFireProjectStore()
    store.loadFireProject(makeLifecycleProject())

    store.addZoneArea({
      ...makeZoneArea('invalid-area', 'building-a', 'floor-a1'),
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ]
    })
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1', 'area-a2', 'area-b1']
    )

    store.replaceZoneArea('area-a1', {
      ...makeZoneArea('invalid-replacement', 'building-a', 'floor-a1'),
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    })
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-a1', 'area-a2', 'area-b1']
    )
  })

  it('normalizes orphan planning references when opening malformed old projects', () => {
    const store = useFireProjectStore()
    const project = makeLifecycleProject()
    project.buildings = [project.buildings[1]]

    store.loadFireProject(project)

    expect(store.project.buildings.map((building) => building.id)).toEqual(['building-b'])
    expect(store.project.devices).toMatchObject([
      { id: 'device-1', placement: { status: 'unplaced' } },
      { id: 'device-2', placement: { status: 'unplaced' } },
      {
        id: 'device-3',
        placement: {
          status: 'placed',
          buildingId: 'building-b',
          floorId: 'floor-b1'
        }
      }
    ])
    expect(store.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)).toEqual(
      ['area-b1']
    )
  })
})
