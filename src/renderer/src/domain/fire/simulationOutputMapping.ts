import type { FireDevice, FirePanel, FireProject, GroupMember } from './types'
import type { OutputActivation } from './simulation/types'

export type DeviceSimulationOutputState = 'active' | 'delayActive' | null
export type SounderOutputPattern = 'silent' | 'continuous' | 'pulse'

export interface DeviceSimulationOutput {
  state: Exclude<DeviceSimulationOutputState, null>
  sounderPattern?: SounderOutputPattern
  remainingDelaySeconds?: number
}

export function getDeviceSimulationOutputState(
  project: FireProject,
  outputs: OutputActivation[],
  device: FireDevice
): DeviceSimulationOutputState {
  return getDeviceSimulationOutput(project, outputs, device)?.state ?? null
}

export function getDeviceSimulationOutput(
  project: FireProject,
  outputs: OutputActivation[],
  device: FireDevice
): DeviceSimulationOutput | null {
  const panel = findPanel(project, device.panelId)
  let delayedOutput: DeviceSimulationOutput | null = null

  for (const output of outputs) {
    if (output.state !== 'active' && output.state !== 'delayActive') {
      continue
    }

    if (device.disabled && !disabledDeviceCanFollowOutput(output, device)) {
      continue
    }

    const match = outputMatchesDevice(output.outputId, panel, device)
    if (!match) {
      continue
    }

    if (match.sounderPattern === 'silent') {
      continue
    }

    if (output.state === 'active') {
      return {
        state: 'active',
        sounderPattern: match.sounderPattern
      }
    }

    delayedOutput = {
      state: 'delayActive',
      sounderPattern: match.sounderPattern,
      remainingDelaySeconds: output.remainingDelaySeconds
    }
  }

  return delayedOutput
}

function disabledDeviceCanFollowOutput(output: OutputActivation, device: FireDevice): boolean {
  return (
    device.isSounder && output.outputId === `device:${device.id}` && output.reason === 'evacuate'
  )
}

function outputMatchesDevice(
  outputId: string,
  panel: FirePanel | undefined,
  device: FireDevice
): { sounderPattern?: SounderOutputPattern } | null {
  if (outputId === `device:${device.id}`) {
    return { sounderPattern: device.isSounder ? 'continuous' : undefined }
  }

  if (!panel) {
    return null
  }

  const sounderGroupId = parseOutputGroupId(outputId, 'sounder-group', panel.id)
  if (sounderGroupId !== undefined) {
    const group = panel.sounderGroups.find((candidate) => candidate.groupId === sounderGroupId)
    const member = group?.addressableMembers.find((candidate) =>
      memberMatchesDevice(candidate, device)
    )
    if (member) {
      return { sounderPattern: resolveSounderOutputPattern(member.status) }
    }

    if (device.sounderGroupId === sounderGroupId) {
      return { sounderPattern: resolveSounderOutputPattern(device.sounderGroupValue) }
    }

    return null
  }

  const ioGroupId = parseOutputGroupId(outputId, 'io-group', panel.id)
  if (ioGroupId !== undefined) {
    const matches =
      device.ioGroupId === ioGroupId ||
      panel.ioGroups
        .find((group) => group.groupId === ioGroupId)
        ?.members.some((member) => memberMatchesDevice(member, device)) === true
    return matches ? {} : null
  }

  return null
}

function parseOutputGroupId(
  outputId: string,
  outputKind: 'sounder-group' | 'io-group',
  panelId: string
): number | undefined {
  const prefix = `${outputKind}:${panelId}:`
  if (!outputId.startsWith(prefix)) {
    return undefined
  }

  const groupId = Number(outputId.slice(prefix.length))
  return Number.isFinite(groupId) ? groupId : undefined
}

function memberMatchesDevice(member: GroupMember, device: FireDevice): boolean {
  return (
    member.loopId === device.loopId &&
    member.physicalAddress !== undefined &&
    member.physicalAddress === device.address
  )
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

export function resolveSounderOutputPattern(value: unknown): SounderOutputPattern {
  if (typeof value !== 'string') {
    return 'pulse'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'silent' || normalized === 'silence' || normalized === 'off') {
    return 'silent'
  }

  if (
    normalized === 'continuous' ||
    normalized === 'continue' ||
    normalized === 'continued' ||
    normalized === 'on'
  ) {
    return 'continuous'
  }

  if (
    normalized === 'intermittent' ||
    normalized === 'pulse' ||
    normalized === 'pulsed' ||
    normalized === 'pulsing'
  ) {
    return 'pulse'
  }

  return 'pulse'
}
