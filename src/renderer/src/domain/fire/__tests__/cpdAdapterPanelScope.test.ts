import { describe, expect, it } from 'vitest'

import { adaptCpdExport } from '../cpdAdapter'
import { fixture } from './cpdAdapter.fixture'

describe('adaptCpdExport panel scoping and defaults', () => {
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

  it('adds device-assigned output groups only for actual output group members when CPD group rows are missing', () => {
    const result = adaptCpdExport(
      {
        ...fixture,
        sounderGroups: [{ ...fixture.sounderGroups[0], groupId: 10, members: [] }],
        ioGroups: [],
        devices: [
          { ...fixture.devices[0], sounderGroup: 1, ioGroup: 2 },
          { ...fixture.devices[1], sounderGroup: 3, ioGroup: 4 },
          {
            ...fixture.devices[1],
            address: 90,
            type: 'sounder',
            classify: 'Sounder',
            description: 'Sounder',
            sounderGroup: 3,
            ioGroup: 0
          }
        ]
      },
      1234
    )

    const panel = result.network.panels[0]
    expect(panel.sounderGroups.map((group) => group.groupId)).toEqual([3, 10])
    expect(panel.sounderGroups.find((group) => group.groupId === 3)).toMatchObject({
      title: 'Sounder Group 3',
      addressableMembers: [{ loopId: 1, physicalAddress: 90 }]
    })
    expect(panel.ioGroups.map((group) => group.groupId)).toEqual([4])
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
