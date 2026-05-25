import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { adaptCpdExport, type CpdAdapterResult } from '../src/renderer/src/domain/fire/cpdAdapter'
import type { FireDevice } from '../src/renderer/src/domain/fire/types'
import { resolveCauseAndEffect } from '../src/renderer/src/domain/fire/simulation/causeEffect'
import type { OutputActivation } from '../src/renderer/src/domain/fire/simulation/types'

type RuntimeResult = {
  imported: true
  fixture: string
  recognized: {
    devices: number
    zones: number[]
    sounderGroups: number[]
    ioGroups: number[]
  }
  simulation: Record<string, 'passed'>
}

function loadFixture(fileName: string): unknown {
  return JSON.parse(readFileSync(resolve('fixtures/cpd/extracted', fileName), 'utf8'))
}

function adaptFixture(fileName: string): CpdAdapterResult {
  return adaptCpdExport(loadFixture(fileName), 1234)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function deviceByAddress(result: CpdAdapterResult, address: number): FireDevice {
  const device = result.devices.find((candidate) => candidate.address === address)
  assert(device, `address ${address} was not imported`)
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
  assert(output, `output ${outputId} was not produced`)
  return output
}

function sortedNumbers(values: number[]): number[] {
  return values.sort((left, right) => left - right)
}

const composite = adaptFixture('6002-realistic-building-composite.json')
const globalDelay = adaptFixture('6002-global-sounder-delay.json')
const delayEdge = adaptFixture('6002-delay-edge-fields.json')
const noDelayedSounders = adaptFixture('6002-zone-no-delayed-sounders.json')
const manualOverride = adaptFixture('6002-manual-callpoint-override-delay.json')
const ioStage = adaptFixture('6002-io-stage-linkage.json')

const compositePanel = composite.network.panels[0]
assert(compositePanel, 'composite fixture did not import a panel')

const globalPanelId = globalDelay.network.panels[0].id
assert(
  outputById(trigger(globalDelay, 1), `sounder-group:${globalPanelId}:1`).state === 'delayActive',
  'global detector did not enter delayed sounder state'
)
assert(
  outputById(trigger(globalDelay, 1), `sounder-group:${globalPanelId}:1`).remainingDelaySeconds ===
    60,
  'global detector delay was not 60 seconds'
)

const delayEdgePanelId = delayEdge.network.panels[0].id
const delayEdgeManualOutput = outputById(
  trigger(delayEdge, 4),
  `sounder-group:${delayEdgePanelId}:1`
)
assert(
  delayEdgeManualOutput.state === 'delayActive' &&
    delayEdgeManualOutput.remainingDelaySeconds === 60 &&
    delayEdgeManualOutput.reason === 'zone-delayed-sounders',
  'delay-edge Zone 1 manual call point did not keep the Zone sounder delay'
)

const noDelayedPanelId = noDelayedSounders.network.panels[0].id
const noDelayedOutput = outputById(
  trigger(noDelayedSounders, 1),
  `sounder-group:${noDelayedPanelId}:1`
)
assert(
  noDelayedOutput.state === 'active' &&
    noDelayedOutput.remainingDelaySeconds === 0 &&
    noDelayedOutput.reason === 'zone-non-delayed-sounders',
  'Zone without Delayed Sounders still entered delayed sounder state'
)

const manualPanelId = manualOverride.network.panels[0].id
assert(
  outputById(trigger(manualOverride, 4), `sounder-group:${manualPanelId}:1`).state === 'active',
  'manual call point did not bypass sounder delay'
)

const compositePanelId = compositePanel.id
assert(
  outputById(trigger(composite, 1, 2), `sounder-group:${compositePanelId}:10`).outputId.endsWith(
    ':10'
  ),
  'composite Zone 1 second stage did not route to evacuation group 10'
)
assert(
  trigger(composite, 21).systemState === 'normal',
  'disabled address 21 still created fire state'
)
assert(
  outputById(trigger(composite, 17), `fire-brigade:${compositePanelId}`).state === 'inhibited',
  'address 17 did not inhibit fire brigade relay output'
)

const ioPanelId = ioStage.network.panels[0].id
assert(
  outputById(trigger(ioStage, 1, 2), `io-group:${ioPanelId}:2`).outputId.endsWith(':2'),
  'Zone 1 second stage did not route to I/O Group 2'
)

const report: RuntimeResult = {
  imported: true,
  fixture: '6002-realistic-building-composite.cpd',
  recognized: {
    devices: composite.devices.length,
    zones: sortedNumbers(compositePanel.zones.map((zone) => zone.zoneNumber)).slice(0, 3),
    sounderGroups: sortedNumbers(compositePanel.sounderGroups.map((group) => group.groupId)),
    ioGroups: sortedNumbers(compositePanel.ioGroups.map((group) => group.groupId))
  },
  simulation: {
    detectorDelay: 'passed',
    delayEdgeZone1ManualCallPointDelay: 'passed',
    zoneNoDelayedSounders: 'passed',
    manualOverride: 'passed',
    zoneStage2: 'passed',
    ioStage: 'passed',
    disabledInput: 'passed',
    inhibitedRelay: 'passed'
  }
}

const reportPath = resolve('.codex-dev-run/cpd-fixture-runtime-report.json')
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
