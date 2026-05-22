import type { CpdAdapterResult } from './cpdAdapter'
import type { FireDevice, FireLoop, FireNetwork, FireProject, FireZone } from './types'

export interface CpdDiffResult {
  matched: Array<{ existingDeviceId: string; incomingDeviceId: string }>
  added: string[]
  removed: string[]
  changed: Array<{ deviceId: string; fields: string[] }>
}

type ProjectWithDevices = FireProject & { devices?: FireDevice[]; issues?: unknown[] }

const COMPARED_DEVICE_FIELDS: Array<keyof FireDevice> = [
  'type',
  'friendlyTypeName',
  'location',
  'zoneNumber',
  'sounderGroupId',
  'ioGroupId',
  'disabled',
  'inhibitSounders',
  'inhibitIO',
  'inhibitRelays'
]

export function diffCpdImport(existing: FireProject, incoming: CpdAdapterResult): CpdDiffResult {
  const existingDevices = (existing as ProjectWithDevices).devices ?? []
  const existingByKey = new Map(existingDevices.map((device) => [deviceMatchKey(device), device]))
  const incomingByKey = new Map(incoming.devices.map((device) => [deviceMatchKey(device), device]))
  const matched: CpdDiffResult['matched'] = []
  const added: string[] = []
  const removed: string[] = []
  const changed: CpdDiffResult['changed'] = []

  for (const incomingDevice of incoming.devices) {
    const existingDevice = existingByKey.get(deviceMatchKey(incomingDevice))

    if (!existingDevice) {
      added.push(incomingDevice.id)
      continue
    }

    matched.push({ existingDeviceId: existingDevice.id, incomingDeviceId: incomingDevice.id })

    const fields = COMPARED_DEVICE_FIELDS.filter(
      (field) =>
        normalizeComparable(existingDevice[field]) !== normalizeComparable(incomingDevice[field])
    ).map(String)

    if (fields.length > 0) {
      changed.push({ deviceId: existingDevice.id, fields })
    }
  }

  for (const existingDevice of existingDevices) {
    if (!incomingByKey.has(deviceMatchKey(existingDevice))) {
      removed.push(existingDevice.id)
    }
  }

  return { matched, added, removed, changed }
}

export function applyCpdDiff(
  existing: FireProject,
  incoming: CpdAdapterResult,
  diff: CpdDiffResult
): FireProject {
  const existingProject = existing as ProjectWithDevices
  const existingDevices = existingProject.devices ?? []
  const existingByKey = new Map(existingDevices.map((device) => [deviceMatchKey(device), device]))
  const incomingMatchedKeys = new Set(incoming.devices.map(deviceMatchKey))
  const removedIds = new Set(diff.removed)
  const devices = [
    ...incoming.devices.map((incomingDevice) => {
      const existingDevice = existingByKey.get(deviceMatchKey(incomingDevice))

      return existingDevice
        ? {
            ...incomingDevice,
            id: existingDevice.id,
            placement: existingDevice.placement
          }
        : incomingDevice
    }),
    ...existingDevices
      .filter(
        (device) => removedIds.has(device.id) && !incomingMatchedKeys.has(deviceMatchKey(device))
      )
      .map((device) => ({
        ...device,
        placement: {
          ...device.placement,
          status: 'missing' as const
        }
      }))
  ]

  return {
    ...clone(existing),
    name: incoming.projectName || existing.name,
    updatedAt: Date.now(),
    networks: [mergeNetworkPlanningState(existing.networks, incoming.network)],
    devices,
    issues: incoming.issues
  } as FireProject
}

function mergeNetworkPlanningState(
  existingNetworks: FireNetwork[],
  incomingNetwork: FireNetwork
): FireNetwork {
  return {
    ...incomingNetwork,
    panels: incomingNetwork.panels.map((incomingPanel) => {
      const existingPanel = existingNetworks
        .flatMap((network) => network.panels)
        .find((panel) => panel.panelNumber === incomingPanel.panelNumber)

      if (!existingPanel) {
        return incomingPanel
      }

      return {
        ...incomingPanel,
        loops: incomingPanel.loops.map((loop) => mergeLoopPlanningState(existingPanel.loops, loop)),
        zones: incomingPanel.zones.map((zone) => mergeZonePlanningState(existingPanel.zones, zone))
      }
    })
  }
}

function mergeLoopPlanningState(existingLoops: FireLoop[], incomingLoop: FireLoop): FireLoop {
  const existingLoop = existingLoops.find((loop) => loop.loopId === incomingLoop.loopId)

  if (!existingLoop) {
    return incomingLoop
  }

  return {
    ...incomingLoop,
    manualDeviceOrder: existingLoop.manualDeviceOrder,
    color: existingLoop.color || incomingLoop.color
  }
}

function mergeZonePlanningState(existingZones: FireZone[], incomingZone: FireZone): FireZone {
  const existingZone = existingZones.find((zone) => zone.zoneNumber === incomingZone.zoneNumber)

  if (!existingZone) {
    return incomingZone
  }

  return {
    ...incomingZone,
    visualAreas: existingZone.visualAreas
  }
}

function deviceMatchKey(device: FireDevice): string {
  return `${device.panelNumber}:${device.loopId ?? 'none'}:${device.address ?? 'none'}`
}

function normalizeComparable(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
