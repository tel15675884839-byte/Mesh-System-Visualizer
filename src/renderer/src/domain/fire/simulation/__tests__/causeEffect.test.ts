import { describe, expect, it } from 'vitest'

import type { FireDevice, FireNetwork, NonAddressableSounderPoint } from '../../types'
import { resolveCauseAndEffect } from '../causeEffect'
import type { ActiveInputAlarm, OutputActivation } from '../types'

function network(
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

function device(overrides: Partial<FireDevice>): FireDevice {
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

function outputsFor(
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

function outputIds(outputs: OutputActivation[]): string[] {
  return outputs
    .filter((output) => output.state === 'active')
    .map((output) => output.outputId)
    .sort()
}

describe('cause and effect resolution', () => {
  it('activates programmed stage 1 Zone outputs', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })

    expect(outputIds(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input]))).toEqual([
      'fire-brigade:panel-1',
      'io-group:panel-1:3',
      'io-group:panel-1:5',
      'io-group:panel-1:6',
      'io-group:panel-1:7',
      'sounder-group:panel-1:1'
    ])
  })

  it('activates programmed stage 2 Zone outputs when a double-knock Zone has two alarms', () => {
    const first = device({ id: 'input-1', zoneNumber: 2 })
    const second = device({ id: 'input-2', address: 2, zoneNumber: 2 })

    expect(
      outputIds(
        outputsFor(
          [
            { deviceId: 'input-1', activatedAt: 0 },
            { deviceId: 'input-2', activatedAt: 1 }
          ],
          [first, second]
        )
      )
    ).toEqual(['fire-brigade:panel-1', 'io-group:panel-1:14', 'sounder-group:panel-1:12'])
  })

  it('activates all Network sounders in Preset mode', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const sounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })
    const nonAddressablePoint: NonAddressableSounderPoint = {
      id: 'nas-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      sounderGroupId: 8,
      channel: 'nonAddressable1',
      label: 'CIE Sounder 1',
      placement: { status: 'unplaced' }
    }

    const outputs = resolveCauseAndEffect({
      network: network({ sounderMode: 'Preset' }),
      devices: [input, sounder],
      nonAddressablePoints: [nonAddressablePoint],
      activeInputAlarms: [{ deviceId: 'input-1', activatedAt: 0 }]
    })

    expect(outputIds(outputs)).toContain('device:sounder-1')
    expect(outputIds(outputs)).toContain('non-addressable-sounder:nas-1')
  })

  it('keeps I/O config-driven in Preset mode', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })

    expect(
      outputIds(
        outputsFor(
          [{ deviceId: 'input-1', activatedAt: 0 }],
          [input],
          network({ sounderMode: 'Preset' })
        )
      )
    ).toContain('io-group:panel-1:3')
  })

  it('does not create an effective alarm for a disabled input', () => {
    const input = device({ id: 'input-1', disabled: true })

    expect(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])).toHaveLength(0)
  })

  it('blocks sounders when the cause inhibits sounders', () => {
    const input = device({ id: 'input-1', inhibitSounders: true })

    expect(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'inhibited',
        reason: 'inhibit-sounders'
      })
    )
  })

  it('blocks I/O when the cause inhibits I/O', () => {
    const input = device({ id: 'input-1', inhibitIO: true })

    expect(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'inhibited',
        reason: 'inhibit-io'
      })
    )
  })

  it('keeps fire sound priority over fault sound', () => {
    const input = device({ id: 'input-1' })

    const result = resolveCauseAndEffect({
      network: network(),
      devices: [input],
      nonAddressablePoints: [],
      activeInputAlarms: [{ deviceId: 'input-1', activatedAt: 0 }],
      activeFaults: [{ deviceId: 'input-1', activatedAt: 1 }]
    })

    expect(result.soundState).toBe('fire')
  })

  it('marks programmed sounder group disabled when its addressable sounder member is disabled', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const disabledSounder = device({
      id: 'sounder-1',
      loopId: 1,
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true,
      disabled: true
    })

    expect(
      outputsFor(
        [{ deviceId: 'input-1', activatedAt: 0 }],
        [input, disabledSounder],
        network({ withGroupMembers: true })
      )
    ).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'disabled',
        reason: 'disabled-output'
      })
    )
  })

  it('marks programmed I/O group disabled when its output-capable member is disabled', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const disabledIO = device({
      id: 'io-1',
      loopId: 1,
      address: 91,
      type: 'input_output',
      friendlyTypeName: 'Input/Output',
      isInputCapable: true,
      isOutputCapable: true,
      disabled: true
    })

    expect(
      outputsFor(
        [{ deviceId: 'input-1', activatedAt: 0 }],
        [input, disabledIO],
        network({ withGroupMembers: true })
      )
    ).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'disabled',
        reason: 'disabled-output'
      })
    )
  })

  it('marks FaultIOGroup disabled when its output-capable member is disabled', () => {
    const faultSource = device({ id: 'input-1' })
    const disabledIO = device({
      id: 'io-1',
      loopId: 1,
      address: 91,
      type: 'input_output',
      friendlyTypeName: 'Input/Output',
      isInputCapable: true,
      isOutputCapable: true,
      disabled: true
    })

    const outputs = resolveCauseAndEffect({
      network: network({ withGroupMembers: true, faultIOGroup: 3 }),
      devices: [faultSource, disabledIO],
      nonAddressablePoints: [],
      activeInputAlarms: [],
      activeFaults: [{ deviceId: 'input-1', activatedAt: 0 }]
    })

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'fault-io-group:panel-1:3',
        state: 'disabled',
        reason: 'disabled-output'
      })
    )
  })
})
