export interface Viewer3DRenderDemand {
  controlsChanged: boolean
  animatedDeviceCount: number
  highlightAnimationCount?: number
}

export function shouldContinueViewer3DRender({
  controlsChanged,
  animatedDeviceCount,
  highlightAnimationCount = 0
}: Viewer3DRenderDemand): boolean {
  return controlsChanged || animatedDeviceCount > 0 || highlightAnimationCount > 0
}
