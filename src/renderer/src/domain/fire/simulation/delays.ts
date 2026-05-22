import type { OutputActivation } from './types'

export type DelayReason = 'general-sounder' | 'io' | 'fire-brigade' | 'evacuate' | 'zone-delayed-sounders'

export function createDelayedActivation(
  outputId: string,
  causes: string[],
  delaySeconds: number,
  reason: DelayReason
): OutputActivation {
  const remainingDelaySeconds = Math.max(0, delaySeconds)

  if (remainingDelaySeconds === 0) {
    return {
      outputId,
      state: 'active',
      causes,
      remainingDelaySeconds: 0,
      reason
    }
  }

  return {
    outputId,
    state: 'delayActive',
    causes,
    remainingDelaySeconds,
    reason
  }
}

export function tickDelayedOutputs(
  outputs: OutputActivation[],
  elapsedSeconds: number,
  timeScale: 1 | 5 | 10 | 30 = 1
): OutputActivation[] {
  const decrement = Math.max(0, elapsedSeconds) * timeScale

  return outputs.map((output) => {
    if (output.state !== 'delayActive') {
      return output
    }

    const remainingDelaySeconds = Math.max(0, (output.remainingDelaySeconds ?? 0) - decrement)

    return {
      ...output,
      state: remainingDelaySeconds === 0 ? 'active' : 'delayActive',
      remainingDelaySeconds
    }
  })
}

export function skipOutputDelay(outputs: OutputActivation[], outputId: string): OutputActivation[] {
  return outputs.map((output) => {
    if (output.outputId !== outputId || output.state !== 'delayActive') {
      return output
    }

    return {
      ...output,
      state: 'active',
      remainingDelaySeconds: 0
    }
  })
}
