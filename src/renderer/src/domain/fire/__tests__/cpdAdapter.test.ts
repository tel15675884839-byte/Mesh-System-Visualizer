import { describe, expect, it } from 'vitest'

import { adaptCpdExport } from '../cpdAdapter'

const fixture = {
  schemaVersion: 1,
  extractor: { name: 'CpdExtractor', version: '1.0.0' },
  source: { fileName: 'sample.cpd', exportedAt: '2026-05-22T00:00:00.000Z' },
  panelCount: 1,
  panels: [
    {
      panelNumber: 1,
      panelModel: 'ControlPanel6002_N',
      general: {
        PanelNumber: 1,
        SounderMode: 'Programmed',
        FaultIOGroup: 5,
        SounderDelayMM: 1,
        SounderDelaySS: 30,
        InputOutputDelayMM: 0,
        InputOutputDelaySS: 15,
        FireBrigadeDelayMM: 2,
        FireBrigadeDelaySS: 0,
        EvacuteDelayMM: 0,
        EvacuteDelaySS: 20,
        OnManualCallPoints: true,
        OnTwoDevices: true
      }
    }
  ],
  devices: [
    {
      panelNumber: 1,
      panelId: 'panel-1',
      loopId: 1,
      address: 10,
      type: 'manual_call_point',
      classify: 'Manual Call Point',
      description: 'MCP',
      location: 'Lobby',
      zone: 3,
      sounderGroup: 7,
      ioGroup: 9,
      disabled: false,
      inhibitSounders: false,
      inhibitIO: false,
      overrideDelays: false,
      immediateEvacuate: true,
      raw: { PhysicalAddress: 10 }
    },
    {
      panelNumber: 1,
      panelId: 'panel-1',
      loopId: 1,
      address: 11,
      type: 'input_output',
      classify: 'I/O',
      description: 'I/O',
      location: 'Lobby',
      zone: 3,
      sounderGroup: 7,
      ioGroup: 9,
      disabled: false,
      inhibitSounders: false,
      inhibitIO: false,
      overrideDelays: false,
      immediateEvacuate: false,
      raw: { PhysicalAddress: 11 }
    }
  ],
  zones: [
    {
      panelNumber: 1,
      zoneNumber: 3,
      text: 'Lobby',
      enabled: true,
      delayedSounders: true,
      alarmMode: 'double',
      sounderGroupAlarm1: 7,
      sounderGroupAlarm2: 8,
      ioGroup1Alarm1: 9,
      ioGroup1Alarm2: 10,
      raw: {}
    }
  ],
  sounderGroups: [
    {
      panelNumber: 1,
      groupId: 7,
      title: 'SG7',
      description: 'Main sounders',
      members: [{ loopId: 1, physicalAddress: 11, status: 'enabled', raw: {} }],
      raw: {}
    }
  ],
  ioGroups: [
    {
      panelNumber: 1,
      groupId: 9,
      members: [{ entry: 1, loopId: 1, physicalAddress: 10, description: 'I/O', raw: {} }],
      raw: {}
    }
  ]
}

describe('adaptCpdExport', () => {
  it('creates one network from the source file and maps panel general configuration', () => {
    const result = adaptCpdExport(fixture, 1234)

    expect(result.projectName).toBe('sample')
    expect(result.network).toMatchObject({
      id: 'network-sample-1234',
      name: 'sample',
      sourceFileName: 'sample.cpd',
      sourceImportedAt: Date.parse('2026-05-22T00:00:00.000Z'),
      extractorVersion: '1.0.0',
      sounderMode: 'Programmed'
    })
    expect(result.network.panels).toHaveLength(1)
    expect(result.network.panels[0]).toMatchObject({
      id: 'network-sample-1234-panel-1',
      panelNumber: 1,
      panelName: 'Panel 1',
      panelModel: 'ControlPanel6002_N',
      general: {
        panelNumber: 1,
        sounderMode: 'Programmed',
        faultIOGroup: 5,
        sounderDelaySeconds: 90,
        inputOutputDelaySeconds: 15,
        fireBrigadeDelaySeconds: 120,
        evacuateDelaySeconds: 20,
        onManualCallPoints: true,
        onTwoDevices: true
      }
    })
    expect(result.network.panels[0].general.raw).toEqual(fixture.panels[0].general)
  })

  it('creates multiple panels when the extractor has multiple control panels', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        panelCount: 2,
        panels: [
          ...fixture.panels,
          {
            panelNumber: 2,
            panelModel: 'ControlPanel6004_N',
            general: { PanelNumber: 2, SounderMode: 'Preset' }
          }
        ]
      },
      1234
    )

    expect(result.network.panels.map((panel) => panel.id)).toEqual([
      'network-sample-1234-panel-1',
      'network-sample-1234-panel-2'
    ])
    expect(result.network.panels[1]).toMatchObject({
      panelName: 'Panel 2',
      panelModel: 'ControlPanel6004_N',
      general: { sounderMode: 'Preset' }
    })
  })

  it('maps numeric CPD SounderMode values without warning noise', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        panelCount: 2,
        panels: [
          {
            ...fixture.panels[0],
            general: { ...fixture.panels[0].general, SounderMode: 0 }
          },
          {
            panelNumber: 2,
            panelModel: 'ControlPanel6004_N',
            general: { PanelNumber: 2, SounderMode: 1 }
          }
        ]
      },
      1234
    )

    expect(result.network.panels[0].general.sounderMode).toBe('Programmed')
    expect(result.network.panels[1].general.sounderMode).toBe('Preset')
    expect(result.issues.map((issue) => issue.code)).not.toContain('sounder-mode-unknown')
  })

  it('normalizes device ids by panel, loop, and address and preserves raw rows', () => {
    const result = adaptCpdExport(fixture, 1234)

    expect(result.devices[0]).toMatchObject({
      id: 'network-sample-1234-panel-1-loop-1-addr-10',
      networkId: 'network-sample-1234',
      panelId: 'network-sample-1234-panel-1',
      panelNumber: 1,
      loopId: 1,
      address: 10,
      type: 'manual_call_point',
      friendlyTypeName: 'Manual Call Point',
      zoneNumber: 3,
      sounderGroupId: 7,
      ioGroupId: 9,
      isInputCapable: true,
      isOutputCapable: false,
      disabled: false,
      immediateEvacuate: true,
      placement: { status: 'unplaced' },
      raw: fixture.devices[0].raw
    })
    expect(result.network.panels[0].loops[0]).toMatchObject({
      id: 'network-sample-1234-panel-1-loop-1',
      loopId: 1,
      configuredDeviceOrder: [
        'network-sample-1234-panel-1-loop-1-addr-10',
        'network-sample-1234-panel-1-loop-1-addr-11'
      ],
      manualDeviceOrder: []
    })
  })

  it('treats input/output devices as both input and output capable', () => {
    const result = adaptCpdExport(fixture, 1234)
    const ioDevice = result.devices.find((device) => device.type === 'input_output')

    expect(ioDevice).toMatchObject({
      friendlyTypeName: 'Input/Output',
      isInputCapable: true,
      isOutputCapable: true,
      isSounder: false
    })
  })

  it('treats SelectedDisablement as a disabled device source', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        devices: [
          {
            ...fixture.devices[0],
            disabled: false,
            selectedDisablement: true,
            raw: {
              ...fixture.devices[0].raw,
              DeviceDisabled: false,
              SelectedDisablement: true
            }
          }
        ]
      },
      1234
    )

    expect(result.devices[0]).toMatchObject({
      disabled: true
    })
  })

  it('maps zone, sounder group, and I/O group data onto the panel', () => {
    const result = adaptCpdExport(fixture, 1234)
    const panel = result.network.panels[0]

    expect(panel.zones[0]).toMatchObject({
      id: 'network-sample-1234-panel-1-zone-3',
      zoneNumber: 3,
      text: 'Lobby',
      enabled: true,
      delayedSounders: true,
      alarmMode: 'double',
      sounderGroupAlarm1: 7,
      sounderGroupAlarm2: 8,
      ioGroup1Alarm1: 9,
      ioGroup1Alarm2: 10,
      visualAreas: [],
      raw: fixture.zones[0].raw
    })
    expect(panel.sounderGroups[0]).toMatchObject({
      id: 'network-sample-1234-panel-1-sounder-group-7',
      groupId: 7,
      title: 'SG7',
      addressableMembers: fixture.sounderGroups[0].members,
      nonAddressableMembers: [],
      raw: fixture.sounderGroups[0].raw
    })
    expect(panel.ioGroups[0]).toMatchObject({
      id: 'network-sample-1234-panel-1-io-group-9',
      groupId: 9,
      members: [
        {
          loopId: 1,
          physicalAddress: 10,
          description: 'I/O',
          raw: fixture.ioGroups[0].members[0].raw
        }
      ],
      raw: fixture.ioGroups[0].raw
    })
  })

  it('preserves non-addressable sounder channel modes from CPD sounder groups', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        sounderGroups: [
          {
            ...fixture.sounderGroups[0],
            raw: {
              GroupId: 7,
              CIE: 1,
              NonAddressable1: 'Intermittent',
              NonAddressable2: 'Silent'
            }
          }
        ]
      },
      1234
    )

    expect(result.network.panels[0].sounderGroups[0].nonAddressableMembers).toEqual([
      {
        cieId: 1,
        nonAddressable1: true,
        status: 'Intermittent',
        raw: {
          CIE: 1,
          channel: 'nonAddressable1',
          status: 'Intermittent'
        }
      },
      {
        cieId: 1,
        nonAddressable2: true,
        status: 'Silent',
        raw: {
          CIE: 1,
          channel: 'nonAddressable2',
          status: 'Silent'
        }
      }
    ])
  })

  it('normalizes CPD relation fields from raw and legacy group member tables', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        devices: [
          {
            panelNumber: 1,
            loopId: 1,
            address: 20,
            type: 'manual_call_point',
            raw: {
              Zone: 6,
              SounderGroup: 12,
              IOGroup: 14,
              InhibitIO: true,
              OverrideDelays: true
            }
          }
        ],
        zones: [
          {
            panelNumber: 1,
            zoneNumber: 6,
            text: 'Raw zone links',
            raw: {
              SounderGroupAlarm1: 12,
              IOGroup1Alarm1: 14,
              DelayedSounders: true,
              ZoneEnabled: true
            }
          }
        ],
        sounderGroups: [
          {
            panelNumber: 1,
            groupId: 12,
            GDataDetail: [{ Loop: 1, PhysicalAddress: 20, Description: 'Legacy SG member' }],
            raw: { source: 'GDataDetail' }
          }
        ],
        ioGroups: [
          {
            panelNumber: 1,
            groupId: 14,
            GDataDetail: [{ LoopID: 1, Address: 20, Description: 'Legacy IO member' }],
            raw: { source: 'GDataDetail' }
          }
        ]
      },
      1234
    )

    const panel = result.network.panels[0]

    expect(result.devices[0]).toMatchObject({
      zoneNumber: 6,
      sounderGroupId: 12,
      ioGroupId: 14,
      inhibitIO: true,
      overrideDelays: true
    })
    expect(panel.zones[0]).toMatchObject({
      zoneNumber: 6,
      delayedSounders: true,
      sounderGroupAlarm1: 12,
      ioGroup1Alarm1: 14
    })
    expect(panel.sounderGroups[0].addressableMembers).toEqual([
      expect.objectContaining({
        loopId: 1,
        physicalAddress: 20,
        description: 'Legacy SG member'
      })
    ])
    expect(panel.ioGroups[0].members).toEqual([
      expect.objectContaining({
        loopId: 1,
        physicalAddress: 20,
        description: 'Legacy IO member'
      })
    ])
  })

  it('keeps extractor Zone and Group rows when only the single panel is present', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        zones: [
          {
            zoneNumber: 1,
            text: '1st Floor',
            enabled: true,
            delayedSounders: false,
            sounderGroupAlarm1: 1,
            sounderGroupAlarm2: 10,
            ioGroup1Alarm1: 1,
            ioGroup1Alarm2: 2,
            raw: {}
          },
          {
            zoneNumber: 2,
            text: '2nd Floor',
            enabled: true,
            delayedSounders: false,
            sounderGroupAlarm1: 2,
            raw: {}
          }
        ],
        sounderGroups: [
          {
            groupId: 10,
            title: 'All Evacuation',
            members: [{ panelNumber: 1, loopId: 1, physicalAddress: 94, raw: {} }],
            raw: {}
          }
        ],
        ioGroups: [
          {
            groupId: 1,
            members: [{ panelNumber: 1, entry: 1, loopId: 1, physicalAddress: 7, raw: {} }],
            raw: {}
          }
        ]
      },
      1234
    )

    const panel = result.network.panels[0]
    expect(panel.zones).toMatchObject([
      {
        zoneNumber: 1,
        text: '1st Floor',
        sounderGroupAlarm1: 1,
        sounderGroupAlarm2: 10,
        ioGroup1Alarm1: 1,
        ioGroup1Alarm2: 2
      },
      {
        zoneNumber: 2,
        text: '2nd Floor',
        sounderGroupAlarm1: 2
      }
    ])
    expect(panel.sounderGroups.map((group) => group.groupId)).toEqual([7, 10])
    expect(panel.sounderGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: 10,
          addressableMembers: [expect.objectContaining({ loopId: 1, physicalAddress: 94 })]
        })
      ])
    )
    expect(panel.ioGroups.map((group) => group.groupId)).toEqual([1, 9])
    expect(panel.ioGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: 1,
          members: [expect.objectContaining({ loopId: 1, physicalAddress: 7 })]
        })
      ])
    )
  })

  it('assigns extractor rows without top-level panel numbers using panel-scoped devices and members', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        panelCount: 2,
        panels: [
          fixture.panels[0],
          {
            panelNumber: 2,
            panelModel: 'ControlPanel6004_N',
            general: { PanelNumber: 2, SounderMode: 'Programmed' }
          }
        ],
        devices: [
          {
            panelNumber: 1,
            loopId: 1,
            address: 10,
            type: 'manual_call_point',
            zone: 1,
            raw: { PhysicalAddress: 10 }
          },
          {
            panelNumber: 1,
            loopId: 1,
            address: 90,
            type: 'sounder',
            zone: 1,
            sounderGroup: 5,
            raw: { PhysicalAddress: 90 }
          },
          {
            panelNumber: 1,
            loopId: 1,
            address: 91,
            type: 'input_output',
            zone: 1,
            ioGroup: 6,
            raw: { PhysicalAddress: 91 }
          },
          {
            panelNumber: 2,
            loopId: 1,
            address: 10,
            type: 'manual_call_point',
            zone: 2,
            raw: { PhysicalAddress: 10 }
          },
          {
            panelNumber: 2,
            loopId: 1,
            address: 90,
            type: 'sounder',
            zone: 2,
            sounderGroup: 5,
            raw: { PhysicalAddress: 90 }
          },
          {
            panelNumber: 2,
            loopId: 1,
            address: 91,
            type: 'input_output',
            zone: 2,
            ioGroup: 6,
            raw: { PhysicalAddress: 91 }
          }
        ],
        zones: [
          {
            zoneNumber: 1,
            text: 'Panel 1 zone',
            enabled: true,
            sounderGroupAlarm1: 5,
            ioGroup1Alarm1: 6,
            raw: {}
          },
          {
            zoneNumber: 2,
            text: 'Panel 2 zone',
            enabled: true,
            sounderGroupAlarm1: 5,
            ioGroup1Alarm1: 6,
            raw: {}
          }
        ],
        sounderGroups: [
          {
            groupId: 5,
            title: 'Configured sounder group',
            members: [
              {
                panelNumber: 1,
                loopId: 1,
                physicalAddress: 90,
                description: 'Panel 1 sounder member',
                raw: {}
              },
              {
                panelNumber: 2,
                loopId: 1,
                physicalAddress: 90,
                description: 'Panel 2 sounder member',
                raw: {}
              }
            ],
            raw: {}
          }
        ],
        ioGroups: [
          {
            groupId: 6,
            members: [
              {
                panelNumber: 1,
                loopId: 1,
                physicalAddress: 91,
                description: 'Panel 1 IO member',
                raw: {}
              },
              {
                panelNumber: 2,
                loopId: 1,
                physicalAddress: 91,
                description: 'Panel 2 IO member',
                raw: {}
              }
            ],
            raw: {}
          }
        ]
      },
      1234
    )

    const panel1 = result.network.panels[0]
    const panel2 = result.network.panels[1]

    expect(panel1.zones.find((zone) => zone.zoneNumber === 1)).toMatchObject({
      text: 'Panel 1 zone',
      sounderGroupAlarm1: 5,
      ioGroup1Alarm1: 6
    })
    expect(panel2.zones.find((zone) => zone.zoneNumber === 2)).toMatchObject({
      text: 'Panel 2 zone',
      sounderGroupAlarm1: 5,
      ioGroup1Alarm1: 6
    })
    expect(panel1.sounderGroups.find((group) => group.groupId === 5)).toMatchObject({
      title: 'Configured sounder group',
      addressableMembers: [
        expect.objectContaining({
          loopId: 1,
          physicalAddress: 90,
          description: 'Panel 1 sounder member'
        })
      ]
    })
    expect(panel2.sounderGroups.find((group) => group.groupId === 5)).toMatchObject({
      title: 'Configured sounder group',
      addressableMembers: [
        expect.objectContaining({
          loopId: 1,
          physicalAddress: 90,
          description: 'Panel 2 sounder member'
        })
      ]
    })
    expect(panel1.ioGroups.find((group) => group.groupId === 6)?.members).toEqual([
      expect.objectContaining({
        loopId: 1,
        physicalAddress: 91,
        description: 'Panel 1 IO member'
      })
    ])
    expect(panel2.ioGroups.find((group) => group.groupId === 6)?.members).toEqual([
      expect.objectContaining({
        loopId: 1,
        physicalAddress: 91,
        description: 'Panel 2 IO member'
      })
    ])
  })

  it('keeps only configured or device-referenced CPD zones', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        devices: [
          { ...fixture.devices[0], zone: 1 },
          { ...fixture.devices[1], zone: 3 }
        ],
        zones: [
          { ...fixture.zones[0], zoneNumber: 1, text: '1st Floor' },
          { ...fixture.zones[0], zoneNumber: 2, text: '2nd Floor' },
          { ...fixture.zones[0], zoneNumber: 3, text: '3rd Floor' },
          {
            ...fixture.zones[0],
            zoneNumber: 4,
            text: '',
            sounderGroupAlarm1: 0,
            sounderGroupAlarm2: 0,
            ioGroup1Alarm1: 0,
            ioGroup1Alarm2: 0
          },
          {
            ...fixture.zones[0],
            zoneNumber: 5,
            text: '',
            sounderGroupAlarm1: 0,
            sounderGroupAlarm2: 0,
            ioGroup1Alarm1: 0,
            ioGroup1Alarm2: 0
          }
        ]
      },
      1234
    )

    expect(result.network.panels[0].zones.map((zone) => zone.zoneNumber)).toEqual([1, 2, 3])
  })

  it('keeps output-configured CPD zones even when they have no text or current devices', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        zones: [
          { ...fixture.zones[0], zoneNumber: 1, text: 'Device zone' },
          {
            zoneNumber: 8,
            text: '',
            enabled: true,
            sounderGroupAlarm1: 7,
            ioGroup1Alarm1: 9,
            raw: {}
          }
        ]
      },
      1234
    )

    expect(result.network.panels[0].zones.find((zone) => zone.zoneNumber === 8)).toMatchObject({
      sounderGroupAlarm1: 7,
      ioGroup1Alarm1: 9
    })
  })

  it('synthesizes panel zones from device zone assignments when CPD zone rows are missing', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        zones: [],
        devices: [
          { ...fixture.devices[0], zone: 1 },
          { ...fixture.devices[1], zone: 3 }
        ]
      },
      1234
    )

    expect(result.network.panels[0].zones).toMatchObject([
      { zoneNumber: 1, text: 'Zone 1' },
      { zoneNumber: 3, text: 'Zone 3' }
    ])
  })

  it('adds device-assigned sounder and I/O groups when CPD group rows are missing', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        sounderGroups: [{ ...fixture.sounderGroups[0], groupId: 10, members: [] }],
        ioGroups: [],
        devices: [
          { ...fixture.devices[0], sounderGroup: 1, ioGroup: 2 },
          { ...fixture.devices[1], sounderGroup: 3, ioGroup: 4 }
        ]
      },
      1234
    )

    const panel = result.network.panels[0]
    expect(panel.sounderGroups.map((group) => group.groupId)).toEqual([1, 3, 10])
    expect(panel.sounderGroups.find((group) => group.groupId === 1)).toMatchObject({
      title: 'Sounder Group 1',
      addressableMembers: [{ loopId: 1, physicalAddress: 10 }]
    })
    expect(panel.ioGroups.map((group) => group.groupId)).toEqual([2, 4])
    expect(panel.ioGroups.find((group) => group.groupId === 4)).toMatchObject({
      members: [{ loopId: 1, physicalAddress: 11 }]
    })
  })

  it('extracts valid non-zero Zone, Sounder Group, and I/O Group values from CPD-like strings', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        devices: [
          {
            ...fixture.devices[0],
            zone: ' 12 ',
            sounderGroup: ' 34 ',
            ioGroup: ' 56 '
          }
        ],
        zones: [
          {
            ...fixture.zones[0],
            zoneNumber: '12',
            sounderGroupAlarm1: '34',
            sounderGroupAlarm2: '35',
            ioGroup1Alarm1: '56',
            ioGroup1Alarm2: '57'
          }
        ],
        sounderGroups: [{ ...fixture.sounderGroups[0], groupId: '34' }],
        ioGroups: [{ ...fixture.ioGroups[0], groupId: '56' }]
      },
      1234
    )

    expect(result.devices[0]).toMatchObject({
      zoneNumber: 12,
      sounderGroupId: 34,
      ioGroupId: 56
    })
    expect(result.network.panels[0].zones[0]).toMatchObject({
      zoneNumber: 12,
      sounderGroupAlarm1: 34,
      sounderGroupAlarm2: 35,
      ioGroup1Alarm1: 56,
      ioGroup1Alarm2: 57
    })
    expect(result.network.panels[0].sounderGroups.map((group) => group.groupId)).toEqual([34])
    expect(result.network.panels[0].ioGroups.map((group) => group.groupId)).toEqual([56])
  })

  it('treats zero, empty, missing, and unparseable group values as unassigned', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        devices: [
          {
            ...fixture.devices[0],
            zone: 0,
            sounderGroup: '',
            ioGroup: 'not-a-number'
          },
          {
            ...fixture.devices[1],
            zone: '0',
            sounderGroup: 0,
            ioGroup: undefined
          }
        ],
        zones: [
          { ...fixture.zones[0], zoneNumber: 0 },
          { ...fixture.zones[0], zoneNumber: 'not-a-number' },
          {
            ...fixture.zones[0],
            zoneNumber: 4,
            sounderGroupAlarm1: 0,
            sounderGroupAlarm2: '',
            ioGroup1Alarm1: '0',
            ioGroup1Alarm2: 'not-a-number'
          }
        ],
        sounderGroups: [
          { ...fixture.sounderGroups[0], groupId: 0 },
          { ...fixture.sounderGroups[0], groupId: '' },
          { ...fixture.sounderGroups[0], groupId: 'not-a-number' }
        ],
        ioGroups: [
          { ...fixture.ioGroups[0], groupId: 0 },
          { ...fixture.ioGroups[0], groupId: '' },
          { ...fixture.ioGroups[0], groupId: 'not-a-number' }
        ]
      },
      1234
    )

    expect(result.devices.map((device) => device.zoneNumber)).toEqual([undefined, undefined])
    expect(result.devices.map((device) => device.sounderGroupId)).toEqual([undefined, undefined])
    expect(result.devices.map((device) => device.ioGroupId)).toEqual([undefined, undefined])
    expect(result.network.panels[0].zones).toHaveLength(1)
    expect(result.network.panels[0].zones[0]).toMatchObject({
      zoneNumber: 4,
      sounderGroupAlarm1: undefined,
      sounderGroupAlarm2: undefined,
      ioGroup1Alarm1: undefined,
      ioGroup1Alarm2: undefined
    })
    expect(result.network.panels[0].sounderGroups).toEqual([])
    expect(result.network.panels[0].ioGroups).toEqual([])
  })

  it('defaults unknown sounder mode to Programmed and records an issue', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        panels: [
          {
            ...fixture.panels[0],
            general: { ...fixture.panels[0].general, SounderMode: 'Mystery' }
          }
        ]
      },
      1234
    )

    expect(result.network.sounderMode).toBe('Programmed')
    expect(result.network.panels[0].general.sounderMode).toBe('Programmed')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sounder-mode-unknown:network-sample-1234-panel-1',
          code: 'sounder-mode-unknown',
          severity: 'warning',
          targetId: 'network-sample-1234-panel-1'
        })
      ])
    )
  })

  it('defaults unresolved zone alarm mode to single and records an issue', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        zones: [{ ...fixture.zones[0], alarmMode: 'triple' }]
      },
      1234
    )

    expect(result.network.panels[0].zones[0].alarmMode).toBe('single')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'zone.alarm-mode-unresolved:network-sample-1234-panel-1-zone-3',
          code: 'zone.alarm-mode-unresolved',
          severity: 'warning',
          targetId: 'network-sample-1234-panel-1-zone-3'
        })
      ])
    )
  })
})
