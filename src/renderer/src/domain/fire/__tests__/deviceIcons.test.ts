import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import {
  deviceIconByType,
  getDeviceIconByType,
  getDeviceIconHrefByType,
  getFriendlyDeviceTypeName,
  isInputCapableType,
  isOutputCapableType,
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
})
