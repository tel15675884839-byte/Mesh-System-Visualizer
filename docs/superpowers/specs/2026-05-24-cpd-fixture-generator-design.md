# CPD Fixture Generator Design

Date: 2026-05-24

## Purpose

Build a real CPD fixture generator for the Numens Fire Alarm Simulator. The generator will create `.cpd` files from the original SmartControlPad Configurator 6002 template so the simulator can be tested against realistic configuration data instead of hand-made mocks.

The output fixtures must support two uses:

- focused automated regression tests for CPD import and simulation logic;
- one realistic 6002 building sample for manual runtime verification in the app.

## Source Boundary

The generator must reuse the real Configurator serialization path:

- source Configurator folder: `..\..\Configurator_v3.6.0_2025-12-24` from the simulator project root;
- source template: `templet project/6002.cpd`;
- runtime dependencies: `BLL.dll`, `Common.dll`, and the existing .NET model assemblies needed by the template;
- serializer methods: `Common.SerializerHelper.ReadFromFileCompression` and `Common.SerializerHelper.SaveToFileCompression`.

The simulator must not deserialize or write BinaryFormatter CPD data in renderer code. CPD creation stays inside a local tool, and the simulator keeps using the existing extractor/import path for normal operation.

## Architecture

Add a dedicated tool under the simulator project:

```text
tools/CpdFixtureGenerator/
```

The tool will:

1. load the 6002 template through the Configurator assemblies;
2. create or normalize Loop 1 devices for deterministic fixture addresses;
3. update device `GData`, system `general.GData`, `zone.GData`, `sounderGroups.GData`, `sounderGroups.GDataDetail`, `ioGroup.GData`, and related detail tables;
4. save generated `.cpd` files to:

```text
fixtures/cpd/
```

The generated fixture set should include a manifest that explains each file, target behavior, trigger devices, and expected simulator outcome.

## Fixture Set

### Automated Fixtures

Generate focused files for these cases:

- `6002-basic-zone-linkage.cpd`
  - 3 zones, one floor-like area per zone.
  - Zone first-stage fire links to same-zone Sounder Group.
  - Zone second-stage fire links to all-evacuation Sounder Group 10.

- `6002-global-sounder-delay.cpd`
  - Global sounder delay enabled, for example 60 seconds.
  - Ordinary detector activation should produce delayed sounder output.

- `6002-manual-callpoint-override-delay.cpd`
  - Manual call points at addresses `04`, `14`, and `24` have `OverrideDelays=true`.
  - Manual call point activation should bypass the global delay.

- `6002-disabled-and-inhibited.cpd`
  - Address `21` is disabled.
  - Address `17` has relay inhibition enabled.
  - Simulation should not treat disabled or inhibited outputs as normal active outputs.

- `6002-io-stage-linkage.cpd`
  - Zone 1 first-stage fire links to I/O Group 1.
  - Zone 1 second-stage fire links to I/O Group 2.
  - I/O group members must point to deterministic module addresses.

- `6002-delay-edge-fields.cpd`
  - Created only when the template tables expose the required columns.
  - Covers fields such as `IOOverrideDelay`, `DelayedSounders`, `SetEvacuateTimer`, or equivalent raw delay fields.
  - The generator must report skipped fields explicitly instead of silently pretending coverage exists.

### Composite Fixture

Generate:

```text
6002-realistic-building-composite.cpd
```

This fixture represents a practical 6002 building test case:

- Loop 1 devices grouped into three logical floors/zones.
- Each zone includes detectors, a manual call point, sounders, and at least one I/O module where possible.
- Global sounder delay is enabled.
- Manual call points override delay.
- Zone first-stage links to local sounders.
- Zone second-stage links to all evacuation.
- Zone 1 links to two I/O stages for a fire shutter style workflow.
- Includes one disabled maintenance detector and one inhibited relay module.

## Data Rules

The generator must preserve the simulator product boundary:

- `.cpd` is import/configuration data only.
- `.fireproj` remains the full planning and placement artifact.
- Generated `.cpd` files do not contain drawings, floor plans, visual zone polygons, or simulator placement data.

The generator must use deterministic addresses so automated tests and manual verification can use stable trigger points:

- Zone 1: detector addresses `01`, `02`, `03`, manual call point `04`, sounders `94`, `95`, I/O modules `07`, `08`.
- Zone 2: detector addresses `11`, `12`, `13`, manual call point `14`, sounders `104`, `105`, I/O module `17`.
- Zone 3: detector addresses `21`, `22`, `23`, manual call point `24`, sounder `114`.

If a model/table/column is absent in the source template, the generator must fail clearly for required fixtures and mark optional edge-field coverage as skipped in the manifest.

## Mandatory Runtime Verification

Implementation is not complete until generated CPD files are applied directly to the current simulator application.

The required verification chain is:

```text
Configurator template -> generated .cpd -> CpdExtractorPortable JSON -> simulator import -> store/importer recognition -> simulation trigger -> visible/effective output state
```

The runtime verification must prove at least these behaviors:

- generated CPD imports without importer errors;
- devices, zones, Sounder Groups, I/O Groups, and relation mappings are recognized;
- ordinary detector activation respects global sounder delay;
- manual call point activation bypasses delay through `OverrideDelays`;
- Zone first-stage and second-stage triggers route to the expected output groups;
- disabled device behavior is not treated as a normal active fire trigger;
- inhibited relay or I/O behavior does not falsely appear as an active relay output;
- the composite fixture can be imported and exercised in Simulation Mode.

Verification can use a dedicated renderer/app harness when that is more reliable than manual clicking, but it must exercise the same import and simulation code paths used by the app.

## Tests

Add tests at these layers:

- generator tests or script checks for created files and manifest entries;
- extractor verification for expected raw fields and relations;
- CPD adapter/import tests using generated fixture output;
- simulation cause/effect tests for delay, override delay, disabled, inhibited, Sounder Group, and I/O Group behavior;
- runtime harness or browser/app verification that imports at least the composite fixture and one delay/override fixture.

## Deliverables

Expected deliverables:

- `tools/CpdFixtureGenerator/` source and build/run scripts;
- `fixtures/cpd/` generated `.cpd` files;
- `fixtures/cpd/manifest.json` or `manifest.md`;
- documentation for regenerating fixtures;
- tests or verification scripts that fail when the generated fixtures stop importing or stop affecting simulation correctly;
- runtime verification notes in the relevant goal task file or handoff document.

## Completion Standard

The work is complete only when:

1. the generator can recreate all required 6002 fixture files from source inputs;
2. the fixture manifest documents expected behavior and skipped optional fields;
3. extractor validation passes for generated files;
4. simulator import tests pass for generated files;
5. simulation tests or harness checks show the configurations are recognized and effective;
6. the current app has been run against the generated CPD files and the result is recorded.
