import { describe, expect, it } from 'vitest'

import type { NonAddressableSounderPoint } from '../../types'
import { resolveCauseAndEffect } from '../causeEffect'
import { device, network, outputIds, outputsFor } from './causeEffect.fixture'

describe('cause and effect delay and evacuate resolution', () => {
  it('does not delay sounders when the alarm Zone has delayed sounders disabled', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].general.sounderDelaySeconds = 90
    net.panels[0].zones[0].delayedSounders = false

    expect(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input], net)).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'active',
        remainingDelaySeconds: 0
      })
    )
  })

  it('applies zone delayed sounders to the whole configured Zone output', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].general.sounderDelaySeconds = 90
    net.panels[0].zones[0].delayedSounders = true

    expect(outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input], net)).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'delayActive',
        remainingDelaySeconds: 90,
        reason: 'zone-delayed-sounders'
      })
    )
  })

  it('keeps Sounder Group and I/O Group delays independent for the same alarm source', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].general.sounderDelaySeconds = 90
    net.panels[0].general.inputOutputDelaySeconds = 60
    net.panels[0].zones[0].delayedSounders = true

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input], net)

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'delayActive',
        remainingDelaySeconds: 90,
        reason: 'zone-delayed-sounders'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'delayActive',
        remainingDelaySeconds: 60,
        reason: 'io'
      })
    )
  })

  it('activates programmed non-addressable sounder points by audible group channel mode', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].sounderGroups = [
      {
        id: 'sounder-group-1',
        networkId: 'network-1',
        panelId: 'panel-1',
        groupId: 1,
        addressableMembers: [],
        nonAddressableMembers: [
          { cieId: 1, nonAddressable1: true, status: 'Intermittent', raw: {} },
          { cieId: 1, nonAddressable2: true, status: 'Silent', raw: {} }
        ],
        raw: {}
      }
    ]
    const firstPoint: NonAddressableSounderPoint = {
      id: 'nas-1',
      networkId: 'network-1',
      panelId: 'panel-1',
      sounderGroupId: 1,
      cieId: 1,
      channel: 'nonAddressable1',
      label: 'CIE Sounder 1',
      placement: { status: 'unplaced' }
    }
    const silentPoint: NonAddressableSounderPoint = {
      ...firstPoint,
      id: 'nas-2',
      channel: 'nonAddressable2',
      label: 'CIE Sounder 2'
    }

    const outputs = resolveCauseAndEffect({
      network: net,
      devices: [input],
      nonAddressablePoints: [firstPoint, silentPoint],
      activeInputAlarms: [{ deviceId: 'input-1', activatedAt: 0 }]
    })

    expect(outputIds(outputs)).toContain('non-addressable-sounder:nas-1')
    expect(outputIds(outputs)).not.toContain('non-addressable-sounder:nas-2')
  })

  it('uses device delay override fields for sounder and I/O outputs', () => {
    const input = device({
      id: 'input-1',
      zoneNumber: 1,
      overrideDelays: true,
      ioOverrideDelay: true
    })
    const net = network()
    net.panels[0].general.sounderDelaySeconds = 90
    net.panels[0].general.inputOutputDelaySeconds = 60
    net.panels[0].zones[0].delayedSounders = true

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input], net)

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'active',
        remainingDelaySeconds: 0,
        reason: 'device-override-delay'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'active',
        remainingDelaySeconds: 0,
        reason: 'io-override-delay'
      })
    )
  })

  it('bypasses I/O output delay when delayed mode is off', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].general.inputOutputDelaySeconds = 60

    const outputs = resolveCauseAndEffect({
      network: net,
      devices: [input],
      nonAddressablePoints: [],
      activeInputAlarms: [{ deviceId: 'input-1', activatedAt: 0 }],
      sounderDelaysEnabled: false
    })

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'active',
        remainingDelaySeconds: 0,
        reason: 'io'
      })
    )
  })

  it('uses I/O output delay when delayed mode is on', () => {
    const input = device({ id: 'input-1', zoneNumber: 1 })
    const net = network()
    net.panels[0].general.inputOutputDelaySeconds = 60

    const outputs = resolveCauseAndEffect({
      network: net,
      devices: [input],
      nonAddressablePoints: [],
      activeInputAlarms: [{ deviceId: 'input-1', activatedAt: 0 }],
      sounderDelaysEnabled: true
    })

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'io-group:panel-1:3',
        state: 'delayActive',
        remainingDelaySeconds: 60,
        reason: 'io'
      })
    )
  })

  it('applies evacuate delay to manual evacuate sounders and evacuate I/O outputs', () => {
    const sounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })
    const evacuateIo = device({
      id: 'io-evacuate',
      address: 91,
      type: 'input_output',
      friendlyTypeName: 'Input/Output',
      isOutputCapable: true,
      evacuateIO: true
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
      network: network(),
      devices: [sounder, evacuateIo],
      nonAddressablePoints: [nonAddressablePoint],
      activeInputAlarms: [],
      evacuateActive: true
    })

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'device:sounder-1',
        state: 'delayActive',
        remainingDelaySeconds: 30,
        reason: 'evacuate'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'device:io-evacuate',
        state: 'delayActive',
        remainingDelaySeconds: 30,
        reason: 'evacuate-io'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'non-addressable-sounder:nas-1',
        state: 'delayActive',
        remainingDelaySeconds: 30,
        reason: 'evacuate'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'evacuate:network-1',
        state: 'delayActive',
        remainingDelaySeconds: 30,
        reason: 'evacuate'
      })
    )
  })

  it('starts immediate evacuate from a configured input and bypasses evacuate delay', () => {
    const input = device({ id: 'input-1', zoneNumber: 1, immediateEvacuate: true })
    const sounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })
    const net = network()
    net.panels[0].general.evacuateDelaySeconds = 45

    const outputs = outputsFor([{ deviceId: 'input-1', activatedAt: 0 }], [input, sounder], net)

    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'device:sounder-1',
        state: 'active',
        remainingDelaySeconds: 0,
        reason: 'evacuate'
      })
    )
    expect(outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'evacuate:network-1',
        state: 'active',
        remainingDelaySeconds: 0,
        reason: 'evacuate'
      })
    )
  })

  it('starts the evacuate timer from device and panel configured alarm conditions', () => {
    const timerInput = device({ id: 'timer-input', zoneNumber: 1, setEvacuateTimer: true })
    const manualCallPoint = device({
      id: 'manual-call-point',
      address: 4,
      zoneNumber: 1,
      type: 'manual_call_point',
      friendlyTypeName: 'Manual Call Point'
    })
    const firstDetector = device({
      id: 'detector-1',
      address: 11,
      zoneNumber: 1,
      type: 'optical_det',
      friendlyTypeName: 'Optical Detector'
    })
    const secondDetector = device({
      id: 'detector-2',
      address: 12,
      zoneNumber: 1,
      type: 'heat_det',
      friendlyTypeName: 'Heat Detector'
    })
    const sounder = device({
      id: 'sounder-1',
      address: 90,
      type: 'sounder',
      friendlyTypeName: 'Sounder',
      isInputCapable: false,
      isOutputCapable: true,
      isSounder: true
    })
    const net = network()
    net.panels[0].general.evacuateDelaySeconds = 25
    net.panels[0].general.onManualCallPoints = true
    net.panels[0].general.onTwoDevices = true

    const timerOutputs = outputsFor(
      [{ deviceId: 'timer-input', activatedAt: 0 }],
      [timerInput, sounder],
      net
    )
    const mcpOutputs = outputsFor(
      [{ deviceId: 'manual-call-point', activatedAt: 0 }],
      [manualCallPoint, sounder],
      net
    )
    const twoDeviceOutputs = outputsFor(
      [
        { deviceId: 'detector-1', activatedAt: 0 },
        { deviceId: 'detector-2', activatedAt: 1 }
      ],
      [firstDetector, secondDetector, sounder],
      net
    )

    for (const outputs of [timerOutputs, mcpOutputs, twoDeviceOutputs]) {
      expect(outputs).toContainEqual(
        expect.objectContaining({
          outputId: 'evacuate:network-1',
          state: 'delayActive',
          remainingDelaySeconds: 25,
          reason: 'evacuate'
        })
      )
    }
  })
})
