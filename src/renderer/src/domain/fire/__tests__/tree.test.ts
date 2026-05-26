import { describe, expect, it } from 'vitest'
import { buildFireDeviceTree, flattenFireTree, type FireTreeProject } from '../tree'
import type { FireDevice } from '../types'

describe('fire device tree', () => {
  it('builds Network > Panel > Loop > Device hierarchy by default', () => {
    const tree = buildFireDeviceTree({
      project: fixtureProject(),
      groupMode: 'loop',
      statusFilter: 'all'
    })

    expect(tree).toHaveLength(1)
    expect(tree[0].label).toBe('Main Network - sample.cpd')
    expect(tree[0].children[0].label).toBe('Panel 1')
    expect(tree[0].children[0].children.map((node) => node.label)).toEqual(['Loop 1', 'Loop 2'])
    expect(flattenFireTree(tree).filter((node) => node.kind === 'device')).toHaveLength(4)
  })

  it('filters by placement status and issue status', () => {
    const project = fixtureProject()

    const unplaced = buildFireDeviceTree({
      project,
      groupMode: 'loop',
      statusFilter: 'unplaced'
    })
    const issues = buildFireDeviceTree({
      project,
      groupMode: 'loop',
      statusFilter: 'issues'
    })

    expect(
      flattenFireTree(unplaced)
        .filter((node) => node.kind === 'device')
        .map((node) => node.deviceId)
    ).toEqual(['device-2'])
    expect(
      flattenFireTree(issues)
        .filter((node) => node.kind === 'device')
        .map((node) => node.deviceId)
    ).toEqual(['device-4'])
  })

  it('searches CPD fields used by the Device Tree', () => {
    const tree = buildFireDeviceTree({
      project: fixtureProject(),
      groupMode: 'loop',
      statusFilter: 'all',
      searchText: 'lobby'
    })

    expect(
      flattenFireTree(tree)
        .filter((node) => node.kind === 'device')
        .map((node) => node.deviceId)
    ).toEqual(['device-1'])
  })

  it('groups by Zone and hides devices without Zone configuration or pure output devices', () => {
    const tree = buildFireDeviceTree({
      project: fixtureProject(),
      groupMode: 'zone',
      statusFilter: 'all'
    })

    const groupLabels = flattenFireTree(tree)
      .filter((node) => node.kind === 'group')
      .map((node) => node.label)
    const deviceIds = flattenFireTree(tree)
      .filter((node) => node.kind === 'device')
      .map((node) => node.deviceId)

    expect(groupLabels).toEqual(['Zone 1', 'Zone 2'])
    expect(deviceIds).toEqual(['device-1', 'device-4'])
  })

  it('does not render Zone 0, group 0, or unassigned buckets in grouped views', () => {
    const project = fixtureProject()
    const panel = project.networks[0].panels[0]
    panel.zones = [
      {
        ...panel.zones[0],
        id: 'zone-0',
        zoneNumber: 0,
        text: 'Invalid zero Zone'
      },
      ...panel.zones
    ]
    panel.sounderGroups = [
      {
        ...panel.sounderGroups[0],
        id: 'sg-0',
        groupId: 0,
        title: 'Sounder Group 0'
      },
      ...panel.sounderGroups
    ]
    panel.ioGroups = [
      {
        ...panel.ioGroups[0],
        id: 'io-0',
        groupId: 0
      },
      ...panel.ioGroups
    ]
    project.devices = [
      makeDevice('zone-zero-input', 1, 50, 'manual_call_point', 'MCP Zero', {
        zoneNumber: 0
      }),
      makeDevice('sounder-zero', 1, 51, 'sounder', 'Sounder Zero', {
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        sounderGroupId: 0
      }),
      makeDevice('sounder-unassigned', 1, 52, 'sounder', 'Sounder Unassigned', {
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        sounderGroupId: undefined
      }),
      makeDevice('sounder-valid', 1, 30, 'sounder', 'Sounder Valid', {
        isInputCapable: false,
        isOutputCapable: true,
        isSounder: true,
        sounderGroupId: 7
      }),
      makeDevice('io-zero', 2, 53, 'input_output', 'I/O Zero', {
        isOutputCapable: true,
        ioGroupId: 0,
        zoneNumber: 2
      }),
      makeDevice('io-unassigned', 2, 54, 'input_output', 'I/O Unassigned', {
        isOutputCapable: true,
        ioGroupId: undefined,
        zoneNumber: 2
      }),
      makeDevice('io-valid', 2, 40, 'input_output', 'I/O Valid', {
        isOutputCapable: true,
        ioGroupId: 9,
        zoneNumber: 2
      })
    ]

    const zoneTree = buildFireDeviceTree({ project, groupMode: 'zone', statusFilter: 'all' })
    const sounderTree = buildFireDeviceTree({
      project,
      groupMode: 'sounderGroup',
      statusFilter: 'all'
    })
    const ioTree = buildFireDeviceTree({ project, groupMode: 'ioGroup', statusFilter: 'all' })

    expect(groupLabels(zoneTree)).toEqual(['Zone 2'])
    expect(deviceIds(zoneTree)).toEqual(['io-valid', 'io-zero', 'io-unassigned'])
    expect(groupLabels(sounderTree)).toEqual(['Sounder Group 7'])
    expect(deviceIds(sounderTree)).toEqual(['sounder-valid'])
    expect(groupLabels(ioTree)).toEqual(['I/O Group 9'])
    expect(deviceIds(ioTree)).toEqual(['io-valid'])
  })

  it('groups by Type using description or classify display names', () => {
    const tree = buildFireDeviceTree({
      project: fixtureProject(),
      groupMode: 'type',
      statusFilter: 'all'
    })

    expect(
      flattenFireTree(tree)
        .filter((node) => node.kind === 'group')
        .map((node) => node.label)
    ).toEqual(['I/O Module', 'Manual Call Point', 'Optical Detector', 'Sounder'])
  })

  it('groups Sounder and I/O views by configured group membership', () => {
    const project = fixtureProject()
    const sounderTree = buildFireDeviceTree({
      project,
      groupMode: 'sounderGroup',
      statusFilter: 'all'
    })
    const ioTree = buildFireDeviceTree({
      project,
      groupMode: 'ioGroup',
      statusFilter: 'all'
    })

    expect(
      flattenFireTree(sounderTree)
        .filter((node) => node.kind === 'device')
        .map((node) => node.deviceId)
    ).toEqual(['device-3'])
    expect(
      flattenFireTree(ioTree)
        .filter((node) => node.kind === 'device')
        .map((node) => node.deviceId)
    ).toEqual(['device-4'])
  })

  it('does not treat initiating-device direct output assignments as tree group membership', () => {
    const project = fixtureProject()
    project.devices!.push(
      makeDevice('direct-mcp-sg', 1, 31, 'manual_call_point', 'Direct MCP SG', {
        zoneNumber: 1,
        sounderGroupId: 7
      }),
      makeDevice('direct-mcp-io', 1, 32, 'manual_call_point', 'Direct MCP IO', {
        zoneNumber: 1,
        ioGroupId: 9
      })
    )

    const sounderTree = buildFireDeviceTree({
      project,
      groupMode: 'sounderGroup',
      statusFilter: 'all'
    })
    const ioTree = buildFireDeviceTree({ project, groupMode: 'ioGroup', statusFilter: 'all' })

    expect(deviceIds(sounderTree)).toEqual(['device-3'])
    expect(deviceIds(ioTree)).toEqual(['device-4'])
  })
})

function groupLabels(tree: ReturnType<typeof buildFireDeviceTree>): string[] {
  return flattenFireTree(tree)
    .filter((node) => node.kind === 'group')
    .map((node) => node.label)
}

function deviceIds(tree: ReturnType<typeof buildFireDeviceTree>): Array<string | undefined> {
  return flattenFireTree(tree)
    .filter((node) => node.kind === 'device')
    .map((node) => node.deviceId)
}

function fixtureProject(): FireTreeProject {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Project Alpha',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [
      {
        id: 'network-1',
        name: 'Main Network',
        sourceFileName: 'sample.cpd',
        sourceImportedAt: 1,
        sounderMode: 'Programmed',
        panels: [
          {
            id: 'panel-1',
            networkId: 'network-1',
            panelNumber: 1,
            panelName: 'Panel 1',
            panelModel: 'ControlPanel6002_N',
            general: {
              panelNumber: 1,
              sounderMode: 'Programmed',
              evacuateDelaySeconds: 0,
              sounderDelaySeconds: 0,
              inputOutputDelaySeconds: 0,
              fireBrigadeDelaySeconds: 0,
              onManualCallPoints: true,
              onTwoDevices: false,
              delayOffAtNight: false,
              raw: {}
            },
            loops: [
              {
                id: 'loop-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                loopId: 1,
                name: 'Loop 1',
                configuredDeviceOrder: ['device-1', 'device-2', 'device-3'],
                manualDeviceOrder: [],
                color: '#f00'
              },
              {
                id: 'loop-2',
                networkId: 'network-1',
                panelId: 'panel-1',
                loopId: 2,
                name: 'Loop 2',
                configuredDeviceOrder: ['device-4'],
                manualDeviceOrder: [],
                color: '#0f0'
              }
            ],
            zones: [
              {
                id: 'zone-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                zoneNumber: 1,
                text: 'Lobby',
                enabled: true,
                delayedSounders: false,
                alarmMode: 'single',
                visualAreas: [],
                raw: {}
              },
              {
                id: 'zone-2',
                networkId: 'network-1',
                panelId: 'panel-1',
                zoneNumber: 2,
                text: 'Plant Room',
                enabled: true,
                delayedSounders: false,
                alarmMode: 'single',
                visualAreas: [],
                raw: {}
              }
            ],
            sounderGroups: [
              {
                id: 'sg-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                groupId: 7,
                title: 'Sounder Group 7',
                addressableMembers: [{ loopId: 1, physicalAddress: 30, raw: {} }],
                nonAddressableMembers: [],
                raw: {}
              }
            ],
            ioGroups: [
              {
                id: 'io-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                groupId: 9,
                members: [{ loopId: 2, physicalAddress: 40, raw: {} }],
                raw: {}
              }
            ],
            sounders: { raw: {} }
          }
        ]
      }
    ],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#111',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: { timeScale: 1, soundEnabled: true },
    devices: [
      makeDevice('device-1', 1, 10, 'manual_call_point', 'Manual Call Point', {
        location: 'Lobby',
        zoneNumber: 1
      }),
      makeDevice('device-2', 1, 20, 'smoke_detector', 'Optical Detector', {
        placementStatus: 'unplaced'
      }),
      makeDevice('device-3', 1, 30, 'sounder', 'Sounder', {
        zoneNumber: 2,
        sounderGroupId: 7,
        isInputCapable: false,
        isSounder: true
      }),
      makeDevice('device-4', 2, 40, 'input_output', 'I/O Module', {
        zoneNumber: 2,
        ioGroupId: 9,
        isOutputCapable: true
      })
    ],
    issues: [
      {
        id: 'issue-1',
        code: 'device.zone-missing',
        severity: 'warning',
        message: 'Issue',
        relatedDeviceId: 'device-4'
      }
    ]
  }
}

function makeDevice(
  id: string,
  loopId: number,
  address: number,
  type: string,
  friendlyTypeName: string,
  overrides: Partial<FireDevice> & { placementStatus?: FireDevice['placement']['status'] } = {}
): FireDevice {
  const { placementStatus, ...deviceOverrides } = overrides

  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId,
    address,
    type,
    friendlyTypeName,
    description: friendlyTypeName,
    classify: friendlyTypeName,
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
      status: overrides.placement?.status ?? placementStatus ?? 'placed',
      buildingId: 'building-1',
      floorId: 'floor-1',
      position: { x: 0, y: 0, z: 0 }
    },
    raw: {},
    ...deviceOverrides
  } as FireDevice
}
