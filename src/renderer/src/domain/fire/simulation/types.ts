export type SystemState = 'normal' | 'fault' | 'evacuate' | 'fireAlarm'
export type OutputState = 'normal' | 'delayActive' | 'active' | 'inhibited' | 'disabled'
export type SoundState = 'silent' | 'fault' | 'fire'

export interface ActiveInputAlarm {
  deviceId: string
  activatedAt: number
}

export interface ActiveFault {
  deviceId: string
  activatedAt: number
}

export interface OutputActivation {
  outputId: string
  state: OutputState
  causes: string[]
  remainingDelaySeconds?: number
  reason?: string
}

export interface SimulationState {
  systemState: SystemState
  soundState: SoundState
  buzzerSilenced: boolean
  activeInputAlarms: ActiveInputAlarm[]
  activeFaults: ActiveFault[]
  outputs: OutputActivation[]
  eventLog: SimulationEvent[]
  manualEvacuateActive?: boolean
  evacuatedAt?: number
  soundersSilenced?: boolean
}

export interface SimulationEvent {
  id: string
  timestamp: number
  type: string
  message: string
  condition?: string
  relatedDeviceId?: string
  relatedOutputId?: string
}
