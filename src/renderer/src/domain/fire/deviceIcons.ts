export const unknownDeviceIcon = 'unknown-device.svg'

export const deviceIconByType: Record<string, string> = {
  co_det: 'co-detector.svg',
  gas_det: 'gas-detector.svg',
  heat_det: 'heat-detector.svg',
  input_output: 'input-output.svg',
  manual_call_point: 'manual-call-point.svg',
  multi_det: 'multi-detector.svg',
  optical_det: 'optical-detector.svg',
  smoke_detector: 'optical-detector.svg',
  sounder: 'sounder.svg',
  zone_monitor: 'zone-monitor.svg',
  wireless_co_det: 'wireless-co-detector.svg',
  wireless_gas_det: 'wireless-gas-detector.svg',
  wireless_heat_det: 'wireless-heat-detector.svg',
  wireless_input_output: 'wireless-input-output.svg',
  wireless_manual_call_point: 'wireless-manual-call-point.svg',
  wireless_multi_det: 'wireless-multi-detector.svg',
  wireless_optical_det: 'wireless-optical-detector.svg',
  wireless_sounder: 'wireless-sounder.svg'
}

export const friendlyNameByType: Record<string, string> = {
  co_det: 'CO Detector',
  gas_det: 'Gas Detector',
  heat_det: 'Heat Detector',
  input_output: 'Input/Output',
  manual_call_point: 'Manual Call Point',
  multi_det: 'Multi Detector',
  optical_det: 'Optical Detector',
  smoke_detector: 'Optical Detector',
  sounder: 'Sounder',
  zone_monitor: 'Zone Monitor',
  wireless_co_det: 'Wireless CO Detector',
  wireless_gas_det: 'Wireless Gas Detector',
  wireless_heat_det: 'Wireless Heat Detector',
  wireless_input_output: 'Wireless Input/Output',
  wireless_manual_call_point: 'Wireless Manual Call Point',
  wireless_multi_det: 'Wireless Multi Detector',
  wireless_optical_det: 'Wireless Optical Detector',
  wireless_sounder: 'Wireless Sounder'
}

const inputCapableTypes = new Set([
  'co_det',
  'gas_det',
  'heat_det',
  'input_output',
  'manual_call_point',
  'multi_det',
  'optical_det',
  'smoke_detector',
  'zone_monitor',
  'wireless_co_det',
  'wireless_gas_det',
  'wireless_heat_det',
  'wireless_input_output',
  'wireless_manual_call_point',
  'wireless_multi_det',
  'wireless_optical_det'
])

const outputCapableTypes = new Set([
  'input_output',
  'sounder',
  'wireless_input_output',
  'wireless_sounder'
])

export function normalizeDeviceType(type: string | undefined | null): string {
  return String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, ' ')
}

export function getDeviceIconByType(type: string | undefined | null): string {
  return deviceIconByType[normalizeDeviceType(type)] ?? unknownDeviceIcon
}

export function getDeviceIconHrefByType(type: string | undefined | null): string {
  return getPublicIconHref(getDeviceIconByType(type))
}

export function getPublicIconHref(iconName: string | undefined | null): string {
  const normalized = String(iconName ?? unknownDeviceIcon).replace(/^\/+/, '')
  return `icons/${normalized}`
}

export function getFriendlyDeviceTypeName(type: string | undefined | null): string {
  const normalized = normalizeDeviceType(type)
  return friendlyNameByType[normalized] ?? String(type ?? 'Unknown Device')
}

export function isInputCapableType(type: string | undefined | null): boolean {
  return inputCapableTypes.has(normalizeDeviceType(type))
}

export function isOutputCapableType(type: string | undefined | null): boolean {
  return outputCapableTypes.has(normalizeDeviceType(type))
}

export function isWirelessDeviceType(type: string | undefined | null): boolean {
  return normalizeDeviceType(type).startsWith('wireless_')
}

export function isSounderType(type: string | undefined | null): boolean {
  const normalized = normalizeDeviceType(type)
  return normalized === 'sounder' || normalized === 'wireless_sounder'
}
