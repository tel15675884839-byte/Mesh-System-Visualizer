import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('Planner2D configuration-only boundary', () => {
  it('does not reference runtime simulation state or actions', () => {
    const source = readFileSync(resolve('src/renderer/src/components/fire/Planner2D.ts'), 'utf8')

    for (const forbidden of [
      'simulationMode',
      'simulationState',
      'getDeviceSimulationOutputState',
      'activate-input',
      'restore-input',
      'trigger-fault',
      'restore-fault'
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  it('keeps simulation controls out of the app shell and the 2D workflow', () => {
    const appSource = readFileSync(resolve('src/renderer/src/App.vue'), 'utf8')
    const plannerTemplateSource = readFileSync(
      resolve('src/renderer/src/components/fire/Planner2D.template.html'),
      'utf8'
    )
    const viewerTemplateSource = readFileSync(
      resolve('src/renderer/src/components/fire/Viewer3D.template.html'),
      'utf8'
    )
    const viewerScriptSource = readFileSync(
      resolve('src/renderer/src/components/fire/Viewer3D.ts'),
      'utf8'
    )

    expect(appSource).not.toContain('SimulationPanel')
    expect(plannerTemplateSource).not.toContain('SimulationPanel')
    expect(viewerTemplateSource).not.toContain('SimulationPanel')
    expect(viewerTemplateSource).toContain('viewer-simulation-actions')
    expect(viewerScriptSource).toContain('shouldPlaySimulationAlarmAudio')
  })

  it('keeps loop wiring automatic and confirms zone drawings before saving', () => {
    const source = readFileSync(resolve('src/renderer/src/components/fire/Planner2D.ts'), 'utf8')

    expect(source).not.toContain('manualLoopWiring')
    expect(source).not.toContain('draftLoopOrder')
    expect(source).not.toContain('setManualLoopOrder')
    expect(source).toContain('pendingZoneArea')
    expect(source).toContain('confirmPendingZoneArea')
    expect(source).toContain('cancelPendingZoneArea')
  })
})
