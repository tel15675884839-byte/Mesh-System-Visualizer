import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('right-side property panel layout', () => {
  const source = readFileSync(resolve('src/renderer/src/App.vue'), 'utf8')

  it('opens as an overlay instead of adding a workspace grid column', () => {
    expect(source).not.toContain('.workspace.right-panel-open')
    expect(source).not.toContain(
      'grid-template-columns: minmax(280px, 340px) minmax(0, 1fr) minmax'
    )
    expect(source).toContain('position: absolute;')
    expect(source).toContain('right: 0;')
    expect(source).toContain('z-index:')
  })

  it('uses a Vue transition for smooth panel entry and exit', () => {
    expect(source).toContain('<Transition name="right-panel-slide">')
    expect(source).toContain('.right-panel-slide-enter-active')
    expect(source).toContain('.right-panel-slide-leave-active')
    expect(source).toContain('transform:')
    expect(source).toContain('opacity:')
  })
})
