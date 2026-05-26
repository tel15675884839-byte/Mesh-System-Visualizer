import type { FireDevice, FireNetwork } from '../../types'
import { resolveCauseAndEffect } from '../causeEffect'
import type { ActiveInputAlarm, OutputActivation } from '../types'

export function network(
  overrides: {
    sounderMode?: FireNetwork['sounderMode']
    withGroupMembers?: boolean
    faultIOGroup?: number
  } = {}
): FireNetwork {
  const sounderMode = overrides.sounderMode ?? 'Programmed'

  return {
    id: 'network-1',
    name: 'Network 1',
    sourceFileName: 'sample.cpd',
    sourceImportedAt: 0,
    sounderMode,
    panels: [
      {
        id: 'panel-1',
        networkId: 'network-1',
        panelNumber: 1,
        panelName: 'Panel 1',
        general: {
          panelNumber: 1,
          sounderMode,
          faultIOGroup: overrides.faultIOGroup ?? 9,
          evacuateDelaySeconds: 30,
          sounderDelaySeconds: 0,
          inputOutputDelaySeconds: 0,
          fireBrigadeDelaySeconds: 0,
          onManualCallPoints: false,
          onTwoDevices: false,
          delayOffAtNight: false,
          raw: {}
        },
        loops: [],
        zones: [
          {
            id: 'zone-1',
            networkId: 'network-1',
            panelId: 'panel-1',
            zoneNumber: 1,
            text: 'Zone 1',
            enabled: true,
            delayedSounders: false,
            alarmMode: 'single',
            sounderGroupAlarm1: 1,
            sounderGroupAlarm2: 2,
            ioGroup1Alarm1: 3,
            ioGroup1Alarm2: 4,
            ioGroup2Alarm1: 5,
            ioGroup3Alarm1: 6,
            ioGroup4Alarm1: 7,
            visualAreas: [],
            raw: {}
          },
          {
            id: 'zone-2',
            networkId: 'network-1',
            panelId: 'panel-1',
            zoneNumber: 2,
            text: 'Zone 2',
            enabled: true,
            delayedSounders: false,
            alarmMode: 'double',
            sounderGroupAlarm1: 11,
            sounderGroupAlarm2: 12,
            ioGroup1Alarm1: 13,
            ioGroup1Alarm2: 14,
            visualAreas: [],
            raw: {}
          }
        ],
        sounderGroups: overrides.withGroupMembers
          ? [
              {
                id: 'sounder-group-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                groupId: 1,
                addressableMembers: [{ loopId: 1, physicalAddress: 90, raw: {} }],
                nonAddressableMembers: [],
                raw: {}
              }
            ]
          : [],
        ioGroups: overrides.withGroupMembers
          ? [
              {
                id: 'io-group-3',
                networkId: 'network-1',
                panelId: 'panel-1',
                groupId: 3,
                members: [{ loopId: 1, physicalAddress: 91, raw: {} }],
                raw: {}
              }
            ]
          : [],
        sounders: { raw: {} }
      }
    ]
  }
}

export function device(overrides: Partial<FireDevice>): FireDevice {
  return {
    id: 'input-1',
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: 1,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    zoneNumber: 1,
    isInputCapable: true,
    isOutputCapable: false,
    isSounder: false,
    isWirelessType: false,
    disabled: false,
    inhibitSounders: false,
    inhibitIO: false,
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: { status: 'unplaced' },
    raw: {},
    ...overrides
  }
}

export function outputsFor(
  activeInputAlarms: ActiveInputAlarm[],
  devices: FireDevice[],
  net = network()
): OutputActivation[] {
  return resolveCauseAndEffect({
    network: net,
    devices,
    nonAddressablePoints: [],
    activeInputAlarms
  })
}

export function outputIds(outputs: OutputActivation[]): string[] {
  return outputs
    .filter((output) => output.state === 'active')
    .map((output) => output.outputId)
    .sort()
}
