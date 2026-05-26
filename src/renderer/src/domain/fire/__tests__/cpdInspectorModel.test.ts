import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCpdInspectorModel, getSpecialProperties } from '../cpdInspectorModel'
import { adaptCpdExport } from '../cpdAdapter'
import { applyCpdDiff, diffCpdImport } from '../cpdDiff'
import type { FirePanel, FireDevice, FireProject } from '../types'

const basePanel: FirePanel = {
  id: 'panel-1',
  networkId: 'network-1',
  panelNumber: 1,
  panelName: 'Panel 1',
  general: {
    panelNumber: 1,
    sounderMode: 'Programmed',
    evacuateDelaySeconds: 120,
    sounderDelaySeconds: 60,
    inputOutputDelaySeconds: 45,
    fireBrigadeDelaySeconds: 0,
    onManualCallPoints: false,
    onTwoDevices: false,
    delayOffAtNight: false,
    raw: {}
  },
  loops: [],
  zones: [
    {
      id: 'panel-1-zone-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 1,
      text: '1st Floor',
      enabled: true,
      delayedSounders: true,
      alarmMode: 'single',
      sounderGroupAlarm1: 1,
      sounderGroupAlarm2: 10,
      ioGroup1Alarm1: 1,
      ioGroup1Alarm2: 2,
      visualAreas: [],
      raw: {}
    },
    {
      id: 'panel-1-zone-2',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 2,
      text: '2nd Floor',
      enabled: true,
      delayedSounders: false,
      alarmMode: 'single',
      sounderGroupAlarm1: 2,
      visualAreas: [],
      raw: {}
    }
  ],
  sounderGroups: [
    {
      id: 'panel-1-sounder-group-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      groupId: 1,
      title: 'Sounder Group 1',
      addressableMembers: [
        { loopId: 1, physicalAddress: 94, raw: {} },
        { loopId: 1, physicalAddress: 95, raw: {} }
      ],
      nonAddressableMembers: [],
      raw: {}
    },
    {
      id: 'panel-1-sounder-group-10',
      networkId: 'network-1',
      panelId: 'panel-1',
      groupId: 10,
      title: 'All Evacuation',
      addressableMembers: [],
      nonAddressableMembers: [],
      raw: {}
    }
  ],
  ioGroups: [
    {
      id: 'panel-1-io-group-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      groupId: 1,
      members: [{ loopId: 1, physicalAddress: 7, raw: {} }],
      raw: {}
    }
  ],
  sounders: { raw: {} }
}

function makeDevice(overrides: Partial<FireDevice> = {}): FireDevice {
  return {
    id: 'device-id',
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 1,
    type: 'optical_detector',
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
    placement: { status: 'unplaced' },
    raw: {},
    ...overrides
  }
}

describe('getSpecialProperties', () => {
  it('identifies standard disabled and override flags', () => {
    const dev = makeDevice({ disabled: true, overrideDelays: true })
    const badges = getSpecialProperties(dev)
    expect(badges).toContain('disabled')
    expect(badges).toContain('overrideDelays')
  })

  it('identifies selectedDisablement when true or a specific string value', () => {
    const dev1 = makeDevice({ selectedDisablement: true })
    const dev2 = makeDevice({ selectedDisablement: 'true' })
    const devTypeSpecific = makeDevice({ selectedDisablement: 'Detector' })
    const dev3 = makeDevice({ selectedDisablement: false })
    const dev4 = makeDevice({ selectedDisablement: 'false' })

    expect(getSpecialProperties(dev1)).toContain('selectedDisablement')
    expect(getSpecialProperties(dev2)).toContain('selectedDisablement')
    expect(getSpecialProperties(devTypeSpecific)).toContain('selectedDisablement')
    expect(getSpecialProperties(dev3)).not.toContain('selectedDisablement')
    expect(getSpecialProperties(dev4)).not.toContain('selectedDisablement')
  })

  it('handles sensitivity parameters', () => {
    const devDefault = makeDevice({ smokeSensitivity: '0', heatGrade: 'Normal' })
    const devSpecial = makeDevice({ smokeSensitivity: 'High', heatGrade: 'Class A' })

    expect(getSpecialProperties(devDefault)).not.toContain('smokeSensitivity')
    expect(getSpecialProperties(devDefault)).not.toContain('heatGrade')

    expect(getSpecialProperties(devSpecial)).toContain('smokeSensitivity')
    expect(getSpecialProperties(devSpecial)).toContain('heatGrade')
  })
})

describe('buildCpdInspectorModel', () => {
  it('correctly maps 128 zones and flags configured zones', () => {
    const devices = [
      makeDevice({ id: 'dev-1', zoneNumber: 1 }),
      makeDevice({ id: 'dev-2', zoneNumber: 2 })
    ]
    const data = buildCpdInspectorModel(basePanel, devices)

    expect(data.zones.length).toBe(128)

    // Zone 1: configured
    const z1 = data.zones.find((z) => z.zoneNumber === 1)
    expect(z1).toBeDefined()
    expect(z1?.text).toBe('1st Floor')
    expect(z1?.enabled).toBe(true)
    expect(z1?.delayedSounders).toBe(true)
    expect(z1?.devicesCount).toBe(1)
    expect(z1?.groups).toEqual(['sg1', 'sg10', 'io1', 'io2'])

    // Zone 2: configured
    const z2 = data.zones.find((z) => z.zoneNumber === 2)
    expect(z2?.text).toBe('2nd Floor')
    expect(z2?.devicesCount).toBe(1)
    expect(z2?.groups).toEqual(['sg2'])

    // Zone 4: unconfigured
    const z4 = data.zones.find((z) => z.zoneNumber === 4)
    expect(z4?.text).toBe('')
    expect(z4?.devicesCount).toBe(0)
    expect(z4?.groups).toEqual([])

    // Totals check
    expect(data.totals.zones).toBe(128)
    expect(data.totals.configuredZones).toBe(2)
  })

  it('maps devices to multiple groups based on addressable members', () => {
    const devices = [
      makeDevice({
        id: 'dev-sg-94',
        classify: 'Alarm',
        type: 'Sounder',
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        address: 94,
        zoneNumber: 0
      }),
      makeDevice({
        id: 'dev-sg-95',
        classify: 'Alarm',
        type: 'Sounder',
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        address: 95,
        zoneNumber: 0
      }),
      makeDevice({
        id: 'dev-io-7',
        classify: 'Module',
        type: 'Input_Output',
        address: 7,
        zoneNumber: 0
      })
    ]

    const data = buildCpdInspectorModel(basePanel, devices)

    // dev-sg-94 is member of sg1
    const d94 = data.devices.find((d) => d.id === 'dev-sg-94')
    expect(d94?.groupIds).toContain('sg1')
    expect(d94?.groupIds).not.toContain('io1')

    // dev-io-7 is member of io1
    const d7 = data.devices.find((d) => d.id === 'dev-io-7')
    expect(d7?.groupIds).toContain('io1')
  })

  it('maps output group membership independently of classify labels', () => {
    const devices = [
      makeDevice({
        id: 'dev-sounder-unclassified',
        classify: 'Detector',
        isSounder: true,
        type: 'Sounder',
        sounderGroupId: 10,
        address: 94,
        zoneNumber: 0
      }),
      makeDevice({
        id: 'dev-io-unclassified',
        classify: 'Detector',
        type: 'Input_Output',
        ioGroupId: 1,
        address: 7,
        zoneNumber: 0
      })
    ]

    const data = buildCpdInspectorModel(basePanel, devices)

    const sounder = data.devices.find((d) => d.id === 'dev-sounder-unclassified')
    expect(sounder?.groupIds).toContain('sg1')
    expect(sounder?.groupIds).not.toContain('sg10')

    const io = data.devices.find((d) => d.id === 'dev-io-unclassified')
    expect(io?.groupIds).toContain('io1')
  })

  it('separates Zone, Sounder Group, I/O Group, and direct device assignment semantics', () => {
    const devices = [
      makeDevice({
        id: 'direct-mcp',
        type: 'manual_call_point',
        friendlyTypeName: 'Manual Call Point',
        address: 20,
        sounderGroupId: 10,
        ioGroupId: 1
      }),
      makeDevice({
        id: 'member-sounder',
        type: 'sounder',
        friendlyTypeName: 'Sounder',
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        address: 94,
        zoneNumber: 1,
        sounderGroupId: 10
      }),
      makeDevice({
        id: 'wireless-sounder-member',
        type: 'wireless_sounder',
        friendlyTypeName: 'Wireless Sounder',
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        address: 95,
        zoneNumber: 1
      }),
      makeDevice({
        id: 'io-member',
        type: 'wireless_input_output',
        friendlyTypeName: 'Wireless Input/Output',
        isInputCapable: true,
        isOutputCapable: true,
        address: 7,
        zoneNumber: 1
      }),
      makeDevice({
        id: 'direct-io-mcp',
        type: 'manual_call_point',
        friendlyTypeName: 'Manual Call Point',
        address: 21,
        zoneNumber: 1,
        ioGroupId: 1
      })
    ]

    const data = buildCpdInspectorModel(basePanel, devices)

    expect(data.zones.find((zone) => zone.zoneNumber === 1)?.devicesCount).toBe(3)

    expect(data.devices.find((device) => device.id === 'direct-mcp')?.groupIds).toEqual([])
    expect(data.devices.find((device) => device.id === 'direct-mcp')?.directGroupIds).toEqual([
      'sg10',
      'io1'
    ])
    expect(data.devices.find((device) => device.id === 'direct-io-mcp')?.groupIds).toEqual([])
    expect(data.devices.find((device) => device.id === 'direct-io-mcp')?.directGroupIds).toEqual([
      'io1'
    ])
    expect(data.devices.find((device) => device.id === 'member-sounder')?.groupIds).toEqual(['sg1'])
    expect(data.devices.find((device) => device.id === 'member-sounder')?.directGroupIds).toEqual(
      []
    )
    expect(
      data.devices.find((device) => device.id === 'wireless-sounder-member')?.groupIds
    ).toEqual(['sg1'])
    expect(data.devices.find((device) => device.id === 'io-member')?.groupIds).toEqual(['io1'])
    expect(data.devices.find((device) => device.id === 'io-member')?.directGroupIds).toEqual([])

    expect(data.directDevices.map((device) => device.id)).toEqual(['direct-mcp', 'direct-io-mcp'])

    expect(data.groups.find((group) => group.id === 'sg1')?.count).toBe(2)
    expect(data.groups.find((group) => group.id === 'sg10')?.count).toBe(0)
    expect(data.groups.find((group) => group.id === 'io1')?.count).toBe(1)
  })

  it('uses CPD device flags after re-import when a fireproj device has stale values', () => {
    const incoming = adaptCpdExport(readFixture('6002-delay-edge-fields.json'), 1700000000000)
    const staleDevice = incoming.devices.find(
      (device) => device.loopId === 1 && device.address === 4
    )
    expect(staleDevice).toBeDefined()
    expect(staleDevice?.setEvacuateTimer).toBe(false)

    const existingProject = projectFromImport(incoming)
    existingProject.devices = existingProject.devices.map((device) =>
      device.loopId === 1 && device.address === 4
        ? { ...device, setEvacuateTimer: true, raw: { ...device.raw, SetEvacuateTimer: true } }
        : device
    )

    const diff = diffCpdImport(existingProject, incoming)
    const applied = applyCpdDiff(existingProject, incoming, diff) as FireProject & {
      devices: FireDevice[]
    }
    const panel = applied.networks[0].panels[0]
    const data = buildCpdInspectorModel(panel, applied.devices)
    const l1004 = data.devices.find((device) => device.loopId === 1 && device.address === 4)

    expect(l1004?.rawDevice.setEvacuateTimer).toBe(false)
    expect(l1004?.specialBadges).not.toContain('setEvacuateTimer')
  })

  it('correctly maps delay values from panel configs', () => {
    const data = buildCpdInspectorModel(basePanel, [])
    const sgGroup = data.groups.find((g) => g.id === 'sg1')
    const ioGroup = data.groups.find((g) => g.id === 'io1')

    expect(sgGroup?.delay).toBe(60)
    expect(ioGroup?.delay).toBe(45)
  })
})

function readFixture(fileName: string): unknown {
  const path = new URL(`../../../../../../fixtures/cpd/extracted/${fileName}`, import.meta.url)
  return JSON.parse(readText(path))
}

function readText(url: URL): string {
  return readFileSync(url, 'utf8')
}

function projectFromImport(result: ReturnType<typeof adaptCpdExport>): FireProject & {
  devices: FireDevice[]
} {
  return {
    schemaVersion: 1,
    projectId: 'project-stale',
    name: result.projectName,
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [result.network],
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
    devices: result.devices
  }
}
