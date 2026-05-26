import type { FireDevice, FirePanel, FireProject, GroupMember } from './types'
import {
  isIOGroupMemberDevice,
  isSounderGroupMemberDevice,
  isZoneMemberDevice
} from './deviceIcons'

export type Viewer3DHighlightKind = 'none' | 'loop' | 'zone' | 'sounderGroup' | 'ioGroup' | 'type'

export interface Viewer3DHighlightSelection {
  kind: Viewer3DHighlightKind
  targetId: string | null
}

export interface Viewer3DHighlightOption {
  id: string
  label: string
}

export interface Viewer3DDeviceHighlightAppearance {
  highlighted: boolean
  faded: boolean
  opacity: number
  color: string | null
}

export function getViewer3DHighlightOptions(
  project: FireProject,
  kind: Viewer3DHighlightKind
): Viewer3DHighlightOption[] {
  if (kind === 'none') {
    return []
  }

  if (kind === 'type') {
    return getProjectDevices(project)
      .reduce<Viewer3DHighlightOption[]>((options, device) => {
        if (options.some((option) => option.id === device.type)) {
          return options
        }

        return [...options, { id: device.type, label: device.friendlyTypeName || device.type }]
      }, [])
      .sort((left, right) => left.label.localeCompare(right.label))
  }

  return project.networks.flatMap((network) =>
    network.panels.flatMap((panel) => {
      const panelPrefix = panel.panelName || `Panel ${panel.panelNumber}`

      if (kind === 'loop') {
        return panel.loops.map((loop) => ({
          id: loop.id,
          label: `${panelPrefix} / ${loop.name || `Loop ${loop.loopId}`}`
        }))
      }

      if (kind === 'zone') {
        return panel.zones.map((zone) => ({
          id: zone.id,
          label: `${panelPrefix} / ${formatZoneLabel(zone.zoneNumber, zone.text)}`
        }))
      }

      if (kind === 'sounderGroup') {
        return panel.sounderGroups.map((group) => ({
          id: group.id,
          label: `${panelPrefix} / ${group.title || group.description || `Sounder Group ${group.groupId}`}`
        }))
      }

      return panel.ioGroups.map((group) => ({
        id: group.id,
        label: `${panelPrefix} / I/O Group ${group.groupId}`
      }))
    })
  )
}

export function isDeviceHighlighted(
  project: FireProject,
  selection: Viewer3DHighlightSelection,
  device: FireDevice
): boolean {
  if (selection.kind === 'none' || !selection.targetId) {
    return false
  }

  const panel = findPanel(project, device.panelId)
  if (!panel) {
    return false
  }

  if (selection.kind === 'type') {
    return device.type === selection.targetId
  }

  if (selection.kind === 'loop') {
    const loop = panel.loops.find((candidate) => candidate.id === selection.targetId)
    return Boolean(loop && device.loopId === loop.loopId)
  }

  if (selection.kind === 'zone') {
    const zone = panel.zones.find((candidate) => candidate.id === selection.targetId)
    return Boolean(
      zone && isZoneMemberDevice(device) && getDeviceCpdZoneNumber(device) === zone.zoneNumber
    )
  }

  if (selection.kind === 'sounderGroup') {
    const group = panel.sounderGroups.find((candidate) => candidate.id === selection.targetId)
    return Boolean(
      group &&
      isSounderGroupMemberDevice(device) &&
      group.addressableMembers.some((member) => memberMatchesDevice(member, device))
    )
  }

  const group = panel.ioGroups.find((candidate) => candidate.id === selection.targetId)
  return Boolean(
    group &&
    isIOGroupMemberDevice(device) &&
    group.members.some((member) => memberMatchesDevice(member, device))
  )
}

export function getViewer3DDeviceHighlightAppearance(
  project: FireProject,
  selection: Viewer3DHighlightSelection,
  device: FireDevice
): Viewer3DDeviceHighlightAppearance {
  const highlightActive = selection.kind !== 'none' && Boolean(selection.targetId)
  const highlighted = isDeviceHighlighted(project, selection, device)

  return {
    highlighted,
    faded: highlightActive && !highlighted,
    opacity: highlightActive && !highlighted ? 0.18 : 1,
    color: highlighted ? '#f59e0b' : null
  }
}

export function isZoneHighlighted(
  selection: Viewer3DHighlightSelection,
  panel: FirePanel,
  zoneNumber: number
): boolean {
  if (selection.kind !== 'zone' || !selection.targetId) {
    return false
  }

  const zone = panel.zones.find((candidate) => candidate.id === selection.targetId)
  return Boolean(zone && zone.zoneNumber === zoneNumber)
}

function findPanel(project: FireProject, panelId: string): FirePanel | undefined {
  for (const network of project.networks) {
    const panel = network.panels.find((candidate) => candidate.id === panelId)
    if (panel) {
      return panel
    }
  }
  return undefined
}

function getProjectDevices(project: FireProject): FireDevice[] {
  return (project as FireProject & { devices?: FireDevice[] }).devices ?? []
}

function formatZoneLabel(zoneNumber: number, text: string | undefined): string {
  const baseLabel = `Zone ${zoneNumber}`
  const trimmedText = text?.trim()
  if (!trimmedText || trimmedText === baseLabel) {
    return baseLabel
  }
  return `${baseLabel} - ${trimmedText}`
}

function memberMatchesDevice(member: GroupMember, device: FireDevice): boolean {
  return (
    member.loopId === device.loopId &&
    member.physicalAddress !== undefined &&
    member.physicalAddress === device.address
  )
}

function getDeviceCpdZoneNumber(device: FireDevice): number | undefined {
  return (
    device.zoneNumber ??
    optionalNumberFromRaw(device.raw.zone) ??
    optionalNumberFromRaw(device.raw.Zone) ??
    optionalNumberFromRaw(device.raw.zoneNumber) ??
    optionalNumberFromRaw(device.raw.ZoneNumber)
  )
}

function optionalNumberFromRaw(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}
