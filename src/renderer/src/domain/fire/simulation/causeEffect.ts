import type {
  FireDevice,
  FireNetwork,
  FirePanel,
  FireZone,
  NonAddressableSounderPoint
} from '../types'
import type {
  ActiveFault,
  ActiveInputAlarm,
  OutputActivation,
  SoundState,
  SystemState
} from './types'
import {
  addEvacuateOutputs,
  addFireBrigadeOutput,
  addPresetSounders,
  addProgrammedZoneOutputs,
  hasOnlyDisabledIOMembers,
  upsertOutput
} from './causeEffectOutputs'

export interface CauseEffectInput {
  network: FireNetwork
  devices: FireDevice[]
  nonAddressablePoints: NonAddressableSounderPoint[]
  activeInputAlarms: ActiveInputAlarm[]
  activeFaults?: ActiveFault[]
  evacuateActive?: boolean
  sounderDelaysEnabled?: boolean
}

export type CauseEffectResult = OutputActivation[] & {
  systemState: SystemState
  soundState: SoundState
}

export interface EffectiveAlarm {
  alarm: ActiveInputAlarm
  device: FireDevice
  panel: FirePanel
  zone?: FireZone
}

export interface EvacuateActivation {
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
