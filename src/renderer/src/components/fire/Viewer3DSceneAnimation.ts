import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SounderOutputPattern } from '../../domain/fire/simulationOutputMapping'
import {
  getViewer3DDeviceAnimationFrame,
  type Viewer3DDeviceOutputState
} from '../../domain/fire/viewer3DSimulationVisual'
import { shouldContinueViewer3DRender } from '../../domain/fire/viewer3DRenderPolicy'

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

interface RadarRipple {
  mesh: THREE.Mesh
  progress: number
  baseScale: number
  deviceSize: number
}

interface RadarZone {
  mesh: THREE.Mesh
  baseOpacity: number
}

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

export function createViewer3DSceneAnimation(dependencies: Viewer3DSceneAnimationDependencies): {
  animate: () => void
  cancelAnimation: () => void
  requestRender: () => void
} {
  let animationFrame = 0
  let lastTime = 0
  const {
    animatedDeviceObjects,
    radarRipples,
    radarZones,
    sounderRipples,
    getControls,
    getRenderer,
    getScene,
    getCamera
  } = dependencies

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

      if (object.isSounder && object.outputState === 'active') {
        object.spriteMaterial.rotation = Math.sin(elapsedMs * 0.04) * 0.08
      } else {
        object.spriteMaterial.rotation = 0
      }
    }
  }

  function updateRadarHighlightAnimations(time: number, deltaMs: number): void {
    radarRipples.forEach((ripple) => {
      ripple.progress += deltaMs / 1800
      if (ripple.progress > 1) ripple.progress = 0

      const scale = 0.5 + ripple.progress * 1.8
      ripple.mesh.scale.setScalar(scale)
      const mat = ripple.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.85 * (1.0 - ripple.progress)
    })

    radarZones.forEach((zone) => {
      const pulseOpacity = zone.baseOpacity * (1.0 + Math.sin(time * 0.004) * 0.3)
      const mat = zone.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = pulseOpacity
    })
  }

  function updateSounderRippleAnimations(deltaMs: number): void {
    sounderRipples.forEach((ripple) => {
      ripple.progress += deltaMs / 600
      if (ripple.progress > 1) ripple.progress = 0

      const easeOutProgress = 1.0 - Math.pow(1.0 - ripple.progress, 2)
      const scale = 0.8 + easeOutProgress * 2.7
      ripple.mesh.scale.setScalar(scale)

      const mat = ripple.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1.0 - easeOutProgress)
    })
  }

  function renderFrame(): void {
    animationFrame = 0
    const now = performance.now()
    const deltaMs = lastTime === 0 ? 0 : now - lastTime
    lastTime = now

    const controlsChanged = getControls()?.update() ?? false
    const animatedDeviceCount = animatedDeviceObjects.length

    if (animatedDeviceCount > 0) {
      updateDeviceAnimations(now)
      updateRadarHighlightAnimations(now, deltaMs)
      updateSounderRippleAnimations(deltaMs)
    }

    const renderer = getRenderer()
    const scene = getScene()
    const camera = getCamera()
    if (renderer && scene && camera) renderer.render(scene, camera)

    if (shouldContinueViewer3DRender({ controlsChanged, animatedDeviceCount })) {
      requestRender()
    } else {
      lastTime = 0
    }
  }

  function requestRender(): void {
    if (animationFrame !== 0) return
    animationFrame = requestAnimationFrame(renderFrame)
  }

  function animate(): void {
    requestRender()
  }

  function cancelAnimation(): void {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
    lastTime = 0
  }

  return { animate, cancelAnimation, requestRender }
}
