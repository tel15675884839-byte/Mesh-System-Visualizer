import { describe, expect, it } from 'vitest'

import {
  getDeviceIconPlanSize,
  getDeviceIconWorldBottomGap,
  getDeviceIconWorldCenterHeight,
  getDeviceIconWorldSize
} from '../deviceSizing'

describe('device sizing', () => {
  it('keeps 2D and 3D icon bases in the same map scale', () => {
    expect(getDeviceIconPlanSize(1)).toBe(24)
    expect(getDeviceIconWorldSize(1, 0.08)).toBeCloseTo(1.92)
    expect(getDeviceIconWorldSize(2, 0.08)).toBeCloseTo(getDeviceIconPlanSize(2) * 0.08)
  })

  it('clamps icon scale consistently for 2D and 3D views', () => {
    expect(getDeviceIconPlanSize(0)).toBeCloseTo(9.6)
    expect(getDeviceIconWorldSize(99, 0.08)).toBeCloseTo(5.76)
  })

  it('keeps the 3D icon bottom gap fixed across icon scales', () => {
    const smallIconSize = getDeviceIconWorldSize(0.4, 0.08)
    const normalIconSize = getDeviceIconWorldSize(1, 0.08)
    const selectedIconSize = normalIconSize * 1.2
    const bottomGap = getDeviceIconWorldBottomGap()

    expect(bottomGap).toBe(0.2)
    expect(getDeviceIconWorldCenterHeight(smallIconSize) - smallIconSize / 2).toBeCloseTo(bottomGap)
    expect(getDeviceIconWorldCenterHeight(normalIconSize) - normalIconSize / 2).toBeCloseTo(
      bottomGap
    )
    expect(getDeviceIconWorldCenterHeight(selectedIconSize) - selectedIconSize / 2).toBeCloseTo(
      bottomGap
    )
  })
})
