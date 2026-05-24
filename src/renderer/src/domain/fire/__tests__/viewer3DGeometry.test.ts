import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FLOOR_HEIGHT_3D,
  MAX_FLOOR_HEIGHT_3D,
  getEffectiveFloorHeight3D,
  MIN_FLOOR_HEIGHT_3D
} from '../viewer3DGeometry'

describe('viewer 3D geometry', () => {
  it('uses a generous default floor spacing', () => {
    expect(getEffectiveFloorHeight3D(undefined)).toBe(DEFAULT_FLOOR_HEIGHT_3D)
  })

  it('clamps legacy tiny floor spacing to a visible minimum', () => {
    expect(getEffectiveFloorHeight3D(3)).toBe(MIN_FLOOR_HEIGHT_3D)
  })

  it('preserves explicitly larger floor spacing', () => {
    expect(getEffectiveFloorHeight3D(90)).toBe(90)
  })

  it('clamps very large floor spacing to the supported range', () => {
    expect(getEffectiveFloorHeight3D(999)).toBe(MAX_FLOOR_HEIGHT_3D)
  })
})
