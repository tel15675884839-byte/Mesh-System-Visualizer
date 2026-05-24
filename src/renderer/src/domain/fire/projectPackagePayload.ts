import type {
  FireAsset,
  FireDevice,
  FireIssue,
  FireProject,
  NonAddressableSounderPoint
} from './types'

export interface FireProjectDocumentPayload extends FireProject {
  devices: FireDevice[]
  issues: FireIssue[]
  nonAddressableSounderPoints: NonAddressableSounderPoint[]
}

interface FireProjectDocumentLike extends FireProject {
  devices: FireDevice[]
  issues: FireIssue[]
  nonAddressableSounderPoints: NonAddressableSounderPoint[]
}

export interface FireProjectSavePayload {
  metadata: {
    schemaVersion: 1
    appName: 'Numens Fire Alarm Simulator'
    exportedAt: string
    language: FireProject['language']
  }
  project: FireProjectDocumentPayload
  assetPaths: Array<{ packagePath: string; sourcePath: string }>
  suggestedFileName: string
}

export function createFireProjectSavePayload(
  project: FireProjectDocumentLike,
  exportedAt = new Date()
): FireProjectSavePayload {
  const snapshot = clonePlain(project) as FireProjectDocumentPayload

  return {
    metadata: {
      schemaVersion: 1,
      appName: 'Numens Fire Alarm Simulator',
      exportedAt: exportedAt.toISOString(),
      language: snapshot.language
    },
    project: snapshot,
    assetPaths: snapshot.assets.flatMap((asset: FireAsset) =>
      asset.runtimePath ? [{ packagePath: asset.packagePath, sourcePath: asset.runtimePath }] : []
    ),
    suggestedFileName: `${snapshot.name || 'fire-project'}.fireproj`
  }
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
