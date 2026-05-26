import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('phase-one workspace layout', () => {
  const appSource = readFileSync(resolve('src/renderer/src/App.vue'), 'utf8')
  const viewerTemplateSource = readFileSync(
    resolve('src/renderer/src/components/fire/Viewer3D.template.html'),
    'utf8'
  )
  const viewerScriptSource = readFileSync(
    resolve('src/renderer/src/components/fire/Viewer3D.ts'),
    'utf8'
  )
  const viewerStyleSource = readFileSync(
    resolve('src/renderer/src/components/fire/Viewer3D.css'),
    'utf8'
  )
  const viewerSceneSource = readFileSync(
    resolve('src/renderer/src/components/fire/Viewer3DScene.ts'),
    'utf8'
  )
  const viewerSceneInteractionSource = readFileSync(
    resolve('src/renderer/src/components/fire/Viewer3DSceneInteraction.ts'),
    'utf8'
  )
  const contextMenuSource = readFileSync(
    resolve('src/renderer/src/components/fire/DeviceContextMenu.vue'),
    'utf8'
  )

  it('removes the app-level right panel and standalone simulation view', () => {
    expect(appSource).toContain("type ViewMode = 'cpd' | '2d' | '3d'")
    expect(appSource).not.toContain("'simulation'")
    expect(appSource).not.toContain('RightPanelTab')
    expect(appSource).not.toContain('isRightPanelOpen')
    expect(appSource).not.toContain('rightPanelTab')
    expect(appSource).not.toContain('PropertyPanel')
    expect(appSource).not.toContain('GroupInspector')
    expect(appSource).not.toContain('<SimulationPanel v-else-if="viewMode === \'simulation\'"')
    expect(appSource).not.toContain('<el-tab-pane')
    expect(appSource).not.toContain('right-pane')
    expect(appSource).not.toContain('panel-toggle')
  })

  it('places compact simulation buttons inside the 3D view', () => {
    expect(viewerScriptSource).not.toContain("import SimulationPanel from './SimulationPanel.vue'")
    expect(viewerTemplateSource).not.toContain('<SimulationPanel')
    expect(viewerStyleSource).not.toContain('.viewer-simulation-panel')
    expect(viewerTemplateSource).toContain('viewer-simulation-actions')
    expect(viewerTemplateSource).toContain('toggleSounders')
    expect(viewerTemplateSource).toContain("dispatchSimulation('buzzer-silence')")
    expect(viewerTemplateSource).toContain("dispatchSimulation('system-reset')")
    expect(viewerScriptSource).toContain('store.enterSimulationMode()')
  })

  it('uses panel bottom SVG assets for 3D simulation buttons', () => {
    expect(viewerTemplateSource).toContain('/panel bottom/sounders active_silence.svg')
    expect(viewerTemplateSource).toContain('/panel bottom/buzzer silence.svg')
    expect(viewerTemplateSource).toContain('/panel bottom/system reset.svg')
    expect(viewerTemplateSource).toContain('/panel bottom/delays active.svg')
    expect(viewerScriptSource).not.toContain('@element-plus/icons-vue')
    expect(viewerTemplateSource).not.toContain('<el-icon>')
  })

  it('keeps 3D highlight and simulation controls in one light control-panel style', () => {
    expect(viewerStyleSource).toContain('background: rgba(248, 250, 252, 0.94)')
    expect(viewerStyleSource).toContain('border-radius: 8px')
    expect(viewerStyleSource).toContain('width: 66px')
    expect(viewerStyleSource).toContain('height: 66px')
    expect(viewerStyleSource).not.toContain('background: rgba(15, 23, 42, 0.85)')
  })

  it('exposes latched delay and conditional skip-delay controls', () => {
    expect(viewerTemplateSource).toContain('sounderDelaysEnabled')
    expect(viewerTemplateSource).toContain('simulation-action-delay-active')
    expect(viewerTemplateSource).toContain('hasDelayedSounderOutputs')
    expect(viewerTemplateSource).toContain('skipSounderDelays')
    expect(viewerScriptSource).toContain('const sounderDelaysEnabled = ref(false)')
  })

  it('routes 3D device-triggered simulation through the delay-aware dispatcher', () => {
    expect(viewerScriptSource).toContain('dispatchSimulationAction(action')
    expect(viewerSceneInteractionSource).toContain('dispatchSimulationAction')
    expect(viewerSceneInteractionSource).not.toContain('store.dispatchSimulationAction')
  })

  it('does not expose property changes from the device context menu yet', () => {
    expect(contextMenuSource).not.toContain('openProperties')
    expect(contextMenuSource).not.toContain('fire.contextMenu.openProperties')
    expect(contextMenuSource).not.toContain('<View />')
  })

  it('does not expose tree location from the device context menu', () => {
    expect(contextMenuSource).not.toContain('locateInTree')
    expect(contextMenuSource).not.toContain('fire.contextMenu.locateInTree')
    expect(contextMenuSource).not.toContain('<Aim />')
    expect(viewerTemplateSource).not.toContain('@locate-in-tree')
  })

  it('renders delayed outputs as countdown-only before output animation', () => {
    expect(viewerSceneSource).toContain('renderDelayCountdownLabel')
    expect(viewerSceneSource).toContain('const isDelayedOutput')
    expect(viewerSceneSource).toContain("const shouldAnimate = outputState?.state === 'active'")
  })

  it('keeps the 3D simulation countdown ticking without the full panel', () => {
    expect(viewerScriptSource).toContain('startSimulationTicking')
    expect(viewerScriptSource).toContain('stopSimulationTicking')
    expect(viewerScriptSource).toContain("type: 'tick'")
    expect(viewerScriptSource).toContain(
      'elapsedSeconds: project.value.simulationSettings.timeScale'
    )
    expect(viewerScriptSource).toContain('window.setInterval')
    expect(viewerScriptSource).toContain('window.clearInterval')
  })

  it('shows a compact 3D event log sourced from simulation state', () => {
    expect(viewerScriptSource).toContain('recent3DEvents')
    expect(viewerScriptSource).toContain('format3DEventTime')
    expect(viewerTemplateSource).toContain('viewer-event-log-panel')
    expect(viewerTemplateSource).toContain('event.type')
    expect(viewerTemplateSource).toContain('event.condition')
    expect(viewerStyleSource).toContain('.viewer-event-log-panel')
  })
})
