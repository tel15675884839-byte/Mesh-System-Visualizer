import { describe, expect, it } from 'vitest'

import { createSimulationAudioRuntime } from '../simulationAudioRuntime'

class FakeAudioParam {
  value = 0
  targets: Array<{ value: number; startTime: number; timeConstant: number }> = []
  setValues: Array<{ value: number; startTime: number }> = []
  cancelCalls: number[] = []

  setTargetAtTime(value: number, startTime: number, timeConstant: number): void {
    this.value = value
    this.targets.push({ value, startTime, timeConstant })
  }

  setValueAtTime(value: number, startTime: number): void {
    this.value = value
    this.setValues.push({ value, startTime })
  }

  cancelScheduledValues(startTime: number): void {
    this.cancelCalls.push(startTime)
  }
}

class FakeOscillator {
  type = 'sine'
  frequency = new FakeAudioParam()
  connectedTo: unknown[] = []
  started = false
  stopped = false
  disconnected = false

  connect(destination?: unknown): void {
    this.connectedTo.push(destination)
  }

  start(): void {
    this.started = true
  }

  stop(): void {
    this.stopped = true
  }

  disconnect(): void {
    this.disconnected = true
  }
}

class FakeGain {
  gain = new FakeAudioParam()
  connectedTo: unknown[] = []
  disconnected = false

  connect(destination?: unknown): void {
    this.connectedTo.push(destination)
  }

  disconnect(): void {
    this.disconnected = true
  }
}

class FakeAudioContext {
  currentTime = 12
  destination = {} as AudioNode
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  resumeCalls = 0
  closeCalls = 0

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  resume(): void {
    this.resumeCalls += 1
  }

  close(): void {
    this.closeCalls += 1
  }
}

describe('simulation audio runtime', () => {
  it('mutes gain and releases the AudioContext when sound stops', () => {
    const contexts: FakeAudioContext[] = []
    const runtime = createSimulationAudioRuntime({
      AudioContext: class extends FakeAudioContext {
        constructor() {
          super()
          contexts.push(this)
        }
      }
    })

    runtime.sync(true, 'fire')
    runtime.sync(false, 'silent')

    const context = contexts[0]
    const oscillator = context.oscillators[0]
    const gain = context.gains[0]

    expect(gain.gain.value).toBe(0)
    expect(gain.gain.cancelCalls.at(-1)).toBe(12)
    expect(gain.gain.targets.at(-1)).toEqual({ value: 0, startTime: 12, timeConstant: 0.01 })
    expect(oscillator.stopped).toBe(true)
    expect(oscillator.disconnected).toBe(true)
    expect(gain.disconnected).toBe(true)
    expect(context.closeCalls).toBe(1)
  })

  it('can start again with a fresh oscillator after stopping', () => {
    const contexts: FakeAudioContext[] = []
    const runtime = createSimulationAudioRuntime({
      AudioContext: class extends FakeAudioContext {
        constructor() {
          super()
          contexts.push(this)
        }
      }
    })

    runtime.sync(true, 'fire')
    runtime.sync(false, 'silent')
    runtime.sync(true, 'fault')

    expect(contexts).toHaveLength(2)
    expect(contexts[0].oscillators[0].stopped).toBe(true)
    expect(contexts[1].oscillators[0].started).toBe(true)
    expect(contexts[1].oscillators[0].type).toBe('sawtooth')
  })
})
