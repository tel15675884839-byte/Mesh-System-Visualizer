# Numens Fire Alarm Simulator Design

## 1. Purpose

`Numens Fire Alarm Simulator` is a desktop planning and simulation tool for fire alarm architecture. It lets users import a real `.cpd` configuration, inspect the configured fire alarm control network, place devices on real drawings, draw physical loop wiring, define visual zone areas, review cause-and-effect logic, and simulate fire, evacuate, fault, sounder, I/O, and fire brigade behavior in 2D and 3D.

The current project already contains an Electron, Vue, TypeScript, Element Plus, and Three.js application with 2D drawing placement and 3D building visualization. The new product keeps that technical foundation but replaces the wireless Mesh business model with a CPD-driven wired fire alarm model.

## 2. Confirmed Direction

The implementation will use the existing project folder:

`D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator`

The project will be transformed in place. It will not create another copy of the repository.

The selected architecture is:

- Keep the Electron + Vue + TypeScript + Element Plus + Three.js stack.
- Keep useful existing capabilities: building and floor configuration, 2D drawing background, device drag placement, 3D stacked floor view, saved view state, and project persistence patterns.
- Remove the product meaning of wireless Mesh, RSSI, Leader, Router, parent-child links, and imported HTML topology.
- Keep wireless CPD device types as normal CPD device types for display and placement only. The application will not implement wireless topology, wireless signal, or wireless network features.
- Use `.cpd` import as one input format and `.fireproj` as the full project format.

## 3. Product Scope

### 3.1 In Scope For The First Full Implementation

- Import `.cpd` through the provided `CpdExtractorPortable`.
- Parse and normalize multi-panel CPD data into a Network > Panel model.
- Show Device Tree as:

```text
Network
  Panel
    Grouping: Loop / Zone / Type / Sounder Group / I/O Group
      Device
```

- Default Device Tree grouping: `Loop`.
- Device Tree status filters: `All`, `Unplaced`, `Placed`, `Issues`.
- Search by: `id`, `projectName`, `network`, `panelName`, `type`, `zone`, `group`, `location`, `loop`, `address`.
- Preserve CPD device type names and use the agreed icon mapping.
- Upload building drawings as image files or PDF pages.
- Place devices on 2D drawings one by one or by batch grid placement.
- Draw Zone visual areas, default rectangle tool, optional polygon tool.
- Draw Loop wiring:
  - default line order follows CPD/user configuration order,
  - manual line order mode lets users select a Loop and click devices in real installation order.
- Show Loop wiring in 2D and 3D:
  - 2D shows only current-floor segments,
  - 3D connects placed devices in sequence, including vertical or cross-floor segments.
- Highlight Zone, Loop, Sounder Group, and I/O Group.
- Simulate Fire Alarm, Evacuate, Fault, Fire Brigade, Sounder, and I/O behavior according to CPD configuration.
- Support `Programmed` and `Preset` Sounder Mode.
- Support realistic `BUZZER SILENCE`, `SYSTEM RESET`, and manual `EVACUATE`.
- Support multiple active input alarms and multiple active faults.
- Export and import `.fireproj` as a complete project package.
- Support Chinese and English UI via i18n.
- Support Undo/Redo for layout and drawing operations.

### 3.2 Out Of Scope For The First Full Implementation

- Direct CAD/DWG/DXF drawing import.
- Real panel connection.
- Live device communication.
- Wireless topology or wireless signal simulation.
- Fire/smoke particle animation. The default alarm animation is engineering-style highlighting and flashing.
- Saving original `.cpd` files inside `.fireproj`.

## 4. CPD Import Boundary

The CPD parser is provided at:

`D:\Users\30741\Desktop\程序开发\报警模拟器\CpdExtractorPortable`

The application must call it from Electron main process, not browser code:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File CpdExtractor.ps1 -InputCpd input.cpd -OutputJson output.json
```

or:

```bat
CpdExtractor.cmd input.cpd output.json
```

Reason: `.cpd` is GZip-compressed .NET BinaryFormatter data referencing legacy DLL types. Browser code must not deserialize it directly.

The extractor output is the external import contract. The application adapter converts extractor JSON into the internal project model.

### 4.1 Extracted CPD Information Used By The App

Panel model:

- Control panel type, such as `ControlPanel6002_N`, `ControlPanel6004_N`, `ControlPanel6008_N`.
- Multiple `ControlPanel` instances in one `.cpd`.

General configuration from `general.GData`:

- `PanelNumber`
- `SounderMode`
- `FaultIOGroup`
- `EvacuteDelayMM`
- `EvacuteDelaySS`
- `EvacuteMode`
- `SounderDelayMM`
- `SounderDelaySS`
- `SounderActiveOn`
- `SounderMode1`
- `InputOutputDelayMM`
- `InputOutputDelaySS`
- `FireBrigadeDelayMM`
- `FireBrigadeDelaySS`
- `FireBrigadeActiveOn`
- `FireBrigadeMode`
- `OnManualCallPoints`
- `OnTwoDevices`
- `DelayOffAtNight`
- `MonFri`
- `Saturday`
- `Sunday`
- `StartTimeDayHH`
- `StartTimeDayMM`
- `StartTimeDayTimedSensitivity`
- `StartTimeNightHH`
- `StartTimeNightMM`
- `StartTimeNightTimedSensitivity`

Zone and cause-and-effect from `zone.GData`:

- `ZoneNumber`
- `ZoneTexts`
- `DelayedSounders`
- `ZoneEnabled`
- `SounderGroupAlarm1`
- `SounderGroupAlarm2`
- `IOGroup1Alarm1`
- `IOGroup1Alarm2`
- `IOGroup2Alarm1`
- `IOGroup3Alarm1`
- `IOGroup4Alarm1`

Sounder Group:

- `sounderGroups.GData`
- `sounderGroups.GDataDetail`
- `sounderGroups.GDataDetailEx`

I/O Group:

- `ioGroup.GData`

Loop and device data:

- `controlPanel.loopList`
- `loopId`
- serialized device objects:
  - `BLL.Detector`
  - `BLL.CallPoint`
  - `BLL.Module`
- device object IDs:
  - `detectorID`
  - `callPointID`
  - `moduleID`
- `physicalAddress`
- `deviceType`
- model fields:
  - `detectorModel`
  - `callPointModel`
  - `moduleModel`
- device `GData` fields:
  - `ID`
  - `PhysicalAddress`
  - `DeviceClassify`
  - `DeviceType`
  - `Description`
  - `DeviceLocationText`
  - `Zone`
  - `SounderGroup`
  - `IOGroup`
  - `InhibitSounders`
  - `InhibitIO`
  - `InhibitRelays`
  - `EvacuateIO`
  - `IOOverrideDelay`
  - `ImmediateEvacuate`
  - `SetEvacuateTimer`
  - `OverrideDelays`
  - `SelectedDisablement`
  - `DeviceDisabled`
  - `ReportingDetail`
  - `SmokeSensitivity`
  - `HeatGrade`
  - `SounderGroupValue`
  - `ImageIndex`

Sounder tables:

- `sounders.GData1`: non-addressable CIE sounder delay override and disabled state.
- `sounders.GData2`: address 94-125 delay overrides.
- `sounders.GData3`: address 94-125 disabled state.

### 4.2 Import Rules

`.cpd` import creates or updates the CPD configuration layer only. It does not contain drawing placement, building layout, Zone visual areas, manual Loop wiring, or view settings.

When importing a `.cpd` into a new project:

- Create one `Network` for the imported `.cpd`.
- Create one `Panel` per CPD control panel.
- Create Loops, Zones, Sounder Groups, I/O Groups, and Devices from extractor JSON.
- Mark all addressable devices as `Unplaced`.
- Do not create non-addressable sounder representative points automatically.

When re-importing a newer `.cpd` into an existing project:

- Match devices by `panelNumber + loopId + address`.
- Preserve matched device placement, floor assignment, manual Loop wiring references, Zone drawings, and view settings.
- Update CPD-derived fields on matched devices.
- Add new devices as `Unplaced`.
- Mark removed devices as `Missing` in `Issues`; do not delete them automatically.
- Show a Diff preview before applying changes.

## 5. Project File Format

The full project export format is `.fireproj`.

`.fireproj` is a single compressed package. It can be imported again to restore the complete project.

The package contains:

```text
metadata.json
project.json
assets/maps/
assets/icons/
assets/audio/
```

`metadata.json` stores:

- project format version,
- app name,
- app version,
- export timestamp,
- language preference,
- original CPD source file name,
- CPD import timestamp,
- CPD extractor name and version,
- CPD version label if available.

`project.json` stores:

- normalized CPD model,
- raw extractor JSON needed for traceability,
- buildings,
- floors,
- map asset references,
- placed device positions,
- Zone visual areas,
- manual Loop wiring,
- non-addressable sounder representative points,
- view settings,
- simulation settings,
- i18n preference.

The original `.cpd` file is not stored inside `.fireproj`.

## 6. Internal Data Model

The internal model must not use old Mesh terms for fire alarm concepts.

### 6.1 Core Objects

`Project`:

- `schemaVersion`
- `projectId`
- `name`
- `createdAt`
- `updatedAt`
- `language`
- `networks`
- `buildings`
- `assets`
- `viewSettings`
- `simulationSettings`

`Network`:

- `id`
- `name`
- `sourceFileName`
- `sourceImportedAt`
- `extractorVersion`
- `sounderMode`
- `panels`

Display format:

```text
Network Name · source-file.cpd
```

`Panel`:

- `id`
- `networkId`
- `panelNumber`
- `panelName`
- `panelModel`
- `general`
- `loops`
- `zones`
- `sounderGroups`
- `ioGroups`
- `sounders`

Display format:

```text
Panel 1
Panel 2
```

`Loop`:

- `id`
- `networkId`
- `panelId`
- `loopId`
- `name`
- `configuredDeviceOrder`
- `manualDeviceOrder`
- `color`

`Device`:

- `id`
- `networkId`
- `panelId`
- `panelNumber`
- `loopId`
- `address`
- `type`
- `friendlyTypeName`
- `description`
- `classify`
- `location`
- `zoneNumber`
- `sounderGroupId`
- `ioGroupId`
- `isInputCapable`
- `isOutputCapable`
- `isSounder`
- `isWirelessType`
- `disabled`
- `inhibitSounders`
- `inhibitIO`
- `inhibitRelays`
- `evacuateIO`
- `ioOverrideDelay`
- `immediateEvacuate`
- `setEvacuateTimer`
- `overrideDelays`
- `selectedDisablement`
- `reportingDetail`
- `smokeSensitivity`
- `heatGrade`
- `sounderGroupValue`
- `imageIndex`
- `placement`
- `sourceState`
- `raw`

`placement`:

- `status`: `unplaced`, `placed`, `missing`
- `buildingId`
- `floorId`
- `position`
- `rotation`

`Zone`:

- `id`
- `networkId`
- `panelId`
- `zoneNumber`
- `text`
- `enabled`
- `delayedSounders`
- `alarmMode`
- `sounderGroupAlarm1`
- `sounderGroupAlarm2`
- `ioGroup1Alarm1`
- `ioGroup1Alarm2`
- `ioGroup2Alarm1`
- `ioGroup3Alarm1`
- `ioGroup4Alarm1`
- `visualAreas`
- `raw`

`zone.alarmMode` is normalized by the CPD adapter as `single` or `double`.

Adapter behavior:

- If extractor JSON supplies an explicit Zone alarm mode, use it.
- If a known raw CPD column supplies the mode, map it to `single` or `double`.
- If no source value is available, use `single` and create an Issue with code `zone.alarm-mode-unresolved`.

`SounderGroup`:

- `id`
- `networkId`
- `panelId`
- `groupId`
- `title`
- `description`
- `nonAddressable1`
- `nonAddressable2`
- `addressableMembers`
- `nonAddressableMembers`
- `raw`

`IOGroup`:

- `id`
- `networkId`
- `panelId`
- `groupId`
- `members`
- `raw`

`NonAddressableSounderPoint`:

- `id`
- `networkId`
- `panelId`
- `sounderGroupId`
- `cieId`
- `channel`
- `label`
- `placement`

These points are created by users, not automatically created from `.cpd`.

## 7. Device Types And Icons

The application displays devices according to CPD `type`.

Normalization rule:

- Convert `type` to lowercase.
- Replace hyphen `-` with underscore `_`.
- Collapse repeated whitespace into one space.
- Look up the normalized value in `deviceIconByType`.
- If not matched, use `unknownDeviceIcon`.

Icon mapping:

| CPD type                     | Friendly name              | SVG                              |
| ---------------------------- | -------------------------- | -------------------------------- |
| `co_det`                     | CO Detector                | `co-detector.svg`                |
| `gas_det`                    | Gas Detector               | `gas-detector.svg`               |
| `heat_det`                   | Heat Detector              | `heat-detector.svg`              |
| `input_output`               | Input/Output               | `input-output.svg`               |
| `manual_call_point`          | Manual Call Point          | `manual-call-point.svg`          |
| `multi_det`                  | Multi Detector             | `multi-detector.svg`             |
| `optical_det`                | Optical Detector           | `optical-detector.svg`           |
| `smoke_detector`             | Optical Detector           | `optical-detector.svg`           |
| `sounder`                    | Sounder                    | `sounder.svg`                    |
| `zone_monitor`               | Zone Monitor               | `zone-monitor.svg`               |
| `wireless_co_det`            | Wireless CO Detector       | `wireless-co-detector.svg`       |
| `wireless_gas_det`           | Wireless Gas Detector      | `wireless-gas-detector.svg`      |
| `wireless_heat_det`          | Wireless Heat Detector     | `wireless-heat-detector.svg`     |
| `wireless_input_output`      | Wireless Input/Output      | `wireless-input-output.svg`      |
| `wireless_manual_call_point` | Wireless Manual Call Point | `wireless-manual-call-point.svg` |
| `wireless_multi_det`         | Wireless Multi Detector    | `wireless-multi-detector.svg`    |
| `wireless_optical_det`       | Wireless Optical Detector  | `wireless-optical-detector.svg`  |
| `wireless_sounder`           | Wireless Sounder           | `wireless-sounder.svg`           |

Wireless device types are displayed and can be placed, searched, highlighted, and inspected. They do not create wireless topology behavior.

Input-capable devices:

- detector types,
- manual call point,
- zone monitor,
- input/output,
- wireless equivalents.

Output-capable devices:

- sounder,
- input/output,
- wireless sounder,
- wireless input/output,
- non-addressable sounder representative points.

I/O devices are both input-capable and output-capable.

## 8. Device Tree

The Device Tree is shown in the 2D planning interface.

Fixed hierarchy:

```text
Network
  Panel
    Group
      Device
```

Group can be switched between:

- `Loop`
- `Zone`
- `Type`
- `Sounder Group`
- `I/O Group`

Default group mode: `Loop`.

Group rules:

- `Loop`: show devices by Loop. Hide Loop field in device row.
- `Zone`: show only devices with Zone configuration. Hide Zone field in device row.
- `Type`: group by `description` or `classify` display name. Hide Type field in device row.
- `Sounder Group`: show only sounder-class devices and Sounder Group members. Hide Sounder Group field in device row.
- `I/O Group`: show only I/O-class devices and I/O Group members. Hide I/O Group field in device row.

Status filters:

- `All`
- `Unplaced`
- `Placed`
- `Issues`

Default filter: `All`.

Issue examples:

- missing Panel, Loop, or Address,
- device removed from CPD but still placed,
- Zone reference does not exist,
- Sounder Group or I/O Group reference does not exist,
- Loop manual line references missing or unplaced devices,
- Zone alarm mode could not be resolved,
- non-addressable sounder is active in simulation but has no representative point.

Search fields:

- `id`
- `projectName`
- `network`
- `panelName`
- `type`
- `zone`
- `group`
- `location`
- `loop`
- `address`

## 9. 2D Planning Interface

### 9.1 Drawing Import

Supported drawing formats:

- `PNG`
- `JPG`
- `JPEG`
- `SVG`
- `PDF`

PDF behavior:

- User can select a page.
- If no page is selected, first page is used.
- The selected PDF page is converted to an internal map image asset.

CAD/DWG/DXF is not included in the first implementation.

### 9.2 Device Placement

Placement behavior:

- Users can drag one device to a drawing.
- Users can multi-select devices and drag them to a drawing.
- Batch placement creates a grid near the drop point.
- Users can move placed devices.
- `Remove from Drawing` clears placement only. It does not delete the CPD device.
- Device CPD properties are not changed by placement.

### 9.3 Mouse And Context Menu Behavior

Left mouse:

- select,
- drag,
- move,
- place,
- operate the current drawing tool.

Right mouse on device:

- open context menu.

Device context menu:

- `Open Properties`
- `Remove from Drawing`
- `Locate in Tree`
- `Start Alarm` when Simulation Mode is active and the device is input-capable
- `Restore Input` when Simulation Mode is active and that input is active
- `Trigger Fault` when Simulation Mode is active
- `Restore Fault` when Simulation Mode is active and that device has active fault

Hover:

- show summary tooltip with Loop, Address, Zone, Type, and Location.

Full properties:

- open in right-side property panel.

Left double-click:

- In Simulation Mode, double-click input-capable device toggles input alarm active/normal.
- Outside Simulation Mode, double-click does not trigger alarm.
- In polygon Zone drawing mode, double-click finishes polygon.
- In manual Loop wiring mode, left clicks create line order.

## 10. Zone Visualization

CPD Zone assignment is authoritative. Visual Zone areas do not change device Zone assignment.

Zone drawing modes:

- Default: rectangle.
- Optional: polygon.

Rectangle mode:

- select Zone,
- drag rectangle on current floor,
- save visual area.

Polygon mode:

- select Zone,
- click to add vertices,
- double-click to finish,
- `Esc` cancels current polygon.

Zone visual area binding:

- `networkId`
- `panelId`
- `zoneNumber`
- `buildingId`
- `floorId`

Rules:

- One Zone can have multiple visual areas.
- One Zone can have areas on multiple floors.
- Clicking a Zone highlights:
  - all Zone visual areas,
  - all devices assigned to that Zone.
- If a Zone has no visual area, the UI creates a temporary bounding highlight around placed Zone devices.
- If a device assigned to Zone A is physically inside Zone B's drawn area, the app reports an Issue. It does not auto-change the device.

3D display:

- Zone visual areas appear as translucent floor overlays.
- The first implementation does not need vertical volumetric Zone bodies.

## 11. Loop Wiring

Loop wiring has two modes.

### 11.1 Default Wiring

Default wiring follows the CPD/user configured order in the Loop device list. It must not reorder devices by address unless the CPD order is already address order.

Default wiring uses:

```text
loop.configuredDeviceOrder
```

### 11.2 Manual Wiring

Manual wiring flow:

1. User selects a Loop.
2. The app highlights all placed devices in that Loop.
3. User clicks devices in actual installation order.
4. Each click appends the device to `loop.manualDeviceOrder`.
5. Lines appear between consecutive clicked devices.
6. User saves manual order.
7. Manual order takes priority over default order.

Commands:

- `Start Manual Loop Wiring`
- `Save Manual Wiring`
- `Clear Manual Wiring`
- `Restore Default Wiring`

2D display:

- Shows only line segments where both devices are placed on the current floor.
- Does not force cross-floor line segments into the 2D current-floor view.

3D display:

- Connects all placed devices in effective Loop order.
- Cross-floor or cross-building connections appear as ordinary 3D line segments between device positions.

Issue behavior:

- If a line segment references an unplaced or missing device, that segment is not drawn.
- The Loop receives an Issue indicating incomplete wiring.

Visual style:

- Each Loop has a stable color.
- Physical Loop lines are solid.
- Selected Loop highlights both devices and lines.

## 12. Group Highlighting

### 12.1 Sounder Group

Clicking a Sounder Group:

- highlights addressable sounder members,
- highlights user-created non-addressable representative points,
- may draw same-color dashed helper lines,
- shows member list and triggering Zone list in a details panel.

Dashed helper lines must be visually distinct from physical Loop lines.

### 12.2 I/O Group

Clicking an I/O Group:

- highlights I/O member devices,
- may draw same-color dashed helper lines,
- shows member list and triggering Zone list in a details panel.

Group detail panel fields:

- group ID,
- group title or description,
- member Panel, Loop, Address, Zone,
- source Zones that trigger the group,
- current state: `Normal`, `Delay Active`, `Output Active`, `Inhibited`, `Disabled`.

## 13. Simulation Model

Simulation Mode is explicit. Editing mode and Simulation Mode are separate.

Network-level controls:

- `EVACUATE`
- `BUZZER SILENCE`
- `SYSTEM RESET`

Controls act on the whole Network, including all Panels.

Simulation supports:

- multiple active input alarms,
- multiple active faults,
- fire alarm and fault sound priority,
- delays,
- delay skip,
- time scale,
- inhibited and disabled states,
- output cause tracing.

Status priority:

```text
Fire Alarm > Evacuate > Fault > Normal
```

Sound priority:

```text
Fire Alarm sound > Fault sound > Silent
```

Default animation style:

- active input alarm: red pulse,
- active sounder output: red/yellow flashing,
- active I/O output: blue or amber highlight,
- disabled or inhibited output: grey or blocked-state styling,
- fault: fault-specific amber or yellow state.

No fire or smoke particle animation is required in the first implementation.

## 14. Fire Alarm Simulation

### 14.1 Input Activation

In Simulation Mode:

- Double-click input-capable device to make it `Active Alarm`.
- Double-click the same active input again to restore it to `Normal`.
- Right-click active input can also choose `Restore Input`.

`SYSTEM RESET` does not automatically restore active inputs.

If active inputs remain after `SYSTEM RESET`, the system returns to alarm according to real CIE behavior.

### 14.2 Programmed Sounder Mode

When Network Sounder Mode is `Programmed`:

1. Active input resolves to its Panel and Zone.
2. Zone configuration determines one-stage or two-stage behavior using normalized `zone.alarmMode`.
3. Stage 1 triggers:
   - `SounderGroupAlarm1`
   - `IOGroup1Alarm1`
   - `IOGroup2Alarm1`
   - `IOGroup3Alarm1`
   - `IOGroup4Alarm1`
4. Stage 2 triggers:
   - `SounderGroupAlarm2`
   - `IOGroup1Alarm2`
5. Delays and override fields are applied.
6. Inhibit and disabled fields are applied strictly.

### 14.3 Preset Sounder Mode

When Network Sounder Mode is `Preset`:

- Any input alarm activates all sounder-class outputs in the Network.
- This includes addressable sounders across all Panels.
- Non-addressable sounder outputs are shown in group/status lists.
- If user-created representative points exist, they flash in the drawing and 3D view.
- Preset behavior applies to sounders; I/O outputs still follow configured logic unless CPD rules explicitly say otherwise.

## 15. Evacuate Simulation

The app must simulate real CIE evacuate logic, not a simplified visual shortcut.

Evacuate inputs and fields:

- manual `EVACUATE` button,
- `EvacuteDelayMM`,
- `EvacuteDelaySS`,
- `EvacuteMode`,
- `OnManualCallPoints`,
- `OnTwoDevices`,
- device `ImmediateEvacuate`,
- device `EvacuateIO`,
- device `SetEvacuateTimer`.

Evacuate behavior:

- Manual `EVACUATE` starts Network-level evacuate according to CPD configuration.
- Manual call point conditions must be evaluated.
- Two-device conditions must be evaluated.
- Evacuate delays must be scheduled and visible.
- Evacuate outputs must be traceable to the cause.

## 16. Fault Simulation

First implementation includes basic fault simulation.

In Simulation Mode:

- Right-click device: `Trigger Fault`.
- Right-click device with active fault: `Restore Fault`.

Fault behavior:

- Active fault sets system Fault state.
- Fault uses fault sound, unless Fire Alarm sound has higher priority.
- Fault activates `FaultIOGroup`.
- Fault does not trigger Fire Alarm sounder groups unless CPD configuration explicitly links it.
- `BUZZER SILENCE` silences current sound but does not clear fault state.
- `SYSTEM RESET` does not clear a fault source that remains active.

## 17. Fire Brigade Simulation

Fire Brigade is part of the real CIE simulation.

Fields:

- `FireBrigadeDelayMM`
- `FireBrigadeDelaySS`
- `FireBrigadeActiveOn`
- `FireBrigadeMode`
- `InhibitRelays`

Behavior:

- Fire Brigade output enters delay or active state according to CPD rules.
- It appears in Simulation panel status and event timeline.
- It does not need a drawing device point in the first implementation.
- If inhibited, it shows `Inhibited` with the source reason.

## 18. Delays And Time Controls

Delays are real by default.

Delay sources:

- `SounderDelayMM`
- `SounderDelaySS`
- `InputOutputDelayMM`
- `InputOutputDelaySS`
- `FireBrigadeDelayMM`
- `FireBrigadeDelaySS`
- `EvacuteDelayMM`
- `EvacuteDelaySS`
- Zone `DelayedSounders`
- device `OverrideDelays`
- device `IOOverrideDelay`

Simulation controls:

- real-time countdown,
- `Skip Delay`,
- time scale: `1x`, `5x`, `10x`, `30x`.

The UI must show why a delay exists:

- General delay,
- Zone delayed sounders,
- device override delay,
- I/O override delay,
- Fire Brigade delay,
- Evacuate delay.

## 19. Inhibit And Disabled Rules

These fields must affect simulation strictly:

- `DeviceDisabled`
- `InhibitSounders`
- `InhibitIO`
- `InhibitRelays`
- `SelectedDisablement`

Rules:

- Disabled input cannot create an effective fire alarm cause.
- Disabled output does not activate.
- `InhibitSounders` blocks sounder activation from that cause.
- `InhibitIO` blocks I/O activation from that cause.
- `InhibitRelays` blocks Fire Brigade or relay-style output from that cause.
- UI must show blocked outputs with the reason.

## 20. BUZZER SILENCE And SYSTEM RESET

`BUZZER SILENCE`:

- Stops current app sound.
- Does not clear fire, evacuate, fault, or output states.
- Does not stop visual flashing.
- If a new fire alarm or fault occurs, sound starts again.
- Fire sound has priority over fault sound.

`SYSTEM RESET`:

- Attempts Network-level reset.
- Clears latched outputs only if sources are restored.
- Does not automatically restore active input alarms.
- Does not automatically restore active faults.
- If active inputs or faults remain, system returns to active state according to CIE logic.

## 21. Undo And Redo

The first implementation must support Undo/Redo for planning operations:

- place device,
- move device,
- remove from drawing,
- batch placement,
- draw Zone area,
- edit Zone area,
- delete Zone area,
- draw manual Loop wiring,
- clear manual Loop wiring,
- restore default Loop wiring.

Importing `.cpd` is not undone through Undo/Redo. It uses Diff preview and confirmation.

Project save stores the current state only. It does not store the undo history.

## 22. Internationalization

The app supports Chinese and English.

Rules:

- UI text uses i18n keys.
- Source files use UTF-8.
- Do not hardcode mixed Chinese and English text in components.
- CPD raw type values remain unchanged.
- Friendly device names are localized.
- `.fireproj` stores language preference.

## 23. SubAgent Execution Governance

Implementation will be run with the primary assistant acting as manager and final reviewer.

SubAgents will perform:

- code writing,
- unit and integration tests,
- first-pass verification,
- self-review.

Manager responsibilities:

- dispatch one focused task at a time,
- provide exact file ownership,
- prevent overlapping write scopes,
- review final diffs and test evidence,
- send spec compliance review after implementation,
- send code quality review after spec compliance passes,
- require fixes before moving to the next task,
- run or inspect final verification before claiming completion.

SubAgents must not:

- revert unrelated changes,
- revive wireless Mesh behavior,
- skip tests,
- silently change the product decisions in this document.

## 24. Acceptance Criteria

The implementation is acceptable when:

- `.cpd` import creates Network, Panels, Loops, Zones, Groups, Devices, and General configuration.
- Device Tree shows the confirmed hierarchy and grouping modes.
- Device filters and search work.
- Device icons match CPD type mapping.
- Users can import drawings, configure buildings/floors, place devices, remove placement, and batch place devices.
- Users can draw Zone rectangles and polygons.
- Users can draw manual Loop wiring and restore default wiring.
- 2D and 3D show placed devices, Loop wiring, Zone highlights, and Group highlights.
- `.fireproj` export/import restores full project state.
- CPD re-import preserves placement and reports changes.
- Simulation Mode supports fire alarm, evacuate, fault, fire brigade, sounder, I/O, delay, inhibit, disabled, buzzer silence, and system reset behavior.
- Active input and fault sources persist through reset until restored.
- Chinese and English UI strings are available for new UI.
- Test commands pass.
