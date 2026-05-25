import type { SoundState } from './simulation/types'

interface AudioParamLike {
  value: number
  cancelScheduledValues?: (startTime: number) => void
  setTargetAtTime?: (value: number, startTime: number, timeConstant: number) => void
  setValueAtTime?: (value: number, startTime: number) => void
}

interface OscillatorLike {
  type: OscillatorType | string
  frequency: AudioParamLike
  connect: (destination: AudioNode) => unknown
  start: () => void
  stop: () => void
  disconnect: () => void
}

interface GainLike {
  gain: AudioParamLike
  connect: (destination: AudioNode) => unknown
  disconnect: () => void
}

interface AudioContextLike {
  currentTime: number
  destination: AudioNode
  createOscillator: () => OscillatorLike
  createGain: () => GainLike
  resume?: () => Promise<void> | void
  close?: () => Promise<void> | void
}

interface SimulationAudioRuntimeWindow {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

export interface SimulationAudioRuntime {
  sync: (shouldPlay: boolean, soundState: SoundState | string) => void
  stop: () => void
}

export function createSimulationAudioRuntime(
  audioWindow: SimulationAudioRuntimeWindow
): SimulationAudioRuntime {
  let audioContext: AudioContextLike | null = null
  let oscillator: OscillatorLike | null = null
  let gainNode: GainLike | null = null

  function sync(shouldPlay: boolean, soundState: SoundState | string): void {
    if (!shouldPlay) {
      stop()
      return
    }

    const context = ensureAudioContext()
    if (!context) return

    if (!oscillator || !gainNode) {
      oscillator = context.createOscillator()
      gainNode = context.createGain()
      oscillator.type = soundState === 'fault' ? 'sawtooth' : 'square'
      setGain(gainNode.gain, 0.035, context.currentTime, 0)
      oscillator.connect(gainNode as unknown as AudioNode)
      gainNode.connect(context.destination)
      oscillator.start()
    }

    oscillator.frequency.setTargetAtTime?.(
      soundState === 'fault' ? 420 : 880,
      context.currentTime,
      0.02
    )
  }

  function ensureAudioContext(): AudioContextLike | null {
    if (audioContext) return audioContext

    const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext
    if (!AudioContextCtor) return null

    audioContext = new AudioContextCtor()
    void audioContext.resume?.()
    return audioContext
  }

  function stop(): void {
    const context = audioContext
    const gain = gainNode
    const activeOscillator = oscillator

    if (context && gain) {
      setGain(gain.gain, 0, context.currentTime, 0.01)
    } else if (gain) {
      gain.gain.value = 0
    }

    try {
      activeOscillator?.stop()
    } catch {
      // The node may already be stopped; cleanup below still disconnects the graph.
    }

    try {
      activeOscillator?.disconnect()
    } catch {
      // Ignore already-disconnected nodes.
    }

    try {
      gain?.disconnect()
    } catch {
      // Ignore already-disconnected nodes.
    }

    oscillator = null
    gainNode = null

    if (context) {
      void Promise.resolve(context.close?.()).catch(() => undefined)
    }
    audioContext = null
  }

  return { sync, stop }
}

function setGain(
  gain: AudioParamLike,
  value: number,
  currentTime: number,
  timeConstant: number
): void {
  gain.cancelScheduledValues?.(currentTime)

  if (gain.setTargetAtTime) {
    gain.setTargetAtTime(value, currentTime, timeConstant)
    return
  }

  if (gain.setValueAtTime) {
    gain.setValueAtTime(value, currentTime)
    return
  }

  gain.value = value
}
