import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const bin =
  process.platform === 'win32'
    ? resolve('node_modules/.bin/vite-node.ps1')
    : resolve('node_modules/.bin/vite-node')

const result =
  process.platform === 'win32'
    ? spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          bin,
          'scripts/runtime-cpd-fixture-check.ts'
        ],
        { cwd: process.cwd(), stdio: 'inherit' }
      )
    : spawnSync(bin, ['scripts/runtime-cpd-fixture-check.ts'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

process.exit(result.status ?? 1)
