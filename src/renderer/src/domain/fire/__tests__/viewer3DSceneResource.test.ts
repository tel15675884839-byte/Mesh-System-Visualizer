import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { clearViewer3DScene } from '../../../components/fire/Viewer3DSceneDisposal'
import { shouldContinueViewer3DRender } from '../viewer3DRenderPolicy'

describe('viewer 3D scene resource policy', () => {
  it('keeps cached floor and icon textures alive when a scene rebuild clears objects', () => {
    const scene = new THREE.Scene()
    const texture = new THREE.Texture()
    texture.userData.preserveOnSceneClear = true
    texture.dispose = vi.fn()
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    scene.add(mesh)

    clearViewer3DScene(scene, [], [])

    expect(scene.children).toHaveLength(0)
    expect(texture.dispose).not.toHaveBeenCalled()
  })

  it('does not keep requesting animation frames when the scene is static', () => {
    expect(
      shouldContinueViewer3DRender({
        controlsChanged: false,
        animatedDeviceCount: 0,
        highlightAnimationCount: 0
      })
    ).toBe(false)
    expect(
      shouldContinueViewer3DRender({
        controlsChanged: true,
        animatedDeviceCount: 0,
        highlightAnimationCount: 0
      })
    ).toBe(true)
    expect(
      shouldContinueViewer3DRender({
        controlsChanged: false,
        animatedDeviceCount: 1,
        highlightAnimationCount: 0
      })
    ).toBe(true)
    expect(
      shouldContinueViewer3DRender({
        controlsChanged: false,
        animatedDeviceCount: 0,
        highlightAnimationCount: 1
      })
    ).toBe(true)
  })
})
