import type { FireDevice, FirePanel, NonAddressableSounderPoint, OutputInhibitMode } from '../types'
import { createDelayedActivation, type DelayReason } from './delays'
import type { CauseEffectInput, EffectiveAlarm, EvacuateActivation } from './causeEffect'
import type { OutputActivation } from './types'

type OutputRelation = 'direct' | 'zonal' | 'common'

export function addProgrammedZoneOutputs(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  alarm: EffectiveAlarm,
  effectiveAlarms: EffectiveAlarm[]
): void {
  addSounderGroupOutput(
    outputs,
    alarm,
    input.devices,
    input.nonAddressablePoints,
    alarm.device.sounderGroupId,
    input.sounderDelaysEnabled !== false,
    'direct'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    alarm.device.ioGroupId,
    input.sounderDelaysEnabled !== false,
    'direct'
  )

  const zone = alarm.zone
  if (!zone) {
    return
  }

  const zoneAlarmCount = effectiveAlarms.filter(
    (candidate) =>
      candidate.device.panelId === alarm.device.panelId &&
      candidate.device.zoneNumber === alarm.device.zoneNumber
  ).length
  const useStage2 = zone.alarmMode === 'double' && zoneAlarmCount >= 2

  if (useStage2) {
    addSounderGroupOutput(
      outputs,
      alarm,
      input.devices,
      input.nonAddressablePoints,
      zone.sounderGroupAlarm2,
      input.sounderDelaysEnabled !== false,
      'zonal'
    )
    addIOGroupOutput(
      outputs,
      alarm,
      input.devices,
      zone.ioGroup1Alarm2,
      input.sounderDelaysEnabled !== false,
      'zonal'
    )
    addCommonOutputs(outputs, input, alarm)
    return
  }

  addSounderGroupOutput(
    outputs,
    alarm,
    input.devices,
    input.nonAddressablePoints,
    zone.sounderGroupAlarm1,
    input.sounderDelaysEnabled !== false,
    'zonal'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    zone.ioGroup1Alarm1,
    input.sounderDelaysEnabled !== false,
    'zonal'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    zone.ioGroup2Alarm1,
    input.sounderDelaysEnabled !== false,
    'zonal'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    zone.ioGroup3Alarm1,
    input.sounderDelaysEnabled !== false,
    'zonal'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    zone.ioGroup4Alarm1,
    input.sounderDelaysEnabled !== false,
    'zonal'
  )
  addCommonOutputs(outputs, input, alarm)
}

export function addPresetSounders(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  alarm: EffectiveAlarm
): void {
  for (const sounder of input.devices.filter((device) => device.isSounder)) {
    addDeviceSounderOutput(outputs, alarm, sounder, input.sounderDelaysEnabled !== false)
  }

  for (const point of input.nonAddressablePoints) {
    const state = isSounderOutputInhibited(alarm.device, 'zonal') ? 'inhibited' : 'active'
    upsertOutput(outputs, {
      outputId: `non-addressable-sounder:${point.id}`,
      state,
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: state === 'inhibited' ? 'inhibit-sounders' : 'preset-sounder'
    })
  }

  addProgrammedZoneOutputs(outputs, input, alarm, [alarm])
}

export function addEvacuateOutputs(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  activation: EvacuateActivation
): void {
  for (const sounder of input.devices.filter((device) => device.isSounder)) {
    upsertOutput(
      outputs,
      createDelayedActivation(
        `device:${sounder.id}`,
        activation.causes,
        getSounderActivationDelaySeconds(input, activation.delaySeconds),
        'evacuate'
      )
    )
  }

  for (const point of input.nonAddressablePoints) {
    upsertOutput(
      outputs,
      createDelayedActivation(
        `non-addressable-sounder:${point.id}`,
        activation.causes,
        getSounderActivationDelaySeconds(input, activation.delaySeconds),
        'evacuate'
      )
    )
  }

  for (const output of input.devices.filter(
    (device) => device.evacuateIO && device.isOutputCapable && !device.isSounder
  )) {
    if (output.disabled) {
      upsertOutput(outputs, {
        outputId: `device:${output.id}`,
        state: 'disabled',
        causes: activation.causes,
        remainingDelaySeconds: 0,
        reason: 'disabled-output'
      })
      continue
    }

    upsertOutput(
      outputs,
      createDelayedActivation(
        `device:${output.id}`,
        activation.causes,
        activation.delaySeconds,
        'evacuate-io'
      )
    )
  }

  upsertOutput(
    outputs,
    createDelayedActivation(
      `evacuate:${input.network.id}`,
      activation.causes,
      activation.delaySeconds,
      'evacuate'
    )
  )
}

function addSounderGroupOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  devices: FireDevice[],
  nonAddressablePoints: NonAddressableSounderPoint[],
  groupId: number | undefined,
  sounderDelaysEnabled: boolean,
  relation: OutputRelation
): void {
  if (groupId === undefined) {
    return
  }

  if (isSounderOutputInhibited(alarm.device, relation)) {
    upsertOutput(outputs, {
      outputId: `sounder-group:${alarm.panel.id}:${groupId}`,
      state: 'inhibited',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'inhibit-sounders'
    })
    return
  }

  if (hasOnlyDisabledSounderMembers(alarm.panel, devices, groupId)) {
    upsertOutput(outputs, {
      outputId: `sounder-group:${alarm.panel.id}:${groupId}`,
      state: 'disabled',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'disabled-output'
    })
    return
  }

  const activation = createDelayedActivation(
    `sounder-group:${alarm.panel.id}:${groupId}`,
    [alarm.device.id],
    getSounderDelaySeconds(alarm, sounderDelaysEnabled),
    getSounderDelayReason(alarm)
  )
  upsertOutput(outputs, activation)
  addNonAddressableSounderGroupOutputs(outputs, alarm, nonAddressablePoints, groupId, activation)
}

function addNonAddressableSounderGroupOutputs(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  nonAddressablePoints: NonAddressableSounderPoint[],
  groupId: number,
  groupActivation: OutputActivation
): void {
  const group = alarm.panel.sounderGroups.find((candidate) => candidate.groupId === groupId)
  if (!group || group.nonAddressableMembers.length === 0) {
    return
  }

  for (const member of group.nonAddressableMembers) {
    if (isSilentSounderMode(member.status)) {
      continue
    }

    const channel = member.nonAddressable1
      ? 'nonAddressable1'
      : member.nonAddressable2
        ? 'nonAddressable2'
        : undefined
    if (!channel) {
      continue
    }

    for (const point of nonAddressablePoints) {
      if (
        point.panelId !== alarm.panel.id ||
        point.sounderGroupId !== groupId ||
        point.channel !== channel ||
        (member.cieId !== undefined && point.cieId !== member.cieId)
      ) {
        continue
      }

      upsertOutput(outputs, {
        ...groupActivation,
        outputId: `non-addressable-sounder:${point.id}`
      })
    }
  }
}

function addDeviceSounderOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  sounder: FireDevice,
  sounderDelaysEnabled: boolean
): void {
  if (isSounderOutputInhibited(alarm.device, 'zonal')) {
    upsertOutput(outputs, {
      outputId: `device:${sounder.id}`,
      state: 'inhibited',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'inhibit-sounders'
    })
    return
  }

  if (sounder.disabled) {
    upsertOutput(outputs, {
      outputId: `device:${sounder.id}`,
      state: 'disabled',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'disabled-output'
    })
    return
  }

  upsertOutput(
    outputs,
    createDelayedActivation(
      `device:${sounder.id}`,
      [alarm.device.id],
      getSounderDelaySeconds(alarm, sounderDelaysEnabled),
      getSounderDelayReason(alarm)
    )
  )
}

function addIOGroupOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  devices: FireDevice[],
  groupId: number | undefined,
  delaysEnabled: boolean,
  relation: OutputRelation
): void {
  if (groupId === undefined) {
    return
  }

  if (isIOOutputInhibited(alarm.device, relation)) {
    upsertOutput(outputs, {
      outputId: `io-group:${alarm.panel.id}:${groupId}`,
      state: 'inhibited',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'inhibit-io'
    })
    return
  }

  if (hasOnlyDisabledIOMembers(alarm.panel, devices, groupId)) {
    upsertOutput(outputs, {
      outputId: `io-group:${alarm.panel.id}:${groupId}`,
      state: 'disabled',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'disabled-output'
    })
    return
  }

  upsertOutput(
    outputs,
    createDelayedActivation(
      `io-group:${alarm.panel.id}:${groupId}`,
      [alarm.device.id],
      getIODelaySeconds(alarm, delaysEnabled),
      getIODelayReason(alarm)
    )
  )
}

function addCommonOutputs(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  alarm: EffectiveAlarm
): void {
  const commonSounderGroup = alarm.panel.sounderGroups.find((group) => group.groupId === 512)
  const commonIOGroup = alarm.panel.ioGroups.find((group) => group.groupId === 512)

  addSounderGroupOutput(
    outputs,
    alarm,
    input.devices,
    input.nonAddressablePoints,
    commonSounderGroup?.groupId,
    input.sounderDelaysEnabled !== false,
    'common'
  )
  addIOGroupOutput(
    outputs,
    alarm,
    input.devices,
    commonIOGroup?.groupId,
    input.sounderDelaysEnabled !== false,
    'common'
  )
}

function hasOnlyDisabledSounderMembers(
  panel: FirePanel,
  devices: FireDevice[],
  groupId: number
): boolean {
  const group = panel.sounderGroups.find((candidate) => candidate.groupId === groupId)
  if (!group || group.addressableMembers.length === 0) {
    return false
  }

  const memberDevices = group.addressableMembers
    .map((member) =>
      devices.find(
        (device) =>
          device.panelId === panel.id &&
          device.loopId === member.loopId &&
          device.address === member.physicalAddress &&
          device.isSounder
      )
    )
    .filter((device): device is FireDevice => device !== undefined)

  return memberDevices.length > 0 && memberDevices.every((device) => device.disabled)
}

export function hasOnlyDisabledIOMembers(
  panel: FirePanel,
  devices: FireDevice[],
  groupId: number
): boolean {
  const group = panel.ioGroups.find((candidate) => candidate.groupId === groupId)
  if (!group || group.members.length === 0) {
    return false
  }

  const memberDevices = group.members
    .map((member) =>
      devices.find(
        (device) =>
          device.panelId === panel.id &&
          device.loopId === member.loopId &&
          device.address === member.physicalAddress &&
          device.isOutputCapable
      )
    )
    .filter((device): device is FireDevice => device !== undefined)

  return memberDevices.length > 0 && memberDevices.every((device) => device.disabled)
}

export function addFireBrigadeOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm
): void {
  if (alarm.device.inhibitRelays) {
    upsertOutput(outputs, {
      outputId: `fire-brigade:${alarm.panel.id}`,
      state: 'inhibited',
      causes: [alarm.device.id],
      remainingDelaySeconds: 0,
      reason: 'inhibit-relays'
    })
    return
  }

  upsertOutput(
    outputs,
    createDelayedActivation(
      `fire-brigade:${alarm.panel.id}`,
      [alarm.device.id],
      alarm.device.overrideDelays ? 0 : alarm.panel.general.fireBrigadeDelaySeconds,
      alarm.device.overrideDelays ? 'device-override-delay' : 'fire-brigade'
    )
  )
}

function getSounderDelaySeconds(alarm: EffectiveAlarm, sounderDelaysEnabled: boolean): number {
  if (!sounderDelaysEnabled) {
    return 0
  }

  if (alarm.device.overrideDelays || alarm.zone?.delayedSounders === false) {
    return 0
  }

  return alarm.panel.general.sounderDelaySeconds
}

function getSounderActivationDelaySeconds(input: CauseEffectInput, delaySeconds: number): number {
  return input.sounderDelaysEnabled === false ? 0 : delaySeconds
}

function getSounderDelayReason(alarm: EffectiveAlarm): DelayReason {
  if (alarm.device.overrideDelays) {
    return 'device-override-delay'
  }

  if (alarm.zone?.delayedSounders === false) {
    return 'zone-non-delayed-sounders'
  }

  if (alarm.zone?.delayedSounders === true) {
    return 'zone-delayed-sounders'
  }

  return 'general-sounder'
}

function getIODelaySeconds(alarm: EffectiveAlarm, delaysEnabled: boolean): number {
  if (!delaysEnabled) {
    return 0
  }

  if (alarm.device.ioOverrideDelay || alarm.device.overrideDelays) {
    return 0
  }

  return alarm.panel.general.inputOutputDelaySeconds
}

function getIODelayReason(alarm: EffectiveAlarm): DelayReason {
  if (alarm.device.ioOverrideDelay) {
    return 'io-override-delay'
  }

  if (alarm.device.overrideDelays) {
    return 'device-override-delay'
  }

  return 'io'
}

function isSounderOutputInhibited(device: FireDevice, relation: OutputRelation): boolean {
  return isRelationInhibited(getInhibitMode(device, 'sounder'), relation)
}

function isIOOutputInhibited(device: FireDevice, relation: OutputRelation): boolean {
  return isRelationInhibited(getInhibitMode(device, 'io'), relation)
}

function isRelationInhibited(mode: OutputInhibitMode, relation: OutputRelation): boolean {
  if (mode === 'ALL') {
    return true
  }

  if (mode === 'COMMON') {
    return relation === 'common'
  }

  if (mode === 'ZONAL') {
    return relation === 'zonal'
  }

  return false
}

function getInhibitMode(device: FireDevice, kind: 'sounder' | 'io'): OutputInhibitMode {
  const rawFields =
    kind === 'sounder'
      ? [device.raw.InhibitSounders, device.raw.inhibitSounders]
      : [device.raw.InhibitIO, device.raw.inhibitIO]
  const explicitMode = rawFields.map(normalizeInhibitMode).find((mode) => mode !== undefined)
  if (explicitMode) {
    return explicitMode
  }

  const fallback = kind === 'sounder' ? device.inhibitSounders : device.inhibitIO
  return fallback ? 'ALL' : 'NONE'
}

function normalizeInhibitMode(value: unknown): OutputInhibitMode | undefined {
  if (typeof value === 'boolean') {
    return value ? 'ALL' : 'NONE'
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? 'ALL' : 'NONE'
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toUpperCase()
  if (normalized === 'NONE' || normalized === 'FALSE' || normalized === '0') {
    return 'NONE'
  }
  if (normalized === 'COMMON') {
    return 'COMMON'
  }
  if (normalized === 'ZONAL' || normalized === 'ZONE') {
    return 'ZONAL'
  }
  if (normalized === 'ALL' || normalized === 'TRUE' || normalized === '1') {
    return 'ALL'
  }

  return undefined
}

function isSilentSounderMode(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === 'silent' || normalized === 'silence' || normalized === 'off'
}

export function upsertOutput(outputs: Map<string, OutputActivation>, next: OutputActivation): void {
  const existing = outputs.get(next.outputId)
  if (!existing) {
    outputs.set(next.outputId, next)
    return
  }

  outputs.set(next.outputId, {
    ...preferOutputState(existing, next),
    causes: Array.from(new Set([...existing.causes, ...next.causes]))
  })
}

function preferOutputState(first: OutputActivation, second: OutputActivation): OutputActivation {
  const rank = {
    active: 4,
    delayActive: 3,
    inhibited: 2,
    disabled: 1,
    normal: 0
  }

  return rank[second.state] > rank[first.state] ? second : first
}
