# Goal 7 Tasks: 3D Delayed Sounder Activation

## Goal

Re-implement delayed sounder activation in the 3D simulator so `fixtures/cpd/6002-delay-edge-fields.cpd` drives Zone 1 alarm outputs exactly by CPD delay configuration: before the configured delay expires, sounder audio and active 3D sounder light animation must not start; the existing countdown visualization must show the remaining delay; after countdown reaches zero, sounder audio and active 3D dynamic light effect may start.

## Feature Contract

- Data source: existing `.cpd` fixture `fixtures/cpd/6002-delay-edge-fields.cpd` and its extracted runtime JSON `fixtures/cpd/extracted/6002-delay-edge-fields.json`.
- Import path: CPD extractor JSON -> `adaptCpdExport` -> store project state.
- Simulation write path: 3D double-click or context-menu alarm action -> `dispatchSimulationAction({ type: 'activate-input' })` -> simulation reducer.
- Simulation read/render path: `simulationState.outputs` -> `getDeviceSimulationOutput` -> `Viewer3DScene` device rendering and animation -> browser audio gate.
- Persistence boundary: no new `.cpd` generation and no change to `.fireproj` format.
- Business rule: delay configuration controls output activation. A delayed Zone sounder output is countdown-only in 3D until its output state becomes `active`.

## Failure Modes To Guard

- A fire source sets `soundState=fire`, causing browser audio before any sounder output is active.
- A delayed sounder is drawn with flashing or red active light before delay expiry.
- A delayed I/O output or fire brigade output is confused with sounder audio behavior.
- Countdown ticks too fast or twice because multiple UI surfaces run timers.
- Active output transition after tick loses cause or sounder group mapping.
- Existing non-delayed fixture regresses and stops activating immediately.
- Manual evacuate behavior regresses while fixing Zone-triggered sounders.

## State-Chain Trace

```text
3D user action
-> Viewer3DSceneInteraction pick device
-> store.dispatchSimulationAction activate-input
-> reduceSimulation resolves CPD Zone outputs
-> delayActive output keeps remainingDelaySeconds
-> Viewer3DScene renders delayed sounder as countdown-only
-> tick action decrements delay
-> output state becomes active at 0 seconds
-> getDeviceSimulationOutput returns active sounder
-> Viewer3DScene starts active red/flash animation
-> audio gate permits sound only when addressable/non-addressable sounder output is active
```

## Test Matrix

- Domain:
  - delayed sounder visual frame is countdown-only before expiry;
  - active sounder frame animates only after output state becomes `active`;
  - audio gate rejects delayed sounder outputs and accepts active sounder outputs.
- Store/engine:
  - `6002-delay-edge-fields` Zone 1 sounder starts `delayActive` at 60s and becomes `active` after 60 ticks.
- 3D/browser:
  - renderer harness mounts 3D with `6002-delay-edge-fields`, triggers Zone 1 address 4, verifies no immediate active 3D output/audio, sees countdown, advances delay, verifies active 3D output/audio.
- Regression:
  - `6002-zone-no-delayed-sounders` remains immediate active.

## Tasks

- [x] Task 1: Write this execution task list before implementation.
- [x] Task 2: Trace current 3D delayed sounder state chain and identify the exact gap.
  - Completion notes:
    - The CPD delay chain already produced `delayActive` outputs for Zone 1 in `6002-delay-edge-fields.json`.
    - Root gap: 3D view had removed the old `SimulationPanel`, so the previous audio gate was no longer mounted in the 3D simulator.
    - Existing 3D countdown-only sounder rendering was kept: delayed sounders show countdown and do not enter active red animation until state becomes `active`.
- [x] Task 3: Add failing tests for delayed audio gate and 3D active-effect transition.
  - Completion notes:
    - Added `simulationAudio.test.ts`; first run failed because `../simulationAudio` did not exist.
    - Added 3D visual regression coverage for `6002-delay-edge-fields` countdown-to-active transition.
- [x] Task 4: Implement the delayed sounder activation boundary and countdown-compatible transition.
  - Completion notes:
    - Added `simulationAudio.ts` with `shouldPlaySimulationAlarmAudio`.
    - Wired `Viewer3D.ts` to create/stop browser audio only when simulation is enabled, sound is enabled, and at least one sounder output is truly `active`.
    - Delayed sounder outputs remain silent while `delayActive`.
- [x] Task 5: Extend the 3D browser harness to prove the real mounted Viewer3D behavior.
  - Completion notes:
    - `viewer3d-check.ts` now records mounted `6002-delay-edge-fields` before/after countdown state.
    - Browser report proves: countdown starts at 60s, active output count is 0 before expiry, audio gate is false before expiry, and after a 60s tick the sounder is active with red active light and audio gate true.
- [x] Task 6: Run focused tests and browser/runtime verification.
  - Completion notes:
    - Verified: `npm run test -- src/renderer/src/domain/fire/__tests__/simulationAudio.test.ts src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts src/renderer/src/domain/fire/simulation/__tests__/cpdFixtureSimulation.test.ts`.
    - Verified: `node .\scripts\runtime-cpd-fixture-check.mjs`.
    - Verified: `node .\scripts\viewer3d-fixture-browser-check.mjs`.
- [x] Task 7: Run full verification: lint, typecheck, test, build.
  - Completion notes:
    - Verified: `npm run lint`.
    - Verified: `npm run typecheck`.
    - Verified: `npm run test` passed, 33 files and 198 tests.
    - Verified: `npm run build`.
- [x] Task 8: Update this file and handoff notes with evidence.
  - Completion notes:
    - This task file records the implementation and verification evidence.
    - Handoff notes updated in `docs/2026-05-24-cpd-fixture-generator-handoff.md`.
- [x] Task 9: Perform scoped git operation for this task's relevant files only.
  - Completion notes:
    - Git staging/commit is scoped to this task's implementation, 3D runtime dependencies, tests, task file, and handoff notes.
    - Pre-existing unrelated dirty files, build output churn, cache files, and local `.codex-dev-run` artifacts are left unstaged unless they are already part of the 3D runtime surface required by this task.
