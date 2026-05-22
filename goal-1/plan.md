# Goal 1 Plan

## Requirements

- Execute the existing implementation plan for Numens Fire Alarm Simulator task by task.
- The primary assistant acts as manager and final reviewer.
- Worker SubAgents implement, test, self-review, and report.
- After every task, run spec compliance review first, then code quality review.
- Do not redesign product requirements or architecture.
- Do not revert unrelated user changes or run destructive git commands.
- Keep each worker write scope narrow and explicit.

## Context

- Project root: `D:\Users\30741\Desktop\程序开发\报警模拟器\Numens Fire Alarm Simulator`
- Source of product truth: `docs/superpowers/specs/2026-05-22-numens-fire-alarm-simulator-design.md`
- Execution checklist: `docs/superpowers/plans/2026-05-22-numens-fire-alarm-simulator-implementation.md`
- Current branch is `main`, ahead of `origin/main` by 2 commits.
- Worktree already contains many modified and untracked files, so changes must remain scoped.

## Risks

- Existing user changes may overlap with planned files, especially `package.json`.
- `npm install` may update `package-lock.json`; this is expected for Task 1 but must be reviewed.
- Typecheck may reveal pre-existing errors outside Task 1 scope; record evidence instead of hiding them.
- The SubAgent-driven skill normally asks for a separate worktree, but project instructions require transforming this checkout in place.

## Execution Plan

1. Bootstrap this goal directory before code edits.
2. Dispatch Task 1 worker with exact owned files.
3. Worker runs Task 1 verification and reports changed files, command output, notes, and risks.
4. Manager inspects resulting diff and verification evidence.
5. Dispatch spec compliance reviewer for Task 1.
6. If spec review requests changes, return to worker for scoped fixes and re-review.
7. Dispatch code quality reviewer only after spec approval.
8. If quality review requests changes, return to worker for scoped fixes and re-review.
9. Run manager verification for Task 1.
10. Update `goal-1/tasks.md` and report Task 1 status before moving to Task 2.

## Validation

Task 1 required commands:

```powershell
npm install
npm run test
npm run typecheck
```

Manager will also inspect:

```powershell
git status --short
git diff -- package.json package-lock.json src/renderer/src/domain/fire/types.ts src/renderer/src/domain/fire/simulation/types.ts src/renderer/src/domain/fire/__tests__/deviceIcons.test.ts
```

## Rollback Plan

- Do not use `git reset --hard` or `git checkout --`.
- If Task 1 introduces faulty changes, apply a targeted patch only to the Task 1 owned files.
- Preserve unrelated pre-existing edits.
