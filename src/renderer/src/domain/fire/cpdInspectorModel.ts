import type { FirePanel, FireZone, FireDevice } from './types'
import {
  hasDirectIOGroupAssignment,
  hasDirectSounderGroupAssignment,
  isIOGroupMemberDevice,
  isSounderGroupMemberDevice,
  isZoneMemberDevice
} from './deviceIcons'

export interface CpdInspectorZone {
  zoneNumber: number
  text: string
  enabled: boolean
  delayedSounders: boolean
  devicesCount: number
  hasSpecialDevices: boolean
  specialDevicesCount: number
  groups: string[]
}

export interface CpdInspectorGroup {
  id: string
  number: number
  type: 'sg' | 'io'
  name: string
  desc: string
  delay: number
  count: number
  zones: number[]
  mode?: string
}

export interface CpdInspectorDevice {
  id: string
  loopId?: number
  address?: number
  type: string
  friendlyTypeName: string
  desc: string
  location?: string
  groupIds: string[]
  directGroupIds: string[]
  isSpecial: boolean
  specialBadges: string[]
  rawDevice: FireDevice
}

export interface CpdInspectorPanelData {
  panelId: string
  panelNumber: number
  panelName: string
  zones: CpdInspectorZone[]
  groups: CpdInspectorGroup[]
  devices: CpdInspectorDevice[]
  directDevices: CpdInspectorDevice[]
  totals: {
    zones: number
    configuredZones: number
    devices: number
    sounderGroups: number
    ioGroups: number
    delayedZones: number
    specialDevices: number
  }
}

export function getSpecialProperties(dev: FireDevice): string[] {
  const badges: string[] = []
  if (dev.disabled) badges.push('disabled')
  if (dev.overrideDelays) badges.push('overrideDelays')
  if (dev.inhibitSounders) badges.push('inhibitSounders')
  if (dev.inhibitIO) badges.push('inhibitIO')
  if (dev.inhibitRelays) badges.push('inhibitRelays')
  if (dev.evacuateIO) badges.push('evacuateIO')
  if (dev.ioOverrideDelay) badges.push('ioOverrideDelay')
  if (dev.immediateEvacuate) badges.push('immediateEvacuate')
  if (dev.setEvacuateTimer) badges.push('setEvacuateTimer')
  if (
    dev.selectedDisablement === true ||
    (typeof dev.selectedDisablement === 'string' &&
      !['', '0', 'false', 'normal', 'default'].includes(
        dev.selectedDisablement.trim().toLowerCase()
      ))
  ) {
    badges.push('selectedDisablement')
  }

  // Handle optional parameters: count as special if they exist and are non-zero/non-default
  const hasValue = (val: string | undefined): boolean => {
    if (!val) return false
    const norm = val.trim().toLowerCase()
    return norm !== '0' && norm !== 'normal' && norm !== 'default'
  }

  if (hasValue(dev.smokeSensitivity)) badges.push('smokeSensitivity')
  if (hasValue(dev.heatGrade)) badges.push('heatGrade')
  if (hasValue(dev.reportingDetail)) badges.push('reportingDetail')

  return badges
}

export function buildCpdInspectorModel(
  panel: FirePanel,
  allDevices: FireDevice[]
): CpdInspectorPanelData {
  const panelDevices = allDevices.filter((d) => d.panelId === panel.id)

  // 1. Resolve device group IDs
  const getDeviceGroupIds = (dev: FireDevice): string[] => {
    const ids: string[] = []

    if (isSounderGroupMemberDevice(dev)) {
      panel.sounderGroups.forEach((sg) => {
        const isMember = sg.addressableMembers.some(
          (m) => m.loopId === dev.loopId && m.physicalAddress === dev.address
        )
        if (isMember) {
          ids.push(`sg${sg.groupId}`)
        }
      })
    }

    if (isIOGroupMemberDevice(dev)) {
      panel.ioGroups.forEach((iog) => {
        const isMember = iog.members.some(
          (m) => m.loopId === dev.loopId && m.physicalAddress === dev.address
        )
        if (isMember) {
          ids.push(`io${iog.groupId}`)
        }
      })
    }

    return [...new Set(ids)]
  }

  const getDeviceDirectGroupIds = (dev: FireDevice): string[] => {
    const ids: string[] = []
    if (hasDirectSounderGroupAssignment(dev)) {
      ids.push(`sg${dev.sounderGroupId}`)
    }
    if (hasDirectIOGroupAssignment(dev)) {
      ids.push(`io${dev.ioGroupId}`)
    }
    return [...new Set(ids)]
  }

  // 2. Map all devices
  const inspectorDevices: CpdInspectorDevice[] = panelDevices.map((dev) => {
    const groupIds = getDeviceGroupIds(dev)
    const directGroupIds = getDeviceDirectGroupIds(dev)
    const specialBadges = getSpecialProperties(dev)
    return {
      id: dev.id,
      loopId: dev.loopId,
      address: dev.address,
      type: dev.type,
      friendlyTypeName: dev.friendlyTypeName,
      desc: dev.location || dev.description || '',
      location: dev.location,
      groupIds,
      directGroupIds,
      isSpecial: specialBadges.length > 0,
      specialBadges,
      rawDevice: dev
    }
  })

  // 3. Map groups
  const inspectorGroups: CpdInspectorGroup[] = []

  panel.sounderGroups.forEach((sg) => {
    const linkedZones: number[] = []
    panel.zones.forEach((z) => {
      if (z.sounderGroupAlarm1 === sg.groupId || z.sounderGroupAlarm2 === sg.groupId) {
        linkedZones.push(z.zoneNumber)
      }
    })

    const count = inspectorDevices.filter((d) => d.groupIds.includes(`sg${sg.groupId}`)).length
    const rawMode =
      sg.raw?.sounderMode ||
      sg.raw?.SounderMode ||
      sg.raw?.mode ||
      sg.raw?.Mode ||
      sg.raw?.SounderMode1
    const mode = String(
      rawMode ||
        panel.general.sounderMode ||
        panel.general.sounderMode1 ||
        panel.general.raw?.SounderMode ||
        ''
    )

    inspectorGroups.push({
      id: `sg${sg.groupId}`,
      number: sg.groupId,
      type: 'sg',
      name: sg.title || `Sounder Group ${sg.groupId}`,
      desc: sg.description || `Linked by Zone ${linkedZones.join(', ')}`,
      delay: panel.general.sounderDelaySeconds || 0,
      count,
      zones: linkedZones,
      mode: mode || undefined
    })
  })

  panel.ioGroups.forEach((iog) => {
    const linkedZones: number[] = []
    panel.zones.forEach((z) => {
      const isLinked = [
        z.ioGroup1Alarm1,
        z.ioGroup1Alarm2,
        z.ioGroup2Alarm1,
        z.ioGroup3Alarm1,
        z.ioGroup4Alarm1
      ].includes(iog.groupId)
      if (isLinked) {
        linkedZones.push(z.zoneNumber)
      }
    })

    const count = inspectorDevices.filter((d) => d.groupIds.includes(`io${iog.groupId}`)).length
    const rawAction =
      iog.raw?.ActionType || iog.raw?.actionType || iog.raw?.action || iog.raw?.Action
    const mode = rawAction ? String(rawAction) : undefined

    inspectorGroups.push({
      id: `io${iog.groupId}`,
      number: iog.groupId,
      type: 'io',
      name: `I/O Group ${iog.groupId}`,
      desc: `Linked by Zone ${linkedZones.join(', ')}`,
      delay: panel.general.inputOutputDelaySeconds || 0,
      count,
      zones: linkedZones,
      mode: mode || undefined
    })
  })

  // 4. Map zones (1 to 128)
  const inspectorZones: CpdInspectorZone[] = []
  const zonesMap = new Map<number, FireZone>()
  panel.zones.forEach((z) => zonesMap.set(z.zoneNumber, z))

  for (let i = 1; i <= 128; i++) {
    const zone = zonesMap.get(i)
    const devicesInZone = panelDevices.filter((d) => d.zoneNumber === i && isZoneMemberDevice(d))
    const specialDevicesInZone = devicesInZone.filter((d) => getSpecialProperties(d).length > 0)

    const groups: string[] = []
    if (zone) {
      if (zone.sounderGroupAlarm1) groups.push(`sg${zone.sounderGroupAlarm1}`)
      if (zone.sounderGroupAlarm2) groups.push(`sg${zone.sounderGroupAlarm2}`)
      if (zone.ioGroup1Alarm1) groups.push(`io${zone.ioGroup1Alarm1}`)
      if (zone.ioGroup1Alarm2) groups.push(`io${zone.ioGroup1Alarm2}`)
      if (zone.ioGroup2Alarm1) groups.push(`io${zone.ioGroup2Alarm1}`)
      if (zone.ioGroup3Alarm1) groups.push(`io${zone.ioGroup3Alarm1}`)
      if (zone.ioGroup4Alarm1) groups.push(`io${zone.ioGroup4Alarm1}`)
    }

    inspectorZones.push({
      zoneNumber: i,
      text: zone?.text || '',
      enabled: zone ? zone.enabled : false,
      delayedSounders: zone ? zone.delayedSounders : false,
      devicesCount: devicesInZone.length,
      hasSpecialDevices: specialDevicesInZone.length > 0,
      specialDevicesCount: specialDevicesInZone.length,
      groups: [...new Set(groups)]
    })
  }

  // 5. Calculate configured zones count
  const configuredZonesCount = inspectorZones.filter((z) => {
    const zInput = zonesMap.get(z.zoneNumber)
    return z.text || z.devicesCount > 0 || z.groups.length > 0 || (zInput && zInput.delayedSounders)
  }).length

  const totals = {
    zones: inspectorZones.length,
    configuredZones: configuredZonesCount,
    devices: panelDevices.length,
    sounderGroups: panel.sounderGroups.length,
    ioGroups: panel.ioGroups.length,
    delayedZones: inspectorZones.filter((z) => z.delayedSounders).length,
    specialDevices: inspectorDevices.filter((d) => d.isSpecial).length
  }

  return {
    panelId: panel.id,
    panelNumber: panel.panelNumber,
    panelName: panel.panelName,
    zones: inspectorZones,
    groups: inspectorGroups,
    devices: inspectorDevices,
    directDevices: inspectorDevices.filter((device) => device.directGroupIds.length > 0),
    totals
  }
}
