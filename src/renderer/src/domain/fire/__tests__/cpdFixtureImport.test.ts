import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adaptCpdExport, type CpdAdapterResult } from '../cpdAdapter'
import type { FireDevice, FirePanel } from '../types'

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

function firstPanel(result: CpdAdapterResult): FirePanel {
  const panel = result.network.panels[0]
  if (!panel) {
    throw new Error('fixture did not import a panel')
  }

  return panel
}

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  if (!device) {
    throw new Error(`fixture did not import address ${address}`)
  }

  return device
}

describe('generated CPD fixtures import through the simulator adapter', () => {
  it('recognizes the composite 6002 fixture devices, groups, and key device flags', () => {
    const result = adaptFixture('6002-realistic-building-composite.json')
    const panel = firstPanel(result)

    expect(result.devices).toHaveLength(20)
    expect(panel.zones.map((zone) => zone.zoneNumber).slice(0, 3)).toEqual([1, 2, 3])
    expect(panel.sounderGroups.map((group) => group.groupId)).toEqual([1, 2, 3, 10])
    expect(panel.ioGroups.map((group) => group.groupId)).toEqual([1, 2, 3])

    expect(deviceByAddress(result, 4).overrideDelays).toBe(true)
    expect(deviceByAddress(result, 14).overrideDelays).toBe(true)
    expect(deviceByAddress(result, 24).overrideDelays).toBe(true)
    expect(deviceByAddress(result, 21).disabled).toBe(true)
    expect(deviceByAddress(result, 17).inhibitRelays).toBe(true)
  })

  it('recognizes global delay and infers double-stage zones from configured stage 2 outputs', () => {
    const result = adaptFixture('6002-global-sounder-delay.json')
    const panel = firstPanel(result)
    const zone1 = panel.zones.find((zone) => zone.zoneNumber === 1)

    expect(panel.general.sounderDelaySeconds).toBe(60)
    expect(zone1).toMatchObject({
      delayedSounders: true,
      sounderGroupAlarm1: 1,
      sounderGroupAlarm2: 10,
      alarmMode: 'double'
    })
  })

  it('imports delayed and non-delayed Zone sounder fixtures distinctly', () => {
    const delayed = firstPanel(adaptFixture('6002-delay-edge-fields.json'))
    const nonDelayed = firstPanel(adaptFixture('6002-zone-no-delayed-sounders.json'))

    expect(delayed.general.sounderDelaySeconds).toBe(60)
    expect(delayed.zones.slice(0, 3).map((zone) => zone.delayedSounders)).toEqual([
      true,
      true,
      true
    ])

    expect(nonDelayed.general.sounderDelaySeconds).toBe(60)
    expect(nonDelayed.zones.slice(0, 3).map((zone) => zone.delayedSounders)).toEqual([
      false,
      false,
      false
    ])
  })

  it('recognizes staged I/O linkage from generated CPD relation fields', () => {
    const result = adaptFixture('6002-io-stage-linkage.json')
    const panel = firstPanel(result)
    const zone1 = panel.zones.find((zone) => zone.zoneNumber === 1)

    expect(zone1).toMatchObject({
      ioGroup1Alarm1: 1,
      ioGroup1Alarm2: 2,
      alarmMode: 'double'
    })
    expect(panel.ioGroups.find((group) => group.groupId === 1)?.members).toEqual([
      expect.objectContaining({ loopId: 1, physicalAddress: 7 })
    ])
    expect(panel.ioGroups.find((group) => group.groupId === 2)?.members).toEqual([
      expect.objectContaining({ loopId: 1, physicalAddress: 8 })
    ])
  })
})
