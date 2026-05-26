# 3D Device Activation Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3D activation animations for detectors, sounders, and IO modules, recreating the visual feel of the 2D "Rapid Response" page in the 3D scene.

**Architecture:** Extend the current requestAnimationFrame rendering loop in `Viewer3DSceneAnimation.ts` to support wiggling, breathing, and radiating shockwaves. Pre-create the meshes for shockwaves inside `rebuildScene()` in `Viewer3DScene.ts` and update their properties (scale, rotation, opacity) dynamically inside the animation frame update functions.

**Tech Stack:** Vue, TypeScript, Three.js, Vitest.

---

## File Structure

- **Modified Files**:
  - `src/renderer/src/domain/fire/viewer3DSimulationVisual.ts` (Animation frame calculation for scaling and coloring)
  - `src/renderer/src/components/fire/Viewer3DSceneAnimation.ts` (Rotational wiggles for sounders, scaling and opacity fade for shockwaves)
  - `src/renderer/src/components/fire/Viewer3DScene.ts` (Instantiating shockwave meshes, setting flags for animations)
  - `src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts` (Unit tests for animations)

---

### Task 1: Extend domain interfaces and animation frame calculations

**Files:**
- Modify: `src/renderer/src/domain/fire/viewer3DSimulationVisual.ts`
- Test: `src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`

- [ ] **Step 1: Update type definitions in `viewer3DSimulationVisual.ts`**
  Modify `Viewer3DDeviceAnimationInput` interface:
  ```typescript
  export interface Viewer3DDeviceAnimationInput {
    baseSize: number
    elapsedMs: number
    outputState: Viewer3DDeviceOutputState
    isSounder: boolean
    sounderPattern?: SounderOutputPattern
    inputActive: boolean
    isIO: boolean
  }
  ```

- [ ] **Step 2: Write failing unit tests in `viewer3DSimulationVisual.test.ts`**
  Add test cases checking that input active and IO activation states produce correct breathing sizes, colors, and opacities.
  ```typescript
  it('breathes in scale and flashes red for active detector inputs', () => {
    const frame1 = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0, // Math.sin(0) = 0 -> scale = baseSize * 1.1
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: false
    })
    const frame2 = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 314, // Math.sin(314 * 0.005) = Math.sin(1.57) = 1 -> scale = baseSize * 1.2
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: false
    })

    expect(frame1.color).toBe('#dc2626')
    expect(frame1.scale).toBeCloseTo(11.0, 1)
    expect(frame2.scale).toBeCloseTo(12.0, 1)
  })

  it('handles IO module input and output active colors and scales', () => {
    const inputFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: null,
      isSounder: false,
      inputActive: true,
      isIO: true
    })
    const outputFrame = getViewer3DDeviceAnimationFrame({
      baseSize: 10,
      elapsedMs: 0,
      outputState: 'active',
      isSounder: false,
      inputActive: false,
      isIO: true
    })

    expect(inputFrame.color).toBe('#dc2626')
    expect(outputFrame.color).toBe('#2563eb')
  })
  ```

- [ ] **Step 3: Run unit tests to verify they fail**
  Run: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`
  Expected: FAIL with compilation/syntax errors or test failures.

- [ ] **Step 4: Implement the logic in `viewer3DSimulationVisual.ts`**
  Modify `getViewer3DDeviceAnimationFrame` to check `inputActive` and `isIO` conditions:
  ```typescript
  export function getViewer3DDeviceAnimationFrame({
    baseSize,
    elapsedMs,
    outputState,
    isSounder,
    sounderPattern,
    inputActive,
    isIO
  }: Viewer3DDeviceAnimationInput): Viewer3DDeviceAnimationFrame {
    // 1. IO Module logic
    if (isIO) {
      const wave = Math.sin(elapsedMs * 0.005)
      const scaleFactor = 1.0 + (wave + 1.0) * 0.1 // oscillates between 1.0 and 1.2
      const color = inputActive ? '#dc2626' : (outputState === 'active' ? '#2563eb' : null)
      return {
        color,
        opacity: 1,
        scale: baseSize * scaleFactor,
        ringOpacity: 0.55 + (wave + 1.0) * 0.17 // oscillates between 0.55 and 0.89
      }
    }

    // 2. Active Detector / Alarm Source (Input capable)
    if (inputActive && !isIO) {
      const wave = Math.sin(elapsedMs * 0.005)
      const scaleFactor = 1.0 + (wave + 1.0) * 0.1 // oscillates between 1.0 and 1.2
      return {
        color: '#dc2626',
        opacity: 1,
        scale: baseSize * scaleFactor,
        ringOpacity: 0.55 + (wave + 1.0) * 0.17 // oscillates between 0.55 and 0.89
      }
    }

    // 3. Existing output/sounder logic...
    if (outputState === 'active' && isSounder) {
      if (sounderPattern === 'continuous') {
        return {
          color: '#ef4444',
          opacity: 1,
          scale: baseSize * 1.08,
          ringOpacity: 0.85
        }
      }

      const flashOn = Math.floor(elapsedMs / 180) % 2 === 0
      const pulse = flashOn ? 1.12 : 1.06
      return {
        color: flashOn ? '#ef4444' : '#facc15',
        opacity: 1,
        scale: baseSize * pulse,
        ringOpacity: flashOn ? 0.9 : 0.65
      }
    }

    if (outputState === 'delayActive') {
      const pulse = Math.floor(elapsedMs / 700) % 2 === 0
      return {
        color: '#0ea5e9',
        opacity: pulse ? 0.9 : 0.55,
        scale: baseSize * (pulse ? 1.04 : 1),
        ringOpacity: pulse ? 0.6 : 0.28
      }
    }

    return {
      color: null,
      opacity: 1,
      scale: baseSize,
      ringOpacity: 0.85
    }
  }
  ```

- [ ] **Step 5: Run unit tests to verify they pass**
  Run: `npm run test -- src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  Run: `git add src/renderer/src/domain/fire/viewer3DSimulationVisual.ts src/renderer/src/domain/fire/__tests__/viewer3DSimulationVisual.test.ts`
  Run: `git commit -m "feat: implement breathing animation math and test cases"`

---

### Task 2: Implement Sounder Wiggle and Shockwave Ripple Logic in the Animation Loop

**Files:**
- Modify: `src/renderer/src/components/fire/Viewer3DSceneAnimation.ts`

- [ ] **Step 1: Modify `AnimatedDeviceObject` interface in `Viewer3DSceneAnimation.ts`**
  Modify interface at line 10:
  ```typescript
  interface AnimatedDeviceObject {
    sprite: THREE.Sprite
    spriteMaterial: THREE.SpriteMaterial
    ringMaterial: THREE.MeshBasicMaterial | null
    baseSize: number
    baseColor: THREE.ColorRepresentation
    baseOpacity: number
    outputState: Viewer3DDeviceOutputState
    sounderPattern?: SounderOutputPattern
    isSounder: boolean
    inputActive: boolean
    isIO: boolean
  }
  ```

- [ ] **Step 2: Add `sounderRipples` to `Viewer3DSceneAnimationDependencies`**
  Modify lines 34-42:
  ```typescript
  interface Viewer3DSceneAnimationDependencies {
    animatedDeviceObjects: AnimatedDeviceObject[]
    radarRipples: RadarRipple[]
    radarZones: RadarZone[]
    sounderRipples: RadarRipple[]
    getControls: () => OrbitControls | null
    getRenderer: () => THREE.WebGLRenderer | null
    getScene: () => THREE.Scene | null
    getCamera: () => THREE.PerspectiveCamera | null
  }
  ```

- [ ] **Step 3: Update `updateDeviceAnimations` to implement wiggle and pass new states**
  Modify `updateDeviceAnimations` in `Viewer3DSceneAnimation.ts`:
  ```typescript
  function updateDeviceAnimations(elapsedMs: number): void {
    for (const object of animatedDeviceObjects) {
      const frame = getViewer3DDeviceAnimationFrame({
        baseSize: object.baseSize,
        elapsedMs,
        outputState: object.outputState,
        sounderPattern: object.sounderPattern,
        isSounder: object.isSounder,
        inputActive: object.inputActive,
        isIO: object.isIO
      })

      object.sprite.scale.setScalar(frame.scale)
      object.spriteMaterial.color.set(frame.color ?? object.baseColor)
      object.spriteMaterial.opacity = object.baseOpacity * frame.opacity

      if (object.ringMaterial) {
        object.ringMaterial.color.set(frame.color ?? object.baseColor)
        object.ringMaterial.opacity = object.baseOpacity * frame.ringOpacity
      }

      // Add rotation wiggle for active sounders
      if (object.isSounder && object.outputState === 'active') {
        object.spriteMaterial.rotation = Math.sin(elapsedMs * 0.04) * 0.08
      } else {
        object.spriteMaterial.rotation = 0
      }
    }
  }
  ```

- [ ] **Step 4: Implement `updateSounderRippleAnimations` function**
  Add the shockwave update routine inside `createViewer3DSceneAnimation`:
  ```typescript
  function updateSounderRippleAnimations(deltaMs: number): void {
    sounderRipples.forEach((ripple) => {
      ripple.progress += deltaMs / 600 // 0.6 seconds duration
      if (ripple.progress > 1) ripple.progress = 0

      // Quadratic ease-out: 1 - (1 - x)^2
      const easeOutProgress = 1.0 - Math.pow(1.0 - ripple.progress, 2)

      // Scale from 0.8 to 3.5
      const scale = 0.8 + easeOutProgress * 2.7
      ripple.mesh.scale.setScalar(scale)

      // Opacity from 0.8 to 0
      const mat = ripple.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1.0 - easeOutProgress)
    })
  }
  ```

- [ ] **Step 5: Call `updateSounderRippleAnimations` in `renderFrame`**
  Modify `renderFrame` inside `Viewer3DSceneAnimation.ts`:
  ```typescript
  if (animatedDeviceCount > 0) {
    updateDeviceAnimations(now)
    updateRadarHighlightAnimations(now, deltaMs)
    updateSounderRippleAnimations(deltaMs)
  }
  ```

- [ ] **Step 6: Verify it compiles successfully**
  Run: `npm run build` or `npx tsc --noEmit` in the submodule.
  Expected: No TypeScript compilation errors.

- [ ] **Step 7: Commit**
  Run: `git add src/renderer/src/components/fire/Viewer3DSceneAnimation.ts`
  Run: `git commit -m "feat: implement wiggle rotation and shockwave animation loop"`

---

### Task 3: Scene Construction and Mesh Lifetime Management

**Files:**
- Modify: `src/renderer/src/components/fire/Viewer3DScene.ts`

- [ ] **Step 1: Update `AnimatedDeviceObject` interface in `Viewer3DScene.ts`**
  Modify interface at line 115:
  ```typescript
  interface AnimatedDeviceObject {
    sprite: THREE.Sprite
    spriteMaterial: THREE.SpriteMaterial
    ringMaterial: THREE.MeshBasicMaterial | null
    baseSize: number
    baseColor: THREE.ColorRepresentation
    baseOpacity: number
    outputState: Viewer3DDeviceOutputState
    sounderPattern?: SounderOutputPattern
    isSounder: boolean
    inputActive: boolean
    isIO: boolean
  }
  ```

- [ ] **Step 2: Declare `sounderRipples` and pass to the animation creator**
  Modify line 71 in `Viewer3DScene.ts`:
  ```typescript
  const radarRipples: RadarRipple[] = []
  const radarZones: RadarZone[] = []
  const sounderRipples: RadarRipple[] = []
  ```
  Pass `sounderRipples` to `createViewer3DSceneAnimation` dependencies (line 103):
  ```typescript
  const { animate, cancelAnimation, requestRender } = createViewer3DSceneAnimation({
    animatedDeviceObjects,
    radarRipples,
    radarZones,
    sounderRipples,
    getControls: () => controls,
    getRenderer: () => renderer,
    getScene: () => scene,
    getCamera: () => camera
  })
  ```

- [ ] **Step 3: Update `renderDevice` to push active inputs and IOs, and instantiate shockwaves**
  Modify lines 291-380 in `Viewer3DScene.ts`:
  - Identify input active: `const inputActive = hasActiveInput(device.id)`
  - Identify IO module: `const isIO = device.type === 'input_output' || device.type === 'wireless_input_output'`
  - Identify if device needs animation: `const shouldAnimate = inputActive || (outputState !== null && !isDelayedSounder)`
  - Modify animation insertion condition:
    ```typescript
    if (shouldAnimate) {
      animatedDeviceObjects.push({
        sprite,
        spriteMaterial: material,
        ringMaterial,
        baseSize: size,
        baseColor: deviceColor,
        baseOpacity: highlightAppearance.opacity * statusAppearance.iconOpacity,
        outputState: outputState?.state ?? null,
        sounderPattern: outputState?.sounderPattern,
        isSounder: device.isSounder,
        inputActive,
        isIO
      })
    }
    ```
  - Instantiate active sounder shockwaves:
    ```typescript
    if (device.isSounder && outputState?.state === 'active') {
      for (let i = 0; i < 3; i++) {
        const rippleMat = new THREE.MeshBasicMaterial({
          color: '#ef4444',
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        })
        const ripple = new THREE.Mesh(
          new THREE.RingGeometry(size * 0.45, size * 0.5, 32),
          rippleMat
        )
        ripple.position.copy(point)
        ripple.rotation.x = Math.PI / 2
        scene?.add(ripple)
        sounderRipples.push({
          mesh: ripple,
          progress: i / 3,
          baseScale: 1.0,
          deviceSize: size
        })
      }
    }
    ```

- [ ] **Step 4: Update scene disposal routine**
  Ensure sounder ripples are cleaned up inside `rebuildScene()` and `cleanupScene()`.
  In `rebuildScene()`:
  ```typescript
  clearViewer3DScene(scene, radarRipples, radarZones)
  // Also dispose and clear sounder ripples
  sounderRipples.forEach((ripple) => {
    ripple.mesh.geometry.dispose()
    if (Array.isArray(ripple.mesh.material)) {
      ripple.mesh.material.forEach((m) => m.dispose())
    } else {
      ripple.mesh.material.dispose()
    }
  })
  sounderRipples.length = 0
  ```
  In `cleanupScene()`:
  ```typescript
  clearViewer3DScene(scene, radarRipples, radarZones)
  sounderRipples.forEach((ripple) => {
    ripple.mesh.geometry.dispose()
    if (Array.isArray(ripple.mesh.material)) {
      ripple.mesh.material.forEach((m) => m.dispose())
    } else {
      ripple.mesh.material.dispose()
    }
  })
  sounderRipples.length = 0
  ```

- [ ] **Step 5: Verify building and check for regressions**
  Run: `npm run build`
  Expected: Successful production build without TypeScript/bundling issues.

- [ ] **Step 6: Commit**
  Run: `git add src/renderer/src/components/fire/Viewer3DScene.ts`
  Run: `git commit -m "feat: instantiate sounder shockwaves and wire up active device states"`
