import {
  getFriendlyDeviceTypeName,
  isInputCapableType,
  isOutputCapableType,
  isSounderType,
  isWirelessDeviceType,
  normalizeDeviceType
} from './deviceIcons'
import type {
  FireDevice,
  FireIssue,
  FireLoop,
  FireNetwork,
  FirePanel,
  FireZone,
  GroupMember,
  IOGroup,
  PanelGeneralConfig,
  SounderGroup,
  SounderMode,
  ZoneAlarmMode
} from './types'

export interface CpdAdapterResult {
  projectName: string
  network: FireNetwork
  devices: FireDevice[]
  issues: FireIssue[]
}

const LOOP_COLORS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#4b5563'
]

export function adaptCpdExport(input: unknown, now = Date.now()): CpdAdapterResult {
  const source = toRecord(input)
  const fileName = stringValue(toRecord(source.source).fileName, 'imported.cpd')
  const safeFileBase = toSafeFileBase(fileName)
  const networkId = `network-${safeFileBase}-${now}`
  const issues: FireIssue[] = []
  const panelsInput = arrayOfRecords(source.panels)
  const devicesInput = arrayOfRecords(source.devices)
  const zonesInput = arrayOfRecords(source.zones)
  const sounderGroupsInput = arrayOfRecords(source.sounderGroups)
  const ioGroupsInput = arrayOfRecords(source.ioGroups)
  const panelIdByNumber = new Map<number, string>()

  const panels: FirePanel[] = panelsInput.map((panelInput, index) => {
    const panelNumber = numberValue(panelInput.panelNumber, index + 1)
    const panelId = `${networkId}-panel-${panelNumber}`
    panelIdByNumber.set(panelNumber, panelId)
    const general = toRecord(panelInput.general)
    const sounderMode = mapSounderMode(general.SounderMode, panelId, issues, general)

    return {
      id: panelId,
      networkId,
      panelNumber,
      panelName: `Panel ${panelNumber}`,
      panelModel: optionalString(panelInput.panelModel),
      general: adaptGeneral(panelNumber, sounderMode, general),
      loops: [],
      zones: [],
      sounderGroups: [],
      ioGroups: [],
      sounders: { raw: toRecord(panelInput.sounders) }
    }
  })

  const devices = devicesInput.map((deviceInput, index) =>
    adaptDevice(deviceInput, index, networkId, panelIdByNumber)
  )

  for (const panel of panels) {
    const panelDevices = devices.filter((device) => device.panelNumber === panel.panelNumber)
    panel.loops = adaptLoops(panel, devices)
    panel.zones = adaptPanelZones(panel, zonesInput, devices, networkId, panels.length, issues)
    panel.sounderGroups = mergeSounderGroups(
      panel,
      sounderGroupsInput
        .filter((group) => inputBelongsToPanel(group, panel, panels.length))
        .map((group) => adaptSounderGroup(group, networkId, panel.id))
        .filter(isNotNull),
      panelDevices
    )
    panel.ioGroups = mergeIOGroups(
      panel,
      ioGroupsInput
        .filter((group) => inputBelongsToPanel(group, panel, panels.length))
        .map((group) => adaptIOGroup(group, networkId, panel.id))
        .filter(isNotNull),
      panelDevices
    )
  }

  const firstPanelMode = panels[0]?.general.sounderMode ?? 'Programmed'
  const network: FireNetwork = {
    id: networkId,
    name: safeFileBase,
    sourceFileName: fileName,
    sourceImportedAt: timestampValue(toRecord(source.source).exportedAt, now),
    extractorVersion: optionalString(toRecord(source.extractor).version),
    sounderMode: firstPanelMode,
    panels
  }

  return {
    projectName: safeFileBase,
    network,
    devices,
    issues
  }
}

function adaptPanelZones(
  panel: FirePanel,
  zonesInput: Record<string, unknown>[],
  devices: FireDevice[],
  networkId: string,
  panelCount: number,
  issues: FireIssue[]
): FireZone[] {
  const panelDevices = devices.filter((device) => device.panelNumber === panel.panelNumber)
  const panelZoneInputs = zonesInput.filter((zone) => inputBelongsToPanel(zone, panel, panelCount))
  const adaptedZones = panelZoneInputs
    .filter((zone) => isRelevantZoneInput(zone, panelDevices))
    .map((zone) => adaptZone(zone, networkId, panel.id, issues))
    .filter(isNotNull)

  if (adaptedZones.length > 0) {
    return adaptedZones
  }

  return synthesizeZonesFromDevices(panel, panelDevices)
}

function inputBelongsToPanel(
  input: Record<string, unknown>,
  panel: FirePanel,
  panelCount: number
): boolean {
  const panelNumber = optionalGroupNumber(input.panelNumber)
  if (panelNumber === undefined) {
    return panelCount === 1
  }

  return panelNumber === panel.panelNumber
}

function isRelevantZoneInput(zoneInput: Record<string, unknown>, devices: FireDevice[]): boolean {
  const zoneNumber = optionalGroupNumber(zoneInput.zoneNumber)
  if (zoneNumber === undefined) {
    return false
  }

  return hasZoneText(zoneInput) || devices.some((device) => device.zoneNumber === zoneNumber)
}

function hasZoneText(zoneInput: Record<string, unknown>): boolean {
  const raw = toRecord(zoneInput.raw)
  return Boolean(
    optionalStringFromFields(zoneInput, raw, ['text', 'ZoneTexts', 'zoneText'])?.trim()
  )
}

function synthesizeZonesFromDevices(panel: FirePanel, devices: FireDevice[]): FireZone[] {
  return Array.from(
    new Set(
      devices
        .map((device) => device.zoneNumber)
        .filter((zoneNumber): zoneNumber is number => zoneNumber !== undefined && zoneNumber > 0)
    )
  )
    .sort((left, right) => left - right)
    .map((zoneNumber) => ({
      id: `${panel.id}-zone-${zoneNumber}`,
      networkId: panel.networkId,
      panelId: panel.id,
      zoneNumber,
      text: `Zone ${zoneNumber}`,
      enabled: true,
      delayedSounders: false,
      alarmMode: 'single',
      visualAreas: [],
      raw: { synthesizedFromDeviceZones: true }
    }))
}

function mergeSounderGroups(
  panel: FirePanel,
  groups: SounderGroup[],
  devices: FireDevice[]
): SounderGroup[] {
  const existingIds = new Set(groups.map((group) => group.groupId))
  const synthesized = uniqueGroupIds(devices.map((device) => device.sounderGroupId))
    .filter((groupId) => !existingIds.has(groupId))
    .map((groupId) => ({
      id: `${panel.id}-sounder-group-${groupId}`,
      networkId: panel.networkId,
      panelId: panel.id,
      groupId,
      title: `Sounder Group ${groupId}`,
      addressableMembers: devices
        .filter((device) => device.sounderGroupId === groupId)
        .map(deviceToGroupMember),
      nonAddressableMembers: [],
      raw: { synthesizedFromDeviceGroups: true }
    }))

  return [...groups, ...synthesized].sort((left, right) => left.groupId - right.groupId)
}

function mergeIOGroups(panel: FirePanel, groups: IOGroup[], devices: FireDevice[]): IOGroup[] {
  const existingIds = new Set(groups.map((group) => group.groupId))
  const synthesized = uniqueGroupIds(devices.map((device) => device.ioGroupId))
    .filter((groupId) => !existingIds.has(groupId))
    .map((groupId) => ({
      id: `${panel.id}-io-group-${groupId}`,
      networkId: panel.networkId,
      panelId: panel.id,
      groupId,
      members: devices.filter((device) => device.ioGroupId === groupId).map(deviceToGroupMember),
      raw: { synthesizedFromDeviceGroups: true }
    }))

  return [...groups, ...synthesized].sort((left, right) => left.groupId - right.groupId)
}

function uniqueGroupIds(values: Array<number | undefined>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => value !== undefined && value > 0))
  ).sort((left, right) => left - right)
}

function deviceToGroupMember(device: FireDevice): GroupMember {
  return {
    loopId: device.loopId,
    physicalAddress: device.address,
    description: device.location || device.description,
    raw: { synthesizedFromDeviceId: device.id }
  }
}

function adaptGeneral(
  panelNumber: number,
  sounderMode: SounderMode,
  general: Record<string, unknown>
): PanelGeneralConfig {
  return {
    panelNumber,
    sounderMode,
    faultIOGroup: optionalGroupNumber(general.FaultIOGroup),
    evacuateDelaySeconds: delaySeconds(general.EvacuteDelayMM, general.EvacuteDelaySS),
    evacuateMode: optionalString(general.EvacuteMode),
    sounderDelaySeconds: delaySeconds(general.SounderDelayMM, general.SounderDelaySS),
    sounderActiveOn: optionalString(general.SounderActiveOn),
    sounderMode1: optionalString(general.SounderMode1),
    inputOutputDelaySeconds: delaySeconds(general.InputOutputDelayMM, general.InputOutputDelaySS),
    fireBrigadeDelaySeconds: delaySeconds(general.FireBrigadeDelayMM, general.FireBrigadeDelaySS),
    fireBrigadeActiveOn: optionalString(general.FireBrigadeActiveOn),
    fireBrigadeMode: optionalString(general.FireBrigadeMode),
    onManualCallPoints: booleanValue(general.OnManualCallPoints),
    onTwoDevices: booleanValue(general.OnTwoDevices),
    delayOffAtNight: booleanValue(general.DelayOffAtNight),
    raw: general
  }
}

function adaptDevice(
  deviceInput: Record<string, unknown>,
  index: number,
  networkId: string,
  panelIdByNumber: Map<number, string>
): FireDevice {
  const raw = toRecord(deviceInput.raw)
  const panelNumber = numberValue(deviceInput.panelNumber, 1)
  const panelId = panelIdByNumber.get(panelNumber) ?? `${networkId}-panel-${panelNumber}`
  const loopId = optionalNumber(deviceInput.loopId)
  const address = optionalNumber(deviceInput.address)
  const normalizedType = normalizeDeviceType(optionalString(deviceInput.type))
  const id =
    loopId !== undefined && address !== undefined
      ? `${panelId}-loop-${loopId}-addr-${address}`
      : `${panelId}-device-${index + 1}`

  return {
    id,
    networkId,
    panelId,
    panelNumber,
    loopId,
    address,
    type: normalizedType,
    friendlyTypeName: getFriendlyDeviceTypeName(normalizedType),
    description: optionalString(deviceInput.description),
    classify: optionalString(deviceInput.classify),
    location: optionalString(deviceInput.location),
    zoneNumber: optionalGroupNumberFromFields(deviceInput, raw, [
      'zone',
      'Zone',
      'zoneNumber',
      'ZoneNumber'
    ]),
    sounderGroupId: optionalGroupNumberFromFields(deviceInput, raw, [
      'sounderGroup',
      'SounderGroup',
      'sounderGroupId',
      'SounderGroupID'
    ]),
    ioGroupId: optionalGroupNumberFromFields(deviceInput, raw, [
      'ioGroup',
      'IOGroup',
      'ioGroupId',
      'IOGroupID'
    ]),
    isInputCapable: isInputCapableType(normalizedType),
    isOutputCapable: isOutputCapableType(normalizedType),
    isSounder: isSounderType(normalizedType),
    isWirelessType: isWirelessDeviceType(normalizedType),
    disabled: booleanFromFields(deviceInput, raw, ['disabled', 'DeviceDisabled', 'deviceDisabled']),
    inhibitSounders: booleanFromFields(deviceInput, raw, ['inhibitSounders', 'InhibitSounders']),
    inhibitIO: booleanFromFields(deviceInput, raw, ['inhibitIO', 'InhibitIO']),
    inhibitRelays: booleanFromFields(deviceInput, raw, ['inhibitRelays', 'InhibitRelays']),
    evacuateIO: booleanFromFields(deviceInput, raw, ['evacuateIO', 'EvacuateIO']),
    ioOverrideDelay: booleanFromFields(deviceInput, raw, ['ioOverrideDelay', 'IOOverrideDelay']),
    immediateEvacuate: booleanFromFields(deviceInput, raw, [
      'immediateEvacuate',
      'ImmediateEvacuate'
    ]),
    setEvacuateTimer: booleanFromFields(deviceInput, raw, ['setEvacuateTimer', 'SetEvacuateTimer']),
    overrideDelays: booleanFromFields(deviceInput, raw, ['overrideDelays', 'OverrideDelays']),
    selectedDisablement: optionalString(deviceInput.selectedDisablement),
    reportingDetail: optionalString(deviceInput.reportingDetail),
    smokeSensitivity: optionalString(deviceInput.smokeSensitivity),
    heatGrade: optionalString(deviceInput.heatGrade),
    sounderGroupValue: optionalString(deviceInput.sounderGroupValue),
    imageIndex: optionalNumber(deviceInput.imageIndex),
    placement: { status: 'unplaced' },
    raw
  }
}

function adaptLoops(panel: FirePanel, devices: FireDevice[]): FireLoop[] {
  const loopIds = new Set(
    devices
      .filter((device) => device.panelNumber === panel.panelNumber && device.loopId !== undefined)
      .map((device) => device.loopId as number)
  )

  return Array.from(loopIds)
    .sort((left, right) => left - right)
    .map((loopId, index) => ({
      id: `${panel.id}-loop-${loopId}`,
      networkId: panel.networkId,
      panelId: panel.id,
      loopId,
      name: `Loop ${loopId}`,
      configuredDeviceOrder: devices
        .filter((device) => device.panelNumber === panel.panelNumber && device.loopId === loopId)
        .map((device) => device.id),
      manualDeviceOrder: [],
      color: LOOP_COLORS[index % LOOP_COLORS.length]
    }))
}

function adaptZone(
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

function adaptSounderGroup(
  groupInput: Record<string, unknown>,
  networkId: string,
  panelId: string
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
    addressableMembers: collectGroupMemberRecords(groupInput).map(adaptGroupMember),
    nonAddressableMembers: [],
    raw
  }
}

function adaptIOGroup(
  groupInput: Record<string, unknown>,
  networkId: string,
  panelId: string
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
    members: collectGroupMemberRecords(groupInput).map(adaptGroupMember),
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

function mapSounderMode(
  value: unknown,
  targetId: string,
  issues: FireIssue[],
  raw: Record<string, unknown>
): SounderMode {
  if (value === 'Preset' || value === 'Programmed') {
    return value
  }

  if (value !== undefined) {
    issues.push({
      id: `sounder-mode-unknown:${targetId}`,
      code: 'sounder-mode-unknown',
      severity: 'warning',
      message: `Unknown SounderMode "${String(value)}"; defaulted to Programmed.`,
      relatedPanelId: targetId,
      targetId,
      raw
    })
  }

  return 'Programmed'
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

function delaySeconds(minutes: unknown, seconds: unknown): number {
  return numberValue(minutes) * 60 + numberValue(seconds)
}

function timestampValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function toSafeFileBase(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.\\/]+$/, '')
  const safe = withoutExtension
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return safe || 'imported'
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(toRecord) : []
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stringValue(value: unknown, fallback = ''): string {
  return optionalString(value) ?? fallback
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

function optionalGroupNumber(value: unknown): number | undefined {
  const parsed = optionalNumber(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

function numberValue(value: unknown, fallback = 0): number {
  return optionalNumber(value) ?? fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function optionalStringFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): string | undefined {
  for (const field of fields) {
    const value = optionalString(input[field]) ?? optionalString(raw[field])
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function optionalNumberFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): number | undefined {
  for (const field of fields) {
    const value = optionalNumber(input[field]) ?? optionalNumber(raw[field])
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function optionalGroupNumberFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): number | undefined {
  const parsed = optionalNumberFromFields(input, raw, fields)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

function booleanFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[],
  fallback = false
): boolean {
  for (const field of fields) {
    const value = input[field] ?? raw[field]
    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const normalized = value.trim().toLowerCase()
      return normalized !== 'false' && normalized !== '0' && normalized !== 'none'
    }
  }

  return fallback
}

function collectGroupMemberRecords(groupInput: Record<string, unknown>): Record<string, unknown>[] {
  const raw = toRecord(groupInput.raw)
  const records = [
    ...arrayOfRecords(groupInput.members),
    ...arrayOfRecords(groupInput.Members),
    ...arrayOfRecords(groupInput.GDataDetail),
    ...arrayOfRecords(groupInput.GDataDetailEx),
    ...arrayOfRecords(raw.members),
    ...arrayOfRecords(raw.Members),
    ...arrayOfRecords(raw.GDataDetail),
    ...arrayOfRecords(raw.GDataDetailEx)
  ]
  const seen = new Set<string>()

  return records.filter((record, index) => {
    const recordRaw = toRecord(record.raw)
    const loopId = optionalNumberFromFields(record, recordRaw, [
      'loopId',
      'Loop',
      'LoopID',
      'LoopNumber'
    ])
    const physicalAddress = optionalNumberFromFields(record, recordRaw, [
      'physicalAddress',
      'PhysicalAddress',
      'address',
      'Address'
    ])
    if (loopId === undefined && physicalAddress === undefined) {
      return false
    }

    const key = `${loopId ?? 'loop?'}:${physicalAddress ?? 'addr?'}:${index}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}
