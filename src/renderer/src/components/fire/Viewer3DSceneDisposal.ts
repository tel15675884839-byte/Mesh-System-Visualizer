import * as THREE from 'three'

export function clearViewer3DScene(
  scene: THREE.Scene | null,
  radarRipples: unknown[],
  radarZones: unknown[]
): void {
  if (!scene) return

  radarRipples.length = 0
  radarZones.length = 0

  for (const object of [...scene.children]) {
    scene.remove(object)
    disposeObject(object)
  }
}

function disposeObject(object: THREE.Object3D): void {
  const mesh = object as THREE.Mesh
  mesh.geometry?.dispose()
  const material = mesh.material
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
  } else if (material) {
    disposeMaterial(material)
  }
}

function disposeMaterial(material: THREE.Material): void {
  const mapMaterial = material as THREE.Material & { map?: THREE.Texture }
  mapMaterial.map?.dispose()
  material.dispose()
}
