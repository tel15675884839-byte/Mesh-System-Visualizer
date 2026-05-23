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
    expect(result.devices.map((device) => device.sounderGroupId)).toEqual([
      undefined,
      undefined
    ])
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
