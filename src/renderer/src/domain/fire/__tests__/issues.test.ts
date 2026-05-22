import { describe, expect, it } from 'vitest'

import { collectFireProjectIssues } from '../issues'
import type {
  FireDevice,
  FireProject,
  FireIssue,
  FirePanel,
  NonAddressableSounderPoint
} from '../types'

type ActiveNonAddressableSounder = Pick<
  NonAddressableSounderPoint,
  'networkId' | 'panelId' | 'sounderGroupId' | 'cieId' | 'channel'
>

type IssueFixtureProject = FireProject & {
  devices: FireDevice[]
  nonAddressableSounderPoints?: NonAddressableSounderPoint[]
  activeNonAddressableSounders?: ActiveNonAddressableSounder[]
}

const basePanel: FirePanel = {
  id: 'panel-1',
  networkId: 'network-1',
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
  loops: [
    {
      id: 'loop-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      loopId: 1,
      name: 'Loop 1',
      configuredDeviceOrder: ['device-ok'],
      manualDeviceOrder: [],
      color: '#2563eb'
    }
  ],
  zones: [
    {
      id: 'zone-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      zoneNumber: 1,
      text: 'Zone 1',
      enabled: true,
      delayedSounders: false,
      alarmMode: 'single',
      visualAreas: [],
      raw: {}
    }
  ],
  sounderGroups: [
    {
      id: 'sounder-group-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      groupId: 1,
      addressableMembers: [],
      nonAddressableMembers: [{ cieId: 1, nonAddressable1: true, raw: {} }],
      raw: {}
    }
  ],
  ioGroups: [
    {
      id: 'io-group-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      groupId: 1,
      members: [],
      raw: {}
    }
  ],
  sounders: { raw: {} }
}

function makeDevice(overrides: Partial<FireDevice> = {}): FireDevice {
  return {
    id: 'device-ok',
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 10,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    zoneNumber: 1,
    sounderGroupId: 1,
    ioGroupId: 1,
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

function makeProject(overrides: Partial<IssueFixtureProject> = {}): IssueFixtureProject {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Project',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [
      {
        id: 'network-1',
        name: 'Network 1',
        sourceFileName: 'sample.cpd',
        sourceImportedAt: 1,
        sounderMode: 'Programmed',
        panels: [basePanel]
      }
    ],
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
    simulationSettings: { timeScale: 1, soundEnabled: true },
    devices: [makeDevice()],
    ...overrides
  }
}

function issueByCode(issues: FireIssue[], code: string): FireIssue {
  const issue = issues.find((candidate) => candidate.code === code)

  if (!issue) {
    throw new Error(`Expected issue code ${code}`)
  }

  return issue
}

describe('collectFireProjectIssues', () => {
  it('reports devices missing Loop or Address as errors', () => {
    const project = makeProject({
      devices: [
        makeDevice({ id: 'missing-loop', loopId: undefined }),
        makeDevice({ id: 'missing-address', address: undefined })
      ]
    })

    const issues = collectFireProjectIssues(project)

    expect(issues.filter((issue) => issue.code === 'device.missing-loop-address')).toEqual([
      expect.objectContaining({
        id: 'device.missing-loop-address:missing-loop',
        severity: 'error',
        relatedDeviceId: 'missing-loop',
        relatedPanelId: 'panel-1'
      }),
      expect.objectContaining({
        id: 'device.missing-loop-address:missing-address',
        severity: 'error',
        relatedDeviceId: 'missing-address',
        relatedPanelId: 'panel-1'
      })
    ])
  })

  it('reports placed devices whose CPD source is missing', () => {
    const project = makeProject({
      devices: [
        makeDevice({
          id: 'removed-device',
          placement: { status: 'missing', buildingId: 'building-1', floorId: 'floor-1' }
        })
      ]
    })

    expect(
      issueByCode(collectFireProjectIssues(project), 'device.source-missing-placed')
    ).toMatchObject({
      severity: 'warning',
      relatedDeviceId: 'removed-device',
      relatedPanelId: 'panel-1'
    })
  })

  it('reports missing Zone, Sounder Group, and I/O Group references', () => {
    const project = makeProject({
      devices: [makeDevice({ id: 'bad-refs', zoneNumber: 99, sounderGroupId: 77, ioGroupId: 66 })]
    })

    const issues = collectFireProjectIssues(project)

    expect(issueByCode(issues, 'device.zone-missing')).toMatchObject({
      severity: 'warning',
      relatedDeviceId: 'bad-refs',
      relatedZoneId: 'panel-1-zone-99'
    })
    expect(issueByCode(issues, 'device.sounder-group-missing')).toMatchObject({
      severity: 'warning',
      relatedDeviceId: 'bad-refs',
      relatedGroupId: 'panel-1-sounder-group-77'
    })
    expect(issueByCode(issues, 'device.io-group-missing')).toMatchObject({
      severity: 'warning',
      relatedDeviceId: 'bad-refs',
      relatedGroupId: 'panel-1-io-group-66'
    })
  })

  it('reports manual Loop segments that reference unplaced devices', () => {
    const panelWithManualOrder: FirePanel = {
      ...basePanel,
      loops: [{ ...basePanel.loops[0], manualDeviceOrder: ['placed-a', 'unplaced-b'] }]
    }
    const project = makeProject({
      networks: [{ ...makeProject().networks[0], panels: [panelWithManualOrder] }],
      devices: [
        makeDevice({
          id: 'placed-a',
          placement: {
            status: 'placed',
            buildingId: 'building-1',
            floorId: 'floor-1',
            position: { x: 1, y: 2, z: 0 }
          }
        }),
        makeDevice({ id: 'unplaced-b', placement: { status: 'unplaced' } })
      ]
    })

    expect(
      issueByCode(collectFireProjectIssues(project), 'loop.manual-order-unplaced-device')
    ).toMatchObject({
      severity: 'warning',
      relatedLoopId: 'loop-1',
      relatedPanelId: 'panel-1',
      relatedDeviceId: 'unplaced-b'
    })
  })

  it('reports active non-addressable sounders without representative points', () => {
    const project = makeProject({
      activeNonAddressableSounders: [
        {
          networkId: 'network-1',
          panelId: 'panel-1',
          sounderGroupId: 1,
          cieId: 1,
          channel: 'nonAddressable1'
        }
      ],
      nonAddressableSounderPoints: []
    })

    expect(
      issueByCode(collectFireProjectIssues(project), 'sounder.non-addressable-no-point')
    ).toMatchObject({
      severity: 'info',
      relatedPanelId: 'panel-1',
      relatedGroupId: 'panel-1-sounder-group-1'
    })
  })

  it('uses distinct stable issue ids for active non-addressable sounders in the same group', () => {
    const project = makeProject({
      activeNonAddressableSounders: [
        {
          networkId: 'network-1',
          panelId: 'panel-1',
          sounderGroupId: 1,
          cieId: 1,
          channel: 'nonAddressable1'
        },
        {
          networkId: 'network-1',
          panelId: 'panel-1',
          sounderGroupId: 1,
          cieId: 2,
          channel: 'nonAddressable2'
        }
      ],
      nonAddressableSounderPoints: []
    })

    const issueIds = collectFireProjectIssues(project)
      .filter((issue) => issue.code === 'sounder.non-addressable-no-point')
      .map((issue) => issue.id)

    expect(issueIds).toEqual([
      'sounder.non-addressable-no-point:panel-1-sounder-group-1:cie-1:nonAddressable1',
      'sounder.non-addressable-no-point:panel-1-sounder-group-1:cie-2:nonAddressable2'
    ])
    expect(new Set(issueIds).size).toBe(issueIds.length)
  })

  it('does not report active non-addressable sounders with representative points', () => {
    const project = makeProject({
      activeNonAddressableSounders: [
        {
          networkId: 'network-1',
          panelId: 'panel-1',
          sounderGroupId: 1,
          cieId: 1,
          channel: 'nonAddressable1'
        }
      ],
      nonAddressableSounderPoints: [
        {
          id: 'point-1',
          networkId: 'network-1',
          panelId: 'panel-1',
          sounderGroupId: 1,
          cieId: 1,
          channel: 'nonAddressable1',
          label: 'CIE 1 NAC 1',
          placement: {
            status: 'placed',
            buildingId: 'building-1',
            floorId: 'floor-1',
            position: { x: 1, y: 2, z: 0 }
          }
        }
      ]
    })

    expect(
      collectFireProjectIssues(project).some(
        (issue) => issue.code === 'sounder.non-addressable-no-point'
      )
    ).toBe(false)
  })
})
