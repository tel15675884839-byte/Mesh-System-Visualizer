import { describe, expect, it } from 'vitest'
import type { FireDevice } from '../types'
import { getDeviceStatusAppearance } from '../deviceVisualState'

describe('device visual status appearance', () => {
  it('uses an explicit amber marker for disabled devices without tinting the icon texture', () => {
    const appearance = getDeviceStatusAppearance(makeDevice({ disabled: true }))

    expect(appearance.state).toBe('disabled')
    expect(appearance.badgeLabel).toBe('D')
    expect(appearance.color).toBe('#f59e0b')
    expect(appearance.iconOpacity).toBeGreaterThan(0.55)
    expect(appearance.spriteColor).toBe('#ffffff')
  })

  it('uses a separate marker for inhibited devices', () => {
    const appearance = getDeviceStatusAppearance(makeDevice({ inhibitIO: true }))

    expect(appearance.state).toBe('inhibited')
    expect(appearance.badgeLabel).toBe('I')
    expect(appearance.color).toBe('#7c3aed')
    expect(appearance.spriteColor).toBe('#ffffff')
  })

  it('treats every inhibit flag as the same static inhibited visual state', () => {
    for (const inhibitedFlag of ['inhibitSounders', 'inhibitIO', 'inhibitRelays'] as const) {
      const appearance = getDeviceStatusAppearance(makeDevice({ [inhibitedFlag]: true }))

      expect(appearance.state).toBe('inhibited')
      expect(appearance.badgeLabel).toBe('I')
    }
  })

  it('gives disabled status priority over inhibited flags', () => {
    const appearance = getDeviceStatusAppearance(
      makeDevice({ disabled: true, inhibitSounders: true, inhibitIO: true, inhibitRelays: true })
    )

    expect(appearance.state).toBe('disabled')
    expect(appearance.badgeLabel).toBe('D')
  })

  it('does not add a status marker to normal devices', () => {
    const appearance = getDeviceStatusAppearance(makeDevice())

    expect(appearance.state).toBe('normal')
    expect(appearance.badgeLabel).toBeNull()
    expect(appearance.iconOpacity).toBe(1)
    expect(appearance.spriteColor).toBe('#ffffff')
  })
})

function makeDevice(overrides: Partial<FireDevice> = {}): FireDevice {
  return {
    id: 'device-1',
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 21,
    type: 'optical_det',
    friendlyTypeName: 'Optical Detector',
    isInputCapable: true,
    isOutputCapable: false,
    isSounder: false,
    isWirelessType: false,
    disabled: false,
    inhibitSounders: false,
    inhibitIO: false,
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: { status: 'unplaced' },
    raw: {},
    ...overrides
  }
}
