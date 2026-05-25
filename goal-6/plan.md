# Goal 6 Plan: Delayed Sounders CPD Fix And 3D Verification

## Requirement

The generated 6002 `.cpd` fixtures must explicitly enable Zone `DelayedSounders` when the intended behavior is delayed Zone-to-Sounder Group activation. Without this CPD field, the simulator should not treat the Zone as delayed. The fix must be proven through generation, extraction, simulator import, simulation behavior, and 3D runtime evidence for both enabled and disabled `DelayedSounders` cases.

## Feature Contract

- Data source: Configurator-backed generated `.cpd` files from `tools/CpdFixtureGenerator/`.
- Write path: generator mutates the 6002 template Zone table fields, then saves compressed `.cpd`.
- Read path: `CpdExtractorPortable` exports JSON, `cpdAdapter.ts` normalizes Zones, `causeEffect.ts` resolves delayed output states, and `viewer3DSimulationVisual.ts` maps simulation outputs to 3D visible states.
- Persistence boundary: `.cpd` remains configuration only; `.fireproj` remains the full layout/project artifact.
- Business rule: global Sounder delay applies to a Zone-triggered Sounder Group only when the triggering Zone has `DelayedSounders=true`, unless the input device overrides delays.
- Control case: a generated fixture with `DelayedSounders=false` must import successfully and must not show delayed Sounder behavior for the same detector path.

## Risks

- The generator may set the wrong Zone row or wrong CPD column casing.
- The extractor may expose `DelayedSounders` under a different raw field than the adapter consumes.
- Existing tests may pass with mocked JSON while real generated CPD still lacks the field.
- Runtime checks may validate cause/effect state but not the 3D visual mapping.
- Pre-existing dirty worktree changes can make a broad Git commit unsafe.

## Test Matrix

- Generator/extractor: regenerate fixtures and verify raw Zone `DelayedSounders` values in extracted JSON.
- Adapter: import extracted generated fixture JSON and assert `zone.delayedSounders` true/false per fixture.
- Simulation: trigger ordinary detector and manual call point to prove delayed and override behavior.
- 3D domain mapping: verify active/delayed Sounder outputs produce expected 3D visual output state.
- Runtime harness: run the app-equivalent fixture harness and write evidence for delayed-enabled vs delayed-disabled Zone behavior.
- Final static checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

## State Chain

Generated CPD Zone row -> extractor `zones[]` / raw Zone table -> `adaptCpdExport()` Zone model -> `resolveCauseAndEffect()` output state -> `resolveSimulationDeviceVisuals()` / 3D visual helper -> 3D sounder sprite/ring state.

## Execution Plan

1. Reproduce and inspect current generated fixture values and simulator delay decisions.
2. Add/adjust regression tests first for required enabled and disabled `DelayedSounders` outcomes.
3. Patch the generator and validation scripts so intended delayed fixtures set `DelayedSounders=true` and the control fixture sets it false.
4. Regenerate all CPDs and extracted JSON.
5. Extend runtime/3D verification to prove both outcomes.
6. Run full verification, update task notes, then perform a scoped Git operation only for relevant files.

## Rollback Plan

If the generator change creates invalid CPD output, revert only the generator edits and regenerate from the previous template-backed implementation. If simulator code changes are unnecessary, keep the fix limited to generator, fixtures, verification scripts, and tests.
