import { describe, expect, it } from 'vitest'
import {
  getDeviceIconByType,
  getFriendlyDeviceTypeName,
  isInputCapableType,
  isOutputCapableType,
  normalizeDeviceType
} from '../deviceIcons'

describe('device icon mapping', () => {
  it('normalizes case, hyphen, and spaces', () => {
    expect(normalizeDeviceType(' Wireless-Heat   Det ')).toBe('wireless_heat det')
  })

  it('maps known CPD type to icon', () => {
    expect(getDeviceIconByType('manual_call_point')).toBe('manual-call-point.svg')
    expect(getDeviceIconByType('smoke_detector')).toBe('optical-detector.svg')
  })

  it('returns unknown icon for unsupported type', () => {
    expect(getDeviceIconByType('not_real')).toBe('unknown-device.svg')
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
})
