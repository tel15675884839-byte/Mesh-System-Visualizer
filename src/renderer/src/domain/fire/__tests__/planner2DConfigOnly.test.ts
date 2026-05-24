import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('Planner2D configuration-only boundary', () => {
  it('does not reference runtime simulation state or actions', () => {
    const source = readFileSync(resolve('src/renderer/src/components/fire/Planner2D.vue'), 'utf8')

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

  it('keeps the simulation panel out of the 2D workflow', () => {
    const source = readFileSync(resolve('src/renderer/src/App.vue'), 'utf8')

    expect(source).toContain('v-if="viewMode === \'3d\'"')
    expect(source).toContain('<SimulationPanel />')
  })
})
