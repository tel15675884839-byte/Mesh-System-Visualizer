import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { FireBuilding, FireDevice, FireLoop, FirePanel } from '../../domain/fire/types'
import { buildLoopSegments } from '../../domain/fire/loopWiring'
import { getDeviceIconByType } from '../../domain/fire/deviceIcons'
import { DEFAULT_FLOOR_HEIGHT_3D } from '../../domain/fire/viewer3DGeometry'
import type { SounderOutputPattern } from '../../domain/fire/simulationOutputMapping'
import {
  getViewer3DDeviceHighlightAppearance,
  isZoneHighlighted
} from '../../domain/fire/viewer3DHighlight'
import {
  getSelectedDeviceBracketPoints,
  type Viewer3DDeviceOutputState
} from '../../domain/fire/viewer3DSimulationVisual'
import {
  getDeviceStatusAppearance,
  type DeviceStatusAppearance
} from '../../domain/fire/deviceVisualState'
import { getFireAssetHref } from '../../domain/fire/projectAssets'
import { getViewer3DMapOpacity } from '../../domain/fire/viewer3DViewState'
import { resolveViewer3DZoneAreas } from '../../domain/fire/viewer3DZoneArea'
import { createViewer3DSceneAnimation } from './Viewer3DSceneAnimation'
import { createViewer3DSceneCalculations } from './Viewer3DSceneCalculations'
import { clearViewer3DScene } from './Viewer3DSceneDisposal'
import { createViewer3DSceneInteraction } from './Viewer3DSceneInteraction'

interface Viewer3DSceneContext {
  // Shared composition context from Viewer3D.ts; narrow scene helpers consume selected keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function createViewer3DScene(context: Viewer3DSceneContext): {
  initScene: () => void
  cleanupScene: () => void
  rebuildScene: () => void
  focusSelectedZone: () => void
  handleRendererPointerDown: (event: PointerEvent) => void
  handleRendererClick: (event: MouseEvent) => void
  handleRendererDoubleClick: (event: MouseEvent) => void
  handleRendererContextMenu: (event: MouseEvent) => void
  closeContextMenu: () => void
  animate: () => void
} {
  const {
    project,
    selectedDeviceId,
    containerRef,
    hiddenBuildingIds,
    hiddenFloorIds,
    highlightKind,
    highlightTargetId,
    highlightSelection
  } = context
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let resizeObserver: ResizeObserver | null = null
  const pickableDeviceObjects: THREE.Object3D[] = []
  const animatedDeviceObjects: AnimatedDeviceObject[] = []

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
  const radarRipples: RadarRipple[] = []
  const radarZones: RadarZone[] = []
  const sounderRipples: RadarRipple[] = []
  let selectedBracketsMesh: THREE.LineSegments | null = null

  const PLAN_SCALE = 0.08
  const DEFAULT_FLOOR_WIDTH = 1200
  const DEFAULT_FLOOR_DEPTH = 800
  const DEFAULT_FLOOR_HEIGHT = DEFAULT_FLOOR_HEIGHT_3D
  const {
    getDevicePoint,
    getRenderedDeviceWorldSize,
    getFloorOrigin,
    getDeviceColor,
    getSelectedZoneBounds,
    hasActiveInput,
    getDeviceOutputState
  } = createViewer3DSceneCalculations(context, {
    planScale: PLAN_SCALE,
    defaultFloorHeight: DEFAULT_FLOOR_HEIGHT
  })
  const {
    handleRendererPointerDown,
    handleRendererClick,
    handleRendererDoubleClick,
    handleRendererContextMenu,
    closeContextMenu
  } = createViewer3DSceneInteraction(context, {
    getRenderer: () => renderer,
    getCamera: () => camera,
    pickableDeviceObjects,
    hasActiveInput
  })
  const { animate, cancelAnimation, requestRender } = createViewer3DSceneAnimation({
    animatedDeviceObjects,
    radarRipples,
    radarZones,
    sounderRipples,
    getControls: () => controls,
    getRenderer: () => renderer,
    getScene: () => scene,
    getCamera: () => camera,
    getSelectedBracketsMesh: () => selectedBracketsMesh
  })
  const textureLoader = new THREE.TextureLoader()
  const textureCache = new Map<string, THREE.Texture>()

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

  function initScene(): void {
    const container = containerRef.value
    if (!container) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color('#eef2f7')

    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 10000)
    camera.position.set(120, 140, 170)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.domElement.addEventListener('pointerdown', handleRendererPointerDown)
    renderer.domElement.addEventListener('click', handleRendererClick)
    renderer.domElement.addEventListener('dblclick', handleRendererDoubleClick)
    renderer.domElement.addEventListener('contextmenu', handleRendererContextMenu)
    container.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(45, 20, 35)
    controls.addEventListener('change', requestRender)

    resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(container)
    resizeRenderer()
  }

  function rebuildScene(): void {
    if (!scene) return
    disposeSelectedBracketsMesh()
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
    pickableDeviceObjects.length = 0
    animatedDeviceObjects.length = 0

    scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 2.2))
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.4)
    keyLight.position.set(90, 150, 80)
    keyLight.castShadow = true
    scene.add(keyLight)

    const deviceObjects = new Map<string, THREE.Vector3>()

    project.value.buildings.forEach((building, buildingIndex) => {
      renderBuilding(building, buildingIndex)
    })

    for (const device of project.value.devices) {
      const point = getDevicePoint(device)
      if (!point) continue
      deviceObjects.set(device.id, point)
      renderDevice(device, point)
    }

    for (const network of project.value.networks) {
      for (const panel of network.panels) {
        for (const loop of panel.loops) {
          renderLoop(loop, deviceObjects)
        }
        for (const zone of panel.zones) {
          const areas = resolveViewer3DZoneAreas({
            zone,
            devices: project.value.devices,
            includeTemporary: isZoneHighlighted(highlightSelection.value, panel, zone.zoneNumber)
          })

          for (const area of areas) {
            if (
              hiddenBuildingIds.value.has(area.buildingId) ||
              hiddenFloorIds.value.has(area.floorId)
            ) {
              continue
            }

            renderZoneArea(
              panel,
              area.zoneNumber,
              area.buildingId,
              area.floorId,
              area.points,
              area.color,
              area.opacity
            )
          }
        }
      }
    }

    requestRender()
  }

  function renderBuilding(building: FireBuilding, buildingIndex: number): void {
    if (hiddenBuildingIds.value.has(building.id)) return
    for (const floor of building.floors) {
      if (hiddenFloorIds.value.has(floor.id)) {
        continue
      }

      const origin = getFloorOrigin(building, buildingIndex, floor)
      const width = (floor.mapWidth ?? DEFAULT_FLOOR_WIDTH) * PLAN_SCALE
      const depth = (floor.mapHeight ?? DEFAULT_FLOOR_DEPTH) * PLAN_SCALE
      const geometry = new THREE.PlaneGeometry(width, depth)
      const floorOpacity = getViewer3DMapOpacity(
        project.value.viewSettings.mapOpacity3D ?? 1,
        floor.mapOpacity3D
      )
      const material = new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        roughness: 0.72,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: floorOpacity < 1,
        opacity: floorOpacity,
        depthWrite: floorOpacity >= 1
      })
      const asset = floor.mapAssetId
        ? project.value.assets.find((candidate) => candidate.id === floor.mapAssetId)
        : undefined

      const assetHref = getFireAssetHref(asset)
      if (assetHref) {
        material.map = getCachedTexture(assetHref, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
        })
        material.map.colorSpace = THREE.SRGBColorSpace
        material.color = new THREE.Color('#ffffff')
        material.transparent = floorOpacity < 1
        material.opacity = floorOpacity
        material.depthWrite = floorOpacity >= 1
        material.needsUpdate = true
      }

      const floorMesh = new THREE.Mesh(geometry, material)
      floorMesh.rotation.x = -Math.PI / 2
      floorMesh.position.set(origin.x + width / 2, origin.y, origin.z + depth / 2)
      floorMesh.receiveShadow = true
      scene?.add(floorMesh)

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: '#64748b',
          transparent: floorOpacity < 1,
          opacity: Math.max(0.24, floorOpacity)
        })
      )
      edge.rotation.x = -Math.PI / 2
      edge.position.copy(floorMesh.position)
      scene?.add(edge)
    }
  }

  function renderDevice(device: FireDevice, point: THREE.Vector3): void {
    const texture = getCachedTexture(`/icons/${getDeviceIconByType(device.type)}`, (next) => {
      next.colorSpace = THREE.SRGBColorSpace
      next.generateMipmaps = false
      next.minFilter = THREE.LinearFilter
      next.magFilter = THREE.LinearFilter
    })
    const highlightAppearance = getViewer3DDeviceHighlightAppearance(
      project.value,
      highlightSelection.value,
      device
    )
    const highlighted = highlightAppearance.highlighted
    const outputState = getDeviceOutputState(device)
    const isDelayedOutput = outputState?.state === 'delayActive'
    const statusAppearance = getDeviceStatusAppearance(device)
    const deviceColor = getDeviceColor(device)
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: deviceColor,
      transparent: true,
      alphaTest: 0.05,
      opacity: highlightAppearance.opacity * statusAppearance.iconOpacity,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    })
    const sprite = new THREE.Sprite(material)
    const size = getRenderedDeviceWorldSize(device)
    sprite.position.copy(point)
    sprite.scale.set(size, size, size)
    sprite.userData.deviceId = device.id
    pickableDeviceObjects.push(sprite)
    scene?.add(sprite)

    const isSelected = device.id === selectedDeviceId.value
    const inputActive = hasActiveInput(device.id)
    const isIO = device.type === 'input_output' || device.type === 'wireless_input_output'
    const outputActive = outputState?.state === 'active'

    if (statusAppearance.state !== 'normal') {
      renderDeviceStatusMarker(point, size, statusAppearance, highlightAppearance.opacity)
    }

    if (isSelected) {
      renderSelectedBrackets(point, size)
    }

    if (highlighted && !isSelected) {
      for (let i = 0; i < 3; i++) {
        const rippleMat = new THREE.MeshBasicMaterial({
          color: '#52c41a',
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        })
        const ripple = new THREE.Mesh(
          new THREE.RingGeometry(size * 0.55, size * 0.6, 32),
          rippleMat
        )
        ripple.position.copy(point)
        ripple.rotation.x = Math.PI / 2
        scene?.add(ripple)
        radarRipples.push({
          mesh: ripple,
          progress: i / 3,
          baseScale: 1.0,
          deviceSize: size
        })
      }
    }

    if (isDelayedOutput) {
      renderDelayCountdownLabel(point, size, outputState?.remainingDelaySeconds)
    }

    const shouldAnimate = outputState?.state === 'active'

    if (shouldAnimate) {
      animatedDeviceObjects.push({
        sprite,
        spriteMaterial: material,
        ringMaterial: null,
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

    const showRipples = (device.isSounder && outputActive) || (isIO && outputActive)
    if (showRipples) {
      const rippleColor = isIO && !inputActive ? '#2563eb' : '#ef4444'
      for (let i = 0; i < 3; i++) {
        const rippleMat = new THREE.MeshBasicMaterial({
          color: rippleColor,
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
  }

  function renderDelayCountdownLabel(
    point: THREE.Vector3,
    size: number,
    remainingDelaySeconds?: number
  ): void {
    const seconds = Math.max(0, Math.ceil(remainingDelaySeconds ?? 0))
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 52
    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = 'rgba(15, 23, 42, 0.86)'
    context.beginPath()
    context.moveTo(12, 4)
    context.lineTo(116, 4)
    context.quadraticCurveTo(124, 4, 124, 12)
    context.lineTo(124, 40)
    context.quadraticCurveTo(124, 48, 116, 48)
    context.lineTo(12, 48)
    context.quadraticCurveTo(4, 48, 4, 40)
    context.lineTo(4, 12)
    context.quadraticCurveTo(4, 4, 12, 4)
    context.closePath()
    context.fill()

    context.fillStyle = '#ffffff'
    context.font = '800 24px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(`${seconds}s`, 64, 26)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.copy(point)
    sprite.position.y += Math.max(size * 0.95, 3)
    sprite.scale.set(Math.max(size * 1.45, 7), Math.max(size * 0.58, 2.7), 1)
    sprite.renderOrder = 20
    scene?.add(sprite)
  }

  function renderDeviceStatusMarker(
    point: THREE.Vector3,
    size: number,
    appearance: DeviceStatusAppearance,
    baseOpacity: number
  ): void {
    const material = new THREE.MeshBasicMaterial({
      color: appearance.color,
      transparent: true,
      opacity: Math.max(0.34, baseOpacity * 0.9),
      depthWrite: false
    })
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.72, Math.max(0.04, size * 0.045), 8, 36),
      material
    )
    ring.position.copy(point)
    ring.position.y += Math.max(0.04, size * 0.04)
    ring.rotation.x = Math.PI / 2
    scene?.add(ring)
  }

  function renderSelectedBrackets(point: THREE.Vector3, size: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      getSelectedDeviceBracketPoints(size).map((next) => new THREE.Vector3(next.x, next.y, next.z))
    )
    const material = new THREE.LineBasicMaterial({
      color: '#00ff66',
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    })
    const mesh = new THREE.LineSegments(geometry, material)
    mesh.position.copy(point)
    mesh.position.y += 0.05
    mesh.renderOrder = 25
    scene?.add(mesh)
    selectedBracketsMesh = mesh
  }

  function disposeSelectedBracketsMesh(): void {
    if (!selectedBracketsMesh) return

    scene?.remove(selectedBracketsMesh)
    selectedBracketsMesh.geometry.dispose()
    const material = selectedBracketsMesh.material
    if (Array.isArray(material)) {
      material.forEach((next) => next.dispose())
    } else {
      material.dispose()
    }
    selectedBracketsMesh = null
  }

  function renderLoop(loop: FireLoop, deviceObjects: Map<string, THREE.Vector3>): void {
    const result = buildLoopSegments(loop, project.value.devices)
    const points = result.segments.flatMap((segment) => {
      const from = deviceObjects.get(segment.fromDeviceId)
      const to = deviceObjects.get(segment.toDeviceId)
      return from && to ? [from, to] : []
    })

    if (points.length === 0) return

    const loopHighlightActive = highlightKind.value === 'loop' && Boolean(highlightTargetId.value)
    const highlighted = loopHighlightActive && highlightTargetId.value === loop.id
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: highlighted ? '#00ff66' : loop.color,
      linewidth: highlighted ? 4 : 2,
      transparent: loopHighlightActive && !highlighted,
      opacity: loopHighlightActive && !highlighted ? 0.18 : 1
    })
    scene?.add(new THREE.LineSegments(geometry, material))
  }

  function renderZoneArea(
    panel: FirePanel,
    zoneNumber: number,
    buildingId: string,
    floorId: string,
    points: Array<{ x: number; y: number }>,
    color: string,
    opacity: number
  ): void {
    const buildingIndex = project.value.buildings.findIndex(
      (building) => building.id === buildingId
    )
    const building = project.value.buildings[buildingIndex]
    const floor = building?.floors.find((candidate) => candidate.id === floorId)
    if (!building || !floor || points.length < 3) return

    const origin = getFloorOrigin(building, Math.max(0, buildingIndex), floor)
    const shape = new THREE.Shape(
      points.map((point) => new THREE.Vector2(point.x * PLAN_SCALE, point.y * PLAN_SCALE))
    )
    const zoneHighlightActive = highlightKind.value === 'zone' && Boolean(highlightTargetId.value)
    const highlighted = isZoneHighlighted(highlightSelection.value, panel, zoneNumber)
    const effectiveOpacity = zoneHighlightActive
      ? highlighted
        ? 0.42
        : 0.04
      : Math.min(0.42, Math.max(0.08, opacity))
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        color: highlighted ? '#00ff66' : color,
        transparent: true,
        opacity: effectiveOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(origin.x, origin.y + 0.12, origin.z)
    scene?.add(mesh)

    if (highlighted) {
      radarZones.push({ mesh, baseOpacity: effectiveOpacity })
    }
  }

  function focusSelectedZone(): void {
    if (!camera || !controls || highlightKind.value !== 'zone' || !highlightTargetId.value) {
      return
    }

    const bounds = getSelectedZoneBounds()
    if (!bounds || bounds.isEmpty()) {
      return
    }

    const sphere = bounds.getBoundingSphere(new THREE.Sphere())
    const radius = Math.max(sphere.radius, 14)
    const target = sphere.center
    const direction = camera.position.clone().sub(controls.target)
    if (direction.lengthSq() < 0.001) {
      direction.set(1, 1.1, 1)
    }
    direction.normalize()

    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const fitDistance = radius / Math.sin(verticalFov / 2)
    camera.position.copy(target.clone().add(direction.multiplyScalar(fitDistance * 1.15)))
    camera.near = Math.max(0.1, fitDistance / 100)
    camera.far = Math.max(10000, fitDistance * 100)
    camera.updateProjectionMatrix()
    controls.target.copy(target)
    controls.update()
    requestRender()
  }

  function resizeRenderer(): void {
    const container = containerRef.value
    if (!container || !renderer || !camera) return

    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    requestRender()
  }

  function cleanupScene(): void {
    cancelAnimation()
    resizeObserver?.disconnect()
    controls?.removeEventListener('change', requestRender)
    controls?.dispose()
    renderer?.domElement.removeEventListener('pointerdown', handleRendererPointerDown)
    renderer?.domElement.removeEventListener('click', handleRendererClick)
    renderer?.domElement.removeEventListener('dblclick', handleRendererDoubleClick)
    renderer?.domElement.removeEventListener('contextmenu', handleRendererContextMenu)
    renderer?.dispose()
    disposeSelectedBracketsMesh()
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
    disposeTextureCache()
  }

  function getCachedTexture(
    href: string,
    configure: (texture: THREE.Texture) => void
  ): THREE.Texture {
    const cached = textureCache.get(href)
    if (cached) {
      return cached
    }

    const texture = textureLoader.load(href, requestRender, undefined, requestRender)
    texture.userData.preserveOnSceneClear = true
    configure(texture)
    textureCache.set(href, texture)
    return texture
  }

  function disposeTextureCache(): void {
    for (const texture of textureCache.values()) {
      texture.userData.preserveOnSceneClear = false
      texture.dispose()
    }
    textureCache.clear()
  }
  return {
    initScene,
    cleanupScene,
    rebuildScene,
    focusSelectedZone,
    handleRendererPointerDown,
    handleRendererClick,
    handleRendererDoubleClick,
    handleRendererContextMenu,
    closeContextMenu,
    animate
  }
}
