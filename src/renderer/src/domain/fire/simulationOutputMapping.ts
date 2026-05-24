import type { FireDevice, FirePanel, FireProject, GroupMember } from './types'
import type { OutputActivation } from './simulation/types'

export type DeviceSimulationOutputState = 'active' | 'delayActive' | null

export function getDeviceSimulationOutputState(
  project: FireProject,
  outputs: OutputActivation[],
  device: FireDevice
): DeviceSimulationOutputState {
  if (device.disabled) {
    return null
  }

  const panel = findPanel(project, device.panelId)
  let state: DeviceSimulationOutputState = null

  for (const output of outputs) {
    if (output.state !== 'active' && output.state !== 'delayActive') {
      continue
    }

    if (!outputMatchesDevice(output.outputId, panel, device)) {
      continue
    }

    if (output.state === 'active') {
      return 'active'
    }

    state = 'delayActive'
  }

  return state
}

function outputMatchesDevice(
  outputId: string,
  panel: FirePanel | undefined,
  device: FireDevice
): boolean {
  if (outputId === `device:${device.id}`) {
    return true
  }

  if (!panel) {
    return false
  }

  const sounderGroupId = parseOutputGroupId(outputId, 'sounder-group', panel.id)
  if (sounderGroupId !== undefined) {
    return (
      device.sounderGroupId === sounderGroupId ||
      panel.sounderGroups
        .find((group) => group.groupId === sounderGroupId)
        ?.addressableMembers.some((member) => memberMatchesDevice(member, device)) === true
    )
  }

  const ioGroupId = parseOutputGroupId(outputId, 'io-group', panel.id)
  if (ioGroupId !== undefined) {
    return (
      device.ioGroupId === ioGroupId ||
      panel.ioGroups
        .find((group) => group.groupId === ioGroupId)
        ?.members.some((member) => memberMatchesDevice(member, device)) === true
    )
  }

  return false
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
