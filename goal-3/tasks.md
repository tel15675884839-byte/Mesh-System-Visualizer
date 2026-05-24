# Goal 3 Tasks

- [x] Task 1: CPD relationship audit baseline
  - Scope:
    - Run/import `Exam_6002_Answer_Advanced.cpd` through the existing extractor path.
    - Add a reusable audit helper/test that reports extracted versus adapted relation counts.
    - Classify missing relations by layer: extractor missing, adapter missing, model unused, UI unused, simulation unused.
  - Verification before Task 2:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
    - audit report includes counts for Zone links, Sounder Group members, I/O Group members, device assignments, inhibit/disable/delay fields.
  - Completion note: Added `src/renderer/src/domain/fire/cpdRelationAudit.ts`, `src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`, and reusable `scripts/audit-cpd-relations.ts`. Verified red first with missing module failure, then green with `npm run test -- src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts` passing 4 tests. Ran `CpdExtractorPortable\CpdExtractor.ps1` against `D:\Users\30741\Desktop\程序开发\报警模拟器\Exam_6002_Answer_Advanced.cpd`, producing `.codex-dev-run\goal-3\Exam_6002_Answer_Advanced.json`. Audit counts: extractor/adapted both report Zone->Sounder Group links 6, Zone->I/O Group links 2, Sounder Group members 5, I/O Group members 3, device Zone assignments 15, device Sounder Group assignments 5, device I/O Group assignments 0, disable/inhibit fields 2, delay/override fields 3. Missing relation list is empty for extractor-to-adapter in this sample. During real-sample audit, fixed a double-counting bug where adapted typed Zone fields and raw CPD fields were counted twice.

- [x] Task 2: Complete CPD relation model and adapter normalization
  - Scope:
    - Extend domain types for explicit CPD relation metadata and traceable raw source fields.
    - Fix `cpdAdapter.ts` so Zone-to-group, group membership and device assignment relations survive import.
    - Extend `CpdExtractorPortable` only if the audit proves required fields are absent from extractor JSON.
  - Verification before Task 3:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
    - `npm run typecheck`
  - Completion note: Added adapter regression coverage for raw CPD fields and legacy `GDataDetail`/`GDataDetailEx` member tables. Updated `cpdAdapter.ts` so device Zone/Sounder Group/I/O Group assignments, inhibit/disable/delay flags, Zone cause/effect fields, Zone enabled/delayed flags, and Sounder/I/O group members can be normalized from either camelCase extractor fields or original CPD/raw field names. The sample extractor already exposed the required relation fields, so `CpdExtractorPortable` was not modified. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/cpdAdapter.test.ts src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts` passed with 18 tests; `npm run typecheck` passed. Re-running the real sample audit still reports extractor/adapted counts equal with no missing relation list.

- [x] Task 3: 3D scope/filter state and drawing opacity controls
  - Scope:
    - Add 3D scope selection for Building, Floor, Device Type, Loop, Zone, Sounder Group, I/O Group and single device.
    - Add global drawing opacity and per-floor override.
    - Building/Floor isolate selected scope while keeping cross-floor relation endpoints visible when a selected relation requires them.
  - Verification before Review Cycle A:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts`
    - `npm run typecheck`
  - Completion note: Added `viewer3DViewState.ts` with tested opacity clamping, Building/Floor isolation, and cross-floor relation endpoint visibility. Extended `viewer3DHighlight.ts` so Device Type is a highlight/dim target rather than an isolation scope. Updated project/store types for `mapOpacity3D` global opacity and per-floor `mapOpacity3D` overrides. Wired `Viewer3D.vue` toolbar controls for global drawing opacity, per-floor override, Building/Floor scope isolation, and Type highlight. 3D floor materials now apply effective opacity, and 3D rendering skips unrelated floors/devices while preserving selected relation context endpoints. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts src/renderer/src/domain/fire/__tests__/viewer3DViewState.test.ts`; `npm run typecheck`.

- [x] Review Cycle A: Broad debug/review after Tasks 1-3
  - Scope:
    - Recheck CPD relation audit, model normalization, and 3D view-state filtering for regressions or hidden assumptions.
  - Verification:
    - `npm run test -- src/renderer/src/domain/fire`
    - `npm run typecheck`
  - Completion note: Ran broad fire-domain regression after CPD audit/adapter/3D view-state changes. Verification passed: `npm run test -- src/renderer/src/domain/fire` passed with 22 files and 125 tests; `npm run typecheck` passed. No regression found in CPD relation audit, adapter mapping, simulation, project store, package payload, loop wiring, Zone geometry, or 3D highlight/view-state helpers.

- [x] Task 4: 3D Zone area highlight with temporary bounding areas
  - Scope:
    - Render saved Zone visual areas as highlighted 3D regions.
    - When no saved Zone area exists, render a temporary bounding highlight around placed devices in that Zone.
    - Do not persist temporary areas into `.fireproj`.
  - Verification before Task 5:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts`
    - `npm run typecheck`
  - Completion note: Added `viewer3DZoneArea.ts` with tested saved-area and temporary per-floor bounding-area resolution. Temporary Zone areas are generated only when the Zone is actively highlighted, use placed devices in that Zone, ignore unplaced/other-zone devices, include padding, and are marked `temporary: true`; saved `visualAreas` remain project-authored and are returned as `temporary: false`. Wired `Viewer3D.vue` to render resolved Zone areas, so selected Zones without saved areas now get temporary 3D region highlights without writing to project state. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DZoneArea.test.ts src/renderer/src/domain/fire/__tests__/viewer3DHighlight.test.ts`; `npm run typecheck`.

- [x] Task 5: Remove simulation behavior from 2D configuration view
  - Scope:
    - Remove 2D double-click alarm toggling, context-menu simulation actions and runtime simulation class rendering.
    - Keep placement, drag/drop, right-click properties, remove-from-drawing, locate-in-tree, Zone drawing and loop wiring.
    - Keep static configuration indicators such as disabled/missing/issues.
  - Verification before Task 6:
    - `npm run test -- src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts`
    - `npm run typecheck`
  - Completion note: Added `planner2DConfigOnly.test.ts` as a static contract that prevents 2D from referencing simulation state/actions. Removed `Planner2D.vue` runtime simulation imports, double-click alarm toggling, context-menu simulation actions, active/fault/output class calculation, and runtime simulation CSS effects. The 2D context menu still supports configuration actions: properties, remove from drawing, and locate in tree. Updated `App.vue` so the Simulation tab only renders when `viewMode === '3d'`, and switching back to 2D moves the right panel away from the simulation tab. Verification passed: `npm run test -- src/renderer/src/domain/fire/__tests__/planner2DConfigOnly.test.ts`; `npm run typecheck`.

- [x] Task 6: Simulation uses completed CPD cause/effect relations
  - Scope:
    - Ensure normalized Zone/group/device relations drive sounder, I/O, fire brigade, fault I/O and delay behavior.
    - Add real-sample regression coverage for the relations found in Task 1.
  - Verification before Review Cycle B:
    - `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts`
    - `npm run typecheck`
  - Completion note: Reviewed existing cause/effect coverage and added a regression in `simulationOutputMapping.test.ts` for CPD group-member outputs mapped to disabled member devices. Fixed `simulationOutputMapping.ts` so disabled devices never receive active/delay visual runtime state from direct device outputs, direct group fields, or CPD group member loop/address matches. This preserves normalized Zone/group cause/effect behavior while ensuring disabled outputs remain visually inactive in 3D. Verification passed: `npm run test -- src/renderer/src/domain/fire/simulation src/renderer/src/domain/fire/__tests__/simulationOutputMapping.test.ts src/renderer/src/domain/fire/__tests__/cpdRelationAudit.test.ts` passed with 40 tests; `npm run typecheck` passed.

- [x] Review Cycle B: Broad debug/review after Tasks 4-6
  - Scope:
    - Recheck 3D zone presentation, 2D/3D separation and simulation relation behavior.
  - Verification:
    - `npm run test`
    - `npm run typecheck`
  - Completion note: Ran full regression after 3D Zone region rendering, 2D configuration-only separation, and simulation output mapping changes. Verification passed: `npm run test` passed with 24 files and 131 tests; `npm run typecheck` passed. No regression found in the updated visual/state boundary or CPD-driven simulation mapping.

- [x] Task 7: Final UI/i18n integration and validation
  - Scope:
    - Add required Chinese/English i18n labels for new controls.
    - Run final lint/typecheck/test/build.
    - Inspect `git status --short` and document changed files.
  - Verification:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run test`
    - `npm run build`
  - Completion note: Added/verified Chinese and English i18n labels for 3D drawing opacity, floor override, Building/Floor scope, and Type highlighting. Ran scoped ESLint autofix for touched files plus one pre-existing formatted test warning required for full lint to pass. Final verification passed: `npm run lint`; `npm run typecheck`; `npm run test` passed with 24 files and 131 tests; `npm run build` passed. Inspected `git status --short`; the repo still contains many pre-existing dirty files from earlier work, plus this goal's scoped files under `goal-3`, `docs/superpowers/specs/2026-05-23-cpd-logic-3d-presentation-design.md`, `docs/superpowers/plans/2026-05-23-cpd-logic-3d-presentation-implementation.md`, `scripts/audit-cpd-relations.ts`, `src/renderer/src/domain/fire/cpdRelationAudit.ts`, `src/renderer/src/domain/fire/viewer3DViewState.ts`, `src/renderer/src/domain/fire/viewer3DZoneArea.ts`, their tests, and updates to `cpdAdapter.ts`, `types.ts`, `fireProjectStore.ts`, `Viewer3D.vue`, `Planner2D.vue`, `App.vue`, `simulationOutputMapping.ts`, and i18n files.

- [x] Final Validation
  - Scope:
    - Perform a final user-facing behavior, code quality, stability and test coverage review.
    - Mark this goal complete only after issues found in final review are fixed and retested.
  - Verification:
    - final command results copied into this task.
  - Completion note: Final review completed after all implementation tasks. Re-ran the real sample audit with `scripts/audit-cpd-relations.ts` against `.codex-dev-run\goal-3\Exam_6002_Answer_Advanced.json`; extractor and adapted counts still match exactly and `missing` remains empty. Static scan confirmed `Planner2D.vue` no longer contains runtime simulation state/action tokens. Static scan confirmed temporary Zone areas are generated only in `viewer3DZoneArea.ts` and consumed by `Viewer3D.vue`; no project mutation path writes temporary areas. Final validation commands passed before this review: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`. Goal 3 is complete.
