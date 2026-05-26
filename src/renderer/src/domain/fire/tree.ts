import type {
  DeviceStatusFilter,
  FireDevice,
  FireIssue,
  FirePanel,
  FireProject,
  GroupMember,
  GroupMode
} from './types'
import {
  getDeviceIconByType,
  isIOGroupMemberDevice,
  isSounderGroupMemberDevice,
  isZoneMemberDevice
} from './deviceIcons'

export type FireTreeNodeKind = 'network' | 'panel' | 'group' | 'device'

export interface FireTreeNode {
  id: string
  kind: FireTreeNodeKind
  label: string
  subtitle?: string
  count: number
  networkId?: string
  panelId?: string
  deviceId?: string
  groupMode?: GroupMode
  groupKey?: string
  icon?: string
  placementStatus?: FireDevice['placement']['status']
  issueCount?: number
  disabled?: boolean
  children: FireTreeNode[]
}

export interface FireTreeProject extends FireProject {
  devices?: FireDevice[]
  issues?: FireIssue[]
}

export interface BuildFireDeviceTreeOptions {
  project: FireTreeProject
  groupMode: GroupMode
  statusFilter: DeviceStatusFilter
  searchText?: string
}

interface GroupBucket {
  key: string
  label: string
  subtitle?: string
  sortValue: string
  devices: FireDevice[]
}

export function buildFireDeviceTree(options: BuildFireDeviceTreeOptions): FireTreeNode[] {
  const searchText = normalizeSearch(options.searchText)
  const devices = options.project.devices ?? []
  const issueCountByDeviceId = countIssuesByDeviceId(options.project.issues ?? [])
  const nodes: FireTreeNode[] = []

  for (const network of options.project.networks) {
    const networkChildren: FireTreeNode[] = []

    for (const panel of network.panels) {
      const panelDevices = devices.filter(
        (device) => device.networkId === network.id && device.panelId === panel.id
      )
      const filteredDevices = panelDevices.filter((device) =>
        shouldShowDevice(
          device,
          options.project,
          network.name,
          panel,
          issueCountByDeviceId,
          options.statusFilter,
          searchText
        )
      )
      const groupBuckets = buildGroupBuckets(panel, filteredDevices, options.groupMode)
      const groupNodes = groupBuckets
        .filter((bucket) => bucket.devices.length > 0)
        .sort((left, right) =>
          left.sortValue.localeCompare(right.sortValue, undefined, { numeric: true })
        )
        .map((bucket) => makeGroupNode(panel, bucket, options.groupMode, issueCountByDeviceId))

      if (groupNodes.length > 0) {
        networkChildren.push({
          id: panel.id,
          kind: 'panel',
          label: panel.panelName || `Panel ${panel.panelNumber}`,
          subtitle: panel.panelModel,
          count: sumCounts(groupNodes),
          networkId: network.id,
          panelId: panel.id,
          children: groupNodes
        })
      }
    }

    if (networkChildren.length > 0) {
      nodes.push({
        id: network.id,
        kind: 'network',
        label: formatNetworkLabel(network.name, network.sourceFileName),
        subtitle: network.sounderMode,
        count: sumCounts(networkChildren),
        networkId: network.id,
        children: networkChildren
      })
    }
  }

  return nodes
}

export function flattenFireTree(nodes: FireTreeNode[]): FireTreeNode[] {
  const flattened: FireTreeNode[] = []

  for (const node of nodes) {
    flattened.push(node)
    flattened.push(...flattenFireTree(node.children))
  }

  return flattened
}

function buildGroupBuckets(
  panel: FirePanel,
  devices: FireDevice[],
  groupMode: GroupMode
): GroupBucket[] {
  switch (groupMode) {
    case 'zone':
      return groupByZone(panel, devices)
    case 'type':
      return groupByType(devices)
    case 'sounderGroup':
      return groupBySounderGroup(panel, devices)
    case 'ioGroup':
      return groupByIOGroup(panel, devices)
    case 'loop':
    default:
      return groupByLoop(panel, devices)
  }
}

function groupByLoop(panel: FirePanel, devices: FireDevice[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()

  for (const loop of panel.loops) {
    buckets.set(String(loop.loopId), {
      key: String(loop.loopId),
      label: loop.name || `Loop ${loop.loopId}`,
      subtitle: `${loop.configuredDeviceOrder.length} configured`,
      sortValue: String(loop.loopId).padStart(4, '0'),
      devices: []
    })
  }

  for (const device of devices) {
    const key = device.loopId === undefined ? 'unassigned-loop' : String(device.loopId)
    const bucket =
      buckets.get(key) ??
      ensureBucket(buckets, key, {
        label: device.loopId === undefined ? 'No Loop' : `Loop ${device.loopId}`,
        sortValue: device.loopId === undefined ? 'zzzz' : String(device.loopId).padStart(4, '0')
      })

    bucket.devices.push(device)
  }

  return [...buckets.values()]
}

function groupByZone(panel: FirePanel, devices: FireDevice[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()

  for (const zone of panel.zones.filter((zone) => hasValidGroupNumber(zone.zoneNumber))) {
    buckets.set(String(zone.zoneNumber), {
      key: String(zone.zoneNumber),
      label: `Zone ${zone.zoneNumber}`,
      subtitle: zone.text,
      sortValue: String(zone.zoneNumber).padStart(4, '0'),
      devices: []
    })
  }

  for (const device of devices) {
    if (!hasValidGroupNumber(device.zoneNumber) || !isZoneMemberDevice(device)) continue
    const key = String(device.zoneNumber)
    const bucket =
      buckets.get(key) ??
      ensureBucket(buckets, key, {
        label: `Zone ${device.zoneNumber}`,
        sortValue: String(device.zoneNumber).padStart(4, '0')
      })

    bucket.devices.push(device)
  }

  return [...buckets.values()]
}

function groupByType(devices: FireDevice[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()

  for (const device of devices) {
    const label =
      device.description ||
      device.classify ||
      device.friendlyTypeName ||
      device.type ||
      'Unknown Type'
    const key = label.toLowerCase()
    const bucket = ensureBucket(buckets, key, {
      label,
      subtitle: device.friendlyTypeName,
      sortValue: label
    })

    bucket.devices.push(device)
  }

  return [...buckets.values()]
}

function groupBySounderGroup(panel: FirePanel, devices: FireDevice[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()
  const validGroups = panel.sounderGroups.filter((group) => hasValidGroupNumber(group.groupId))

  for (const group of validGroups) {
    buckets.set(String(group.groupId), {
      key: String(group.groupId),
      label: group.title || `Sounder Group ${group.groupId}`,
      subtitle: group.description,
      sortValue: String(group.groupId).padStart(4, '0'),
      devices: []
    })
  }

  for (const device of devices) {
    if (!isSounderGroupMemberDevice(device)) {
      continue
    }

    const memberGroupId = validGroups.find((group) =>
      isDeviceInMembers(device, group.addressableMembers)
    )?.groupId

    if (memberGroupId === undefined) {
      continue
    }

    const key = String(memberGroupId)
    const bucket =
      buckets.get(key) ??
      ensureBucket(buckets, key, {
        label: `Sounder Group ${memberGroupId}`,
        sortValue: String(memberGroupId).padStart(4, '0')
      })

    bucket.devices.push(device)
  }

  return [...buckets.values()]
}

function groupByIOGroup(panel: FirePanel, devices: FireDevice[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()
  const validGroups = panel.ioGroups.filter((group) => hasValidGroupNumber(group.groupId))

  for (const group of validGroups) {
    buckets.set(String(group.groupId), {
      key: String(group.groupId),
      label: group.raw?.title ? String(group.raw.title) : `I/O Group ${group.groupId}`,
      subtitle: group.raw?.description ? String(group.raw.description) : undefined,
      sortValue: String(group.groupId).padStart(4, '0'),
      devices: []
    })
  }

  for (const device of devices) {
    if (!isIOGroupMemberDevice(device)) {
      continue
    }

    const memberGroupId = validGroups.find((group) =>
      isDeviceInMembers(device, group.members)
    )?.groupId

    if (memberGroupId === undefined) {
      continue
    }

    const key = String(memberGroupId)
    const bucket =
      buckets.get(key) ??
      ensureBucket(buckets, key, {
        label: `I/O Group ${memberGroupId}`,
        sortValue: String(memberGroupId).padStart(4, '0')
      })

    bucket.devices.push(device)
  }

  return [...buckets.values()]
}

function makeGroupNode(
  panel: FirePanel,
  bucket: GroupBucket,
  groupMode: GroupMode,
  issueCountByDeviceId: Map<string, number>
): FireTreeNode {
  const deviceNodes = bucket.devices
    .slice()
    .sort(compareDevices)
    .map((device) => makeDeviceNode(device, issueCountByDeviceId))

  return {
    id: `${panel.id}:${groupMode}:${bucket.key}`,
    kind: 'group',
    label: bucket.label,
    subtitle: bucket.subtitle,
    count: deviceNodes.length,
    panelId: panel.id,
    groupMode,
    groupKey: bucket.key,
    children: deviceNodes
  }
}

function makeDeviceNode(
  device: FireDevice,
  issueCountByDeviceId: Map<string, number>
): FireTreeNode {
  const issueCount = issueCountByDeviceId.get(device.id) ?? 0
  const addressLabel =
    device.loopId !== undefined && device.address !== undefined
      ? `L${device.loopId}-${device.address}`
      : undefined
  const subtitleParts = [
    addressLabel,
    device.zoneNumber !== undefined ? `Zone ${device.zoneNumber}` : undefined,
    device.location
  ].filter(Boolean)

  return {
    id: device.id,
    kind: 'device',
    label: device.description || device.friendlyTypeName || device.type || device.id,
    subtitle: subtitleParts.join(' | '),
    count: 1,
    networkId: device.networkId,
    panelId: device.panelId,
    deviceId: device.id,
    icon: getDeviceIconByType(device.type),
    placementStatus: device.placement.status,
    issueCount,
    disabled: device.disabled,
    children: []
  }
}

function shouldShowDevice(
  device: FireDevice,
  project: FireTreeProject,
  networkName: string,
  panel: FirePanel,
  issueCountByDeviceId: Map<string, number>,
  statusFilter: DeviceStatusFilter,
  searchText: string
): boolean {
  if (!matchesStatusFilter(device, issueCountByDeviceId, statusFilter)) {
    return false
  }

  if (!searchText) {
    return true
  }

  return getSearchFields(device, project.name, networkName, panel).some((field) =>
    field.toLowerCase().includes(searchText)
  )
}

function matchesStatusFilter(
  device: FireDevice,
  issueCountByDeviceId: Map<string, number>,
  statusFilter: DeviceStatusFilter
): boolean {
  switch (statusFilter) {
    case 'unplaced':
      return device.placement.status === 'unplaced'
    case 'placed':
      return device.placement.status === 'placed'
    case 'issues':
      return (issueCountByDeviceId.get(device.id) ?? 0) > 0
    case 'all':
    default:
      return true
  }
}

function getSearchFields(
  device: FireDevice,
  projectName: string,
  networkName: string,
  panel: FirePanel
): string[] {
  return [
    device.id,
    projectName,
    networkName,
    panel.panelName,
    `Panel ${panel.panelNumber}`,
    device.type,
    device.friendlyTypeName,
    device.description,
    device.classify,
    device.location,
    device.zoneNumber === undefined ? undefined : `Zone ${device.zoneNumber}`,
    device.sounderGroupId === undefined ? undefined : `Sounder Group ${device.sounderGroupId}`,
    device.ioGroupId === undefined ? undefined : `I/O Group ${device.ioGroupId}`,
    device.loopId === undefined ? undefined : `Loop ${device.loopId}`,
    device.address === undefined ? undefined : String(device.address)
  ].filter((field): field is string => Boolean(field))
}

function countIssuesByDeviceId(issues: FireIssue[]): Map<string, number> {
  const issueCountByDeviceId = new Map<string, number>()

  for (const issue of issues) {
    if (!issue.relatedDeviceId) continue
    issueCountByDeviceId.set(
      issue.relatedDeviceId,
      (issueCountByDeviceId.get(issue.relatedDeviceId) ?? 0) + 1
    )
  }

  return issueCountByDeviceId
}

function isDeviceInMembers(device: FireDevice, members: GroupMember[]): boolean {
  return members.some(
    (member) => member.loopId === device.loopId && member.physicalAddress === device.address
  )
}

function ensureBucket(
  buckets: Map<string, GroupBucket>,
  key: string,
  defaults: Pick<GroupBucket, 'label' | 'sortValue'> & Partial<Pick<GroupBucket, 'subtitle'>>
): GroupBucket {
  const existing = buckets.get(key)
  if (existing) {
    return existing
  }

  const bucket: GroupBucket = {
    key,
    label: defaults.label,
    subtitle: defaults.subtitle,
    sortValue: defaults.sortValue,
    devices: []
  }
  buckets.set(key, bucket)
  return bucket
}

function compareDevices(left: FireDevice, right: FireDevice): number {
  return (
    compareMaybeNumber(left.loopId, right.loopId) ||
    compareMaybeNumber(left.address, right.address) ||
    left.id.localeCompare(right.id, undefined, { numeric: true })
  )
}

function compareMaybeNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

function hasValidGroupNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeSearch(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function formatNetworkLabel(name: string, sourceFileName: string): string {
  return sourceFileName ? `${name} - ${sourceFileName}` : name
}

function sumCounts(nodes: FireTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.count, 0)
}
