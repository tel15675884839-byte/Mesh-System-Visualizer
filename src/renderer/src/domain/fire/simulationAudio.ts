import { getDeviceSimulationOutput } from './simulationOutputMapping'
import type { OutputActivation, SoundState } from './simulation/types'
import type { FireDevice, FireProject } from './types'

export interface SimulationAlarmAudioInput {
  simulationMode: boolean
  soundEnabled: boolean
  soundState: SoundState
  project: FireProject
  devices: FireDevice[]
  outputs: OutputActivation[]
}

export function shouldPlaySimulationAlarmAudio({
  simulationMode,
  soundEnabled,
  soundState,
  project,
  devices,
  outputs
}: SimulationAlarmAudioInput): boolean {
  if (!simulationMode || !soundEnabled || soundState === 'silent') {
    return false
  }

  if (soundState === 'fault') {
    return true
  }

  const hasActiveAddressableSounder = devices.some((device) => {
    if (!device.isSounder) {
      return false
    }

    return getDeviceSimulationOutput(project, outputs, device)?.state === 'active'
  })
  if (hasActiveAddressableSounder) {
    return true
  }

  return outputs.some(
    (output) => output.state === 'active' && output.outputId.startsWith('non-addressable-sounder:')
  )
}
