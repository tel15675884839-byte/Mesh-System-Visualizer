export const fixture = {
  schemaVersion: 1,
  extractor: { name: 'CpdExtractor', version: '1.0.0' },
  source: { fileName: 'sample.cpd', exportedAt: '2026-05-22T00:00:00.000Z' },
  panelCount: 1,
  panels: [
    {
      panelNumber: 1,
      panelModel: 'ControlPanel6002_N',
      general: {
        PanelNumber: 1,
        SounderMode: 'Programmed',
        FaultIOGroup: 5,
        SounderDelayMM: 1,
        SounderDelaySS: 30,
        InputOutputDelayMM: 0,
        InputOutputDelaySS: 15,
        FireBrigadeDelayMM: 2,
        FireBrigadeDelaySS: 0,
        EvacuteDelayMM: 0,
        EvacuteDelaySS: 20,
        OnManualCallPoints: true,
        OnTwoDevices: true
      }
    }
  ],
  devices: [
    {
      panelNumber: 1,
      panelId: 'panel-1',
      loopId: 1,
      address: 10,
      type: 'manual_call_point',
      classify: 'Manual Call Point',
      description: 'MCP',
      location: 'Lobby',
      zone: 3,
      sounderGroup: 7,
      ioGroup: 9,
      disabled: false,
      inhibitSounders: false,
      inhibitIO: false,
      overrideDelays: false,
      immediateEvacuate: true,
      raw: { PhysicalAddress: 10 }
    },
    {
      panelNumber: 1,
      panelId: 'panel-1',
      loopId: 1,
      address: 11,
      type: 'input_output',
      classify: 'I/O',
      description: 'I/O',
      location: 'Lobby',
      zone: 3,
      sounderGroup: 7,
      ioGroup: 9,
      disabled: false,
      inhibitSounders: false,
      inhibitIO: false,
      overrideDelays: false,
      immediateEvacuate: false,
      raw: { PhysicalAddress: 11 }
    }
  ],
  zones: [
    {
      panelNumber: 1,
      zoneNumber: 3,
      text: 'Lobby',
      enabled: true,
      delayedSounders: true,
      alarmMode: 'double',
      sounderGroupAlarm1: 7,
      sounderGroupAlarm2: 8,
      ioGroup1Alarm1: 9,
      ioGroup1Alarm2: 10,
      raw: {}
    }
  ],
  sounderGroups: [
    {
      panelNumber: 1,
      groupId: 7,
      title: 'SG7',
      description: 'Main sounders',
      members: [{ loopId: 1, physicalAddress: 11, status: 'enabled', raw: {} }],
      raw: {}
    }
  ],
  ioGroups: [
    {
      panelNumber: 1,
      groupId: 9,
      members: [{ entry: 1, loopId: 1, physicalAddress: 10, description: 'I/O', raw: {} }],
      raw: {}
    }
  ]
}
