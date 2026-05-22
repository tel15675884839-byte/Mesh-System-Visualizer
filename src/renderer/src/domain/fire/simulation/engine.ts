import type { FireDevice, FireNetwork, NonAddressableSounderPoint } from '../types'
import { resolveCauseAndEffect } from './causeEffect'
import { skipOutputDelay, tickDelayedOutputs } from './delays'
import type { ActiveFault, ActiveInputAlarm, SimulationEvent, SimulationState } from './types'

export interface SimulationEngineInput {
  network: FireNetwork
  devices: FireDevice[]
  nonAddressablePoints: NonAddressableSounderPoint[]
  now: number
}

export type SimulationAction =
  | { type: 'activate-input'; deviceId: string; at: number }
  | { type: 'restore-input'; deviceId: string; at: number }
  | { type: 'trigger-fault'; deviceId: string; at: number }
  | { type: 'restore-fault'; deviceId: string; at: number }
  | { type: 'evacuate'; at: number }
  | { type: 'buzzer-silence'; at: number }
  | { type: 'system-reset'; at: number }
  | { type: 'tick'; at: number; elapsedSeconds: number }
  | { type: 'skip-delay'; outputId: string; at: number }

export function createInitialSimulationState(): SimulationState {
  return {
    systemState: 'normal',
    soundState: 'silent',
    buzzerSilenced: false,
    activeInputAlarms: [],
    activeFaults: [],
    outputs: [],
    eventLog: []
  }
}

export function reduceSimulation(
  state: SimulationState,
  input: SimulationEngineInput,
  action: SimulationAction
): SimulationState {
  if (action.type === 'tick') {
    return {
      ...state,
      outputs: tickDelayedOutputs(state.outputs, action.elapsedSeconds)
    }
  }

  if (action.type === 'skip-delay') {
    return {
      ...state,
      outputs: skipOutputDelay(state.outputs, action.outputId),
      eventLog: appendEvent(state.eventLog, action.at, 'skip-delay', `Skipped delay for ${action.outputId}`)
    }
  }

  const nextSources = reduceSources(state, action)
  const resolved = resolveCauseAndEffect({
    network: input.network,
    devices: input.devices,
    nonAddressablePoints: input.nonAddressablePoints,
    activeInputAlarms: nextSources.activeInputAlarms,
    activeFaults: nextSources.activeFaults,
    evacuateActive: nextSources.manualEvacuateActive
  })

  const buzzerSilenced = action.type === 'buzzer-silence' ? true : shouldKeepBuzzerSilenced(state, action)
  const soundState = buzzerSilenced ? 'silent' : resolved.soundState

  return {
    ...state,
    ...nextSources,
    systemState: resolved.systemState,
    soundState,
    buzzerSilenced,
    outputs: mergeContinuingOutputState(state.outputs, [...resolved]),
    eventLog: appendEvent(state.eventLog, action.at, action.type, eventMessage(action), actionDeviceId(action))
  }
}

function mergeContinuingOutputState(previousOutputs: SimulationState['outputs'], nextOutputs: SimulationState['outputs']): SimulationState['outputs'] {
  const previousById = new Map(previousOutputs.map((output) => [output.outputId, output]))

  return nextOutputs.map((next) => {
    const previous = previousById.get(next.outputId)
    if (!previous) {
      return next
    }

    if (previous.state === 'active' && next.state === 'delayActive') {
      return {
        ...next,
        state: 'active',
        remainingDelaySeconds: 0,
        reason: previous.reason ?? next.reason
      }
    }

    if (previous.state === 'delayActive' && next.state === 'delayActive') {
      return {
        ...next,
        remainingDelaySeconds: Math.min(previous.remainingDelaySeconds ?? 0, next.remainingDelaySeconds ?? 0)
      }
    }

    return next
  })
}

function reduceSources(
  state: SimulationState,
  action: Exclude<SimulationAction, { type: 'tick'; at: number; elapsedSeconds: number } | { type: 'skip-delay'; outputId: string; at: number }>
): Pick<SimulationState, 'activeInputAlarms' | 'activeFaults' | 'manualEvacuateActive' | 'evacuatedAt'> {
  switch (action.type) {
    case 'activate-input':
      return {
        activeInputAlarms: upsertSource(state.activeInputAlarms, action.deviceId, action.at),
        activeFaults: state.activeFaults,
        manualEvacuateActive: state.manualEvacuateActive,
        evacuatedAt: state.evacuatedAt
      }
    case 'restore-input':
      return {
        activeInputAlarms: state.activeInputAlarms.filter((alarm) => alarm.deviceId !== action.deviceId),
        activeFaults: state.activeFaults,
        manualEvacuateActive: state.manualEvacuateActive,
        evacuatedAt: state.evacuatedAt
      }
    case 'trigger-fault':
      return {
        activeInputAlarms: state.activeInputAlarms,
        activeFaults: upsertSource(state.activeFaults, action.deviceId, action.at),
        manualEvacuateActive: state.manualEvacuateActive,
        evacuatedAt: state.evacuatedAt
      }
    case 'restore-fault':
      return {
        activeInputAlarms: state.activeInputAlarms,
        activeFaults: state.activeFaults.filter((fault) => fault.deviceId !== action.deviceId),
        manualEvacuateActive: state.manualEvacuateActive,
        evacuatedAt: state.evacuatedAt
      }
    case 'evacuate':
      return {
        activeInputAlarms: state.activeInputAlarms,
        activeFaults: state.activeFaults,
        manualEvacuateActive: true,
        evacuatedAt: action.at
      }
    case 'system-reset':
      return {
        activeInputAlarms: state.activeInputAlarms,
        activeFaults: state.activeFaults,
        manualEvacuateActive: false,
        evacuatedAt: undefined
      }
    case 'buzzer-silence':
      return {
        activeInputAlarms: state.activeInputAlarms,
        activeFaults: state.activeFaults,
        manualEvacuateActive: state.manualEvacuateActive,
        evacuatedAt: state.evacuatedAt
      }
  }
}

function upsertSource<T extends ActiveInputAlarm | ActiveFault>(sources: T[], deviceId: string, at: number): T[] {
  if (sources.some((source) => source.deviceId === deviceId)) {
    return sources
  }

  return [...sources, { deviceId, activatedAt: at } as T]
}

function shouldKeepBuzzerSilenced(state: SimulationState, action: SimulationAction): boolean {
  if (!state.buzzerSilenced) {
    return false
  }

  return action.type !== 'activate-input' && action.type !== 'trigger-fault' && action.type !== 'evacuate'
}

function appendEvent(
  eventLog: SimulationEvent[],
  timestamp: number,
  type: string,
  message: string,
  relatedDeviceId?: string
): SimulationEvent[] {
  return [
    ...eventLog,
    {
      id: `${timestamp}:${type}:${eventLog.length + 1}`,
      timestamp,
      type,
      message,
      relatedDeviceId
    }
  ]
}

function eventMessage(action: SimulationAction): string {
  switch (action.type) {
    case 'activate-input':
      return `Activated input ${action.deviceId}`
    case 'restore-input':
      return `Restored input ${action.deviceId}`
    case 'trigger-fault':
      return `Triggered fault ${action.deviceId}`
    case 'restore-fault':
      return `Restored fault ${action.deviceId}`
    case 'evacuate':
      return 'Manual evacuate started'
    case 'buzzer-silence':
      return 'Buzzer silenced'
    case 'system-reset':
      return 'System reset requested'
    case 'tick':
      return 'Simulation tick'
    case 'skip-delay':
      return `Skipped delay for ${action.outputId}`
  }
}

function actionDeviceId(action: SimulationAction): string | undefined {
  return 'deviceId' in action ? action.deviceId : undefined
}
