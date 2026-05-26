import { describe, expect, it } from 'vitest'
import type { FireDevice, FireNetwork, FireProject } from '../types'
import {
  getDeviceSimulationOutput,
  getDeviceSimulationOutputState
} from '../simulationOutputMapping'
import type { OutputActivation } from '../simulation/types'

describe('simulation output mapping', () => {
  it('maps active sounder and I/O group outputs to devices by CPD member address', () => {
    const project = makeProject()
    const [, sounderMember, ioMember] = project.devices as FireDevice[]
    const outputs: OutputActivation[] = [
      {
        outputId: 'sounder-group:panel-1:7',
        state: 'active',
        causes: ['input-1'],
        remainingDelaySeconds: 0
      },
      {
        outputId: 'io-group:panel-1:9',
        state: 'delayActive',
        causes: ['input-1'],
        remainingDelaySeconds: 20
      }
    ]

    expect(getDeviceSimulationOutputState(project, outputs, sounderMember)).toBe('active')
    expect(getDeviceSimulationOutputState(project, outputs, ioMember)).toBe('delayActive')
  })

  it('keeps direct device and direct group field mappings working', () => {
    const project = makeProject()
    const [input, sounderMember, ioMember] = project.devices as FireDevice[]
    const directSounder = { ...sounderMember, id: 'sounder-direct', sounderGroupId: 7 }
    const directIo = { ...ioMember, id: 'io-direct', ioGroupId: 9 }
    const outputs: OutputActivation[] = [
      { outputId: 'device:input-1', state: 'active', causes: ['input-1'] },
      { outputId: 'sounder-group:panel-1:7', state: 'active', causes: ['input-1'] },
      { outputId: 'io-group:panel-1:9', state: 'active', causes: ['input-1'] }
    ]

    expect(getDeviceSimulationOutputState(project, outputs, input)).toBe('active')
    expect(getDeviceSimulationOutputState(project, outputs, directSounder)).toBe('active')
    expect(getDeviceSimulationOutputState(project, outputs, directIo)).toBe('active')
  })

  it('ignores inhibited or disabled group outputs for active visual state', () => {
    const project = makeProject()
    const [, sounderMember, ioMember] = project.devices as FireDevice[]
    const outputs: OutputActivation[] = [
      { outputId: 'sounder-group:panel-1:7', state: 'inhibited', causes: ['input-1'] },
      { outputId: 'io-group:panel-1:9', state: 'disabled', causes: ['input-1'] }
    ]

    expect(getDeviceSimulationOutputState(project, outputs, sounderMember)).toBeNull()
    expect(getDeviceSimulationOutputState(project, outputs, ioMember)).toBeNull()
  })

  it('does not mark disabled member devices active when their group output is active', () => {
    const project = makeProject()
    const [, sounderMember, ioMember] = project.devices as FireDevice[]
    const outputs: OutputActivation[] = [
      { outputId: 'sounder-group:panel-1:7', state: 'active', causes: ['input-1'] },
      { outputId: 'io-group:panel-1:9', state: 'active', causes: ['input-1'] }
    ]

    expect(
      getDeviceSimulationOutputState(project, outputs, { ...sounderMember, disabled: true })
    ).toBeNull()
    expect(
      getDeviceSimulationOutputState(project, outputs, { ...ioMember, disabled: true })
    ).toBeNull()
  })

  it('allows disabled sounders to render active when evacuation directly operates them', () => {
    const project = makeProject()
    const [, sounderMember] = project.devices as FireDevice[]
    const disabledSounder = { ...sounderMember, disabled: true }
    const outputs: OutputActivation[] = [
      {
        outputId: `device:${disabledSounder.id}`,
        state: 'active',
        causes: ['manual-evacuate'],
        reason: 'evacuate'
      }
    ]

    expect(getDeviceSimulationOutputState(project, outputs, disabledSounder)).toBe('active')
  })

  it('uses sounder group member status to determine addressable sounder output pattern', () => {
    const project = makeProject()
    const [, sounderMember] = project.devices as FireDevice[]
    const outputs: OutputActivation[] = [
      { outputId: 'sounder-group:panel-1:7', state: 'active', causes: ['input-1'] }
    ]

    expect(getDeviceSimulationOutput(project, outputs, sounderMember)).toEqual({
      state: 'active',
      sounderPattern: 'continuous'
    })
  })

  it('keeps silent sounder group members visually and audibly inactive', () => {
    const project = makeProject()
    project.networks[0].panels[0].sounderGroups[0].addressableMembers[0].status = 'Silent'
    const [, sounderMember] = project.devices as FireDevice[]
    const outputs: OutputActivation[] = [
      { outputId: 'sounder-group:panel-1:7', state: 'active', causes: ['input-1'] }
    ]

    expect(getDeviceSimulationOutput(project, outputs, sounderMember)).toBeNull()
    expect(getDeviceSimulationOutputState(project, outputs, sounderMember)).toBeNull()
  })
})

function makeProject(): FireProject & { devices: FireDevice[] } {
  const network: FireNetwork = {
    id: 'network-1',
    name: 'Network 1',
    sourceFileName: 'test.cpd',
    sourceImportedAt: 1,
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
          evacuateDelaySeconds: 0,
          sounderDelaySeconds: 0,
          inputOutputDelaySeconds: 0,
          fireBrigadeDelaySeconds: 0,
          onManualCallPoints: false,
          onTwoDevices: false,
          delayOffAtNight: false,
          raw: {}
        },
        loops: [],
        zones: [],
        sounderGroups: [
          {
            id: 'sounder-group-7',
            networkId: 'network-1',
            panelId: 'panel-1',
            groupId: 7,
            addressableMembers: [{ loopId: 1, physicalAddress: 94, status: 'Continuous', raw: {} }],
            nonAddressableMembers: [],
            raw: {}
          }
        ],
        ioGroups: [
          {
            id: 'io-group-9',
            networkId: 'network-1',
            panelId: 'panel-1',
            groupId: 9,
            members: [{ loopId: 1, physicalAddress: 20, raw: {} }],
            raw: {}
          }
        ],
        sounders: { raw: {} }
      }
    ]
  }

  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Project',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [network],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      floorSpacing3D: 36,
      mapOpacity: 1,
      labelColor: '#111827',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: {
      timeScale: 1,
      soundEnabled: true
    },
    devices: [
      makeDevice('input-1', 1, 'manual_call_point', false, false),
      makeDevice('sounder-94', 94, 'sounder', true, false),
      makeDevice('io-20', 20, 'input_output', false, true)
    ]
  }
}

function makeDevice(
  id: string,
  address: number,
  type: string,
  isSounder: boolean,
  isOutputCapable: boolean
): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address,
    type,
    friendlyTypeName: type,
    isInputCapable: !isSounder,
    isOutputCapable: isOutputCapable || isSounder,
    isSounder,
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
    raw: {}
  }
}
