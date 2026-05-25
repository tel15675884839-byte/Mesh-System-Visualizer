import type {
  FireDevice,
  FireNetwork,
  FirePanel,
  FireZone,
  NonAddressableSounderPoint
} from '../types'
import { createDelayedActivation, type DelayReason } from './delays'
import type {
  ActiveFault,
  ActiveInputAlarm,
  OutputActivation,
  SoundState,
  SystemState
} from './types'

export interface CauseEffectInput {
  network: FireNetwork
  devices: FireDevice[]
  nonAddressablePoints: NonAddressableSounderPoint[]
  activeInputAlarms: ActiveInputAlarm[]
  activeFaults?: ActiveFault[]
  evacuateActive?: boolean
}

export type CauseEffectResult = OutputActivation[] & {
  systemState: SystemState
  soundState: SoundState
}

interface EffectiveAlarm {
  alarm: ActiveInputAlarm
  device: FireDevice
  panel: FirePanel
  zone?: FireZone
}

interface EvacuateActivation {
  causes: string[]
  delaySeconds: number
}

export function resolveCauseAndEffect(input: CauseEffectInput): CauseEffectResult {
  const effectiveAlarms = input.activeInputAlarms.flatMap((alarm): EffectiveAlarm[] => {
    const device = input.devices.find((candidate) => candidate.id === alarm.deviceId)
    if (!device || !device.isInputCapable || device.disabled) {
      return []
    }

    const panel = input.network.panels.find((candidate) => candidate.id === device.panelId)
    if (!panel) {
      return []
    }

    const zone = panel.zones.find((candidate) => candidate.zoneNumber === device.zoneNumber)
    if (zone && !zone.enabled) {
      return []
    }

    return [{ alarm, device, panel, zone }]
  })

  const outputs = new Map<string, OutputActivation>()

  for (const alarm of effectiveAlarms) {
    if (input.network.sounderMode === 'Preset') {
      addPresetSounders(outputs, input, alarm)
    } else {
      addProgrammedZoneOutputs(outputs, input, alarm, effectiveAlarms)
    }

    addFireBrigadeOutput(outputs, alarm)
  }

  for (const fault of input.activeFaults ?? []) {
    const device = input.devices.find((candidate) => candidate.id === fault.deviceId)
    const panel = device
      ? input.network.panels.find((candidate) => candidate.id === device.panelId)
      : input.network.panels[0]
    const faultIOGroup = panel?.general.faultIOGroup

    if (panel && faultIOGroup !== undefined) {
      if (hasOnlyDisabledIOMembers(panel, input.devices, faultIOGroup)) {
        upsertOutput(outputs, {
          outputId: `fault-io-group:${panel.id}:${faultIOGroup}`,
          state: 'disabled',
          causes: [fault.deviceId],
          remainingDelaySeconds: 0,
          reason: 'disabled-output'
        })
        continue
      }

      upsertOutput(outputs, {
        outputId: `fault-io-group:${panel.id}:${faultIOGroup}`,
        state: 'active',
        causes: [fault.deviceId],
        remainingDelaySeconds: 0,
        reason: 'fault'
      })
    }
  }

  const evacuateActivations = collectEvacuateActivations(input, effectiveAlarms)
  for (const activation of evacuateActivations) {
    addEvacuateOutputs(outputs, input, activation)
  }

  const hasEvacuate = evacuateActivations.length > 0
  const hasFireSound = effectiveAlarms.length > 0 || hasEvacuate
  const hasFaultSound = (input.activeFaults?.length ?? 0) > 0
  const soundState: SoundState = hasFireSound ? 'fire' : hasFaultSound ? 'fault' : 'silent'
  const systemState: SystemState =
    effectiveAlarms.length > 0
      ? 'fireAlarm'
      : hasEvacuate
        ? 'evacuate'
        : hasFaultSound
          ? 'fault'
          : 'normal'

  return Object.assign(Array.from(outputs.values()), {
    systemState,
    soundState
  })
}

function collectEvacuateActivations(
  input: CauseEffectInput,
  effectiveAlarms: EffectiveAlarm[]
): EvacuateActivation[] {
  const activations: EvacuateActivation[] = []

  if (input.evacuateActive) {
    activations.push({
      causes: ['manual-evacuate'],
      delaySeconds: getNetworkEvacuateDelaySeconds(input.network)
    })
  }

  for (const alarm of effectiveAlarms) {
    if (alarm.device.immediateEvacuate) {
      activations.push({
        causes: [alarm.device.id],
        delaySeconds: 0
      })
      continue
    }

    if (alarmStartsEvacuateTimer(alarm, effectiveAlarms)) {
      activations.push({
        causes: [alarm.device.id],
        delaySeconds: alarm.panel.general.evacuateDelaySeconds
      })
    }
  }

  return activations
}

function alarmStartsEvacuateTimer(
  alarm: EffectiveAlarm,
  effectiveAlarms: EffectiveAlarm[]
): boolean {
  if (alarm.device.setEvacuateTimer) {
    return true
  }

  if (alarm.panel.general.onManualCallPoints && isManualCallPoint(alarm.device)) {
    return true
  }

  return alarm.panel.general.onTwoDevices && hasTwoEffectiveAlarmsOnPanel(alarm, effectiveAlarms)
}

function getNetworkEvacuateDelaySeconds(network: FireNetwork): number {
  return Math.max(...network.panels.map((panel) => panel.general.evacuateDelaySeconds), 0)
}

function isManualCallPoint(device: FireDevice): boolean {
  return (
    device.type === 'manual_call_point' ||
    device.friendlyTypeName.trim().toLowerCase() === 'manual call point'
  )
}

function hasTwoEffectiveAlarmsOnPanel(
  alarm: EffectiveAlarm,
  effectiveAlarms: EffectiveAlarm[]
): boolean {
  return (
    effectiveAlarms.filter((candidate) => candidate.device.panelId === alarm.device.panelId)
      .length >= 2
  )
}

function addProgrammedZoneOutputs(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  alarm: EffectiveAlarm,
  effectiveAlarms: EffectiveAlarm[]
): void {
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
      zone.sounderGroupAlarm2
    )
    addIOGroupOutput(outputs, alarm, input.devices, zone.ioGroup1Alarm2)
    return
  }

  addSounderGroupOutput(
    outputs,
    alarm,
    input.devices,
    input.nonAddressablePoints,
    zone.sounderGroupAlarm1
  )
  addIOGroupOutput(outputs, alarm, input.devices, zone.ioGroup1Alarm1)
  addIOGroupOutput(outputs, alarm, input.devices, zone.ioGroup2Alarm1)
  addIOGroupOutput(outputs, alarm, input.devices, zone.ioGroup3Alarm1)
  addIOGroupOutput(outputs, alarm, input.devices, zone.ioGroup4Alarm1)
}

function addPresetSounders(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  alarm: EffectiveAlarm
): void {
  for (const sounder of input.devices.filter((device) => device.isSounder)) {
    addDeviceSounderOutput(outputs, alarm, sounder)
  }

  for (const point of input.nonAddressablePoints) {
    const state = alarm.device.inhibitSounders ? 'inhibited' : 'active'
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

function addEvacuateOutputs(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput,
  activation: EvacuateActivation
): void {
  for (const sounder of input.devices.filter((device) => device.isSounder)) {
    if (sounder.disabled) {
      upsertOutput(outputs, {
        outputId: `device:${sounder.id}`,
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
        `device:${sounder.id}`,
        activation.causes,
        activation.delaySeconds,
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
        activation.delaySeconds,
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
  groupId: number | undefined
): void {
  if (groupId === undefined) {
    return
  }

  if (alarm.device.inhibitSounders) {
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
    getSounderDelaySeconds(alarm),
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
  sounder: FireDevice
): void {
  if (alarm.device.inhibitSounders) {
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
      getSounderDelaySeconds(alarm),
      getSounderDelayReason(alarm)
    )
  )
}

function addIOGroupOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  devices: FireDevice[],
  groupId: number | undefined
): void {
  if (groupId === undefined) {
    return
  }

  if (alarm.device.inhibitIO) {
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
      getIODelaySeconds(alarm),
      getIODelayReason(alarm)
    )
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

function hasOnlyDisabledIOMembers(
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

function addFireBrigadeOutput(outputs: Map<string, OutputActivation>, alarm: EffectiveAlarm): void {
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

function getSounderDelaySeconds(alarm: EffectiveAlarm): number {
  if (alarm.device.overrideDelays || alarm.zone?.delayedSounders === false) {
    return 0
  }

  return alarm.panel.general.sounderDelaySeconds
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

function getIODelaySeconds(alarm: EffectiveAlarm): number {
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

function isSilentSounderMode(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === 'silent' || normalized === 'silence' || normalized === 'off'
}

function upsertOutput(outputs: Map<string, OutputActivation>, next: OutputActivation): void {
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
