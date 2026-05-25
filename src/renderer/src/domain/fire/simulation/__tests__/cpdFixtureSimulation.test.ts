import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adaptCpdExport, type CpdAdapterResult } from '../../cpdAdapter'
import type { FireDevice } from '../../types'
import { resolveCauseAndEffect } from '../causeEffect'
import type { OutputActivation } from '../types'

function loadExtractedFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../../../../fixtures/cpd/extracted/${fileName}`, import.meta.url),
      'utf8'
    )
  )
}

function adaptFixture(fileName: string): CpdAdapterResult {
  return adaptCpdExport(loadExtractedFixture(fileName), 1234)
}

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`fixture did not import address ${address}`)
  }

  return device
}

function trigger(
  result: CpdAdapterResult,
  ...addresses: number[]
): OutputActivation[] & {
  systemState: string
  soundState: string
} {
  return resolveCauseAndEffect({
    network: result.network,
    devices: result.devices,
    nonAddressablePoints: [],
    activeInputAlarms: addresses.map((address, index) => ({
      deviceId: deviceByAddress(result, address).id,
      activatedAt: index
    }))
  })
}

function outputById(outputs: OutputActivation[], outputId: string): OutputActivation {
  const output = outputs.find((candidate) => candidate.outputId === outputId)
  if (!output) {
    throw new Error(`output not found: ${outputId}`)
  }

  return output
}

describe('generated CPD fixtures drive simulator cause and effect', () => {
  it('applies CPD Zone delayed sounders to ordinary detector activation', () => {
    const result = adaptFixture('6002-global-sounder-delay.json')
    const panelId = result.network.panels[0].id
    const outputs = trigger(result, 1)

    expect(outputById(outputs, `sounder-group:${panelId}:1`)).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 60,
      reason: 'zone-delayed-sounders'
    })
    expect(outputs.systemState).toBe('fireAlarm')
  })

  it('keeps Zone 1 manual call point delayed in the delay edge fixture', () => {
    const result = adaptFixture('6002-delay-edge-fields.json')
    const panelId = result.network.panels[0].id
    const outputs = trigger(result, 4)

    expect(outputById(outputs, `sounder-group:${panelId}:1`)).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 60,
      reason: 'zone-delayed-sounders'
    })
  })

  it('keeps the delay edge fixture free of immediate Zone 1 outputs', () => {
    const result = adaptFixture('6002-delay-edge-fields.json')
    const panelId = result.network.panels[0].id

    for (const address of [1, 2, 3, 4, 7, 8]) {
      const outputs = trigger(result, address)

      expect(
        outputs.filter((output) => output.state === 'active'),
        `address ${address} should not immediately activate outputs`
      ).toEqual([])
      expect(outputById(outputs, `sounder-group:${panelId}:1`)).toMatchObject({
        state: 'delayActive',
        remainingDelaySeconds: 60,
        reason: 'zone-delayed-sounders'
      })
      expect(outputById(outputs, `io-group:${panelId}:1`)).toMatchObject({
        state: 'delayActive',
        remainingDelaySeconds: 45,
        reason: 'io'
      })
      expect(outputById(outputs, `fire-brigade:${panelId}`)).toMatchObject({
        state: 'delayActive',
        remainingDelaySeconds: 30,
        reason: 'fire-brigade'
      })
    }
  })

  it('bypasses global sounder delay when the Zone does not enable Delayed Sounders', () => {
    const result = adaptFixture('6002-zone-no-delayed-sounders.json')
    const panelId = result.network.panels[0].id
    const outputs = trigger(result, 1)

    expect(outputById(outputs, `sounder-group:${panelId}:1`)).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0,
      reason: 'zone-non-delayed-sounders'
    })
    expect(outputs.systemState).toBe('fireAlarm')
  })

  it('lets manual call points override the global sounder delay', () => {
    const result = adaptFixture('6002-manual-callpoint-override-delay.json')
    const panelId = result.network.panels[0].id
    const outputs = trigger(result, 4)

    expect(outputById(outputs, `sounder-group:${panelId}:1`)).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0,
      reason: 'device-override-delay'
    })
  })

  it('routes Zone 1 first-stage and second-stage I/O outputs', () => {
    const result = adaptFixture('6002-io-stage-linkage.json')
    const panelId = result.network.panels[0].id

    expect(outputById(trigger(result, 1), `io-group:${panelId}:1`)).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 30,
      reason: 'io'
    })

    expect(outputById(trigger(result, 1, 2), `io-group:${panelId}:2`)).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 30,
      reason: 'io'
    })
  })

  it('ignores disabled input devices as active fire sources', () => {
    const result = adaptFixture('6002-disabled-and-inhibited.json')
    const outputs = trigger(result, 21)

    expect(outputs).toHaveLength(0)
    expect(outputs.systemState).toBe('normal')
    expect(outputs.soundState).toBe('silent')
  })

  it('marks fire brigade relay output inhibited when the source device inhibits relays', () => {
    const result = adaptFixture('6002-disabled-and-inhibited.json')
    const panelId = result.network.panels[0].id
    const outputs = trigger(result, 17)

    expect(outputById(outputs, `fire-brigade:${panelId}`)).toMatchObject({
      state: 'inhibited',
      remainingDelaySeconds: 0,
      reason: 'inhibit-relays'
    })
  })
})
