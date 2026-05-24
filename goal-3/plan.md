# Goal 3 Plan

## Objective

Complete the CPD logic and 3D presentation corrections requested for `Numens Fire Alarm Simulator`: audit the real `Exam_6002_Answer_Advanced.cpd` import path for missing relations, fix the extractor/adapter/model/UI/simulation gaps, add 3D drawing opacity and category filtering, add Zone area highlighting, and remove runtime simulation behavior from the 2D configuration view.

## Confirmed Requirements

- CPD relation loss must be handled as a full-chain audit, not a single UI patch. The audit must cover Zone to Sounder Group/I/O Group links, Sounder Group/I/O Group membership, device group assignments, cause/effect fields, delay fields, disablement, inhibit and raw-but-unused fields.
- Relation processing is layered:
  - engineering/config relations are visible, searchable, highlightable and locatable;
  - real cause/effect relations also drive simulation outputs.
- 2D is configuration only:
  - no Simulation Mode controls;
  - no alarm/fault trigger/restore actions;
  - no runtime flashing or simulation colors;
  - static configuration states such as disabled, inhibited, missing and issues can remain.
- 3D is presentation/simulation:
  - building/floor filtering isolates the selected scope;
  - loop/zone/group/type/device filtering highlights selected entities and dims unrelated entities;
  - when an isolated building/floor would hide cross-floor relation endpoints, those endpoints remain visible as relation context.
- 3D drawing opacity must support one global opacity plus per-floor override.
- Zone area highlight uses saved hand-drawn Zone visual areas first. If a Zone has no saved area, 3D creates a temporary bounding area from placed devices and does not write that temporary area into the project.
- The main acceptance sample is `D:\Users\30741\Desktop\程序开发\报警模拟器\Exam_6002_Answer_Advanced.cpd`.
- If the extractor does not expose required fields, `D:\Users\30741\Desktop\程序开发\报警模拟器\CpdExtractorPortable` can be extended.
- 3D toolbar owns Building/Floor/Type and opacity/global view controls. Device Tree/right panel clicks can drive Loop/Zone/Group/Device highlighting.
- Acceptance prioritizes real CPD audit counts and fixed points, automated tests, typecheck and build.

## Context

Project root:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator
```

Related files:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\CpdExtractorPortable
D:\Users\30741\Desktop\程序开发\报警模拟器\Exam_6002_Answer_Advanced.cpd
```

Required project reading:

```text
docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md
docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md
AGENTS.md
```

New durable docs for this goal:

```text
docs/superpowers/specs/2026-05-23-cpd-logic-3d-presentation-design.md
docs/superpowers/plans/2026-05-23-cpd-logic-3d-presentation-implementation.md
```

## Risks

- The worktree already contains many pre-existing changes. Each task must inspect and preserve surrounding changes before editing.
- `Viewer3D.vue` already contains recent custom 3D visual code and mojibake comments. Do not revert it; make scoped, compatible edits.
- Some CPD data may be present in extractor raw fields but not normalized. Fix the earliest layer that has the missing information.
- 2D currently imports `simulationMode`, `simulationState`, simulation output mapping, and dispatches simulation actions. Removing runtime behavior must not break configuration interactions such as placement, Zone drawing and loop wiring.
- A full visual browser check may be difficult if Electron dev startup is unstable; automated domain/component tests plus typecheck/build are mandatory.

## Execution Plan

Use the task list in `goal-3/tasks.md`. Every task must be independently verified. Every third implementation task is followed by a broad debug/review cycle.

Implementation will be test-first for behavior changes:

1. Add failing tests for the specific missing relation or UI contract.
2. Verify the test fails for the intended reason.
3. Implement the minimal production change.
4. Run the focused test and then the task-level verification.
5. Update `goal-3/tasks.md` with the completion note.

## Validation

Minimum final commands:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Real sample audit command will be added during Task 1 and must produce a concise relation count report for `Exam_6002_Answer_Advanced.cpd`.

## Rollback Plan

- Do not use destructive git commands.
- Keep edits scoped to files listed in the active task.
- If a task introduces instability, revert only that task's own changes manually with `apply_patch`.
- Preserve pre-existing unrelated files and generated output.
