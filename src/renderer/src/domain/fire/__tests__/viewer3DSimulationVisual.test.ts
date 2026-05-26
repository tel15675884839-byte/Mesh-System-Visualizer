import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { adaptCpdExport, type CpdAdapterResult } from '../cpdAdapter'
import { getDeviceSimulationOutput } from '../simulationOutputMapping'
import type { FireDevice, FireProject } from '../types'
import { getViewer3DDeviceAnimationFrame } from '../viewer3DSimulationVisual'
import { resolveCauseAndEffect } from '../simulation/causeEffect'
import { tickDelayedOutputs } from '../simulation/delays'
import type { OutputActivation } from '../simulation/types'

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
    projectId: 'viewer-3d-fixture',
    name: 'Viewer 3D fixture',
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
      soundEnabled: false
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

function trigger(result: CpdAdapterResult, address: number): OutputActivation[] {
  return resolveCauseAndEffect({
    network: result.network,
    devices: result.devices,
    nonAddressablePoints: [],
    activeInputAlarms: [{ deviceId: deviceByAddress(result, address).id, activatedAt: 0 }]
  })
}

describe('viewer 3D simulation visuals', () => {
  it('flashes active sounder outputs between red and yellow', () => {
    const first = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'active',
      isSounder: true
    })
    const second = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 180,
      outputState: 'active',
      isSounder: true
    })

    expect(first.color).toBe('#ef4444')
    expect(second.color).toBe('#facc15')
    expect(first.scale).toBeGreaterThan(10)
    expect(second.scale).toBeGreaterThan(10)
  })

  it('uses a slower cyan pulse for delayed non-sounder outputs', () => {
    const first = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'delayActive',
      isSounder: false
    })
    const second = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 700,
      outputState: 'delayActive',
      isSounder: false
    })

    expect(first.color).toBe('#0ea5e9')
    expect(second.color).toBe('#0ea5e9')
    expect(first.opacity).not.toBe(second.opacity)
  })

  it('keeps continuous sounder outputs steady instead of flashing', () => {
    const first = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'active',
      isSounder: true,
      sounderPattern: 'continuous'
    })
    const second = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 180,
      outputState: 'active',
      isSounder: true,
      sounderPattern: 'continuous'
    })

    expect(first).toEqual(second)
    expect(first.color).toBe('#ef4444')
  })

  it('maps generated CPD delayed and non-delayed Zone sounder states into 3D visuals', () => {
    const delayed = adaptFixture('6002-global-sounder-delay.json')
    const delayedSounder = deviceByAddress(delayed, 94)
    const delayedOutput = getDeviceSimulationOutput(
      makeProject(delayed),
      trigger(delayed, 1),
      delayedSounder
    )
    const delayedFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: delayedOutput?.state ?? null,
      sounderPattern: delayedOutput?.sounderPattern,
      isSounder: delayedSounder.isSounder
    })

    const nonDelayed = adaptFixture('6002-zone-no-delayed-sounders.json')
    const activeSounder = deviceByAddress(nonDelayed, 94)
    const activeOutput = getDeviceSimulationOutput(
      makeProject(nonDelayed),
      trigger(nonDelayed, 1),
      activeSounder
    )
    const activeFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: activeOutput?.state ?? null,
      sounderPattern: activeOutput?.sounderPattern,
      isSounder: activeSounder.isSounder
    })

    expect(delayedOutput).toMatchObject({ state: 'delayActive' })
    expect(delayedOutput?.remainingDelaySeconds).toBeGreaterThan(0)
    expect(delayedFrame.color).toBe('#0ea5e9')
    expect(activeOutput).toMatchObject({ state: 'active', sounderPattern: 'continuous' })
    expect(activeFrame.color).toBe('#ef4444')
  })

  it('switches the delay-edge Zone 1 sounder from countdown state to active 3D alarm state', () => {
    const result = adaptFixture('6002-delay-edge-fields.json')
    const sounder = deviceByAddress(result, 94)
    const delayedOutputs = trigger(result, 4)
    const delayedOutput = getDeviceSimulationOutput(makeProject(result), delayedOutputs, sounder)
    const activeOutputs = tickDelayedOutputs(delayedOutputs, 60)
    const activeOutput = getDeviceSimulationOutput(makeProject(result), activeOutputs, sounder)
    const delayedFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: delayedOutput?.state ?? null,
      sounderPattern: delayedOutput?.sounderPattern,
      isSounder: sounder.isSounder
    })
    const activeFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: activeOutput?.state ?? null,
      sounderPattern: activeOutput?.sounderPattern,
      isSounder: sounder.isSounder
    })

    expect(delayedOutput).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 60
    })
    expect(delayedFrame.color).toBe('#0ea5e9')
    expect(activeOutput).toMatchObject({
      state: 'active',
      sounderPattern: 'continuous'
    })
    expect(activeFrame.color).toBe('#ef4444')
  })

  it('checks detector input active breathing scale and red color', () => {
    const framePeak = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 100 * Math.PI,
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: false
    })
    const frameTrough = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 300 * Math.PI,
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: false
    })

    expect(framePeak.color).toBeNull()
    expect(framePeak.scale).toBeCloseTo(12, 5)
    expect(framePeak.ringOpacity).toBeCloseTo(0.89, 5)

    expect(frameTrough.color).toBeNull()
    expect(frameTrough.scale).toBeCloseTo(10, 5)
    expect(frameTrough.ringOpacity).toBeCloseTo(0.55, 5)
  })

  it('checks IO module input active (red) and output active (blue) states', () => {
    const frameInputActive = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: true
    })
    const frameOutputActive = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'active',
      isSounder: false,
      inputActive: false,
      isIO: true
    })
    const frameInactive = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: null,
      isSounder: false,
      inputActive: false,
      isIO: true
    })

    expect(frameInputActive.color).toBe('#dc2626')
    expect(frameOutputActive.color).toBe('#2563eb')
    expect(frameInactive.color).toBeNull()

    expect(frameInputActive.scale).toBeCloseTo(11, 5)
    expect(frameInputActive.ringOpacity).toBeCloseTo(0.72, 5)

    const framePeak = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 100 * Math.PI,
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: true
    })
    expect(framePeak.scale).toBeCloseTo(12, 5)
    expect(framePeak.ringOpacity).toBeCloseTo(0.89, 5)
  })
})

