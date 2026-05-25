import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SounderOutputPattern } from '../../domain/fire/simulationOutputMapping'
import {
  getViewer3DDeviceAnimationFrame,
  type Viewer3DDeviceOutputState
} from '../../domain/fire/viewer3DSimulationVisual'

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
  getControls: () => OrbitControls | null
  getRenderer: () => THREE.WebGLRenderer | null
  getScene: () => THREE.Scene | null
  getCamera: () => THREE.PerspectiveCamera | null
}

export function createViewer3DSceneAnimation(dependencies: Viewer3DSceneAnimationDependencies): {
  animate: () => void
  cancelAnimation: () => void
} {
  let animationFrame = 0
  let lastTime = 0
  const {
    animatedDeviceObjects,
    radarRipples,
    radarZones,
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
        isSounder: object.isSounder
      })

      object.sprite.scale.setScalar(frame.scale)
      object.spriteMaterial.color.set(frame.color ?? object.baseColor)
      object.spriteMaterial.opacity = object.baseOpacity * frame.opacity

      if (object.ringMaterial) {
        object.ringMaterial.color.set(frame.color ?? object.baseColor)
        object.ringMaterial.opacity = object.baseOpacity * frame.ringOpacity
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

  function animate(): void {
    animationFrame = requestAnimationFrame(animate)
    getControls()?.update()

    const now = performance.now()
    const deltaMs = lastTime === 0 ? 0 : now - lastTime
    lastTime = now

    updateDeviceAnimations(now)
    updateRadarHighlightAnimations(now, deltaMs)

    const renderer = getRenderer()
    const scene = getScene()
    const camera = getCamera()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }

  function cancelAnimation(): void {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
    lastTime = 0
  }

  return { animate, cancelAnimation }
}
