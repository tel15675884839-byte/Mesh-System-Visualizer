import type { SounderOutputPattern } from './simulationOutputMapping'

export type Viewer3DDeviceOutputState = 'active' | 'delayActive' | null

export interface Viewer3DDeviceAnimationInput {
  baseSize: number
  elapsedMs: number
  outputState: Viewer3DDeviceOutputState
  isSounder: boolean
  sounderPattern?: SounderOutputPattern
  inputActive?: boolean
  isIO?: boolean
}

export interface Viewer3DDeviceAnimationFrame {
  color: string | null
  accentColor: string | null
  opacity: number
  scale: number
  ringOpacity: number
}

export interface Viewer3DSelectedBracketPoint {
  x: number
  y: number
  z: number
}

export interface Viewer3DSelectedBracketAnimationFrame {
  scale: number
  opacity: number
}

export function getSelectedDeviceBracketPoints(size: number): Viewer3DSelectedBracketPoint[] {
  const d = size * 0.82
  const l = size * 0.26
  const inner = d - l

  return [
    { x: inner, y: 0, z: d },
    { x: d, y: 0, z: d },
    { x: d, y: 0, z: inner },
    { x: d, y: 0, z: d },
    { x: -inner, y: 0, z: d },
    { x: -d, y: 0, z: d },
    { x: -d, y: 0, z: inner },
    { x: -d, y: 0, z: d },
    { x: inner, y: 0, z: -d },
    { x: d, y: 0, z: -d },
    { x: d, y: 0, z: -inner },
    { x: d, y: 0, z: -d },
    { x: -inner, y: 0, z: -d },
    { x: -d, y: 0, z: -d },
    { x: -d, y: 0, z: -inner },
    { x: -d, y: 0, z: -d }
  ]
}

export function getSelectedDeviceBracketAnimationFrame(
  elapsedMs: number
): Viewer3DSelectedBracketAnimationFrame {
  const breath = Math.sin(elapsedMs * 0.004)
  return {
    scale: 1 + breath * 0.08,
    opacity: 0.8 + breath * 0.15
  }
}

export function getViewer3DDeviceAnimationFrame({
  baseSize,
  elapsedMs,
  outputState,
  isSounder,
  sounderPattern,
  isIO
}: Viewer3DDeviceAnimationInput): Viewer3DDeviceAnimationFrame {
  if (isIO && outputState === 'active') {
    const scale = baseSize * (1.1 + 0.1 * Math.sin(elapsedMs * 0.005))
    const ringOpacity = 0.72 + 0.17 * Math.sin(elapsedMs * 0.005)
    return {
      color: null,
      accentColor: '#2563eb',
      opacity: 1,
      scale,
      ringOpacity
    }
  }

  if (outputState === 'active' && isSounder) {
    if (sounderPattern === 'continuous') {
      return {
        color: null,
        accentColor: '#ef4444',
        opacity: 1,
        scale: baseSize * 1.08,
        ringOpacity: 0.85
      }
    }

    const flashOn = Math.floor(elapsedMs / 180) % 2 === 0
    const pulse = flashOn ? 1.12 : 1.06
    return {
      color: null,
      accentColor: flashOn ? '#ef4444' : '#facc15',
      opacity: 1,
      scale: baseSize * pulse,
      ringOpacity: flashOn ? 0.9 : 0.65
    }
  }

  if (outputState === 'delayActive') {
    const pulse = Math.floor(elapsedMs / 700) % 2 === 0
    return {
      color: null,
      accentColor: '#0ea5e9',
      opacity: pulse ? 0.9 : 0.55,
      scale: baseSize * (pulse ? 1.04 : 1),
      ringOpacity: pulse ? 0.6 : 0.28
    }
  }

  return {
    color: null,
    accentColor: null,
    opacity: 1,
    scale: baseSize,
    ringOpacity: 0
  }
}
