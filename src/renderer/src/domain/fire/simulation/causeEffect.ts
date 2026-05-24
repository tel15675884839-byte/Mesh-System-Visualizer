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
      addProgrammedZoneOutputs(outputs, input.devices, alarm, effectiveAlarms)
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

  if (input.evacuateActive) {
    addEvacuateSounders(outputs, input)
    const maxDelaySeconds = Math.max(
      ...input.network.panels.map((panel) => panel.general.evacuateDelaySeconds),
      0
    )
    upsertOutput(
      outputs,
      createDelayedActivation(
        `evacuate:${input.network.id}`,
        ['manual-evacuate'],
        maxDelaySeconds,
        'evacuate'
      )
    )
  }

  const hasFireSound = effectiveAlarms.length > 0 || input.evacuateActive === true
  const hasFaultSound = (input.activeFaults?.length ?? 0) > 0
  const soundState: SoundState = hasFireSound ? 'fire' : hasFaultSound ? 'fault' : 'silent'
  const systemState: SystemState =
    effectiveAlarms.length > 0
      ? 'fireAlarm'
      : input.evacuateActive
        ? 'evacuate'
        : hasFaultSound
          ? 'fault'
          : 'normal'

  return Object.assign(Array.from(outputs.values()), {
    systemState,
    soundState
  })
}

function addProgrammedZoneOutputs(
  outputs: Map<string, OutputActivation>,
  devices: FireDevice[],
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
    addSounderGroupOutput(outputs, alarm, devices, zone.sounderGroupAlarm2)
    addIOGroupOutput(outputs, alarm, devices, zone.ioGroup1Alarm2)
    return
  }

  addSounderGroupOutput(outputs, alarm, devices, zone.sounderGroupAlarm1)
  addIOGroupOutput(outputs, alarm, devices, zone.ioGroup1Alarm1)
  addIOGroupOutput(outputs, alarm, devices, zone.ioGroup2Alarm1)
  addIOGroupOutput(outputs, alarm, devices, zone.ioGroup3Alarm1)
  addIOGroupOutput(outputs, alarm, devices, zone.ioGroup4Alarm1)
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

  addProgrammedZoneOutputs(outputs, input.devices, alarm, [alarm])
}

function addEvacuateSounders(
  outputs: Map<string, OutputActivation>,
  input: CauseEffectInput
): void {
  for (const sounder of input.devices.filter((device) => device.isSounder)) {
    if (sounder.disabled) {
      upsertOutput(outputs, {
        outputId: `device:${sounder.id}`,
        state: 'disabled',
        causes: ['manual-evacuate'],
        remainingDelaySeconds: 0,
        reason: 'disabled-output'
      })
      continue
    }

    upsertOutput(outputs, {
      outputId: `device:${sounder.id}`,
      state: 'active',
      causes: ['manual-evacuate'],
      remainingDelaySeconds: 0,
      reason: 'evacuate'
    })
  }

  for (const point of input.nonAddressablePoints) {
    upsertOutput(outputs, {
      outputId: `non-addressable-sounder:${point.id}`,
      state: 'active',
      causes: ['manual-evacuate'],
      remainingDelaySeconds: 0,
      reason: 'evacuate'
    })
  }
}

function addSounderGroupOutput(
  outputs: Map<string, OutputActivation>,
  alarm: EffectiveAlarm,
  devices: FireDevice[],
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

  upsertOutput(
    outputs,
    createDelayedActivation(
      `sounder-group:${alarm.panel.id}:${groupId}`,
      [alarm.device.id],
      getSounderDelaySeconds(alarm),
      getSounderDelayReason(alarm)
    )
  )
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
