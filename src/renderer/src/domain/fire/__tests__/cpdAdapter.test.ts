import { describe, expect, it } from 'vitest'

import { adaptCpdExport } from '../cpdAdapter'
import { fixture } from './cpdAdapter.fixture'

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
})
