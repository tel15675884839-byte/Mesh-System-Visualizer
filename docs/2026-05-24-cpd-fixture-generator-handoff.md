# CPD Fixture Generator Handoff

Date: 2026-05-24

Updated: 2026-05-25 for Goal 6 Delayed Sounders validation.

## What Was Added

- `tools/CpdFixtureGenerator/`: standalone .NET Framework CPD fixture generator.
- `fixtures/cpd/`: generated 6002 `.cpd` fixtures and manifest.
- `fixtures/cpd/extracted/`: extractor JSON snapshots for deterministic tests.
- `scripts/verify-cpd-fixtures.mjs`: regenerates extractor JSON and validates fixture fields.
- `scripts/runtime-cpd-fixture-check.mjs`: applies generated fixture data to the simulator adapter and simulation logic.
- `scripts/viewer3d-fixture-browser-check.mjs`: opens the 3D viewer harness in headless Chrome and verifies generated CPD delayed/non-delayed sounder states in the 3D mapping path.
- CPD fixture import and simulation tests.

## Generated Fixtures

- `6002-basic-zone-linkage.cpd`
- `6002-global-sounder-delay.cpd`
- `6002-zone-no-delayed-sounders.cpd`
- `6002-manual-callpoint-override-delay.cpd`
- `6002-disabled-and-inhibited.cpd`
- `6002-io-stage-linkage.cpd`
- `6002-delay-edge-fields.cpd`
- `6002-realistic-building-composite.cpd`

## Verification Results

- `.\tools\CpdFixtureGenerator\generate.ps1`: passed.
- `node .\scripts\verify-cpd-fixtures.mjs`: passed for all 8 fixtures.
- `npm run test -- src/renderer/src/domain/fire/__tests__/cpdFixtureImport.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`: passed, 10 tests.
- `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`: passed, including generated CPD delayed/non-delayed 3D mapping.
- `node .\scripts\runtime-cpd-fixture-check.mjs`: passed.
- `node .\scripts\viewer3d-fixture-browser-check.mjs`: passed, with browser report written to `.codex-dev-run/viewer3d-fixture-browser-report.json`.
- `npm run test`: passed, 28 test files and 181 tests.
- `npm run lint`: passed with one pre-existing warning in `.codex-dev-run/goal3-baseline-simulation.ts`.
- `npm run typecheck`: passed.
- `npm run build`: passed.

## Runtime Application Check

The runtime harness uses the simulator's current CPD adapter and cause/effect simulation code. It imported generated fixture JSON and verified:

- 20 devices recognized.
- Zones 1, 2, and 3 recognized.
- Sounder Groups 1, 2, 3, and 10 recognized.
- I/O Groups 1, 2, and 3 recognized.
- Ordinary detector activation enters 60-second delayed sounder state.
- The same ordinary detector path with global 60-second Sounder Delay but Zone `DelayedSounders=false` activates the Sounder Group immediately with reason `zone-non-delayed-sounders`.
- Manual call point activation bypasses sounder delay.
- Zone 1 second-stage activation routes to evacuation group 10.
- Zone 1 I/O second-stage activation routes to I/O Group 2.
- Disabled address 21 does not create fire state.
- Inhibited relay address 17 marks fire brigade output inhibited.

Report path:

```text
.codex-dev-run/cpd-fixture-runtime-report.json
.codex-dev-run/viewer3d-fixture-browser-report.json
```

## Implementation Note

Real generated CPD/extractor data does not expose a separate `AlarmMode` value for Zone two-stage behavior. The simulator adapter now infers `alarmMode: "double"` when a Zone has configured second-stage output fields such as `SounderGroupAlarm2` or `IOGroup1Alarm2`.

For delayed Sounder behavior, the generated CPD must set Zone `DelayedSounders=true`; a global `SounderDelayMM/SS` value alone is not enough. `6002-zone-no-delayed-sounders.cpd` intentionally keeps a 60-second global Sounder Delay while Zone `DelayedSounders=false` to prove this distinction.

`6002-delay-edge-fields.cpd` keeps Zone 1 Sounder Group, I/O Group, and Fire Brigade outputs delayed for all Zone 1 trigger devices, including manual call point address `04`. It intentionally has no immediate active outputs for Zone 1 triggers: Sounder Group delay is 60 seconds, I/O delay is 45 seconds, and Fire Brigade delay is 30 seconds. Manual call point override behavior remains isolated in `6002-manual-callpoint-override-delay.cpd`, so the delay-edge fixture can be used to test `DelayedSounders=true` without being masked by `OverrideDelays`, `IOOverrideDelay`, `SetEvacuateTimer`, or zero Fire Brigade delay.

The generator writes each fixture to a fresh temporary path and only replaces the final `.cpd` after successful serialization. This prevents a failed overwrite from leaving a 0-byte fixture file.

## Regeneration

From the simulator project root:

```powershell
.\tools\CpdFixtureGenerator\generate.ps1
node .\scripts\verify-cpd-fixtures.mjs
node .\scripts\runtime-cpd-fixture-check.mjs
node .\scripts\viewer3d-fixture-browser-check.mjs
```
