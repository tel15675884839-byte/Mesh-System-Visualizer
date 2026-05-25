import * as THREE from 'three'
import type { FireDevice } from '../../domain/fire/types'

interface Viewer3DSceneContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Viewer3DSceneInteractionDependencies {
  getRenderer: () => THREE.WebGLRenderer | null
  getCamera: () => THREE.PerspectiveCamera | null
  pickableDeviceObjects: THREE.Object3D[]
  hasActiveInput: (deviceId: string) => boolean
}

export function createViewer3DSceneInteraction(
  context: Viewer3DSceneContext,
  dependencies: Viewer3DSceneInteractionDependencies
): {
  handleRendererPointerDown: (event: PointerEvent) => void
  handleRendererClick: (event: MouseEvent) => void
  handleRendererDoubleClick: (event: MouseEvent) => void
  handleRendererContextMenu: (event: MouseEvent) => void
  closeContextMenu: () => void
} {
  const { store, simulationMode, deviceById, contextMenu } = context
  const { getRenderer, getCamera, pickableDeviceObjects, hasActiveInput } = dependencies
  let pointerDownPosition: { x: number; y: number } | null = null

  function handleRendererPointerDown(event: PointerEvent): void {
    pointerDownPosition = { x: event.clientX, y: event.clientY }
  }

  function handleRendererClick(event: MouseEvent): void {
    closeContextMenu()
    if (!pointerDownPosition) return

    const dragDistance = Math.hypot(
      event.clientX - pointerDownPosition.x,
      event.clientY - pointerDownPosition.y
    )
    pointerDownPosition = null
    if (dragDistance > 4) return

    store.selectDevice(pickDeviceIdFromEvent(event))
  }

  function handleRendererDoubleClick(event: MouseEvent): void {
    closeContextMenu()
    const deviceId = pickDeviceIdFromEvent(event)
    const device = deviceId ? (deviceById.value.get(deviceId) as FireDevice | undefined) : undefined
    if (!simulationMode.value || !device?.isInputCapable) return

    event.preventDefault()
    store.selectDevice(device.id)
    store.dispatchSimulationAction({
      type: hasActiveInput(device.id) ? 'restore-input' : 'activate-input',
      deviceId: device.id,
      at: Date.now()
    })
  }

  function handleRendererContextMenu(event: MouseEvent): void {
    event.preventDefault()
    const deviceId = pickDeviceIdFromEvent(event)
    if (!deviceId) {
      closeContextMenu()
      store.selectDevice(null)
      return
    }

    store.selectDevice(deviceId)
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      deviceId
    }
  }

  function pickDeviceIdFromEvent(event: MouseEvent): string | null {
    const renderer = getRenderer()
    const camera = getCamera()
    if (!renderer || !camera) return null

    const rect = renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)

    const hit = raycaster.intersectObjects(pickableDeviceObjects, false)[0]
    const deviceId = hit?.object.userData.deviceId
    return typeof deviceId === 'string' ? deviceId : null
  }

  function closeContextMenu(): void {
    contextMenu.value = { visible: false, x: 0, y: 0, deviceId: null }
  }

  return {
    handleRendererPointerDown,
    handleRendererClick,
    handleRendererDoubleClick,
    handleRendererContextMenu,
    closeContextMenu
  }
}
