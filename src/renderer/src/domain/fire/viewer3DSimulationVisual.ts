import type { SounderOutputPattern } from './simulationOutputMapping'

export type Viewer3DDeviceOutputState = 'active' | 'delayActive' | null

export interface Viewer3DDeviceAnimationInput {
  baseSize: number
  elapsedMs: number
  outputState: Viewer3DDeviceOutputState
  isSounder: boolean
  sounderPattern?: SounderOutputPattern
}

export interface Viewer3DDeviceAnimationFrame {
  color: string | null
  opacity: number
  scale: number
  ringOpacity: number
}

export function getViewer3DDeviceAnimationFrame({
  baseSize,
  elapsedMs,
  outputState,
  isSounder,
  sounderPattern
}: Viewer3DDeviceAnimationInput): Viewer3DDeviceAnimationFrame {
  if (outputState === 'active' && isSounder) {
    if (sounderPattern === 'continuous') {
      return {
        color: '#ef4444',
        opacity: 1,
        scale: baseSize * 1.08,
        ringOpacity: 0.85
      }
    }

    const flashOn = Math.floor(elapsedMs / 180) % 2 === 0
    const pulse = flashOn ? 1.12 : 1.06
    return {
      color: flashOn ? '#ef4444' : '#facc15',
      opacity: 1,
      scale: baseSize * pulse,
      ringOpacity: flashOn ? 0.9 : 0.65
    }
  }

  if (outputState === 'delayActive') {
    const pulse = Math.floor(elapsedMs / 700) % 2 === 0
    return {
      color: '#0ea5e9',
      opacity: pulse ? 0.9 : 0.55,
      scale: baseSize * (pulse ? 1.04 : 1),
      ringOpacity: pulse ? 0.6 : 0.28
    }
  }

  return {
    color: null,
    opacity: 1,
    scale: baseSize,
    ringOpacity: 0.85
  }
}
