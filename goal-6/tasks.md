# Goal 6 Tasks: Delayed Sounders CPD Fix

## Goal

Fix the generated `.cpd` fixture data so Zone-to-Sounder delayed activation correctly requires Zone `DelayedSounders=true`, then verify both delayed-enabled and delayed-disabled behavior through extractor, simulator import, simulation logic, and 3D runtime evidence. Finish with a scoped Git operation after verification passes.

## Tasks

- [x] Task 1: Inspect and reproduce the Delayed Sounders gap
  - Scope:
    - Read the generator Zone-writing code, extractor validation, adapter, simulation delay logic, and 3D visual mapping path.
    - Regenerate or inspect current fixture JSON to confirm which fixtures set Zone `DelayedSounders`.
    - Record the intended true/false matrix for focused and composite fixtures.
  - Verification:
    - Use existing generator/extractor scripts or direct JSON inspection to show current values.
  - Completion notes:
    - Inspected `tools/CpdFixtureGenerator/CpdFixtureGenerator.cs`, extractor verification, `cpdAdapter.ts`, `causeEffect.ts`, `simulationOutputMapping.ts`, and `viewer3DSimulationVisual.ts`.
    - Current extracted fixtures show `6002-global-sounder-delay`, `6002-manual-callpoint-override-delay`, and `6002-realistic-building-composite` have Zone 1-3 `delayedSounders=true`.
    - Found a coverage gap: no fixture has `SounderDelaySeconds=60` with Zone `DelayedSounders=false`, so the app cannot prove the enabled-vs-disabled difference.
    - Found a semantic gap: `6002-delay-edge-fields` has a 60-second Sounder Delay while all Zones have `delayedSounders=false`; this should become an explicit delayed fixture.

- [x] Task 2: Add regression tests for delayed-enabled and delayed-disabled Zone behavior
  - Scope:
    - Add or extend import/simulation tests using generated fixture extraction output.
    - Test that delayed fixture Zones import with `delayedSounders=true`.
    - Test that a control fixture imports with `delayedSounders=false` and does not create delayed Sounder output.
  - Verification:
    - Run focused tests and confirm the new test fails before the generator fix when applicable.
  - Completion notes:
    - Added import regression coverage for `6002-delay-edge-fields.json` requiring Zone 1-3 `delayedSounders=true`.
    - Added import and simulation regression coverage for a new `6002-zone-no-delayed-sounders.json` control fixture with 60-second global Sounder Delay and Zone `delayedSounders=false`.
    - Verified failing-before-fix command: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.
    - Expected failure confirmed: missing `fixtures/cpd/extracted/6002-zone-no-delayed-sounders.json`.

- [x] Task 3: Patch generator and fixture validation
  - Scope:
    - Update `tools/CpdFixtureGenerator` to set Zone `DelayedSounders` explicitly according to each fixture scenario.
    - Update manifest and validation scripts so missing or wrong `DelayedSounders` fails loudly.
    - Regenerate `.cpd` files and extracted JSON.
  - Verification:
    - `.\tools\CpdFixtureGenerator\generate.ps1`
    - `node .\scripts\verify-cpd-fixtures.mjs`
  - Completion notes:
    - Added `6002-zone-no-delayed-sounders.cpd` as the 60-second global Sounder Delay / Zone `DelayedSounders=false` control fixture.
    - Changed `6002-delay-edge-fields.cpd` to use Zone `DelayedSounders=true`.
    - Changed generator Zone writing so `DelayedSounders` is required and tracked, not silently optional.
    - Fixed generator process shutdown with `Environment.Exit(code)` because Configurator/BLL leaves foreground threads after generation.
    - Regenerated 8 CPD fixtures and extracted JSON.
    - Verified: `.\tools\CpdFixtureGenerator\generate.ps1`.
    - Verified: `node .\scripts\verify-cpd-fixtures.mjs`.

- [x] Review Cycle A: Generator and extractor review after Task 3
  - Scope:
    - Recheck generated CPD raw values, manifest expectations, and adapter import assumptions.
  - Verification:
    - Focused import and simulation tests.
  - Completion notes:
    - Confirmed extracted matrix: delayed fixtures have Zone 1-3 `delayedSounders=true`; control/no-delay fixtures have Zone 1-3 `delayedSounders=false`.
    - Confirmed `6002-zone-no-delayed-sounders.json` exists and has `sounderDelay=60` with Zone delayed false.
    - Verified focused tests after regeneration: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.

- [x] Task 4: Prove simulator cause/effect behavior for delayed true and false
  - Scope:
    - Extend runtime harness or simulation tests to compare ordinary detector activation under Zone delayed enabled vs disabled.
    - Preserve manual call point override delay coverage.
  - Verification:
    - Focused simulation tests.
    - Runtime fixture harness.
  - Completion notes:
    - Extended `scripts/runtime-cpd-fixture-check.ts` to import `6002-zone-no-delayed-sounders.json`.
    - Runtime harness now proves ordinary detector output is `delayActive` with 60 seconds when Zone `DelayedSounders=true`, and `active` with 0 seconds/reason `zone-non-delayed-sounders` when Zone `DelayedSounders=false`.
    - Preserved manual call point override, stage-2, I/O stage, disabled input, and inhibited relay runtime checks.
    - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.

- [x] Task 5: Prove 3D simulator mapping for delayed true and false
  - Scope:
    - Add or extend a 3D/runtime check so delayed Sounder Group output appears as delayed when Zone delayed is enabled and not delayed when disabled.
    - Verify visible/effective 3D output state through the existing 3D visual mapping code or renderer harness.
  - Verification:
    - Focused 3D visual tests or harness output with saved report.
  - Completion notes:
    - Extended `viewer3DSimulationVisual.test.ts` so generated CPD outputs map to 3D sounder visuals: delayed Zone yields `delayActive` / cyan, non-delayed Zone yields `active` / red.
    - Extended `src/renderer/src/viewer3d-check.ts` browser harness to read generated extracted fixtures and record CPD delayed-vs-non-delayed 3D sounder state.
    - Added `scripts/viewer3d-fixture-browser-check.mjs` to start Vite and verify the actual `Viewer3D` page through headless Chrome.
    - Verified: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`.
    - Verified: `node .\scripts\viewer3d-fixture-browser-check.mjs`.
    - Browser report: `.codex-dev-run/viewer3d-fixture-browser-report.json`.

- [x] Task 6: Final verification, documentation, and Git
  - Scope:
    - Run full verification.
    - Update this task file and handoff notes.
    - Inspect Git status and perform a scoped Git operation for relevant files only if safe.
  - Verification:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run test`
    - `npm run build`
  - Completion notes:
    - Updated `docs/2026-05-24-cpd-fixture-generator-handoff.md` with the Delayed Sounders rule, new control fixture, 3D browser check, and current verification commands.
    - Fixed generator repeatability by writing to a temporary `.cpd.tmp` path and replacing the final `.cpd` only after successful serialization.
    - Verified: `.\tools\CpdFixtureGenerator\generate.ps1`.
    - Verified: `node .\scripts\verify-cpd-fixtures.mjs`.
    - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.
    - Verified: `node .\scripts\viewer3d-fixture-browser-check.mjs`.
    - Verified: `npm run lint`.
    - Verified: `npm run typecheck`.
    - Verified: `npm run test` passed, 28 files and 181 tests.
    - Verified: `npm run build`.
    - Git status inspected before staging; worktree still contains unrelated pre-existing UI/build changes that must not be included in the scoped CPD commit.

- [x] Review Cycle B: Final comprehensive review
  - Scope:
    - Check user-facing behavior, code quality, test coverage, runtime evidence, and Git scope.
  - Verification:
    - Confirm all required checks and reports exist.
  - Completion notes:
    - Requirement checklist reviewed: generated CPD now writes Zone `DelayedSounders=true` for delay fixtures; a 60-second non-delayed control fixture proves the negative case; simulator cause/effect and 3D mapping both distinguish true vs false.
    - Runtime evidence reports exist at `.codex-dev-run/cpd-fixture-runtime-report.json` and `.codex-dev-run/viewer3d-fixture-browser-report.json`.
    - No unrelated dirty worktree files were reverted.

## Follow-up Fix: 2026-05-25 `6002-delay-edge-fields.cpd`

- [x] Reproduced the reported no-delay symptom on Zone 1 address `04`.
  - Evidence: Zone 1 detector/I/O addresses `01`, `02`, `03`, `07`, and `08` already delayed correctly, but address `04` was active immediately because the delay-edge fixture combined `OverrideDelays=true` and `SetEvacuateTimer=true` on the same manual call point.
- [x] Added failing regression coverage.
  - Test: `cpdFixtureSimulation.test.ts` now requires address `04` in `6002-delay-edge-fields.json` to keep the Zone Sounder Group in `delayActive` for 60 seconds.
- [x] Fixed the generator.
  - `6002-delay-edge-fields.cpd` no longer sets manual override or evacuate timer on address `04`; the later 3D follow-up also removed `IOOverrideDelay=true` from this clean delayed-positive fixture.
  - Manual call point override behavior remains covered by `6002-manual-callpoint-override-delay.cpd`.
- [x] Regenerated and verified fixtures.
  - Verified: `.\tools\CpdFixtureGenerator\generate.ps1`.
  - Verified: `node .\scripts\verify-cpd-fixtures.mjs`.
  - Verified: `npm run test -- src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.
  - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.

## Follow-up Fix: 2026-05-25 `6002-delay-edge-fields.cpd` 3D immediate outputs

- [x] Reproduced the reported 3D/Simulation still-immediate symptom.
  - Evidence: Sounder Group was delayed, but the same file still produced immediate active outputs because Zone 1 had a zero Fire Brigade delay and address `04` still had `IOOverrideDelay=true`.
- [x] Added failing regression coverage.
  - Test: `cpdFixtureSimulation.test.ts` now requires every Zone 1 trigger in `6002-delay-edge-fields.json` to produce zero immediate `active` outputs.
  - Expected delays: Sounder Group 1 = 60s, I/O Group 1 = 45s, Fire Brigade = 30s.
- [x] Fixed the generator and regenerated the CPD.
  - `6002-delay-edge-fields.cpd` now keeps Zone 1 Sounder, I/O, and Fire Brigade outputs delayed for addresses `01`, `02`, `03`, `04`, `07`, and `08`.
  - Address `04` now has `IOOverrideDelay=false`, `OverrideDelays=false`, and `SetEvacuateTimer=false`.
  - Manual/override behavior remains isolated in the override fixtures so this file is a clean delayed-positive case.
- [x] Extended runtime and 3D verification.
  - `scripts/runtime-cpd-fixture-check.ts` now fails if any Zone 1 trigger in delay-edge creates an immediate `active` output.
  - `src/renderer/src/viewer3d-check.ts` now verifies delay-edge address `04` has no immediate active 3D outputs while the non-delayed fixture still activates immediately.
- [x] Completed full verification.
  - Verified: `.\tools\CpdFixtureGenerator\generate.ps1`.
  - Verified: `node .\scripts\verify-cpd-fixtures.mjs`.
  - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.
  - Verified: `node .\scripts\viewer3d-fixture-browser-check.mjs`.
  - Verified: `npm run lint`.
  - Verified: `npm run typecheck`.
  - Verified: `npm run test`.
  - Verified: `npm run build`.
