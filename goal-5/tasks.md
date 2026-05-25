# Goal 5 Tasks: CPD Fixture Generator And Runtime Application Verification

## Goal

Create a reusable 6002 CPD fixture generator inside the simulator project, generate focused and realistic CPD files, and apply them directly to the current simulator to verify that imported configurations are recognized and effective in simulation.

## Reference Spec

- `docs/superpowers/specs/2026-05-24-cpd-fixture-generator-design.md`

## Tasks

- [x] Task 1: Inspect Configurator generation surface and simulator CPD import expectations
  - Scope:
    - Read the existing Configurator `CPDExamManager.cs` generation path.
    - Confirm required assemblies, template file, serializer methods, device append methods, and relevant `GData`/`GDataDetail` tables.
    - Read simulator CPD importer, adapter, relation audit, and simulation cause/effect code paths that consume generated fields.
    - Produce a short field map for required fields: zone assignment, Sounder Group, I/O Group, global delay, `OverrideDelays`, disabled, inhibited relay, and optional edge delay fields.
  - Owned files:
    - documentation only unless a small helper inspection script is needed.
  - Verification:
    - Confirm `6002.cpd` template can be loaded through the Configurator serializer.
    - Confirm existing extractor can read at least one current generated/sample CPD.
  - Completion notes:
    - Record exact source fields and any missing optional fields before implementation.
    - Confirmed baseline extractor on `..\Exam_6002_Answer_Advanced.cpd`: 1 panel, 20 devices, 128 zones, 4 sounder groups, 3 I/O groups.
    - Confirmed required fields: `SounderDelayMM/SS`, `OverrideDelays`, `DeviceDisabled`, `InhibitRelays`, `IOOverrideDelay`, `DelayedSounders`, Zone sounder/I/O linkage, Sounder Group members, and I/O Group members.
    - Recorded field map in `.codex-dev-run/cpd-fixture-field-map.md`.

- [x] Task 2: Create simulator-local `tools/CpdFixtureGenerator` scaffold
  - Scope:
    - Add the generator project or script wrapper under `tools/CpdFixtureGenerator/`.
    - Keep the tool independent from renderer/runtime app code.
    - Add build/run documentation.
    - Define output location `fixtures/cpd/`.
    - Add a manifest structure for fixture name, purpose, trigger devices, expected groups, expected delay behavior, and skipped optional fields.
  - Owned files:
    - `tools/CpdFixtureGenerator/**`
    - `fixtures/cpd/README.md` or equivalent manifest stub.
  - Verification:
    - Run the tool in a no-op or list mode if implemented.
    - Confirm it does not modify Configurator binaries or simulator source runtime files.
  - Completion notes:
    - Added `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`, `build.ps1`, `generate.ps1`, and README.
    - Verified `.\tools\CpdFixtureGenerator\generate.ps1 -List` builds and lists all 7 fixture names.
    - The tool loads Configurator assemblies by path and writes only under simulator `fixtures/cpd/`.

- [x] Task 3: Implement deterministic 6002 device and group fixture generation
  - Scope:
    - Load `templet project/6002.cpd`.
    - Normalize Loop 1 device addresses for Zones 1-3.
    - Generate `6002-basic-zone-linkage.cpd`.
    - Populate Zone text/enabled state, Sounder Group metadata, Sounder Group members, and all-evacuation Group 10.
    - Write initial manifest entries.
  - Owned files:
    - `tools/CpdFixtureGenerator/**`
    - `fixtures/cpd/**`
  - Verification:
    - Generated CPD exists and can be read by `CpdExtractorPortable`.
    - Extracted JSON contains expected zones, devices, sounder groups, and zone-to-output relations.
  - Completion notes:
    - Generated deterministic Loop 1 addresses for Zones 1-3 and Sounder Groups 1, 2, 3, and 10.
    - Generated `6002-basic-zone-linkage.cpd`.
    - Verified through `node .\scripts\verify-cpd-fixtures.mjs`.

- [x] Task 4: Implement delay, override, disabled, inhibited, and I/O fixtures
  - Scope:
    - Generate focused files for:
      - global sounder delay;
      - manual call point `OverrideDelays`;
      - disabled detector plus inhibited relay;
      - Zone 1 I/O first-stage and second-stage linkage.
    - Generate optional delay edge fixture only when required columns exist.
    - Record optional skipped fields in the manifest.
  - Owned files:
    - `tools/CpdFixtureGenerator/**`
    - `fixtures/cpd/**`
  - Verification:
    - Extractor validation confirms each file exposes expected fields and relation mappings.
    - Required fixtures fail loudly if required columns are missing.
  - Completion notes:
    - Generated focused delay, override, disabled/inhibited, I/O stage, and optional edge-field fixtures.
    - Optional edge fixture confirmed `IOOverrideDelay` and `SetEvacuateTimer` fields are present in this 6002 template.
    - Extractor validation passes for all generated files.

- [x] Task 5: Generate the realistic 6002 composite building fixture
  - Scope:
    - Generate `6002-realistic-building-composite.cpd`.
    - Include three logical floors/zones, global delay, manual override, local first-stage sounders, all-evacuation second stage, I/O stage linkage, disabled maintenance detector, and inhibited relay module.
    - Add manifest entries that describe manual verification steps and expected simulation results.
  - Owned files:
    - `tools/CpdFixtureGenerator/**`
    - `fixtures/cpd/**`
  - Verification:
    - Extractor JSON contains all expected major sections: panels, devices, zones, sounderGroups, ioGroups, and relations.
    - Composite fixture imports through existing importer tests without schema errors.
  - Completion notes:
    - Generated `6002-realistic-building-composite.cpd` with three zones, global 60-second delay, manual overrides, staged I/O, disabled address 21, and inhibited relay address 17.
    - Runtime report recognizes 20 devices, Zones 1-3, Sounder Groups 1/2/3/10, and I/O Groups 1/2/3.

- [x] Task 6: Add simulator import and adapter regression tests for generated fixtures
  - Scope:
    - Add or extend tests so generated fixtures are parsed through the same extractor/import adapter path used by the app.
    - Verify recognized device count, zone IDs, group IDs, relation mappings, and delay-related normalized fields.
    - Keep tests deterministic and avoid relying on user-local absolute paths except through documented fixture paths.
  - Owned files:
    - `src/renderer/src/domain/fire/__tests__/**`
    - `src/renderer/src/domain/fire/cpdAdapter.ts` only if a real importer gap is discovered.
    - `src/main/cpdImport.ts` only if the main-process bridge needs fixture path handling.
  - Verification:
    - Run the focused CPD adapter/import tests.
    - Run `npm run typecheck`.
  - Completion notes:
    - Added `src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts`.
    - Fixed `cpdAdapter.ts` to infer double-stage zones when real CPD has stage-2 output fields but no explicit `AlarmMode`.
    - Verified: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts`; `npm run typecheck`.

- [x] Task 7: Add simulation behavior tests for generated fixture scenarios
  - Scope:
    - Verify ordinary detector activation respects global delay.
    - Verify manual call point activation bypasses delay.
    - Verify Zone first-stage and second-stage output routing.
    - Verify disabled device and inhibited relay scenarios do not appear as normal active outputs.
    - Verify I/O Group first-stage and second-stage routing.
  - Owned files:
    - `src/renderer/src/domain/fire/simulation/**`
    - `src/renderer/src/domain/fire/__tests__/**`
  - Verification:
    - Run focused simulation tests.
    - Run `npm run typecheck`.
  - Completion notes:
    - Added `src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.
    - Verified generated fixtures drive global delay, manual override, staged I/O, disabled input, and inhibited relay behavior.
    - Verified: `npm run test -- src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`; `npm run typecheck`.

- [x] Task 8: Apply generated CPD files directly to the app and verify runtime effect
  - Scope:
    - Import at least:
      - `6002-realistic-building-composite.cpd`;
      - one global delay fixture;
      - one manual override fixture;
      - one I/O linkage fixture.
    - Use the real app or a renderer/app harness that exercises the same import and simulation paths.
    - Trigger representative devices in Simulation Mode.
    - Confirm visible/effective state changes in the simulation panel and 2D/3D output state where applicable.
  - Owned files:
    - runtime harness files only if needed;
    - goal/handoff verification notes.
  - Verification:
    - Record the exact command or harness used.
    - Record which fixture files were imported.
    - Record observed results for delay, override delay, Zone linkage, I/O linkage, disabled, and inhibited scenarios.
  - Completion requirement:
    - This task is mandatory. The generator is not complete until the current program has consumed the generated CPD files and shown that the configurations are recognized and effective.
  - Completion notes:
    - Added `scripts/runtime-cpd-fixture-check.mjs` and `scripts/runtime-cpd-fixture-check.ts`.
    - Harness imports generated fixture JSON through the simulator adapter and triggers representative devices through the simulator cause/effect logic.
    - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.
    - Runtime report written to `.codex-dev-run/cpd-fixture-runtime-report.json`.

- [x] Review Cycle A: Generator and fixture correctness review
  - Scope:
    - Recheck generator output against Configurator field map.
    - Re-run extractor validation.
    - Confirm manifest matches actual generated files.
    - Confirm optional skipped fields are explicit.
  - Verification:
    - Run generator.
    - Run extractor validation script/checks.
    - Run focused import tests.
  - Completion notes:
    - Verified: `.\tools\CpdFixtureGenerator\generate.ps1`.
    - Verified: `node .\scripts\verify-cpd-fixtures.mjs`.
    - Verified: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.

- [x] Review Cycle B: End-to-end simulator verification review
  - Scope:
    - Recheck the full chain:
      - template generation;
      - extractor JSON;
      - simulator import;
      - store recognition;
      - simulation trigger;
      - visible/effective state.
    - Update handoff notes with commands, results, and residual risks.
  - Verification:
    - `npm run test`
    - `npm run typecheck`
    - Runtime app or harness verification from Task 8.
  - Completion notes:
    - Verified full test suite: `npm run test` passed, 28 files and 176 tests.
    - Verified: `npm run lint` passed with one pre-existing `.codex-dev-run/goal3-baseline-simulation.ts` prettier warning.
    - Verified: `npm run typecheck` passed.
    - Verified: `npm run build` passed.
    - Verified runtime harness: detector delay, manual override, Zone stage 2, I/O stage, disabled input, and inhibited relay all passed.
