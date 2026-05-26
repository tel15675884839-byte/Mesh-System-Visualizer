import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adaptCpdExport, type CpdAdapterResult } from '../cpdAdapter'
import { shouldPlaySimulationAlarmAudio } from '../simulationAudio'
import type { FireDevice, FireProject } from '../types'
import { createInitialSimulationState, reduceSimulation } from '../simulation/engine'
import type { SimulationState } from '../simulation/types'

function loadExtractedFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../../../fixtures/cpd/extracted/${fileName}`, import.meta.url),
      'utf8'
    )
  )
}

function adaptFixture(fileName: string): CpdAdapterResult {
  return adaptCpdExport(loadExtractedFixture(fileName), 1234)
}

function makeProject(result: CpdAdapterResult): FireProject {
  return {
    schemaVersion: 1,
    projectId: 'simulation-audio-test',
    name: result.projectName,
    createdAt: 0,
    updatedAt: 0,
    language: 'en',
    networks: [result.network],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#0f172a',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: {
      timeScale: 1,
      soundEnabled: true
    }
  }
}

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`fixture did not import address ${address}`)
  }

  return device
}

function activate(result: CpdAdapterResult, address: number): SimulationState {
  return reduceSimulation(
    createInitialSimulationState(),
    {
      network: result.network,
      devices: result.devices,
      nonAddressablePoints: [],
      now: 0
    },
    {
      type: 'activate-input',
      deviceId: deviceByAddress(result, address).id,
      at: 0
    }
  )
}

function tick(
  result: CpdAdapterResult,
  state: SimulationState,
  elapsedSeconds: number
): SimulationState {
  return reduceSimulation(
    state,
    {
      network: result.network,
      devices: result.devices,
      nonAddressablePoints: [],
      now: elapsedSeconds
    },
    {
      type: 'tick',
      at: elapsedSeconds,
      elapsedSeconds
    }
  )
}

describe('simulation audio gate', () => {
  it('keeps 3D fire sound silent while the CPD Zone 1 sounder output is still delayed', () => {
    const result = adaptFixture('6002-delay-edge-fields.json')
    const state = activate(result, 4)

    expect(state.outputs).toContainEqual(
      expect.objectContaining({
        outputId: `sounder-group:${result.network.panels[0].id}:1`,
        state: 'delayActive',
        remainingDelaySeconds: 60
      })
    )
    expect(
      shouldPlaySimulationAlarmAudio({
        simulationMode: true,
        soundEnabled: true,
        soundState: state.soundState,
        project: makeProject(result),
        devices: result.devices,
        outputs: state.outputs
      })
    ).toBe(false)
  })

  it('starts 3D fire sound only after the CPD sounder delay counts down to active', () => {
    const result = adaptFixture('6002-delay-edge-fields.json')
    const state = tick(result, activate(result, 4), 60)

    expect(state.outputs).toContainEqual(
      expect.objectContaining({
        outputId: `sounder-group:${result.network.panels[0].id}:1`,
        state: 'active',
        remainingDelaySeconds: 0
      })
    )
    expect(
      shouldPlaySimulationAlarmAudio({
        simulationMode: true,
        soundEnabled: true,
        soundState: state.soundState,
        project: makeProject(result),
        devices: result.devices,
        outputs: state.outputs
      })
    ).toBe(true)
  })

  it('still plays immediately for the non-delayed control fixture', () => {
    const result = adaptFixture('6002-zone-no-delayed-sounders.json')
    const state = activate(result, 1)

    expect(
      shouldPlaySimulationAlarmAudio({
        simulationMode: true,
        soundEnabled: true,
        soundState: state.soundState,
        project: makeProject(result),
        devices: result.devices,
        outputs: state.outputs
      })
    ).toBe(true)
  })

  it('plays evacuation audio when a disabled sounder is directly operated by evacuation', () => {
    const result = adaptFixture('6002-zone-no-delayed-sounders.json')
    const sounder = result.devices.find((candidate) => candidate.isSounder)
    if (!sounder) {
      throw new Error('fixture did not import an addressable sounder')
    }
    const disabledSounder = { ...sounder, disabled: true }

    expect(
      shouldPlaySimulationAlarmAudio({
        simulationMode: true,
        soundEnabled: true,
        soundState: 'fire',
        project: makeProject(result),
        devices: [disabledSounder],
        outputs: [
          {
            outputId: `device:${disabledSounder.id}`,
            state: 'active',
            causes: ['manual-evacuate'],
            reason: 'evacuate'
          }
        ]
      })
    ).toBe(true)
  })
})
