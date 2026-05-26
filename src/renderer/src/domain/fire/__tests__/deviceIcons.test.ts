import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import {
  deviceIconByType,
  getDeviceIconByType,
  getDeviceIconHrefByType,
  getFriendlyDeviceTypeName,
  hasDirectIOGroupAssignment,
  hasDirectSounderGroupAssignment,
  isInputCapableType,
  isIOGroupMemberDevice,
  isOutputCapableType,
  isSounderGroupMemberDevice,
  isZoneMemberDevice,
  normalizeDeviceType,
  unknownDeviceIcon
} from '../deviceIcons'

describe('device icon mapping', () => {
  it('normalizes case, hyphen, and spaces', () => {
    expect(normalizeDeviceType(' Wireless-Heat   Det ')).toBe('wireless_heat det')
  })

  it('maps known CPD type to icon', () => {
    expect(getDeviceIconByType('manual_call_point')).toBe('manual-call-point.svg')
    expect(getDeviceIconByType('smoke_detector')).toBe('optical-detector.svg')
  })

  it('creates Electron-safe public icon hrefs', () => {
    expect(getDeviceIconHrefByType('manual_call_point')).toBe('icons/manual-call-point.svg')
  })

  it('returns unknown icon for unsupported type', () => {
    expect(getDeviceIconByType('not_real')).toBe('unknown-device.svg')
  })

  it('has SVG assets for every mapped fire device icon', () => {
    const icons = new Set([...Object.values(deviceIconByType), unknownDeviceIcon])

    for (const icon of icons) {
      expect(existsSync(resolve('public/icons', icon)), icon).toBe(true)
    }
  })

  it('returns friendly names', () => {
    expect(getFriendlyDeviceTypeName('wireless_sounder')).toBe('Wireless Sounder')
  })

  it('treats I/O as input and output capable', () => {
    expect(isInputCapableType('input_output')).toBe(true)
    expect(isOutputCapableType('input_output')).toBe(true)
  })

  it('treats sounder as output only', () => {
    expect(isInputCapableType('sounder')).toBe(false)
    expect(isOutputCapableType('sounder')).toBe(true)
  })

  it('classifies Project Preview membership roles from CPD device type semantics', () => {
    expect(isZoneMemberDevice({ type: 'manual_call_point', isInputCapable: true })).toBe(true)
    expect(isZoneMemberDevice({ type: 'wireless_sounder', isInputCapable: false })).toBe(false)

    expect(isSounderGroupMemberDevice({ type: 'sounder' })).toBe(true)
    expect(isSounderGroupMemberDevice({ type: 'wireless_sounder' })).toBe(true)
    expect(isSounderGroupMemberDevice({ type: 'manual_call_point', sounderGroupId: 4 })).toBe(false)

    expect(isIOGroupMemberDevice({ type: 'input_output' })).toBe(true)
    expect(isIOGroupMemberDevice({ type: 'wireless_input_output' })).toBe(true)
    expect(isIOGroupMemberDevice({ type: 'manual_call_point', ioGroupId: 2 })).toBe(false)
  })

  it('distinguishes direct initiating-device output assignments from group membership', () => {
    expect(
      hasDirectSounderGroupAssignment({
        type: 'manual_call_point',
        isInputCapable: true,
        sounderGroupId: 3
      })
    ).toBe(true)
    expect(
      hasDirectSounderGroupAssignment({ type: 'sounder', isInputCapable: false, sounderGroupId: 3 })
    ).toBe(false)

    expect(
      hasDirectIOGroupAssignment({
        type: 'input_output',
        isInputCapable: true,
        ioGroupId: 6
      })
    ).toBe(true)
    expect(
      hasDirectIOGroupAssignment({ type: 'sounder', isInputCapable: false, ioGroupId: 6 })
    ).toBe(false)
  })
})
