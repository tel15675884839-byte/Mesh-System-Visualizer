# AGENTS.md

## Project

This repository is the working copy for `Numens Fire Alarm Simulator`.

Project root:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator
```

The project is an Electron + Vue + TypeScript + Element Plus + Three.js desktop application. It is being transformed from the copied Mesh Studio app into a CPD-driven 2D/3D fire alarm planning and simulation tool.

## Required Reading

Before making code changes, read these two documents:

```text
docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md
docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md
```

The design document is the source of product truth. The implementation plan is the execution checklist.

Do not restart product discovery or redesign unless the user explicitly asks to revise the design.

## Current Execution Mode

The primary assistant acts as manager and final reviewer.

SubAgents or worker sessions should:

- implement one plan task at a time,
- write or update tests for the assigned scope,
- run the required verification commands,
- self-review before reporting completion,
- report changed files and command results.

The manager should:

- dispatch focused tasks with clear file ownership,
- avoid overlapping write scopes,
- review spec compliance first,
- review code quality second,
- require fixes before moving to the next task,
- perform final verification before claiming completion.

## Critical Product Rules

- Keep the existing technical stack unless the plan explicitly changes it.
- Reuse useful existing capabilities: building/floor setup, 2D drawing placement, 3D floor view, device dragging, and project persistence patterns.
- Remove user-facing Mesh product behavior.
- Do not keep RSSI, Leader, Router, wireless topology, or HTML topology import as product concepts.
- Wireless CPD device types are still imported, displayed, placed, searched, and simulated according to their CPD type. They do not create wireless network behavior.
- `.cpd` import is configuration-only. It does not restore drawings or placement.
- `.fireproj` import/export is the full project format and must restore drawings, placement, Zone areas, Loop wiring, and settings.
- The original `.cpd` file must not be stored inside `.fireproj`.
- Simulation must follow CPD/CIE behavior, including Fire Alarm, Evacuate, Fault, Fire Brigade, Sounder, I/O, delays, disabled states, inhibited states, `BUZZER SILENCE`, and `SYSTEM RESET`.

## Code Organization

- Keep code files maintainable. As a working rule, avoid letting any source code file exceed 500 lines.
- When a feature or core component approaches 500 lines, split it by responsibility before adding more behavior.
- Prefer small focused modules for templates, styles, store actions, domain helpers, scene logic, interaction handlers, calculations, and test fixtures.
- Do not reduce line count by weakening behavior, deleting verification, or hiding unrelated logic in hard-to-follow abstractions.
- For large 2D/3D components, keep the `.vue` file as a thin entry point and move template, script, styles, and specialized actions into nearby files.

## CPD Extractor

Use the provided extractor package:

```text
D:\Users\30741\Desktop\程序开发\报警模拟器\CpdExtractorPortable
```

The Electron main process should call the extractor. Browser/renderer code must not deserialize `.cpd` directly.

Expected command shape:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\CpdExtractor.ps1 -InputCpd input.cpd -OutputJson output.json
```

or:

```bat
CpdExtractor.cmd input.cpd output.json
```

## Worktree Safety

The worktree may already contain user changes.

Rules:

- Do not run `git reset --hard`.
- Do not run `git checkout --` to discard changes unless the user explicitly asks.
- Do not revert files you did not intentionally edit.
- Keep each task's touched files narrow.
- Before reporting completion, show or inspect `git status --short`.

## Implementation Order

Follow the task order in:

```text
docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md
```

Start with Task 1 unless the manager explicitly assigns another task.

Each worker should treat the task text as authoritative for:

- owned files,
- test expectations,
- verification commands,
- required behavior.

## New Feature Defect Discovery Gate

Before implementing any new user-facing feature, do not start from code. First produce and use a short feature contract, risk list, test matrix, and state-chain trace. The goal is to catch review-level bugs before implementation, not after.

Required pre-implementation output:

1. Feature contract
   - State the data source, write path, read path, persistence boundary, and business rules the feature must not change.
   - For planning features, explicitly distinguish configuration data from visual-only data.
   - For this product, remember: Zone visual areas are visual overlays only and must not change CPD Zone assignment.
   - `.cpd` import is configuration-only; `.fireproj` is the full save/open artifact.

2. Failure modes
   - List realistic ways the feature can break before coding.
   - Include non-happy-path cases: empty data, missing selection, wrong floor/building, multi-floor or multi-panel projects, saved data mixed with generated data, undo/redo, save/open, re-import, filtering/highlighting, and invalid user input.
   - For 2D/3D features, always include Building/Floor scope filtering, camera focus behavior, and whether hidden floors or devices can still leak into the visible result.

3. Test matrix
   - Define what will be covered at each layer before implementation:
     - domain helpers,
     - store/actions and undo/redo,
     - persistence or re-import behavior,
     - component/render logic,
     - runtime harness or browser check.
   - Do not accept a test plan that only proves the basic happy path.

4. State-chain trace
   - Trace the full flow from user action to rendered result.
   - For UI/3D work, use this shape:

```text
user action -> coordinate/input normalization -> store action -> project state -> persistence payload -> reload/normalize -> 2D render -> 3D resolve -> 3D scope/highlight -> rendered object
```

5. Review checklist before coding
   - Does the feature have a delete/edit/recover path when users make mistakes?
   - Does it reuse existing filtering/highlighting rules instead of creating a parallel rule set?
   - Does it preserve existing product boundaries such as visual-only Zone areas and CPD-vs-fireproj separation?
   - Does it handle saved state plus temporary/generated state deterministically?
   - Does it have at least one runtime verification path using the real renderer or a dedicated renderer harness?

Implementation may start only after the contract, failure modes, test matrix, and state-chain trace are written. If a task is small, keep this concise, but do not skip it.

For 2D/3D planner or simulation work, verification must include both static checks and runtime evidence. Common commands are still required, but they are not enough by themselves:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Use the real app or a dedicated renderer harness for browser/runtime checks. If a harness fails with `.vue` import-analysis errors, it was probably loaded through the wrong Vite config or boot path; use a renderer-aware harness with `@vitejs/plugin-vue` instead of treating the feature as broken.

## Testing And Verification

Use the commands specified by the current plan task. Common commands are:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

If a command fails because of pre-existing errors outside the assigned files, report:

- the command,
- the relevant error lines,
- why it appears outside the assigned scope,
- whether the assigned task still works.

Do not claim a task is complete without test or verification evidence.

## UI And Interaction Rules

- Device Tree hierarchy is fixed: `Network > Panel > Grouping > Device`.
- Default grouping is `Loop`.
- Grouping modes are `Loop`, `Zone`, `Type`, `Sounder Group`, and `I/O Group`.
- Status filters are `All`, `Unplaced`, `Placed`, and `Issues`; default is `All`.
- Left mouse is for selection, dragging, moving, placement, and active tool behavior.
- Right-click device opens a context menu.
- Device properties open from the context menu.
- Simulation alarm trigger requires Simulation Mode.
- In Simulation Mode, double-clicking an input-capable device toggles active alarm and restored normal.
- `SYSTEM RESET` does not restore active input or fault sources. Sources must be restored separately.

## Visual Rules

- Loop lines are physical lines and should be solid.
- Group helper lines may be dashed and must be visually distinct from Loop lines.
- Zone areas are visual overlays only. They do not change CPD Zone assignment.
- Default Zone drawing tool is rectangle. Polygon is optional when needed.
- 2D view shows current-floor Loop segments only.
- 3D view connects placed devices in effective Loop order, including cross-floor segments.

## Internationalization

New UI text should use i18n.

Supported languages:

- English
- Chinese

Source files must remain UTF-8. Avoid introducing mojibake or mixed hardcoded language strings.

## Reporting Format

When a worker finishes a task, report:

```text
Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

Task:
[task number and title]

Changed files:
- path
- path

Verification:
- command: result
- command: result

Notes:
- important implementation notes
- concerns or follow-up risks
```

When a reviewer finishes, report:

```text
Review type: Spec Compliance | Code Quality | Final
Status: APPROVED | CHANGES_REQUESTED

Findings:
- severity, file, line, issue

Residual risks:
- any remaining risk or test gap
```

## Do Not Do

- Do not implement wireless topology.
- Do not import old HTML topology files as a product workflow.
- Do not simplify CIE simulation into visual-only animation.
- Do not ignore CPD disabled or inhibited fields.
- Do not make `.fireproj` store original `.cpd` files.
- Do not skip the design and implementation documents.
- Do not make broad unrelated refactors.
