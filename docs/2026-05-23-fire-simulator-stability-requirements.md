# Fire Simulator Stability Requirements Update

Date: 2026-05-23

## Purpose

This document records the confirmed stability and usability requirements discovered after the initial Numens Fire Alarm Simulator implementation. It updates the next work queue for the active Fire Alarm Simulator shell. It does not restore old Mesh, RSSI, Leader, Router, or HTML topology product features.

## Confirmed Requirements

### 2D Planner

- Device connection lines on the 2D planner must be based only on Loop wiring.
- Zone and Group data must not drive 2D device connection lines.
- Loop line order must come from the effective Loop order: manual Loop order when present, otherwise CPD configured device order.
- While dragging a device, the UI should visually update only the Loop segments adjacent to the dragged device.
- Drag movement must remain preview-only until mouse release. The store should receive one final position update after the drag completes.
- Selecting a device must not render an outer circle or ring. Selection should use icon-only highlighting, such as brightness or a subtle shadow.
- The 2D toolbar should be reorganized into clean functional groups:
  - Floor and drawing controls.
  - Zone tools.
  - Loop tools.
  - View controls.
- Toolbar action buttons should use SVG/icon buttons with hover tooltips instead of long visible text where possible.
- Selects, sliders, and other controls that need visible values may remain visible, but should not collide or compress.

### 3D Viewer

- 3D floor planes must display the same imported drawing asset used by the 2D floor.
- Re-importing or replacing a 2D drawing should automatically affect the related 3D floor plane.
- 3D floor drawing scale should match the floor map dimensions used by 2D.
- The black floor-map rendering issue must be fixed by correctly loading/rendering the imported map texture.
- Floor spacing must be increased so multiple floors are visually distinguishable.
- 3D device size must be controlled by the same global 2D device icon scale setting. There should not be a separate 3D icon-size control.
- 3D device markers should remain visible but should not dominate the floor drawing.
- The visible bottom reference grid should be hidden.
- Internal coordinate, scaling, or placement calculations may continue to use the same underlying reference logic; only the visual grid should be removed or hidden.

### Simulation

- Simulation behavior must be audited as a full chain:
  - User triggers an input device.
  - The simulation engine receives the action.
  - The cause/effect resolver calculates outputs from parsed CPD configuration.
  - Output state updates reach sounders, sounder groups, I/O groups, non-addressable outputs, and UI views.
  - 2D, 3D, panels, and audio feedback reflect the state.
- Simulation output calculation must use the parsed `.cpd` configuration, including current support for:
  - Zone triggers.
  - Sounder Group configuration.
  - I/O Group configuration.
  - Delay behavior.
  - Disabled and inhibited devices or outputs.
- Do not add speculative support for CPD fields that are not parsed yet. If an already parsed field is not connected to simulation behavior, treat that as a bug.
- Triggered sounders must have visible UI animation and audible sound feedback.
- Animation states should be visually distinct:
  - Input alarm: red flashing or pulsing.
  - Active sounder: strong flashing visual state.
  - Active I/O output: visually distinct from input alarm and sounder output.
  - Delayed output: slower or pending-style animation.
  - Fault: amber warning animation.
  - Disabled or inhibited: muted/greyed state that is not overridden by normal active animations.
- Exact animation styling can be tuned later; the first fix should prioritize correctness and clarity.

### Device Tree

- The Device Tree header controls should be redesigned to prevent squeezing and collisions.
- Header controls should primarily use icons with hover tooltips rather than long visible labels.
- Zone grouping must not show `Zone 0`.
- Sounder Group grouping must not show `Sounder Group 0`.
- I/O Group grouping must not show `I/O Group 0`.
- Group value `0`, empty, missing, or unparseable means "not assigned to a real group".
- Unassigned devices must not appear under the corresponding Zone, Sounder Group, or I/O Group grouped views.
- Sounders and pure output devices must not be grouped under Zone, because sounders cannot be assigned to Zone.
- Devices with both input and output capability may appear in Zone grouping only when they have a valid non-zero Zone assignment.
- I/O Group extraction from CPD must be rechecked. If real I/O groups are being parsed as `0` or missing, fix the CPD adapter or related mapping.

## Non-Goals

- Do not restore old Mesh Studio product behavior.
- Do not reintroduce RSSI, Leader, Router, or HTML topology features into the active Fire Alarm Simulator UI.
- Do not add multi-select or bulk move to the 2D planner in this pass.
- Do not create a separate 3D device-size setting; use the existing global 2D icon scale.
- Do not show unassigned group buckets for Zone, Sounder Group, or I/O Group.

## Recommended Task Order

1. Verify CPD group parsing semantics before changing Device Tree behavior.
2. Fix Device Tree group filtering, then its header layout.
3. Confirm 2D Loop-only line sources before changing drag preview rendering.
4. Fix 2D drag-line preview, selection highlight, and toolbar layout as separate tasks.
5. Fix 3D floor map texture rendering before changing spacing, scale, and grid visibility.
6. Audit Simulation input-to-output logic before adding visual or audio feedback.
7. Add Simulation visual states before audio feedback.
8. Run a cross-module runtime review after all focused tasks pass.
9. Run final logic, code, build, and UI validation after all stability tasks are complete.

## Verification Guidance

- Prefer focused tests before behavior changes.
- Use targeted Vitest files for domain/store logic.
- Each task must pass its listed verification before the next task starts.
- Use runtime/manual checks for Device Tree, 2D, 3D, and audio behavior when the task changes visible or audible behavior.
- Record exact commands, results, and manual findings in `goal-1/tasks.md` completion notes.
- Run full validation only after all stability tasks are complete, per the updated user request:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- After full validation, perform one final UI review for Device Tree, 2D, 3D, and Simulation layout/behavior.
