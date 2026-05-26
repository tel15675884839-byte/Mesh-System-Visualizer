# CPD Fixture Field Map

- Template: Configurator `templet project/6002.cpd`
- Serializer: `Common.SerializerHelper.ReadFromFileCompression` / `SaveToFileCompression`
- Device fields: `DeviceLocationText`, `Zone`, `SounderGroup`, `OverrideDelays`, `DeviceDisabled`, `InhibitRelays`, optional `IOOverrideDelay`, `InhibitIO`, `InhibitSounders`
- General fields: `SounderDelayMM`, `SounderDelaySS`, `InputOutputDelayMM`, `InputOutputDelaySS`, `FireBrigadeDelayMM`, `FireBrigadeDelaySS`, `EvacuteDelayMM`, `EvacuteDelaySS`
- Zone fields: `ZoneNumber`, `ZoneTexts`, `ZoneEnabled`, `DelayedSounders`, `SounderGroupAlarm1`, `SounderGroupAlarm2`, `IOGroup1Alarm1`, `IOGroup1Alarm2`, `IOGroup2Alarm1`, `IOGroup3Alarm1`, `IOGroup4Alarm1`
- Sounder group detail fields: `SounderGroupID`, `LoopID`, `PhysicalAddress`, `SounderStatus`
- I/O group fields: `IOGroup`, `Entry`, `Loop`, `Device`, `Text`
- Simulator delay rule: `DelayedSounders=false` bypasses global sounder delay, so delay fixtures must set `DelayedSounders=true`.
