# CPD Fixture Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simulator-local 6002 CPD fixture generator and verify generated CPD files through extractor, importer, simulation tests, and the current app/runtime path.

**Architecture:** Add a standalone .NET Framework console generator under `tools/CpdFixtureGenerator/` that loads the Configurator 6002 template through `Common.SerializerHelper`, writes fixture `.cpd` files to `fixtures/cpd/`, and writes a manifest. Add Node verification scripts and Vitest coverage that read extracted JSON fixtures through `adaptCpdExport()` and `resolveCauseAndEffect()`.

**Tech Stack:** C# .NET Framework via `csc.exe`, PowerShell wrapper scripts, Node.js verification scripts, Vitest, existing CPD extractor and Electron/Vue simulator domain modules.

---

## File Structure

- Create `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`: C# console generator that owns all BinaryFormatter template mutation.
- Create `tools/CpdFixtureGenerator/build.ps1`: compiles the generator with local Configurator DLL references.
- Create `tools/CpdFixtureGenerator/generate.ps1`: builds and runs the generator, defaulting source Configurator and output directories.
- Create `tools/CpdFixtureGenerator/README.md`: regeneration and dependency notes.
- Create `scripts/verify-cpd-fixtures.mjs`: runs the extractor for each generated `.cpd` and verifies JSON fields.
- Create `scripts/runtime-cpd-fixture-check.mjs`: imports extracted fixture JSON through built domain code or a lightweight compiled harness path and records results.
- Create `fixtures/cpd/manifest.json`: generated fixture manifest.
- Create `fixtures/cpd/*.cpd`: generated fixture files.
- Create `fixtures/cpd/extracted/*.json`: extracted JSON snapshots used by deterministic tests.
- Add or extend `src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts`: adapter assertions against extracted fixtures.
- Add or extend `src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`: simulation assertions against adapted fixtures.
- Update `goal-5/tasks.md`: mark tasks complete and record commands/results as each phase lands.

## Task 1: Baseline Field Map And Verification

**Files:**

- Modify: `goal-5/tasks.md`
- Create: `.codex-dev-run/cpd-fixture-field-map.md`

- [ ] **Step 1: Run existing extractor against a known CPD**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\CpdExtractorPortable\CpdExtractor.ps1 -InputCpd ..\Exam_6002_Answer_Advanced.cpd -OutputJson .codex-dev-run\goal5-baseline-extract.json
```

Expected: exit code 0 and JSON file created.

- [ ] **Step 2: Inspect expected fields**

Run:

```powershell
@'
const fs = require('fs')
const data = JSON.parse(fs.readFileSync('.codex-dev-run/goal5-baseline-extract.json', 'utf8'))
const firstDevice = data.devices.find((d) => d.address === 4) || data.devices[0]
const firstZone = data.zones.find((z) => z.zoneNumber === 1) || data.zones[0]
console.log(JSON.stringify({
  counts: {
    panels: data.panels.length,
    devices: data.devices.length,
    zones: data.zones.length,
    sounderGroups: data.sounderGroups.length,
    ioGroups: data.ioGroups.length
  },
  firstDevice,
  firstZone
}, null, 2))
'@ | node
```

Expected: counts are non-zero and raw fields include delay/linkage columns.

- [ ] **Step 3: Record field map**

Write `.codex-dev-run/cpd-fixture-field-map.md` with exact fields consumed by generator and simulator:

```markdown
# CPD Fixture Field Map

- Template: Configurator `templet project/6002.cpd`
- Serializer: `Common.SerializerHelper.ReadFromFileCompression` / `SaveToFileCompression`
- Device fields: `DeviceLocationText`, `Zone`, `SounderGroup`, `OverrideDelays`, `DeviceDisabled`, `InhibitRelays`, optional `IOOverrideDelay`
- General fields: `SounderDelayMM`, `SounderDelaySS`, `InputOutputDelayMM`, `InputOutputDelaySS`, `FireBrigadeDelayMM`, `FireBrigadeDelaySS`, `EvacuteDelayMM`, `EvacuteDelaySS`
- Zone fields: `ZoneNumber`, `ZoneTexts`, `ZoneEnabled`, `DelayedSounders`, `SounderGroupAlarm1`, `SounderGroupAlarm2`, `IOGroup1Alarm1`, `IOGroup1Alarm2`
- Sounder detail fields: `SounderGroupID`, `LoopID`, `PhysicalAddress`, `SounderStatus`
- I/O fields: `IOGroup`, `Entry`, `Loop`, `Device`, `Text`
```

## Task 2: Generator Scaffold

**Files:**

- Create: `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`
- Create: `tools/CpdFixtureGenerator/build.ps1`
- Create: `tools/CpdFixtureGenerator/generate.ps1`
- Create: `tools/CpdFixtureGenerator/README.md`
- Create: `fixtures/cpd/README.md`

- [ ] **Step 1: Write generator smoke behavior**

Create a C# program that accepts:

```text
--configurator <path>
--output <path>
--list
```

`--list` prints fixture names and exits without writing CPD files.

- [ ] **Step 2: Build the generator**

Run:

```powershell
.\tools\CpdFixtureGenerator\build.ps1
```

Expected: `tools/CpdFixtureGenerator/bin/CpdFixtureGenerator.exe` exists.

- [ ] **Step 3: Run list mode**

Run:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1 -List
```

Expected: prints all fixture names and exits 0.

## Task 3: Generate Core Linkage Fixture

**Files:**

- Modify: `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`
- Modify: `tools/CpdFixtureGenerator/README.md`
- Create/Modify: `fixtures/cpd/manifest.json`
- Create: `fixtures/cpd/6002-basic-zone-linkage.cpd`

- [ ] **Step 1: Add template loading and deterministic device creation**

Implement loading through Configurator assemblies, clear Loop 1 devices, and append addresses `01`, `02`, `03`, `04`, `07`, `08`, `11`, `12`, `13`, `14`, `17`, `21`, `22`, `23`, `24`, `94`, `95`, `104`, `105`, `114`.

- [ ] **Step 2: Add Zone and Sounder Group configuration**

Populate Zones 1-3 with `SounderGroupAlarm1 = zone`, `SounderGroupAlarm2 = 10`, enabled state, and Sounder Group details for groups 1, 2, 3, and 10.

- [ ] **Step 3: Generate and extract**

Run:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1
node .\scripts\verify-cpd-fixtures.mjs
```

Expected: `6002-basic-zone-linkage.cpd` exists and extracted JSON contains Zone 1/2/3 and Sounder Groups 1/2/3/10.

## Task 4: Delay, Override, Disabled, Inhibited, I/O, And Composite Fixtures

**Files:**

- Modify: `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`
- Modify: `fixtures/cpd/manifest.json`
- Create: `fixtures/cpd/6002-global-sounder-delay.cpd`
- Create: `fixtures/cpd/6002-manual-callpoint-override-delay.cpd`
- Create: `fixtures/cpd/6002-disabled-and-inhibited.cpd`
- Create: `fixtures/cpd/6002-io-stage-linkage.cpd`
- Create: `fixtures/cpd/6002-delay-edge-fields.cpd` when optional fields exist
- Create: `fixtures/cpd/6002-realistic-building-composite.cpd`

- [ ] **Step 1: Add per-fixture options**

Represent fixture options in C# with booleans/values for `SounderDelaySS`, `InputOutputDelaySS`, `OverrideDelays`, `DeviceDisabled`, `InhibitRelays`, Zone I/O linkage, `DelayedSounders`, and optional `IOOverrideDelay`.

- [ ] **Step 2: Generate all fixtures**

Run:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1
```

Expected: required `.cpd` files and manifest are created.

- [ ] **Step 3: Extract and validate**

Run:

```powershell
node .\scripts\verify-cpd-fixtures.mjs
```

Expected: extractor runs for every generated `.cpd`; JSON checks pass; optional fields are recorded as present or skipped.

## Task 5: Import Tests

**Files:**

- Create: `src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Add tests that load `fixtures/cpd/extracted/*.json`, call `adaptCpdExport(data, 1234)`, and assert:

```typescript
expect(panel.zones.find((zone) => zone.zoneNumber === 1)).toMatchObject({
  sounderGroupAlarm1: 1,
  sounderGroupAlarm2: 10
})
expect(deviceByAddress(4).overrideDelays).toBe(true)
expect(deviceByAddress(21).disabled).toBe(true)
expect(deviceByAddress(17).inhibitRelays).toBe(true)
```

- [ ] **Step 2: Run the failing/passing test cycle**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts
```

Expected after generator/extraction exists: tests pass. If they fail due adapter gaps, fix `cpdAdapter.ts` minimally and rerun.

## Task 6: Simulation Tests

**Files:**

- Create: `src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`

- [ ] **Step 1: Write simulation tests from adapted fixtures**

Add tests that adapt generated JSON, find devices by address, call `resolveCauseAndEffect()`, and assert:

```typescript
expect(outputForDetector.reason).toBe('general-sounder')
expect(outputForDetector.remainingDelaySeconds).toBe(60)
expect(outputForManualCallPoint.reason).toBe('device-override-delay')
expect(outputForManualCallPoint.remainingDelaySeconds).toBe(0)
expect(stage2Outputs).toContain('sounder-group:<panel-id>:10')
expect(disabledInputResult.systemState).toBe('normal')
expect(inhibitedRelayOutput.state).toBe('inhibited')
```

- [ ] **Step 2: Run focused simulation test**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts
```

Expected: tests pass, or minimal simulation/import fixes are applied and rerun.

## Task 7: Runtime/App Verification Harness

**Files:**

- Create: `scripts/runtime-cpd-fixture-check.mjs`
- Modify: `goal-5/tasks.md`

- [ ] **Step 1: Implement harness**

The harness must load extracted fixture JSON, adapt it with the same domain code used by the app, trigger representative devices, and emit a JSON report with:

```json
{
  "imported": true,
  "fixture": "6002-realistic-building-composite.cpd",
  "recognized": {
    "devices": 20,
    "zones": [1, 2, 3],
    "sounderGroups": [1, 2, 3, 10],
    "ioGroups": [1, 2]
  },
  "simulation": {
    "detectorDelay": "passed",
    "manualOverride": "passed",
    "zoneStage2": "passed",
    "ioStage": "passed",
    "disabledInput": "passed",
    "inhibitedRelay": "passed"
  }
}
```

- [ ] **Step 2: Run harness**

Run:

```powershell
node .\scripts\runtime-cpd-fixture-check.mjs
```

Expected: report marks every required runtime behavior as passed and is written to `.codex-dev-run/cpd-fixture-runtime-report.json`.

## Task 8: Final Verification And Task Updates

**Files:**

- Modify: `goal-5/tasks.md`

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts
npm run typecheck
node .\scripts\verify-cpd-fixtures.mjs
node .\scripts\runtime-cpd-fixture-check.mjs
```

Expected: all commands pass.

- [ ] **Step 2: Update task checklist**

Mark completed Goal 5 tasks and record commands/results under completion notes.

- [ ] **Step 3: Inspect git status**

Run:

```powershell
git status --short
```

Expected: only intentional generator, fixture, test, script, docs, and task files are changed or added.
