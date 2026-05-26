import {
  getFriendlyDeviceTypeName,
  isInputCapableType,
  isIOGroupMemberDevice,
  isOutputCapableType,
  isSounderGroupMemberDevice,
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
  SounderMode
} from './types'
import {
  arrayOfRecords,
  booleanFromFields,
  booleanValue,
  collectGroupMemberRecords,
  delaySeconds,
  explicitInputPanelNumber,
  isDisabledDevice,
  isNotNull,
  memberPanelNumber,
  numberValue,
  optionalGroupNumber,
  optionalGroupNumberFromFields,
  optionalNumber,
  optionalString,
  optionalStringFromFields,
  selectedDisablementValue,
  stringValue,
  timestampValue,
  toRecord,
  toSafeFileBase
} from './cpdAdapterInput'
import { adaptIOGroup, adaptSounderGroup, adaptZone } from './cpdAdapterGroups'

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
        .filter((group) => groupBelongsToPanel(group, panel, panels.length))
        .map((group) => adaptSounderGroup(group, networkId, panel.id, panel, panels.length))
        .filter(isNotNull),
      panelDevices
    )
    panel.ioGroups = mergeIOGroups(
      panel,
      ioGroupsInput
        .filter((group) => groupBelongsToPanel(group, panel, panels.length))
        .map((group) => adaptIOGroup(group, networkId, panel.id, panel, panels.length))
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
  const panelZoneInputs = zonesInput.filter((zone) =>
    zoneBelongsToPanel(zone, panel, panelCount, panelDevices)
  )
  const adaptedZones = panelZoneInputs
    .filter((zone) => isRelevantZoneInput(zone, panelDevices))
    .map((zone) => adaptZone(zone, networkId, panel.id, issues))
    .filter(isNotNull)

  if (adaptedZones.length > 0) {
    return adaptedZones
  }

  return synthesizeZonesFromDevices(panel, panelDevices)
}

function zoneBelongsToPanel(
  input: Record<string, unknown>,
  panel: FirePanel,
  panelCount: number,
  panelDevices: FireDevice[]
): boolean {
  const panelNumber = explicitInputPanelNumber(input)
  if (panelNumber === undefined) {
    if (panelCount === 1) {
      return true
    }

    const raw = toRecord(input.raw)
    const zoneNumber = optionalGroupNumberFromFields(input, raw, ['zoneNumber', 'ZoneNumber'])
    if (
      zoneNumber !== undefined &&
      panelDevices.some((device) => device.zoneNumber === zoneNumber)
    ) {
      return true
    }

    return hasZoneOutputLinks(input)
  }

  return panelNumber === panel.panelNumber
}

function groupBelongsToPanel(
  input: Record<string, unknown>,
  panel: FirePanel,
  panelCount: number
): boolean {
  const panelNumber = explicitInputPanelNumber(input)
  if (panelNumber !== undefined) {
    return panelNumber === panel.panelNumber
  }

  const members = collectGroupMemberRecords(input)
  const memberPanelNumbers = members
    .map(memberPanelNumber)
    .filter((value): value is number => value !== undefined)

  if (memberPanelNumbers.length > 0) {
    return memberPanelNumbers.includes(panel.panelNumber)
  }

  return panelCount === 1
}

function isRelevantZoneInput(zoneInput: Record<string, unknown>, devices: FireDevice[]): boolean {
  const raw = toRecord(zoneInput.raw)
  const zoneNumber = optionalGroupNumberFromFields(zoneInput, raw, ['zoneNumber', 'ZoneNumber'])
  if (zoneNumber === undefined) {
    return false
  }

  return (
    hasZoneText(zoneInput) ||
    hasZoneOutputLinks(zoneInput) ||
    devices.some((device) => device.zoneNumber === zoneNumber)
  )
}

function hasZoneText(zoneInput: Record<string, unknown>): boolean {
  const raw = toRecord(zoneInput.raw)
  return Boolean(
    optionalStringFromFields(zoneInput, raw, ['text', 'ZoneTexts', 'zoneText'])?.trim()
  )
}

function hasZoneOutputLinks(zoneInput: Record<string, unknown>): boolean {
  const raw = toRecord(zoneInput.raw)
  return [
    'sounderGroupAlarm1',
    'SounderGroupAlarm1',
    'sounderGroupAlarm2',
    'SounderGroupAlarm2',
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
  ].some((field) => optionalGroupNumberFromFields(zoneInput, raw, [field]) !== undefined)
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
  const outputMemberDevices = devices.filter(isSounderGroupMemberDevice)
  const synthesized = uniqueGroupIds(outputMemberDevices.map((device) => device.sounderGroupId))
    .filter((groupId) => !existingIds.has(groupId))
    .map((groupId) => ({
      id: `${panel.id}-sounder-group-${groupId}`,
      networkId: panel.networkId,
      panelId: panel.id,
      groupId,
      title: `Sounder Group ${groupId}`,
      addressableMembers: outputMemberDevices
        .filter((device) => device.sounderGroupId === groupId)
        .map(deviceToGroupMember),
      nonAddressableMembers: [],
      raw: { synthesizedFromDeviceGroups: true }
    }))

  return [...groups, ...synthesized].sort((left, right) => left.groupId - right.groupId)
}

function mergeIOGroups(panel: FirePanel, groups: IOGroup[], devices: FireDevice[]): IOGroup[] {
  const existingIds = new Set(groups.map((group) => group.groupId))
  const outputMemberDevices = devices.filter(isIOGroupMemberDevice)
  const synthesized = uniqueGroupIds(outputMemberDevices.map((device) => device.ioGroupId))
    .filter((groupId) => !existingIds.has(groupId))
    .map((groupId) => ({
      id: `${panel.id}-io-group-${groupId}`,
      networkId: panel.networkId,
      panelId: panel.id,
      groupId,
      members: outputMemberDevices
        .filter((device) => device.ioGroupId === groupId)
        .map(deviceToGroupMember),
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
    disabled: isDisabledDevice(deviceInput, raw),
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
    selectedDisablement: selectedDisablementValue(deviceInput, raw),
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

function mapSounderMode(
  value: unknown,
  targetId: string,
  issues: FireIssue[],
  raw: Record<string, unknown>
): SounderMode {
  if (value === 'Preset' || value === 'Programmed') {
    return value
  }

  if (value === 0 || value === '0') {
    return 'Programmed'
  }

  if (value === 1 || value === '1') {
    return 'Preset'
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
