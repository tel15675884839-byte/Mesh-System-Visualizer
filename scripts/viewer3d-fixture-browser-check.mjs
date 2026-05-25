/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const port = 5200 + Math.floor(Math.random() * 1000)
const url = `http://127.0.0.1:${port}/viewer3d-check.html`
const reportPath = resolve(root, '.codex-dev-run/viewer3d-fixture-browser-report.json')
const vitePs1 = resolve(root, 'node_modules/.bin/vite.ps1')
const viteConfig = resolve(root, 'scripts/planner-check.vite.config.mjs')
const chrome = findChrome()

mkdirSync(dirname(reportPath), { recursive: true })

const vite = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    vitePs1,
    '--config',
    viteConfig,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort'
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
)

let viteOutput = ''
vite.stdout.on('data', (chunk) => {
  viteOutput += chunk.toString()
})
vite.stderr.on('data', (chunk) => {
  viteOutput += chunk.toString()
})

try {
  await waitForServer(url, 30_000)
  const result = spawnSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-first-run',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=5000',
      `--user-data-dir=${mkdtempSync(resolve(tmpdir(), 'viewer3d-fixture-chrome-'))}`,
      '--dump-dom',
      url
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000
    }
  )

  if (result.status !== 0) {
    throw new Error(
      `Chrome viewer3d check failed (status=${result.status}, signal=${result.signal}, error=${result.error?.message ?? 'none'})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    )
  }

  const report = extractReport(result.stdout)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  if (!report.ok) {
    throw new Error(`Viewer3D browser report failed: ${JSON.stringify(report.errors)}`)
  }
  console.log(JSON.stringify({ reportPath, ok: report.ok, checks: report.checks }, null, 2))
} catch (error) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        viteOutput
      },
      null,
      2
    )
  )
  throw error
} finally {
  stopProcessTree(vite.pid)
  vite.stdout.destroy()
  vite.stderr.destroy()
}

async function waitForServer(target, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (vite.exitCode !== null) {
      throw new Error(`Vite exited before server was ready:\n${viteOutput}`)
    }

    try {
      const response = await fetch(target)
      if (response.ok) {
        return
      }
    } catch {
      // Wait until Vite is ready.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }

  throw new Error(`Timed out waiting for ${target}\n${viteOutput}`)
}

function findChrome() {
  const candidates = [
    resolve(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'),
    resolve(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
    resolve(process.env.ProgramFiles ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    resolve(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe')
  ]
  const candidate = candidates.find((item) => existsSync(item))
  if (!candidate) {
    throw new Error('Could not find Chrome or Edge for browser verification.')
  }
  return candidate
}

function extractReport(dom) {
  const match = dom.match(/<pre[^>]*id=["']viewer3d-check-report["'][^>]*>([\s\S]*?)<\/pre>/i)
  if (!match) {
    throw new Error(`Viewer3D report element was not found in browser DOM.\n${dom.slice(0, 2000)}`)
  }

  return JSON.parse(decodeHtml(match[1]))
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function stopProcessTree(pid) {
  if (!pid) {
    return
  }

  spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
}
