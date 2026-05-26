import { describe, expect, it } from 'vitest'

import type { NonAddressableSounderPoint } from '../../types'
import { resolveCauseAndEffect } from '../causeEffect'
import { device, network, outputIds, outputsFor } from './causeEffect.fixture'

describe('cause and effect resolution', () => {
  it('activates programmed stage 1 Zone outputs', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])

    expect(outputIds(outputs)).toEqual([
      'fire-brigade:panel-1',
      'io-group:panel-1:3',
      'io-group:panel-1:5',
      'io-group:panel-1:6',
      'io-group:panel-1:7',
      'sounder-group:panel-1:1'
    ])
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        reason: 'zone-non-delayed-sounders'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        reason: 'io'
      })
    )
  })

  it('activates direct initiating-device Sounder Group and I/O Group assignments separately from membership', () => {
    const input = device({ id: 'input-1', zoneNumber: 1, sounderGroupId: 8, ioGroupId: 9 })

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])

    expect(outputIds(outputs)).toEqual([
      'fire-brigade:panel-1',
      'io-group:panel-1:3',
      'io-group:panel-1:5',
      'io-group:panel-1:6',
      'io-group:panel-1:7',
      'io-group:panel-1:9',
      'sounder-group:panel-1:1',
      'sounder-group:panel-1:8'
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

  it('activates all enabled Network sounders from manual evacuate', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const firstSounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })
    const secondSounder = device({
      id: 'sounder-2',
      address: 91,
      type: 'wireless_sounder',
      friendlyTypeName: 'Wireless Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true,
      isWirelessType: true
    })
    const disabledSounder = device({
      id: 'sounder-disabled',
      address: 92,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true,
      disabled: true
    })
    const net = network()
    net.panels[0].general.evacuateDelaySeconds = 0

    const outputs = resolveCauseAndEffect({
      network: net,
      devices: [input, firstSounder, secondSounder, disabledSounder],
      nonAddressablePoints: [],
      activeInputAlarms: [],
      evacuateActive: true
    })

    expect(outputIds(outputs)).toContain('device:sounder-1')
    expect(outputIds(outputs)).toContain('device:sounder-2')
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'device:sounder-disabled',
        state: 'active',
        reason: 'evacuate'
      })
    )
    expect(outputs.systemState).toBe('evacuate')
  })

  it('keeps programmed alarms CPD-configured instead of activating every sounder', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const unrelatedSounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input, unrelatedSounder])

    expect(outputIds(outputs)).toContain('sounder-group:panel-1:1')
    expect(outputIds(outputs)).not.toContain('device:sounder-1')
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

  it('applies zonal sounder inhibit without blocking direct device sounder assignments', () => {
    const input = device({
      id: 'input-1',
      zoneNumber: 1,
      sounderGroupId: 8,
      inhibitSounders: true,
      raw: { InhibitSounders: 'ZONAL' }
    })

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input])

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'inhibited',
        reason: 'inhibit-sounders'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:8',
        state: 'active'
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
