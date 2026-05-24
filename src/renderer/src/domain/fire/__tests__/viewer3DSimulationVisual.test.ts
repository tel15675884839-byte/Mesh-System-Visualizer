import { describe, expect, it } from 'vitest'
import { getViewer3DDeviceAnimationFrame } from '../viewer3DSimulationVisual'

describe('viewer 3D simulation visuals', () => {
  it('flashes active sounder outputs between red and yellow', () => {
    const first = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'active',
      isSounder: true
    })
    const second = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 180,
      outputState: 'active',
      isSounder: true
    })

    expect(first.color).toBe('#ef4444')
    expect(second.color).toBe('#facc15')
    expect(first.scale).toBeGreaterThan(10)
    expect(second.scale).toBeGreaterThan(10)
  })

  it('uses a slower cyan pulse for delayed outputs', () => {
    const first = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'delayActive',
      isSounder: true
    })
    const second = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 700,
      outputState: 'delayActive',
      isSounder: true
    })

    expect(first.color).toBe('#0ea5e9')
    expect(second.color).toBe('#0ea5e9')
    expect(first.opacity).not.toBe(second.opacity)
  })
})
