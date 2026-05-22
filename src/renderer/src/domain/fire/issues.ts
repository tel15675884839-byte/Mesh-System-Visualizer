import type {
  FireDevice,
  FireIssue,
  FireIssueSeverity,
  FirePanel,
  FireProject,
  NonAddressableSounderPoint
} from './types'

type ActiveNonAddressableSounder = Pick<
  NonAddressableSounderPoint,
  'networkId' | 'panelId' | 'sounderGroupId' | 'cieId' | 'channel'
>

type IssueProject = FireProject & {
  devices?: FireDevice[]
  nonAddressableSounderPoints?: NonAddressableSounderPoint[]
  activeNonAddressableSounders?: ActiveNonAddressableSounder[]
}

export function collectFireProjectIssues(project: FireProject): FireIssue[] {
  const issueProject = project as IssueProject
  const panels = project.networks.flatMap((network) => network.panels)
  const panelById = new Map(panels.map((panel) => [panel.id, panel]))
  const devices = issueProject.devices ?? []
  const deviceById = new Map(devices.map((device) => [device.id, device]))
  const issues: FireIssue[] = []

  for (const device of devices) {
    collectDeviceIssues(device, panelById.get(device.panelId), issues)
  }

  for (const panel of panels) {
    collectManualLoopIssues(panel, deviceById, issues)
  }

  collectNonAddressableSounderIssues(issueProject, issues)

  return issues
}

function collectDeviceIssues(
  device: FireDevice,
  panel: FirePanel | undefined,
  issues: FireIssue[]
): void {
  if (device.loopId === undefined || device.address === undefined) {
    issues.push(
      makeIssue({
        code: 'device.missing-loop-address',
        severity: 'error',
        message: `Device ${device.id} is missing Loop or Address configuration.`,
        relatedDeviceId: device.id,
        relatedPanelId: device.panelId
      })
    )
  }

  if (device.placement.status === 'missing') {
    issues.push(
      makeIssue({
        code: 'device.source-missing-placed',
        severity: 'warning',
        message: `Placed device ${device.id} is missing from the current CPD source.`,
        relatedDeviceId: device.id,
        relatedPanelId: device.panelId
      })
    )
  }

  if (!panel) {
    return
  }

  if (
    device.zoneNumber !== undefined &&
    !panel.zones.some((zone) => zone.zoneNumber === device.zoneNumber)
  ) {
    issues.push(
      makeIssue({
        code: 'device.zone-missing',
        severity: 'warning',
        message: `Device ${device.id} references missing Zone ${device.zoneNumber}.`,
        relatedDeviceId: device.id,
        relatedPanelId: panel.id,
        relatedZoneId: `${panel.id}-zone-${device.zoneNumber}`
      })
    )
  }

  if (
    device.sounderGroupId !== undefined &&
    !panel.sounderGroups.some((group) => group.groupId === device.sounderGroupId)
  ) {
    issues.push(
      makeIssue({
        code: 'device.sounder-group-missing',
        severity: 'warning',
        message: `Device ${device.id} references missing Sounder Group ${device.sounderGroupId}.`,
        relatedDeviceId: device.id,
        relatedPanelId: panel.id,
        relatedGroupId: `${panel.id}-sounder-group-${device.sounderGroupId}`
      })
    )
  }

  if (
    device.ioGroupId !== undefined &&
    !panel.ioGroups.some((group) => group.groupId === device.ioGroupId)
  ) {
    issues.push(
      makeIssue({
        code: 'device.io-group-missing',
        severity: 'warning',
        message: `Device ${device.id} references missing I/O Group ${device.ioGroupId}.`,
        relatedDeviceId: device.id,
        relatedPanelId: panel.id,
        relatedGroupId: `${panel.id}-io-group-${device.ioGroupId}`
      })
    )
  }
}

function collectManualLoopIssues(
  panel: FirePanel,
  deviceById: Map<string, FireDevice>,
  issues: FireIssue[]
): void {
  for (const loop of panel.loops) {
    for (const deviceId of loop.manualDeviceOrder) {
      const device = deviceById.get(deviceId)

      if (!device || device.placement.status !== 'placed') {
        issues.push(
          makeIssue({
            code: 'loop.manual-order-unplaced-device',
            severity: 'warning',
            message: `Manual Loop order for ${loop.name} references unplaced device ${deviceId}.`,
            relatedDeviceId: deviceId,
            relatedPanelId: panel.id,
            relatedLoopId: loop.id
          })
        )
      }
    }
  }
}

function collectNonAddressableSounderIssues(project: IssueProject, issues: FireIssue[]): void {
  const points = project.nonAddressableSounderPoints ?? []

  for (const activeSounder of project.activeNonAddressableSounders ?? []) {
    const hasRepresentativePoint = points.some((point) =>
      nonAddressableSounderMatches(point, activeSounder)
    )

    if (!hasRepresentativePoint) {
      const relatedGroupId = `${activeSounder.panelId}-sounder-group-${activeSounder.sounderGroupId}`

      issues.push(
        makeIssue({
          code: 'sounder.non-addressable-no-point',
          severity: 'info',
          message: `Active non-addressable sounder group ${activeSounder.sounderGroupId} has no representative point.`,
          relatedPanelId: activeSounder.panelId,
          relatedGroupId,
          identity: `${relatedGroupId}:cie-${activeSounder.cieId ?? 'unknown'}:${activeSounder.channel}`
        })
      )
    }
  }
}

function nonAddressableSounderMatches(
  point: NonAddressableSounderPoint,
  activeSounder: ActiveNonAddressableSounder
): boolean {
  return (
    point.networkId === activeSounder.networkId &&
    point.panelId === activeSounder.panelId &&
    point.sounderGroupId === activeSounder.sounderGroupId &&
    point.channel === activeSounder.channel &&
    point.cieId === activeSounder.cieId
  )
}

function makeIssue(input: {
  code: string
  severity: FireIssueSeverity
  message: string
  relatedDeviceId?: string
  relatedPanelId?: string
  relatedLoopId?: string
  relatedZoneId?: string
  relatedGroupId?: string
  identity?: string
}): FireIssue {
  const { identity, ...issue } = input
  const relatedId =
    identity ??
    issue.relatedDeviceId ??
    issue.relatedLoopId ??
    issue.relatedZoneId ??
    issue.relatedGroupId ??
    issue.relatedPanelId ??
    'project'

  return {
    id: `${issue.code}:${relatedId}`,
    ...issue
  }
}
