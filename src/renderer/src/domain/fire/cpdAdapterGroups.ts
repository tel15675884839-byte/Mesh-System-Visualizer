import type {
  FireIssue,
  FirePanel,
  FireZone,
  GroupMember,
  IOGroup,
  NonAddressableSounderMember,
  SounderGroup,
  ZoneAlarmMode
} from './types'
import {
  booleanFromFields,
  collectPanelGroupMemberRecords,
  firstDefinedField,
  isEmptyNonAddressableMode,
  optionalGroupNumberFromFields,
  optionalNumberFromFields,
  optionalString,
  optionalStringFromFields,
  stringValue,
  toRecord
} from './cpdAdapterInput'

export function adaptZone(
  zoneInput: Record<string, unknown>,
  networkId: string,
  panelId: string,
  issues: FireIssue[]
): FireZone | null {
  const raw = toRecord(zoneInput.raw)
  const zoneNumber = optionalGroupNumberFromFields(zoneInput, raw, ['zoneNumber', 'ZoneNumber'])
  if (zoneNumber === undefined) {
    return null
  }

  const id = `${panelId}-zone-${zoneNumber}`
  const alarmMode = mapZoneAlarmMode(zoneInput, id, issues)

  return {
    id,
    networkId,
    panelId,
    zoneNumber,
    text: stringValue(
      optionalStringFromFields(zoneInput, raw, ['text', 'ZoneTexts', 'zoneText']),
      `Zone ${zoneNumber}`
    ),
    enabled: booleanFromFields(zoneInput, raw, ['enabled', 'ZoneEnabled'], true),
    delayedSounders: booleanFromFields(zoneInput, raw, ['delayedSounders', 'DelayedSounders']),
    alarmMode,
    sounderGroupAlarm1: optionalGroupNumberFromFields(zoneInput, raw, [
      'sounderGroupAlarm1',
      'SounderGroupAlarm1'
    ]),
    sounderGroupAlarm2: optionalGroupNumberFromFields(zoneInput, raw, [
      'sounderGroupAlarm2',
      'SounderGroupAlarm2'
    ]),
    ioGroup1Alarm1: optionalGroupNumberFromFields(zoneInput, raw, [
      'ioGroup1Alarm1',
      'IOGroup1Alarm1'
    ]),
    ioGroup1Alarm2: optionalGroupNumberFromFields(zoneInput, raw, [
      'ioGroup1Alarm2',
      'IOGroup1Alarm2'
    ]),
    ioGroup2Alarm1: optionalGroupNumberFromFields(zoneInput, raw, [
      'ioGroup2Alarm1',
      'IOGroup2Alarm1'
    ]),
    ioGroup3Alarm1: optionalGroupNumberFromFields(zoneInput, raw, [
      'ioGroup3Alarm1',
      'IOGroup3Alarm1'
    ]),
    ioGroup4Alarm1: optionalGroupNumberFromFields(zoneInput, raw, [
      'ioGroup4Alarm1',
      'IOGroup4Alarm1'
    ]),
    visualAreas: [],
    raw
  }
}

export function adaptSounderGroup(
  groupInput: Record<string, unknown>,
  networkId: string,
  panelId: string,
  panel: FirePanel,
  panelCount: number
): SounderGroup | null {
  const raw = toRecord(groupInput.raw)
  const groupId = optionalGroupNumberFromFields(groupInput, raw, ['groupId', 'GroupId', 'GroupID'])
  if (groupId === undefined) {
    return null
  }

  return {
    id: `${panelId}-sounder-group-${groupId}`,
    networkId,
    panelId,
    groupId,
    title: optionalStringFromFields(groupInput, raw, ['title', 'Title']),
    description: optionalStringFromFields(groupInput, raw, ['description', 'Description']),
    addressableMembers: collectPanelGroupMemberRecords(groupInput, panel, panelCount).map(
      adaptGroupMember
    ),
    nonAddressableMembers: adaptNonAddressableSounderMembers(groupInput),
    raw
  }
}

export function adaptIOGroup(
  groupInput: Record<string, unknown>,
  networkId: string,
  panelId: string,
  panel: FirePanel,
  panelCount: number
): IOGroup | null {
  const raw = toRecord(groupInput.raw)
  const groupId = optionalGroupNumberFromFields(groupInput, raw, ['groupId', 'GroupId', 'GroupID'])
  if (groupId === undefined) {
    return null
  }

  return {
    id: `${panelId}-io-group-${groupId}`,
    networkId,
    panelId,
    groupId,
    members: collectPanelGroupMemberRecords(groupInput, panel, panelCount).map(adaptGroupMember),
    raw
  }
}

function adaptGroupMember(member: Record<string, unknown>): GroupMember {
  const raw = toRecord(member.raw)

  return {
    loopId: optionalNumberFromFields(member, raw, ['loopId', 'Loop', 'LoopID', 'LoopNumber']),
    physicalAddress: optionalNumberFromFields(member, raw, [
      'physicalAddress',
      'PhysicalAddress',
      'address',
      'Address'
    ]),
    description: optionalStringFromFields(member, raw, [
      'description',
      'Description',
      'DeviceLocationText'
    ]),
    status: optionalStringFromFields(member, raw, ['status', 'Status']),
    raw
  }
}

function adaptNonAddressableSounderMembers(
  groupInput: Record<string, unknown>
): NonAddressableSounderMember[] {
  const raw = toRecord(groupInput.raw)
  const cieId = optionalNumberFromFields(groupInput, raw, ['cieId', 'CIE', 'Cie', 'CieId', 'CIEID'])
  const members: NonAddressableSounderMember[] = []

  for (const channel of ['nonAddressable1', 'nonAddressable2'] as const) {
    const field = channel === 'nonAddressable1' ? 'NonAddressable1' : 'NonAddressable2'
    const value = firstDefinedField(groupInput, raw, [channel, field])
    if (isEmptyNonAddressableMode(value)) {
      continue
    }

    const status = optionalString(value) ?? String(value)
    members.push({
      cieId,
      [channel]: true,
      status,
      raw: {
        ...(cieId !== undefined ? { CIE: cieId } : {}),
        channel,
        status
      }
    })
  }

  return members
}

function mapZoneAlarmMode(
  zoneInput: Record<string, unknown>,
  targetId: string,
  issues: FireIssue[]
): ZoneAlarmMode {
  const raw = toRecord(zoneInput.raw)
  const mode = stringValue(zoneInput.alarmMode ?? raw.alarmMode ?? raw.AlarmMode)
    .trim()
    .toLowerCase()

  if (mode === 'single' || mode === 'double') {
    return mode
  }

  if (mode === '' && hasConfiguredStage2Output(zoneInput, raw)) {
    return 'double'
  }

  issues.push({
    id: `zone.alarm-mode-unresolved:${targetId}`,
    code: 'zone.alarm-mode-unresolved',
    severity: 'warning',
    message: 'Zone alarm mode could not be resolved; defaulted to single.',
    relatedZoneId: targetId,
    targetId,
    raw
  })

  return 'single'
}

function hasConfiguredStage2Output(
  zoneInput: Record<string, unknown>,
  raw: Record<string, unknown>
): boolean {
  return ['sounderGroupAlarm2', 'SounderGroupAlarm2', 'ioGroup1Alarm2', 'IOGroup1Alarm2'].some(
    (field) => optionalGroupNumberFromFields(zoneInput, raw, [field]) !== undefined
  )
}
