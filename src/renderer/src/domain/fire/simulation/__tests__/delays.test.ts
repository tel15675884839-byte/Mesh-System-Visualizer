import { describe, expect, it } from 'vitest'

import { createDelayedActivation, skipOutputDelay, tickDelayedOutputs } from '../delays'

describe('simulation delays', () => {
  it('creates a general sounder delay', () => {
    const output = createDelayedActivation(
      'sounder-group:panel-1:1',
      ['input-1'],
      90,
      'general-sounder'
    )

    expect(output).toMatchObject({
      outputId: 'sounder-group:panel-1:1',
      state: 'delayActive',
      remainingDelaySeconds: 90,
      reason: 'general-sounder'
    })
  })

  it('creates an I/O delay', () => {
    const output = createDelayedActivation('io-group:panel-1:2', ['input-1'], 15, 'io')

    expect(output).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 15,
      reason: 'io'
    })
  })

  it('creates a Fire Brigade delay', () => {
    const output = createDelayedActivation('fire-brigade:panel-1', ['input-1'], 120, 'fire-brigade')

    expect(output).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 120,
      reason: 'fire-brigade'
    })
  })

  it('creates an Evacuate delay', () => {
    const output = createDelayedActivation(
      'evacuate:network-1',
      ['manual-evacuate'],
      30,
      'evacuate'
    )

    expect(output).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 30,
      reason: 'evacuate'
    })
  })

  it('skips a delay for a selected output', () => {
    const outputs = [
      createDelayedActivation('sounder-group:panel-1:1', ['input-1'], 90, 'general-sounder')
    ]

    expect(skipOutputDelay(outputs, 'sounder-group:panel-1:1')[0]).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0
    })
  })

  it('uses time scale when reducing remaining seconds', () => {
    const outputs = [
      createDelayedActivation('sounder-group:panel-1:1', ['input-1'], 90, 'general-sounder')
    ]

    expect(tickDelayedOutputs(outputs, 3, 10)[0]).toMatchObject({
      state: 'delayActive',
      remainingDelaySeconds: 60
    })
  })

  it('activates an output when the scaled countdown reaches zero', () => {
    const outputs = [createDelayedActivation('io-group:panel-1:2', ['input-1'], 15, 'io')]

    expect(tickDelayedOutputs(outputs, 3, 5)[0]).toMatchObject({
      state: 'active',
      remainingDelaySeconds: 0
    })
  })
})
