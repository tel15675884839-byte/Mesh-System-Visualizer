# CPD Inspector Visual Flow Design

Date: 2026-05-25

Target repo: `D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator`

Prototype baseline:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator\.superpowers\brainstorm\live-session\content\preview-v7.html
```

## Goal

Add a read-only CPD Inspector view to the simulator. The view visualizes the parsed `.cpd` configuration structure and explains the relationship chain:

```text
Zone -> Zone Devices -> Output Groups -> Output Devices -> Device Details
```

The simulator must not edit `.cpd` configuration. This page is only a visualization and explanation layer over the parsed CPD-derived project state.

## Product Boundary

- `.cpd` is the read-only configuration source.
- The renderer must not parse `.cpd` files directly.
- Use the existing import/adaptation path and project store state.
- Do not add config editing, save-back-to-CPD behavior, or editable fields.
- `.fireproj` may save simulator/project state, but it must not imply CPD configuration editing.
- Zone visual areas remain visual-only overlays and must not alter CPD Zone assignment.

## Current Web Prototype Summary

`preview-v7.html` already demonstrates the preferred core interaction:

- Three visual columns:
  - `Zones`
  - `Output Groups`
  - `Output Devices`
- SVG Bezier paths connect currently relevant cards.
- Selecting a Zone filters/highlights related groups.
- Selecting a Group filters/highlights related output devices.
- `All` mode shows all groups while dimming unrelated groups.
- Scroll and resize redraw paths.
- Cards outside their scroll viewport are excluded from line drawing.
- Hovering a card highlights connected paths.

This feature should keep that visual direction, but adapt it to the real Vue/Electron application shell and real CPD-derived project data.

## Placement In App

Add `CPD Preview` as a first-class main workspace view, placed before the existing visual/simulation views:

```text
CPD Preview | 2D | 3D | Simulation
```

The existing left Device Tree remains available as the app navigation pane. The CPD Preview content replaces the center workspace while selected.

## Recommended Layout

Inside the CPD Preview center workspace:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ CPD Preview | 2D | 3D | Simulation                                   │
├──────────────────────┬────────────────────────┬──────────────────────┤
│ Zones                │ Output Groups           │ Output Devices       │
│ - Zone cards         │ - Sounder Groups        │ - SVG icon + addr    │
│ - Devices button     │ - I/O Groups            │ - special badges     │
│ - expandable devices │ - mode/delay summary    │ - click for details  │
└──────────────────────┴────────────────────────┴──────────────────────┘
```

Use a quiet engineering-tool style:

- white cards on the existing light gray workspace background,
- thin borders,
- compact text,
- clear badges,
- no marketing-style panels,
- no editable controls except filters/search,
- no decorative graphics beyond the relationship SVG lines.

## Zone Column

### Zone Card Default Content

Each configured Zone card should show:

- Zone number, formatted as `Zone 001`.
- Zone text/name if available.
- Sounder delay status if enabled.
- Output count summary.
- `Devices N` button.
- `Special M` indicator when any Zone device has non-default simulation-impacting properties.

Example:

```text
Zone 001                         ACTIVE
1st Floor
Delay 60s | 4 Outputs
[Devices 6 · 2 Special]
```

### Zone Count Handling

There can be 128 Zones. Do not show all full cards by default.

Default filter:

```text
Configured Zones
```

A Zone is considered configured if any of these are true:

- `zone.enabled` is true,
- `zone.text` is not empty,
- the Zone has one or more assigned devices,
- the Zone has any output group assignment,
- `zone.delayedSounders` is true,
- the Zone has meaningful raw CPD configuration.

Provide filters:

- `Configured`
- `All 1-128`
- `Delayed`
- `Has Devices`
- `Has Outputs`
- `Special Devices`

Provide search that supports:

- `1`
- `001`
- `Zone 1`
- Zone text/name.

When `All 1-128` is enabled, empty/unconfigured Zones should render as compact low-emphasis rows, not large cards.

### Zone Device Expansion

Each Zone card has a small `Devices N` button. Clicking it expands or collapses a second layer under that Zone.

Recommended behavior:

- Default: only the selected Zone's devices may be expanded automatically.
- Expanding another Zone should collapse the previous expanded Zone unless multi-expand is explicitly added later.
- Clicking the Zone card body selects the Zone and redraws/highlights relations.
- Clicking `Devices N` only toggles the Zone device layer and should not feel like editing.

### Zone Device Row

Zone device rows are intentionally minimal.

For normal/default devices, show only:

- device SVG icon,
- loop number,
- address,
- short type/friendly type.

Example:

```text
[icon] L1-094  Sounder
```

Only show badges when the device has non-default or simulation-impacting properties.

Example:

```text
[icon] L1-017  Input Output    Disabled | Override Delay
```

Do not show all CPD parameter fields in the expanded Zone device list.

## Output Groups Column

The middle column shows groups associated with the selected Zone.

Group types:

- Sounder Group
- I/O Group

`All` mode may show all groups, but unrelated groups must be visually dimmed.

### Sounder Group Card

Each Sounder Group card should show:

- group number,
- title/description if available,
- triggering Zone summary,
- sounder mode,
- delay summary,
- member count.

Example:

```text
Sounder Group 1                 SG
Zone 1 Local Sounders
Mode: Pulse | Delay 60s | 2 Devices
Triggered by Zone 001
```

Sounder mode source should be resolved from the best available parsed fields:

1. group-specific raw CPD mode field if present,
2. panel/general sounder fields such as `sounderMode`, `sounderMode1`, or raw equivalents,
3. fallback label `Mode unavailable`.

Do not invent `Pulse` or `Continuous` if the parsed data does not contain a reliable source. If the current adapter does not expose a group-specific sounder mode, Gemini should inspect extractor output and adapter fields before adding display mapping.

### I/O Group Card

Each I/O Group card should show:

- group number,
- description if available,
- triggering Zone summary,
- I/O delay summary,
- member count,
- action-type summary when available from raw CPD fields.

Example:

```text
I/O Group 1                     IO
Linked by Zone 001
Delay 45s | 1 Device
```

## Output Devices Column

The right column shows devices belonging to the selected output group.

Device cards should stay compact:

- SVG icon,
- loop/address,
- friendly type,
- location/description if useful,
- only special badges when non-default properties exist.

Example:

```text
[sounder icon] L1-094 Sounder
1F Corridor Sounder
SG 1, SG 10
```

If the device has special properties:

```text
[module icon] L1-017 Input Output
2F Sprinkler Relay
Disabled | IO Override Delay
```

Clicking a device opens a read-only device detail popup/drawer.

## Device Detail Popup

Use a modal, drawer, or anchored popup. It must not crowd the three-column relationship view.

Default visible sections:

### Header

- device icon,
- loop/address,
- friendly type,
- description,
- location.

### CPD Assignment

- panel,
- loop,
- address,
- Zone,
- Sounder Group,
- I/O Group.

### Simulation-Impacting Properties

Show only properties that are true, non-empty, or non-default:

- `disabled`
- `overrideDelays`
- `inhibitSounders`
- `inhibitIO`
- `inhibitRelays`
- `evacuateIO`
- `ioOverrideDelay`
- `immediateEvacuate`
- `setEvacuateTimer`
- `selectedDisablement`
- `smokeSensitivity`
- `heatGrade`
- `reportingDetail`

If there are no special properties, show a concise empty state:

```text
No non-default simulation properties.
```

### Raw Field Mapping

Keep field mapping collapsed by default. The user can expand it when debugging extraction or adapter behavior.

Display rows like:

```text
CPD field              JSON field              Simulator field        Meaning
PhysicalAddress        address                 address                Loop physical address
DeviceType             type                    type                   Device type
DeviceClassify         classify                classify               Device category
DeviceLocationText     location                location               Display location
Description            description             description            Display description
Zone                   zone                    zoneNumber             Zone assignment
SounderGroup           sounderGroup            sounderGroupId         Sounder group assignment
IOGroup                ioGroup                 ioGroupId              I/O group assignment
DeviceDisabled         disabled                disabled               Disabled device
OverrideDelays         overrideDelays          overrideDelays         Bypass output delays
InhibitSounders        inhibitSounders         inhibitSounders        Prevent sounder output
InhibitIO              inhibitIO               inhibitIO              Prevent I/O output
InhibitRelays          inhibitRelays           inhibitRelays          Prevent relay output
EvacuateIO             evacuateIO              evacuateIO             Activate I/O on evacuate
IOOverrideDelay        ioOverrideDelay         ioOverrideDelay        Bypass I/O delay
ImmediateEvacuate      immediateEvacuate       immediateEvacuate      Enter evacuate immediately
SetEvacuateTimer       setEvacuateTimer        setEvacuateTimer       Start evacuate timer
SelectedDisablement    selectedDisablement     selectedDisablement    Selective disablement
SmokeSensitivity       smokeSensitivity        smokeSensitivity       Smoke threshold parameter
HeatGrade              heatGrade               heatGrade              Heat detector parameter
ReportingDetail        reportingDetail         reportingDetail        Reporting detail parameter
```

## Badge Rules

Only show badges for values that matter. Do not render false/default properties.

Priority and suggested color intent:

- `disabled`, `selectedDisablement`: high severity, red/orange.
- `overrideDelays`, `ioOverrideDelay`: timing override, orange.
- `inhibitSounders`: sounder suppression, blue.
- `inhibitIO`, `inhibitRelays`: output suppression, purple.
- `evacuateIO`, `immediateEvacuate`, `setEvacuateTimer`: evacuation behavior, red/orange.
- `smokeSensitivity`, `heatGrade`, `reportingDetail`: detector/reporting parameters, neutral gray-blue unless critical.

Zone cards should summarize special device count rather than showing every special property inline:

```text
Devices 6 · 2 Special
```

Expanded Zone device rows and Output Device cards may show the actual badges.

## Highlight And Dimming Rules

The active explanation path must be visually obvious.

When a Zone is selected:

- selected Zone card is strongly highlighted,
- related Output Groups are highlighted,
- unrelated Output Groups are dimmed in `All` mode,
- devices under the selected Output Group are highlighted,
- unrelated devices are hidden or dimmed depending on view mode.

When a Zone device is hovered:

- highlight the Zone card,
- highlight that device row,
- optionally highlight the Zone-to-Group paths if the device can trigger alarm behavior.

When an Output Group is selected:

- group card is strongly highlighted,
- selected group's output devices are shown/highlighted,
- Zone cards that trigger this group remain highlighted or outlined,
- if selected group is not linked to current Zone, update selected Zone to the first linked Zone and scroll it into view.

When an Output Device is hovered:

- highlight only the group-to-device path,
- do not redraw unrelated Zone-to-Group paths.

SVG path behavior:

- redraw after selection changes,
- redraw after column scroll,
- redraw after resize,
- redraw after the device expansion state changes,
- do not draw lines to cards outside their scroll viewport,
- prefer `requestAnimationFrame` after Vue `nextTick` to avoid stale coordinates.

## Data Model Guidance

Create a derived read-only view model from existing project state. Suggested helper:

```text
src/renderer/src/domain/fire/cpdInspectorModel.ts
```

Suggested output shape:

```ts
interface CpdInspectorModel {
  panels: CpdInspectorPanel[]
  totals: {
    panels: number
    zones: number
    configuredZones: number
    devices: number
    sounderGroups: number
    ioGroups: number
    delayedZones: number
    specialDevices: number
  }
}
```

For each selected panel, derive:

- zones from `panel.zones`,
- sounder groups from `panel.sounderGroups`,
- I/O groups from `panel.ioGroups`,
- devices from `project.devices` filtered by `panelId`,
- Zone devices by matching `device.zoneNumber === zone.zoneNumber`,
- Sounder Group devices by matching `device.sounderGroupId === group.groupId` plus group member references,
- I/O Group devices by matching `device.ioGroupId === group.groupId` plus group member references,
- Zone-to-output relations from:
  - `zone.sounderGroupAlarm1`,
  - `zone.sounderGroupAlarm2`,
  - `zone.ioGroup1Alarm1`,
  - `zone.ioGroup1Alarm2`,
  - `zone.ioGroup2Alarm1`,
  - `zone.ioGroup3Alarm1`,
  - `zone.ioGroup4Alarm1`.

Do not mutate project state in this helper.

## Component Guidance

Suggested components:

```text
src/renderer/src/components/fire/CpdInspector.vue
src/renderer/src/components/fire/CpdInspectorZoneColumn.vue
src/renderer/src/components/fire/CpdInspectorGroupColumn.vue
src/renderer/src/components/fire/CpdInspectorDeviceColumn.vue
src/renderer/src/components/fire/CpdInspectorDeviceDetails.vue
src/renderer/src/domain/fire/cpdInspectorModel.ts
```

Keep SVG line drawing isolated in `CpdInspector.vue` or a small local composable. Avoid spreading DOM measurement logic across all child components.

## I18n

All new user-facing strings must use the existing i18n setup.

Add English and Chinese strings for:

- `CPD Preview`,
- `Zones`,
- `Output Groups`,
- `Output Devices`,
- `Devices`,
- `Special`,
- `Configured`,
- `All 1-128`,
- `Delayed`,
- `Has Outputs`,
- `Special Devices`,
- `Mode unavailable`,
- `No output devices in this group`,
- `No non-default simulation properties`.

## Tests And Verification

Gemini should not stop at a static code change.

Minimum verification:

- unit tests for `cpdInspectorModel.ts`:
  - configured Zone filtering,
  - Zone device derivation,
  - Zone-to-Sounder Group relation derivation,
  - Zone-to-I/O Group relation derivation,
  - special device badge derivation,
  - selectedDisablement counted as special.
- component/runtime check:
  - CPD Preview tab appears before 2D/3D/Simulation,
  - selecting a Zone updates groups/devices,
  - `Devices N` expands only relevant Zone devices,
  - normal devices render compactly,
  - special devices show badges,
  - clicking a device opens read-only details,
  - SVG paths do not connect to offscreen cards.
- full project checks:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

If a browser/runtime harness already exists, add or reuse one for CPD Preview. If not, create a minimal renderer harness rather than relying only on screenshots.

## Acceptance Criteria

The feature is accepted when:

1. `CPD Preview` is visible to the left of `2D / 3D / Simulation`.
2. The page is read-only and contains no CPD editing behavior.
3. The visual relationship flow is:

   ```text
   Zone -> Output Groups -> Output Devices
   ```

4. Zone cards include a `Devices N` button.
5. Clicking `Devices N` expands the Zone's device rows.
6. Normal Zone device rows are compact and show only icon, loop, address, and short type.
7. Special/non-default device properties are shown as badges only when present.
8. Full device fields are available only through a read-only popup/drawer.
9. Sounder Group cards show sounder mode when reliably available, with a fallback when not available.
10. Selecting a Zone highlights related groups/devices and dims unrelated content.
11. SVG paths redraw correctly after selection, scroll, resize, and expansion.
12. The implementation uses existing CPD-adapted project data and does not reparse `.cpd` in the renderer.

## Gemini Execution Prompt

Use this prompt when assigning the implementation:

```text
You are working in:
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator

Read first:
- AGENTS.md
- docs/superpowers/specs/2026-05-25-cpd-inspector-visual-flow-design.md
- .superpowers/brainstorm/live-session/content/preview-v7.html
- src/renderer/src/App.vue
- src/renderer/src/stores/fireProjectStore.ts
- src/renderer/src/domain/fire/types.ts
- src/renderer/src/domain/fire/cpdAdapter.ts

Implement the CPD Inspector as a read-only CPD configuration visualization page. It must be added as CPD Preview before 2D / 3D / Simulation. Use the preview-v7.html model as the interaction baseline: Zone -> Output Groups -> Output Devices with SVG relationship lines.

Follow the design doc exactly:
- Do not add CPD editing.
- Do not parse CPD in the renderer.
- Derive a read-only view model from existing project state.
- Add Zone cards with Devices N expansion.
- Show compact Zone device rows by default.
- Show badges only for non-default/simulation-impacting device properties.
- Put full device properties in a read-only popup or drawer.
- Show Sounder Group mode when reliably available; use Mode unavailable when not.
- Highlight the active Zone relation path and dim unrelated content.

Add focused tests for the derived model and run:
- npm run lint
- npm run typecheck
- npm run test
- npm run build

Also perform a runtime/browser check of the CPD Preview view. Do not report completion until static checks and runtime verification both pass.
```
