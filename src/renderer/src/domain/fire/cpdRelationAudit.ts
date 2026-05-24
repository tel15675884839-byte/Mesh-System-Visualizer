import type { FireDevice, FireNetwork } from './types'

export interface CpdRelationCountSet {
  zoneToSounderGroupLinks: number
  zoneToIOGroupLinks: number
  sounderGroupMembers: number
  ioGroupMembers: number
  deviceZoneAssignments: number
  deviceSounderGroupAssignments: number
  deviceIOGroupAssignments: number
  disableOrInhibitFields: number
  delayOrOverrideFields: number
}

export type CpdRelationLossLayer =
  | 'extractor-missing'
  | 'adapter-missing'
  | 'model-unused'
  | 'ui-unused'
  | 'simulation-unused'

export interface CpdRelationLoss {
  layer: CpdRelationLossLayer
  relation: keyof CpdRelationCountSet
  extractor: number
  adapted: number
}

export interface CpdRelationAuditReport {
  extractor: CpdRelationCountSet
  adapted: CpdRelationCountSet
  missing: CpdRelationLoss[]
}

export interface AdaptedCpdRelationSource {
  network?: FireNetwork
  networks?: FireNetwork[]
  devices: FireDevice[]
}

const EMPTY_COUNTS: CpdRelationCountSet = {
  zoneToSounderGroupLinks: 0,
  zoneToIOGroupLinks: 0,
  sounderGroupMembers: 0,
  ioGroupMembers: 0,
  deviceZoneAssignments: 0,
  deviceSounderGroupAssignments: 0,
  deviceIOGroupAssignments: 0,
  disableOrInhibitFields: 0,
  delayOrOverrideFields: 0
}

const ZONE_SOUNDER_GROUP_FIELDS = [
  'sounderGroupAlarm1',
  'SounderGroupAlarm1',
  'sounderGroupAlarm2',
  'SounderGroupAlarm2'
]
const ZONE_IO_GROUP_FIELDS = [
  'ioGroup1Alarm1',
  'IOGroup1Alarm1',
  'ioGroup1Alarm2',
  'IOGroup1Alarm2',
  'ioGroup2Alarm1',
  'IOGroup2Alarm1',
  'ioGroup3Alarm1',
  'IOGroup3Alarm1',
  'ioGroup4Alarm1',
  'IOGroup4Alarm1'
]
const DEVICE_ZONE_FIELDS = ['zone', 'Zone', 'zoneNumber', 'ZoneNumber']
const DEVICE_SOUNDER_GROUP_FIELDS = [
  'sounderGroup',
  'SounderGroup',
  'sounderGroupId',
  'SounderGroupID'
]
const DEVICE_IO_GROUP_FIELDS = ['ioGroup', 'IOGroup', 'ioGroupId', 'IOGroupID']
const DISABLE_OR_INHIBIT_FIELDS = [
  'disabled',
  'DeviceDisabled',
  'deviceDisabled',
  'inhibitSounders',
  'InhibitSounders',
  'inhibitIO',
  'InhibitIO',
  'inhibitRelays',
  'InhibitRelays',
  'selectedDisablement',
  'SelectedDisablement'
]
const DELAY_OR_OVERRIDE_FIELDS = [
  'ioOverrideDelay',
  'IOOverrideDelay',
  'immediateEvacuate',
  'ImmediateEvacuate',
  'setEvacuateTimer',
  'SetEvacuateTimer',
  'overrideDelays',
  'OverrideDelays'
]

export function countExtractorCpdRelations(input: unknown): CpdRelationCountSet {
  const source = toRecord(input)
  const zones = arrayOfRecords(source.zones)
  const sounderGroups = arrayOfRecords(source.sounderGroups)
  const ioGroups = arrayOfRecords(source.ioGroups)
  const devices = arrayOfRecords(source.devices)

  return {
    zoneToSounderGroupLinks: zones.reduce(
      (count, zone) => count + countPositiveFields(zone, ZONE_SOUNDER_GROUP_FIELDS),
      0
    ),
    zoneToIOGroupLinks: zones.reduce(
      (count, zone) => count + countPositiveFields(zone, ZONE_IO_GROUP_FIELDS),
      0
    ),
    sounderGroupMembers: sounderGroups.reduce(
      (count, group) =>
        count + countGroupMemberRecords(group, ['members', 'GDataDetail', 'GDataDetailEx']),
      0
    ),
    ioGroupMembers: ioGroups.reduce(
      (count, group) =>
        count + countGroupMemberRecords(group, ['members', 'GDataDetail', 'GDataDetailEx']),
      0
    ),
    deviceZoneAssignments: devices.filter((device) => hasPositiveField(device, DEVICE_ZONE_FIELDS))
      .length,
    deviceSounderGroupAssignments: devices.filter((device) =>
      hasPositiveField(device, DEVICE_SOUNDER_GROUP_FIELDS)
    ).length,
    deviceIOGroupAssignments: devices.filter((device) =>
      hasPositiveField(device, DEVICE_IO_GROUP_FIELDS)
    ).length,
    disableOrInhibitFields: devices.filter((device) =>
      hasTruthyField(device, DISABLE_OR_INHIBIT_FIELDS)
    ).length,
    delayOrOverrideFields: devices.filter((device) =>
      hasTruthyField(device, DELAY_OR_OVERRIDE_FIELDS)
    ).length
  }
}

export function countAdaptedCpdRelations(source: AdaptedCpdRelationSource): CpdRelationCountSet {
  const networks = source.networks ?? (source.network ? [source.network] : [])
  const panels = networks.flatMap((network) => network.panels)
  const zones = panels.flatMap((panel) => panel.zones)
  const sounderGroups = panels.flatMap((panel) => panel.sounderGroups)
  const ioGroups = panels.flatMap((panel) => panel.ioGroups)
  const devices = source.devices

  return {
    zoneToSounderGroupLinks: zones.reduce(
      (count, zone) =>
        count +
        countAdaptedZoneFieldPairs(zone, [
          ['sounderGroupAlarm1', 'SounderGroupAlarm1'],
          ['sounderGroupAlarm2', 'SounderGroupAlarm2']
        ]),
      0
    ),
    zoneToIOGroupLinks: zones.reduce(
      (count, zone) =>
        count +
        countAdaptedZoneFieldPairs(zone, [
          ['ioGroup1Alarm1', 'IOGroup1Alarm1'],
          ['ioGroup1Alarm2', 'IOGroup1Alarm2'],
          ['ioGroup2Alarm1', 'IOGroup2Alarm1'],
          ['ioGroup3Alarm1', 'IOGroup3Alarm1'],
          ['ioGroup4Alarm1', 'IOGroup4Alarm1']
        ]),
      0
    ),
    sounderGroupMembers: sounderGroups
      .filter((group) => !toRecord(group.raw).synthesizedFromDeviceGroups)
      .reduce((count, group) => count + group.addressableMembers.length, 0),
    ioGroupMembers: ioGroups
      .filter((group) => !toRecord(group.raw).synthesizedFromDeviceGroups)
      .reduce((count, group) => count + group.members.length, 0),
    deviceZoneAssignments: devices.filter((device) => isPositiveNumber(device.zoneNumber)).length,
    deviceSounderGroupAssignments: devices.filter((device) =>
      isPositiveNumber(device.sounderGroupId)
    ).length,
    deviceIOGroupAssignments: devices.filter((device) => isPositiveNumber(device.ioGroupId)).length,
    disableOrInhibitFields: devices.filter(
      (device) =>
        device.disabled || device.inhibitSounders || device.inhibitIO || device.inhibitRelays
    ).length,
    delayOrOverrideFields: devices.filter(
      (device) =>
        device.ioOverrideDelay ||
        device.immediateEvacuate ||
        device.setEvacuateTimer ||
        device.overrideDelays
    ).length
  }
}

export function auditCpdRelations(
  extractorInput: unknown,
  adaptedSource: AdaptedCpdRelationSource
): CpdRelationAuditReport {
  const extractor = countExtractorCpdRelations(extractorInput)
  const adapted = countAdaptedCpdRelations(adaptedSource)

  return {
    extractor,
    adapted,
    missing: relationKeys().flatMap((relation) =>
      adapted[relation] < extractor[relation]
        ? [
            {
              layer: 'adapter-missing' as const,
              relation,
              extractor: extractor[relation],
              adapted: adapted[relation]
            }
          ]
        : []
    )
  }
}

function countGroupMemberRecords(group: Record<string, unknown>, fields: string[]): number {
  return fields.reduce((count, field) => count + arrayOfRecords(group[field]).length, 0)
}

function countPositiveFields(input: Record<string, unknown>, fields: string[]): number {
  return fields.reduce((count, field) => count + (isPositiveValue(input[field]) ? 1 : 0), 0)
}

function hasPositiveField(input: Record<string, unknown>, fields: string[]): boolean {
  return fields.some(
    (field) => isPositiveValue(input[field]) || isPositiveValue(toRecord(input.raw)[field])
  )
}

function hasTruthyField(input: Record<string, unknown>, fields: string[]): boolean {
  return fields.some(
    (field) => isTruthyValue(input[field]) || isTruthyValue(toRecord(input.raw)[field])
  )
}

function countAdaptedZoneFieldPairs(
  zone: { raw: Record<string, unknown> },
  fields: Array<[string, string]>
): number {
  const raw = toRecord(zone.raw)
  const zoneRecord = zone as Record<string, unknown>

  return fields.reduce((count, [typedField, rawField]) => {
    if (isPositiveValue(zoneRecord[typedField])) {
      return count + 1
    }

    return count + (isPositiveValue(raw[rawField]) ? 1 : 0)
  }, 0)
}

function isPositiveValue(value: unknown): boolean {
  return isPositiveNumber(optionalNumber(value))
}

function isPositiveNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

function isTruthyValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    return trimmed.length > 0 && trimmed !== 'false' && trimmed !== '0' && trimmed !== 'none'
  }

  return false
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function relationKeys(): Array<keyof CpdRelationCountSet> {
  return Object.keys(EMPTY_COUNTS) as Array<keyof CpdRelationCountSet>
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(toRecord) : []
}
