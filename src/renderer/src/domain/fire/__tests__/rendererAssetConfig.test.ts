import { describe, expect, it } from 'vitest'
import config from '../../../../../../electron.vite.config'

describe('renderer asset config', () => {
  it('serves project public assets to the renderer build', () => {
    expect(config.renderer?.publicDir).toBeTruthy()
    expect(String(config.renderer?.publicDir).replace(/\\/g, '/')).toMatch(/\/public$/)
  })
})
