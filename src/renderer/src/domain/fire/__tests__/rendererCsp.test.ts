import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

describe('renderer content security policy', () => {
  it('allows imported drawing assets to load through the fire asset protocol', () => {
    const html = readFileSync(resolve('src/renderer/index.html'), 'utf8')

    expect(html).toContain('img-src')
    expect(html).toContain('fire-asset:')
  })
})
