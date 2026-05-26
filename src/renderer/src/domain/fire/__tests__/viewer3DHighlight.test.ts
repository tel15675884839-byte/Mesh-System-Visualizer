import { describe, expect, it } from 'vitest'
import type { FireDevice, FireNetwork, FireProject } from '../types'
import {
  getViewer3DDeviceHighlightAppearance,
  getViewer3DHighlightOptions,
  isDeviceHighlighted
} from '../viewer3DHighlight'

describe('viewer 3D highlight', () => {
  it('builds highlight targets for loops, zones, and groups', () => {
    const project = makeProject()

    expect(getViewer3DHighlightOptions(project, 'loop')).toEqual([
      { id: 'loop-1', label: 'Panel 1 / Loop 1' }
    ])
    expect(getViewer3DHighlightOptions(project, 'zone')).toEqual([
      { id: 'zone-1', label: 'Panel 1 / Zone 1 - Office' }
    ])
    expect(getViewer3DHighlightOptions(project, 'sounderGroup')).toEqual([
      { id: 'sounder-3', label: 'Panel 1 / Sounders 3' }
    ])
    expect(getViewer3DHighlightOptions(project, 'ioGroup')).toEqual([
      { id: 'io-4', label: 'Panel 1 / I/O Group 4' }
    ])
    expect(getViewer3DHighlightOptions(project, 'type')).toEqual([
      { id: 'input_output', label: 'I/O Module' },
      { id: 'manual_call_point', label: 'Manual Call Point' },
      { id: 'optical_det', label: 'Optical Detector' },
      { id: 'sounder', label: 'Sounder' }
    ])
  })

  it('matches group highlights by true members, not direct initiating-device assignments', () => {
    const project = makeProject()
    const [deviceOne, deviceTwo, memberSounder, directIo] = project.devices as FireDevice[]

    expect(isDeviceHighlighted(project, { kind: 'loop', targetId: 'loop-1' }, deviceOne)).toBe(true)
    expect(isDeviceHighlighted(project, { kind: 'zone', targetId: 'zone-1' }, deviceOne)).toBe(true)
    expect(
      isDeviceHighlighted(project, { kind: 'sounderGroup', targetId: 'sounder-3' }, deviceOne)
    ).toBe(false)
    expect(isDeviceHighlighted(project, { kind: 'ioGroup', targetId: 'io-4' }, deviceTwo)).toBe(
      false
    )
    expect(
      isDeviceHighlighted(project, { kind: 'sounderGroup', targetId: 'sounder-3' }, memberSounder)
    ).toBe(true)
    expect(isDeviceHighlighted(project, { kind: 'ioGroup', targetId: 'io-4' }, directIo)).toBe(true)
    expect(isDeviceHighlighted(project, { kind: 'type', targetId: 'sounder' }, memberSounder)).toBe(
      true
    )
    expect(isDeviceHighlighted(project, { kind: 'zone', targetId: 'zone-1' }, deviceTwo)).toBe(
      false
    )
  })

  it('returns a visible 3D appearance for highlighted and dimmed devices', () => {
    const project = makeProject()
    const [deviceOne, deviceTwo, memberSounder] = project.devices as FireDevice[]
    const selection = { kind: 'sounderGroup' as const, targetId: 'sounder-3' }

    expect(getViewer3DDeviceHighlightAppearance(project, selection, deviceOne)).toMatchObject({
      highlighted: false,
      faded: true,
      opacity: 0.18
    })
    expect(getViewer3DDeviceHighlightAppearance(project, selection, memberSounder)).toMatchObject({
      highlighted: true,
      faded: false
    })
    expect(getViewer3DDeviceHighlightAppearance(project, selection, deviceTwo)).toMatchObject({
      highlighted: false,
      faded: true,
      opacity: 0.18
    })
    expect(
      getViewer3DDeviceHighlightAppearance(project, { kind: 'none', targetId: null }, deviceTwo)
    ).toMatchObject({
      highlighted: false,
      faded: false,
      opacity: 1
    })
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
        loops: [
          {
            id: 'loop-1',
            networkId: 'network-1',
            panelId: 'panel-1',
            loopId: 1,
            name: 'Loop 1',
            configuredDeviceOrder: ['device-1', 'device-2'],
            manualDeviceOrder: [],
            color: '#2563eb'
          }
        ],
        zones: [
          {
            id: 'zone-1',
            networkId: 'network-1',
            panelId: 'panel-1',
            zoneNumber: 1,
            text: 'Office',
            enabled: true,
            delayedSounders: false,
            alarmMode: 'single',
            visualAreas: [],
            raw: {}
          }
        ],
        sounderGroups: [
          {
            id: 'sounder-3',
            networkId: 'network-1',
            panelId: 'panel-1',
            groupId: 3,
            title: 'Sounders 3',
            addressableMembers: [{ loopId: 1, physicalAddress: 3, raw: {} }],
            nonAddressableMembers: [],
            raw: {}
          }
        ],
        ioGroups: [
          {
            id: 'io-4',
            networkId: 'network-1',
            panelId: 'panel-1',
            groupId: 4,
            members: [{ loopId: 1, physicalAddress: 4, raw: {} }],
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
      makeDevice('device-1', 1, 1, 3, undefined, 'manual_call_point', 'Manual Call Point'),
      makeDevice('device-2', 2, 2),
      makeDevice('device-3', 3, 3, undefined, undefined, 'sounder', 'Sounder'),
      makeDevice('device-4', 4, 4, undefined, 4, 'input_output', 'I/O Module')
    ]
  }
}

function makeDevice(
  id: string,
  address: number,
  zoneNumber: number,
  sounderGroupId?: number,
  ioGroupId?: number,
  type = 'optical_det',
  friendlyTypeName = 'Optical Detector'
): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address,
    zoneNumber,
    sounderGroupId,
    ioGroupId,
    type,
    friendlyTypeName,
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
    raw: {}
  }
}
