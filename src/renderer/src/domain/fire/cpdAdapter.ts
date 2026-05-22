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
    panel.loops = adaptLoops(panel, devices)
    panel.zones = zonesInput
      .filter((zone) => numberValue(zone.panelNumber) === panel.panelNumber)
      .map((zone) => adaptZone(zone, networkId, panel.id, issues))
    panel.sounderGroups = sounderGroupsInput
      .filter((group) => numberValue(group.panelNumber) === panel.panelNumber)
      .map((group) => adaptSounderGroup(group, networkId, panel.id))
    panel.ioGroups = ioGroupsInput
      .filter((group) => numberValue(group.panelNumber) === panel.panelNumber)
      .map((group) => adaptIOGroup(group, networkId, panel.id))
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

function adaptGeneral(
  panelNumber: number,
  sounderMode: SounderMode,
  general: Record<string, unknown>
): PanelGeneralConfig {
  return {
    panelNumber,
    sounderMode,
    faultIOGroup: optionalNumber(general.FaultIOGroup),
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
    zoneNumber: optionalNumber(deviceInput.zone),
    sounderGroupId: optionalNumber(deviceInput.sounderGroup),
    ioGroupId: optionalNumber(deviceInput.ioGroup),
    isInputCapable: isInputCapableType(normalizedType),
    isOutputCapable: isOutputCapableType(normalizedType),
    isSounder: isSounderType(normalizedType),
    isWirelessType: isWirelessDeviceType(normalizedType),
    disabled: booleanValue(deviceInput.disabled),
    inhibitSounders: booleanValue(deviceInput.inhibitSounders),
    inhibitIO: booleanValue(deviceInput.inhibitIO),
    inhibitRelays: booleanValue(deviceInput.inhibitRelays),
    evacuateIO: booleanValue(deviceInput.evacuateIO),
    ioOverrideDelay: booleanValue(deviceInput.ioOverrideDelay),
    immediateEvacuate: booleanValue(deviceInput.immediateEvacuate),
    setEvacuateTimer: booleanValue(deviceInput.setEvacuateTimer),
    overrideDelays: booleanValue(deviceInput.overrideDelays),
    selectedDisablement: optionalString(deviceInput.selectedDisablement),
    reportingDetail: optionalString(deviceInput.reportingDetail),
    smokeSensitivity: optionalString(deviceInput.smokeSensitivity),
    heatGrade: optionalString(deviceInput.heatGrade),
    sounderGroupValue: optionalString(deviceInput.sounderGroupValue),
    imageIndex: optionalNumber(deviceInput.imageIndex),
    placement: { status: 'unplaced' },
    raw: toRecord(deviceInput.raw)
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
): FireZone {
  const zoneNumber = numberValue(zoneInput.zoneNumber)
  const id = `${panelId}-zone-${zoneNumber}`
  const alarmMode = mapZoneAlarmMode(zoneInput, id, issues)

  return {
    id,
    networkId,
    panelId,
    zoneNumber,
    text: stringValue(zoneInput.text, `Zone ${zoneNumber}`),
    enabled: booleanValue(zoneInput.enabled, true),
    delayedSounders: booleanValue(zoneInput.delayedSounders),
    alarmMode,
    sounderGroupAlarm1: optionalNumber(zoneInput.sounderGroupAlarm1),
    sounderGroupAlarm2: optionalNumber(zoneInput.sounderGroupAlarm2),
    ioGroup1Alarm1: optionalNumber(zoneInput.ioGroup1Alarm1),
    ioGroup1Alarm2: optionalNumber(zoneInput.ioGroup1Alarm2),
    ioGroup2Alarm1: optionalNumber(zoneInput.ioGroup2Alarm1),
    ioGroup3Alarm1: optionalNumber(zoneInput.ioGroup3Alarm1),
    ioGroup4Alarm1: optionalNumber(zoneInput.ioGroup4Alarm1),
    visualAreas: [],
    raw: toRecord(zoneInput.raw)
  }
}

function adaptSounderGroup(
  groupInput: Record<string, unknown>,
  networkId: string,
  panelId: string
): SounderGroup {
  const groupId = numberValue(groupInput.groupId)

  return {
    id: `${panelId}-sounder-group-${groupId}`,
    networkId,
    panelId,
    groupId,
    title: optionalString(groupInput.title),
    description: optionalString(groupInput.description),
    addressableMembers: arrayOfRecords(groupInput.members).map(adaptGroupMember),
    nonAddressableMembers: [],
    raw: toRecord(groupInput.raw)
  }
}

function adaptIOGroup(groupInput: Record<string, unknown>, networkId: string, panelId: string): IOGroup {
  const groupId = numberValue(groupInput.groupId)

  return {
    id: `${panelId}-io-group-${groupId}`,
    networkId,
    panelId,
    groupId,
    members: arrayOfRecords(groupInput.members).map(adaptGroupMember),
    raw: toRecord(groupInput.raw)
  }
}

function adaptGroupMember(member: Record<string, unknown>): GroupMember {
  return {
    loopId: optionalNumber(member.loopId),
    physicalAddress: optionalNumber(member.physicalAddress),
    description: optionalString(member.description),
    status: optionalString(member.status),
    raw: toRecord(member.raw)
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
      code: 'sounder-mode-unknown',
      severity: 'warning',
      message: `Unknown SounderMode "${String(value)}"; defaulted to Programmed.`,
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
    code: 'zone.alarm-mode-unresolved',
    severity: 'warning',
    message: 'Zone alarm mode could not be resolved; defaulted to single.',
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

function numberValue(value: unknown, fallback = 0): number {
  return optionalNumber(value) ?? fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}
