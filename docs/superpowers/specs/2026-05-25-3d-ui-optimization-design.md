# Spec: 3D Configuration UI Layout Optimization

## Overview

This specification details the layout and interaction adjustments for the 3D Viewer interface in the Fire Alarm Simulator. The objective is to maximize viewport space, harmonize elements with the existing 2D design, and implement premium micro-animations.

---

## Design Requirements

### 1. Centered Highlight & Floor Spacing Toolbar

- **Position**: Floating top-center of the 3D viewport.
- **Structure**:
  - Left section: Highlight buttons (`none`, `loop`, `zone`, `sounderGroup`, `ioGroup`) and Target Picker selector.
  - Right section: Horizontal **Floor Spacing** slider.
  - Sections are separated by a vertical divider line.
- **Aesthetics**: Glassmorphic dark styling (`rgba(15, 23, 42, 0.85)` background, `blur(12px)` backdrop filter, thin white border).

### 2. Left Panel: Compact Floor Visibility (Style 1 Refinement)

- **Position**: Left edge of the 3D viewport, aligned with the 2D sidebar wrapper.
- **Width**: Default compact width of `56px` expanding to `172px` on hover.
- **Aesthetics**: Frosted glass panel matching the 2D sidebar styling (`background: rgba(255, 255, 255, 0.72)`, `backdrop-filter: blur(16px)`).
- **Floor Buttons**: Circle buttons matching 2D style (`floor-btn`):
  - Active/Visible state: Apple-blue (`#0071e3`) with white text.
  - Inactive/Hidden state: White background, dark text, light grey border.
- **Hover Stretch Interaction**:
  - Hovering a floor button expands its width from `32px` to `150px` smoothly (`transition: width 0.35s`).
  - Reveals an inline horizontal slider (`<input type="range">`) to adjust opacity and a percentage display (`0% - 100%`).
  - Keeping the slider inside the expanded button eliminates the bug where the hover state collapses when the user moves the cursor to drag the slider.

---

## File Changes

### [Viewer3D.template.html](file:///d:/Users/30741/Desktop/程序开发/报警模拟器/Numens Fire Alarm Simulator/src/renderer/src/components/fire/Viewer3D.template.html)

- Combine the Highlight panel and Floor Spacing vertical slider into a single top-center toolbar.
- Remove the "Drawing Control" (`DrawingControl`) section header from the left panel.
- Update the floor list elements inside the left drawings panel to use the inline stretching structure.

### [Viewer3D.css](file:///d:/Users/30741/Desktop/程序开发/报警模拟器/Numens Fire Alarm Simulator/src/renderer/src/components/fire/Viewer3D.css)

- Re-style `.viewer-highlight-panel` as a top-centered horizontal toolbar.
- Update `.viewer-drawings-panel` to match the compact `56px` base width.
- Add the CSS rules and transitions for the stretching `.floor-btn` elements and the inline sliders.

---

## Verification Plan

- **Manual Verification**:
  - Verify Highlight toolbar floats and centers correctly at the top.
  - Verify the horizontal Floor Spacing slider adjusts building layout spacing in real-time.
  - Verify left drawing panel displays circular buttons for floors.
  - Verify hovering over floor circular buttons expands them smoothly to reveal the opacity slider.
  - Verify sliding the opacity slider and clicking floor buttons successfully alters the 3D building visual opacity and visibility.
