import { describe, expect, it } from 'vitest'

import { adaptCpdExport } from '../cpdAdapter'
import {
  auditCpdRelations,
  countAdaptedCpdRelations,
  countExtractorCpdRelations
} from '../cpdRelationAudit'

const extractorFixture = {
  schemaVersion: 1,
  extractor: { name: 'CpdExtractor', version: '1.0.0' },
  source: { fileName: 'audit-sample.cpd', exportedAt: '2026-05-23T00:00:00.000Z' },
  panels: [{ panelNumber: 1, general: { PanelNumber: 1, SounderMode: 'Programmed' } }],
  zones: [
    {
      panelNumber: 1,
      zoneNumber: 3,
      text: 'Lobby',
      enabled: true,
      sounderGroupAlarm1: 4,
      ioGroup1Alarm1: 2
    }
  ],
  sounderGroups: [
    {
      panelNumber: 1,
      groupId: 4,
      members: [{ loopId: 1, physicalAddress: 7, status: 'enabled', raw: {} }]
    }
  ],
  ioGroups: [
    {
      panelNumber: 1,
      groupId: 2,
      members: [{ loopId: 1, physicalAddress: 8, status: 'enabled', raw: {} }]
    }
  ],
  devices: [
    {
      panelNumber: 1,
      loopId: 1,
      address: 7,
      type: 'sounder',
      zone: 3,
      sounderGroup: 4,
      disabled: false,
      inhibitSounders: true,
      raw: { InhibitSounders: true }
    },
    {
      panelNumber: 1,
      loopId: 1,
      address: 8,
      type: 'input_output',
      zone: 3,
      ioGroup: 2,
      disabled: true,
      overrideDelays: true,
      raw: { DeviceDisabled: true, OverrideDelays: true }
    }
  ]
}

describe('CPD relation audit', () => {
  it('counts CPD relation categories from extractor-shaped data', () => {
    expect(countExtractorCpdRelations(extractorFixture)).toMatchObject({
      zoneToSounderGroupLinks: 1,
      zoneToIOGroupLinks: 1,
      sounderGroupMembers: 1,
      ioGroupMembers: 1,
      deviceZoneAssignments: 2,
      deviceSounderGroupAssignments: 1,
      deviceIOGroupAssignments: 1,
      disableOrInhibitFields: 2,
      delayOrOverrideFields: 1
    })
  })

  it('counts the same relation categories after adapter normalization', () => {
    const adapted = adaptCpdExport(extractorFixture, 1000)

    expect(
      countAdaptedCpdRelations({ network: adapted.network, devices: adapted.devices })
    ).toMatchObject({
      zoneToSounderGroupLinks: 1,
      zoneToIOGroupLinks: 1,
      sounderGroupMembers: 1,
      ioGroupMembers: 1,
      deviceZoneAssignments: 2,
      deviceSounderGroupAssignments: 1,
      deviceIOGroupAssignments: 1,
      disableOrInhibitFields: 2,
      delayOrOverrideFields: 1
    })
  })

  it('does not double count adapted typed fields that are also present in raw CPD data', () => {
    const adapted = adaptCpdExport(
      {
        ...extractorFixture,
        zones: [
          {
            ...extractorFixture.zones[0],
            raw: {
              SounderGroupAlarm1: 4,
              IOGroup1Alarm1: 2
            }
          }
        ]
      },
      1000
    )

    expect(
      countAdaptedCpdRelations({ network: adapted.network, devices: adapted.devices })
    ).toMatchObject({
      zoneToSounderGroupLinks: 1,
      zoneToIOGroupLinks: 1
    })
  })

  it('classifies relation losses between extractor and adapted project layers', () => {
    const adapted = adaptCpdExport(
      {
        ...extractorFixture,
        sounderGroups: [],
        ioGroups: []
      },
      1000
    )

    const report = auditCpdRelations(extractorFixture, {
      network: adapted.network,
      devices: adapted.devices
    })

    expect(report.extractor.sounderGroupMembers).toBe(1)
    expect(report.extractor.ioGroupMembers).toBe(1)
    expect(report.adapted.sounderGroupMembers).toBe(0)
    expect(report.adapted.ioGroupMembers).toBe(0)
    expect(report.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layer: 'adapter-missing',
          relation: 'sounderGroupMembers',
          extractor: 1,
          adapted: 0
        }),
        expect.objectContaining({
          layer: 'adapter-missing',
          relation: 'ioGroupMembers',
          extractor: 1,
          adapted: 0
        })
      ])
    )
  })
})
