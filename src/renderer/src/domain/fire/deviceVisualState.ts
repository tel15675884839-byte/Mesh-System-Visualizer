import type { FireDevice } from './types'

export type DeviceVisualStatus = 'normal' | 'disabled' | 'inhibited'

export interface DeviceStatusAppearance {
  state: DeviceVisualStatus
  color: string
  badgeLabel: string | null
  title: string | null
  iconOpacity: number
  spriteColor: string
}

const NORMAL_APPEARANCE: DeviceStatusAppearance = {
  state: 'normal',
  color: '#ffffff',
  badgeLabel: null,
  title: null,
  iconOpacity: 1,
  spriteColor: '#ffffff'
}

const DISABLED_APPEARANCE: DeviceStatusAppearance = {
  state: 'disabled',
  color: '#f59e0b',
  badgeLabel: 'D',
  title: 'Disabled',
  iconOpacity: 0.72,
  spriteColor: '#ffffff'
}

const INHIBITED_APPEARANCE: DeviceStatusAppearance = {
  state: 'inhibited',
  color: '#7c3aed',
  badgeLabel: 'I',
  title: 'Inhibited',
  iconOpacity: 0.82,
  spriteColor: '#ffffff'
}

export function getDeviceStatusAppearance(device: FireDevice): DeviceStatusAppearance {
  if (device.disabled) {
    return DISABLED_APPEARANCE
  }

  if (device.inhibitSounders || device.inhibitIO || device.inhibitRelays) {
    return INHIBITED_APPEARANCE
  }

  return NORMAL_APPEARANCE
}
