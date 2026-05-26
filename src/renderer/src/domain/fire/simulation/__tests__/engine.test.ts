import { describe, expect, it } from 'vitest'

import type { FireDevice, FireNetwork, NonAddressableSounderPoint } from '../../types'
import {
  createInitialSimulationState,
  reduceSimulation,
  type SimulationEngineInput
} from '../engine'

function network(
  generalOverrides: Partial<FireNetwork['panels'][number]['general']> = {}
): FireNetwork {
  return {
    id: 'network-1',
    name: 'Network 1',
    sourceFileName: 'sample.cpd',
    sourceImportedAt: 0,
    sounderMode: 'Programmed',
    panels: [
      {
        id: 'panel-1',
        networkId: 'network-1',
        panelNumber: 1,
        panelName: 'Panel 1',
        general: {
          panelNumber: 1,
          sounderMode: 'Programmed',
          faultIOGroup: 9,
          evacuateDelaySeconds: 0,
          sounderDelaySeconds: 0,
          inputOutputDelaySeconds: 0,
          fireBrigadeDelaySeconds: 0,
          onManualCallPoints: false,
          onTwoDevices: false,
          delayOffAtNight: false,
          raw: {},
          ...generalOverrides
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
            ioGroup1Alarm1: 3,
            visualAreas: [],
            raw: {}
          }
        ],
        sounderGroups: [],
        ioGroups: [],
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

function engineInput(
  devices: FireDevice[] = [device({ id: 'input-1' })],
  net: FireNetwork = network()
): SimulationEngineInput {
  return {
    network: net,
    devices,
    nonAddressablePoints: [] satisfies NonAddressableSounderPoint[],
    now: 0
  }
}

describe('simulation engine reducer', () => {
  it('activates an alarm from the double-click equivalent input action', () => {
    const state = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })

    expect(state.systemState).toBe('fireAlarm')
    expect(state.soundState).toBe('fire')
    expect(state.activeInputAlarms).toEqual([{ deviceId: 'input-1', activatedAt: 10 }])
  })

  it('removes the source when an input is restored', () => {
    const active = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })

    const restored = reduceSimulation(active, engineInput(), {
      type: 'restore-input',
      deviceId: 'input-1',
      at: 20
    })

    expect(restored.systemState).toBe('normal')
    expect(restored.activeInputAlarms).toEqual([])
  })

  it('resets directly to the initial state', () => {
    const active = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })

    const faulted = reduceSimulation(active, engineInput(), {
      type: 'trigger-fault',
      deviceId: 'input-1',
      at: 15
    })

    const silenced = reduceSimulation(faulted, engineInput(), {
      type: 'buzzer-silence',
      at: 18
    })

    const reset = reduceSimulation(silenced, engineInput(), {
      type: 'system-reset',
      at: 20
    })

    expect(reset).toEqual(createInitialSimulationState())
  })

  it('silences the current sound when the buzzer is silenced', () => {
    const active = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })

    const silenced = reduceSimulation(active, engineInput(), {
      type: 'buzzer-silence',
      at: 20
    })

    expect(silenced.systemState).toBe('fireAlarm')
    expect(silenced.soundState).toBe('silent')
    expect(silenced.buzzerSilenced).toBe(true)
  })

  it('restarts sound for a new alarm after buzzer silence', () => {
    const silenced = reduceSimulation(
      reduceSimulation(createInitialSimulationState(), engineInput(), {
        type: 'activate-input',
        deviceId: 'input-1',
        at: 10
      }),
      engineInput(),
      { type: 'buzzer-silence', at: 20 }
    )

    const newAlarm = reduceSimulation(
      silenced,
      engineInput([device({ id: 'input-1' }), device({ id: 'input-2' })]),
      {
        type: 'activate-input',
        deviceId: 'input-2',
        at: 30
      }
    )

    expect(newAlarm.soundState).toBe('fire')
    expect(newAlarm.buzzerSilenced).toBe(false)
  })

  it('activates the configured FaultIOGroup when a fault is triggered', () => {
    const fault = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'trigger-fault',
      deviceId: 'input-1',
      at: 10
    })

    expect(fault.systemState).toBe('fault')
    expect(fault.soundState).toBe('fault')
    expect(fault.outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'fault-io-group:panel-1:9',
        state: 'active'
      })
    )
  })

  it('clears the fault source when a fault is restored', () => {
    const fault = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'trigger-fault',
      deviceId: 'input-1',
      at: 10
    })

    const restored = reduceSimulation(fault, engineInput(), {
      type: 'restore-fault',
      deviceId: 'input-1',
      at: 20
    })

    expect(restored.systemState).toBe('normal')
    expect(restored.activeFaults).toEqual([])
  })

  it('starts the evacuate flow from manual evacuate', () => {
    const evacuated = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'evacuate',
      at: 10
    })

    expect(evacuated.systemState).toBe('evacuate')
    expect(evacuated.soundState).toBe('fire')
    expect(evacuated.outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'evacuate:network-1',
        state: 'active'
      })
    )
  })

  it('preserves reduced delay remaining seconds across non-tick actions', () => {
    const net = network({ sounderDelaySeconds: 90 })
    net.panels[0].zones[0].delayedSounders = true
    const active = reduceSimulation(createInitialSimulationState(), engineInput(undefined, net), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })
    const ticked = reduceSimulation(active, engineInput(undefined, net), {
      type: 'tick',
      at: 20,
      elapsedSeconds: 30
    })

    const silenced = reduceSimulation(ticked, engineInput(undefined, net), {
      type: 'buzzer-silence',
      at: 30
    })

    expect(silenced.outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'delayActive',
        remainingDelaySeconds: 60
      })
    )
  })

  it('bypasses sounder delays when the 3D delay toggle is off', () => {
    const net = network({ sounderDelaySeconds: 60 })
    net.panels[0].zones[0].delayedSounders = true

    const active = reduceSimulation(
      createInitialSimulationState(),
      { ...engineInput(undefined, net), sounderDelaysEnabled: false },
      {
        type: 'activate-input',
        deviceId: 'input-1',
        at: 10
      }
    )

    expect(outputById(active, 'sounder-group:panel-1:1')).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0
    })
  })

  it('applies sounder delays when the 3D delay toggle is on', () => {
    const net = network({ sounderDelaySeconds: 60 })
    net.panels[0].zones[0].delayedSounders = true

    const active = reduceSimulation(
      createInitialSimulationState(),
      { ...engineInput(undefined, net), sounderDelaysEnabled: true },
      {
        type: 'activate-input',
        deviceId: 'input-1',
        at: 10
      }
    )

    expect(outputById(active, 'sounder-group:panel-1:1')).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 60
    })
  })

  it('silences sounders without restoring active detector alarms', () => {
    const net = network({ sounderDelaySeconds: 0 })
    const active = reduceSimulation(createInitialSimulationState(), engineInput(undefined, net), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })

    const silenced = reduceSimulation(active, engineInput(undefined, net), {
      type: 'sounder-silence',
      at: 20
    })

    expect(silenced.systemState).toBe('fireAlarm')
    expect(silenced.soundState).toBe('silent')
    expect(silenced.activeInputAlarms).toEqual([{ deviceId: 'input-1', activatedAt: 10 }])
    expect(silenced.outputs.some((output) => output.outputId.startsWith('sounder-group:'))).toBe(
      false
    )
  })

  it('clears manual evacuate when sounders are silenced but keeps detector alarms', () => {
    const alarmed = reduceSimulation(createInitialSimulationState(), engineInput(), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })
    const evacuated = reduceSimulation(alarmed, engineInput(), { type: 'evacuate', at: 12 })

    const silenced = reduceSimulation(evacuated, engineInput(), {
      type: 'sounder-silence',
      at: 20
    })

    expect(silenced.systemState).toBe('fireAlarm')
    expect(silenced.manualEvacuateActive).toBe(false)
    expect(silenced.activeInputAlarms).toEqual([{ deviceId: 'input-1', activatedAt: 10 }])
  })

  it('skips only delayed sounder outputs for 3D demonstrations', () => {
    const net = network({
      sounderDelaySeconds: 60,
      inputOutputDelaySeconds: 45,
      fireBrigadeDelaySeconds: 30
    })
    net.panels[0].zones[0].delayedSounders = true
    const delayed = reduceSimulation(
      createInitialSimulationState(),
      { ...engineInput(undefined, net), sounderDelaysEnabled: true },
      {
        type: 'activate-input',
        deviceId: 'input-1',
        at: 10
      }
    )

    const skipped = reduceSimulation(delayed, engineInput(undefined, net), {
      type: 'skip-sounder-delays',
      at: 20
    })

    expect(outputById(skipped, 'sounder-group:panel-1:1')).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0
    })
    expect(outputById(skipped, 'io-group:panel-1:3')).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 45
    })
    expect(outputById(skipped, 'fire-brigade:panel-1')).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 30
    })
  })

  it('preserves skipped delay as active across later non-tick actions while the cause remains', () => {
    const net = network({ sounderDelaySeconds: 90 })
    const active = reduceSimulation(createInitialSimulationState(), engineInput(undefined, net), {
      type: 'activate-input',
      deviceId: 'input-1',
      at: 10
    })
    const skipped = reduceSimulation(active, engineInput(undefined, net), {
      type: 'skip-delay',
      outputId: 'sounder-group:panel-1:1',
      at: 20
    })

    const faulted = reduceSimulation(skipped, engineInput(undefined, net), {
      type: 'trigger-fault',
      deviceId: 'input-1',
      at: 30
    })

    expect(faulted.outputs).toContainEqual(
      expect.objectContaining({
        outputId: 'sounder-group:panel-1:1',
        state: 'active',
        remainingDelaySeconds: 0
      })
    )
  })
})

function outputById(
  state: ReturnType<typeof createInitialSimulationState>,
  outputId: string
): ReturnType<typeof createInitialSimulationState>['outputs'][number] | undefined {
  return state.outputs.find((output) => output.outputId === outputId)
}
