import type { FirePanel } from './types'

export function explicitInputPanelNumber(input: Record<string, unknown>): number | undefined {
  const raw = toRecord(input.raw)
  return optionalGroupNumberFromFields(input, raw, ['panelNumber', 'PanelNumber'])
}

export function delaySeconds(minutes: unknown, seconds: unknown): number {
  return numberValue(minutes) * 60 + numberValue(seconds)
}

export function timestampValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

export function toSafeFileBase(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.\\/]+$/, '')
  const safe = withoutExtension
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return safe || 'imported'
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

export function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(toRecord) : []
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function stringValue(value: unknown, fallback = ''): string {
  return optionalString(value) ?? fallback
}

export function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function optionalGroupNumber(value: unknown): number | undefined {
  const parsed = optionalNumber(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

export function numberValue(value: unknown, fallback = 0): number {
  return optionalNumber(value) ?? fallback
}

export function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function optionalStringFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): string | undefined {
  for (const field of fields) {
    const value = optionalString(input[field]) ?? optionalString(raw[field])
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

export function optionalNumberFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): number | undefined {
  for (const field of fields) {
    const value = optionalNumber(input[field]) ?? optionalNumber(raw[field])
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

export function optionalGroupNumberFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): number | undefined {
  const parsed = optionalNumberFromFields(input, raw, fields)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

export function booleanFromFields(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[],
  fallback = false
): boolean {
  for (const field of fields) {
    const value = input[field] ?? raw[field]
    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const normalized = value.trim().toLowerCase()
      return normalized !== 'false' && normalized !== '0' && normalized !== 'none'
    }
  }

  return fallback
}

export function isDisabledDevice(
  input: Record<string, unknown>,
  raw: Record<string, unknown>
): boolean {
  return (
    booleanFromFields(input, raw, ['disabled', 'DeviceDisabled', 'deviceDisabled']) ||
    booleanFromFields(input, raw, ['selectedDisablement', 'SelectedDisablement'])
  )
}

export function selectedDisablementValue(
  input: Record<string, unknown>,
  raw: Record<string, unknown>
): string | boolean | undefined {
  const value = firstDefinedField(input, raw, ['selectedDisablement', 'SelectedDisablement'])
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }

  if (typeof value === 'boolean') {
    return value
  }

  return undefined
}

export function firstDefinedField(
  input: Record<string, unknown>,
  raw: Record<string, unknown>,
  fields: string[]
): unknown {
  for (const field of fields) {
    const value = input[field] ?? raw[field]
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

export function isEmptyNonAddressableMode(value: unknown): boolean {
  if (value === undefined || value === null || value === false) {
    return true
  }

  if (typeof value === 'number') {
    return value <= 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return (
      normalized === '' || normalized === '0' || normalized === 'false' || normalized === 'none'
    )
  }

  return false
}

export function collectGroupMemberRecords(
  groupInput: Record<string, unknown>
): Record<string, unknown>[] {
  const raw = toRecord(groupInput.raw)
  const records = [
    ...arrayOfRecords(groupInput.members),
    ...arrayOfRecords(groupInput.Members),
    ...arrayOfRecords(groupInput.GDataDetail),
    ...arrayOfRecords(groupInput.GDataDetailEx),
    ...arrayOfRecords(raw.members),
    ...arrayOfRecords(raw.Members),
    ...arrayOfRecords(raw.GDataDetail),
    ...arrayOfRecords(raw.GDataDetailEx)
  ]
  const seen = new Set<string>()

  return records.filter((record, index) => {
    const recordRaw = toRecord(record.raw)
    const loopId = optionalNumberFromFields(record, recordRaw, [
      'loopId',
      'Loop',
      'LoopID',
      'LoopNumber'
    ])
    const physicalAddress = optionalNumberFromFields(record, recordRaw, [
      'physicalAddress',
      'PhysicalAddress',
      'address',
      'Address'
    ])
    if (loopId === undefined && physicalAddress === undefined) {
      return false
    }

    const key = `${loopId ?? 'loop?'}:${physicalAddress ?? 'addr?'}:${index}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function collectPanelGroupMemberRecords(
  groupInput: Record<string, unknown>,
  panel: FirePanel,
  panelCount: number
): Record<string, unknown>[] {
  const records = collectGroupMemberRecords(groupInput)
  const explicitGroupPanelNumber = explicitInputPanelNumber(groupInput)

  if (explicitGroupPanelNumber !== undefined || panelCount === 1) {
    return records.filter((record) => {
      const panelNumber = memberPanelNumber(record)
      return panelNumber === undefined || panelNumber === panel.panelNumber
    })
  }

  const hasPanelScopedMembers = records.some((record) => memberPanelNumber(record) !== undefined)
  if (!hasPanelScopedMembers) {
    return records
  }

  return records.filter((record) => memberPanelNumber(record) === panel.panelNumber)
}

export function memberPanelNumber(member: Record<string, unknown>): number | undefined {
  const raw = toRecord(member.raw)
  return optionalGroupNumberFromFields(member, raw, ['panelNumber', 'PanelNumber'])
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}
