import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { adaptCpdExport, type CpdAdapterResult } from '../src/renderer/src/domain/fire/cpdAdapter'
import { buildCpdInspectorModel } from '../src/renderer/src/domain/fire/cpdInspectorModel'
import type { FireDevice } from '../src/renderer/src/domain/fire/types'
import { resolveCauseAndEffect } from '../src/renderer/src/domain/fire/simulation/causeEffect'
import {
  createInitialSimulationState,
  reduceSimulation,
  type SimulationEngineInput
} from '../src/renderer/src/domain/fire/simulation/engine'
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
  preview: Record<string, 'passed'>
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

function engineInput(result: CpdAdapterResult, sounderDelaysEnabled = true): SimulationEngineInput {
  return {
    network: result.network,
    devices: result.devices,
    nonAddressablePoints: [],
    now: 0,
    sounderDelaysEnabled
  }
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
const delayEdgePanel = delayEdge.network.panels[0]
const delayEdgePreview = buildCpdInspectorModel(delayEdgePanel, delayEdge.devices)
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
for (const address of [1, 2, 3, 4, 7, 8]) {
  const outputs = trigger(delayEdge, address)
  assert(
    outputs.every((output) => output.state !== 'active'),
    `delay-edge address ${address} produced an immediate active output`
  )
  assert(
    outputById(outputs, `io-group:${delayEdgePanelId}:1`).state === 'delayActive',
    `delay-edge address ${address} did not keep the I/O delay`
  )
  assert(
    outputById(outputs, `fire-brigade:${delayEdgePanelId}`).state === 'delayActive',
    `delay-edge address ${address} did not keep the fire brigade delay`
  )
}
const zone1 = delayEdgePreview.zones.find((zone) => zone.zoneNumber === 1)
assert(zone1, 'delay-edge preview did not include Zone 1')
assert(
  zone1.devicesCount ===
    delayEdge.devices.filter(
      (device) =>
        device.panelId === delayEdgePanelId &&
        device.zoneNumber === 1 &&
        device.isInputCapable &&
        !device.isSounder
    ).length,
  'Project Preview Zone 1 did not use input-only Zone membership'
)
assert(
  delayEdgePreview.devices
    .filter((device) => device.groupIds.some((groupId) => groupId.startsWith('sg')))
    .every((device) => device.rawDevice.isSounder),
  'Project Preview Sounder Group membership included a non-sounder device'
)
assert(
  delayEdgePreview.devices
    .filter((device) => device.groupIds.some((groupId) => groupId.startsWith('io')))
    .every((device) =>
      ['input_output', 'wireless_input_output'].includes(device.rawDevice.type.toLowerCase())
    ),
  'Project Preview I/O Group membership included a non-I/O device'
)
const ioModule7 = delayEdgePreview.devices.find((device) => device.address === 7)
assert(
  ioModule7?.rawDevice.zoneNumber === 1 && ioModule7.groupIds.includes('io1'),
  'Project Preview did not keep I/O module address 7 as both Zone input and I/O Group member'
)
const manual4 = delayEdgePreview.devices.find(
  (device) => device.loopId === 1 && device.address === 4
)
assert(
  manual4 && !manual4.specialBadges.includes('setEvacuateTimer'),
  'Project Preview showed Set Evacuate Timer for L1-004 despite CPD false'
)
const syntheticDirectInput: FireDevice = {
  ...deviceByAddress(delayEdge, 4),
  id: 'synthetic-direct-l1-004',
  sounderGroupId: 3,
  ioGroupId: 2,
  raw: {
    ...deviceByAddress(delayEdge, 4).raw,
    SounderGroup: 3,
    IOGroup: 2
  }
}
const syntheticPreview = buildCpdInspectorModel(delayEdgePanel, [
  ...delayEdge.devices,
  syntheticDirectInput
])
const syntheticDirectPreviewDevice = syntheticPreview.directDevices.find(
  (device) => device.id === syntheticDirectInput.id
)
assert(
  syntheticDirectPreviewDevice?.directGroupIds.includes('sg3') &&
    syntheticDirectPreviewDevice.directGroupIds.includes('io2') &&
    syntheticDirectPreviewDevice.groupIds.length === 0,
  'Project Preview did not separate direct initiating-device assignments from group membership'
)
const syntheticDirectOutputs = resolveCauseAndEffect({
  network: delayEdge.network,
  devices: [...delayEdge.devices, syntheticDirectInput],
  nonAddressablePoints: [],
  activeInputAlarms: [{ deviceId: syntheticDirectInput.id, activatedAt: 0 }],
  sounderDelaysEnabled: true
})
assert(
  outputById(syntheticDirectOutputs, `sounder-group:${delayEdgePanelId}:3`).state ===
    'delayActive' &&
    outputById(syntheticDirectOutputs, `io-group:${delayEdgePanelId}:2`).state === 'delayActive',
  'Direct initiating-device Sounder Group / I/O Group assignment did not drive outputs'
)

const activated = reduceSimulation(createInitialSimulationState(), engineInput(delayEdge), {
  type: 'activate-input',
  deviceId: deviceByAddress(delayEdge, 4).id,
  at: 10
})
const expired = reduceSimulation(activated, engineInput(delayEdge), {
  type: 'tick',
  at: 70,
  elapsedSeconds: 60
})
const reset = reduceSimulation(expired, engineInput(delayEdge), {
  type: 'system-reset',
  at: 80
})
assert(
  expired.eventLog.some(
    (event) =>
      event.type === 'delay-expired' &&
      event.relatedOutputId === `sounder-group:${delayEdgePanelId}:1` &&
      event.condition?.includes('fireAlarm')
  ),
  '3D simulation event log did not record delayed output expiry'
)
assert(
  reset.eventLog.some(
    (event) =>
      event.type === 'system-reset' &&
      event.condition === 'normal / silent / inputs 0 / faults 0 / outputs 0'
  ),
  '3D simulation event log did not record reset condition summary'
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
  preview: {
    zoneInputOnly: 'passed',
    sounderGroupSoundersOnly: 'passed',
    ioGroupIOModulesOnly: 'passed',
    ioModuleDualZoneAndGroupSemantics: 'passed',
    directDeviceAssignmentsSeparate: 'passed',
    l1004CpdSetEvacuateTimerFalse: 'passed'
  },
  simulation: {
    detectorDelay: 'passed',
    delayEdgeZone1ManualCallPointDelay: 'passed',
    delayEdgeNoImmediateZone1Outputs: 'passed',
    zoneNoDelayedSounders: 'passed',
    manualOverride: 'passed',
    zoneStage2: 'passed',
    ioStage: 'passed',
    disabledInput: 'passed',
    inhibitedRelay: 'passed',
    directDeviceAssignments: 'passed',
    eventLogDelayExpiry: 'passed',
    eventLogResetSummary: 'passed'
  }
}

const reportPath = resolve('.codex-dev-run/cpd-fixture-runtime-report.json')
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
