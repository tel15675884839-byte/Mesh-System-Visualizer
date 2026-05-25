/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const fixtureDir = resolve(root, 'fixtures/cpd')
const extractorDir = resolve(root, '../CpdExtractorPortable')
const extractor = join(extractorDir, 'CpdExtractor.ps1')
const manifestPath = join(fixtureDir, 'manifest.json')
const extractedDir = join(fixtureDir, 'extracted')

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function runExtractor(fileName) {
  const input = join(fixtureDir, fileName)
  const output = join(extractedDir, fileName.replace(/\.cpd$/i, '.json'))
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      extractor,
      '-InputCpd',
      input,
      '-OutputJson',
      output
    ],
    { cwd: root, encoding: 'utf8' }
  )

  if (result.status !== 0) {
    fail(`Extractor failed for ${fileName}\n${result.stdout}\n${result.stderr}`)
  }

  return JSON.parse(readFileSync(output, 'utf8'))
}

function deviceByAddress(data, address) {
  return data.devices.find((device) => device.address === address)
}

function zoneByNumber(data, zoneNumber) {
  return data.zones.find((zone) => zone.zoneNumber === zoneNumber)
}

function groupIds(groups) {
  return groups.map((group) => group.groupId).sort((left, right) => left - right)
}

function totalDelaySeconds(general, minuteField, secondField) {
  return Number(general[minuteField] || 0) * 60 + Number(general[secondField] || 0)
}

function validateCommon(fileName, data) {
  assert(data.panels.length === 1, `${fileName}: expected one panel`)
  assert(data.devices.length === 20, `${fileName}: expected 20 devices`)
  assert(zoneByNumber(data, 1), `${fileName}: expected Zone 1`)
  assert(zoneByNumber(data, 2), `${fileName}: expected Zone 2`)
  assert(zoneByNumber(data, 3), `${fileName}: expected Zone 3`)
  assert(
    JSON.stringify(groupIds(data.sounderGroups)) === JSON.stringify([1, 2, 3, 10]),
    `${fileName}: expected sounder groups 1,2,3,10`
  )
}

function validateFixture(fileName, data, expected) {
  validateCommon(fileName, data)
  const zone1 = zoneByNumber(data, 1)
  assert(zone1.sounderGroupAlarm1 === 1, `${fileName}: Zone 1 first-stage sounder group mismatch`)
  assert(zone1.sounderGroupAlarm2 === 10, `${fileName}: Zone 1 second-stage sounder group mismatch`)

  const expectedSounderDelaySeconds = Number(expected?.sounderDelaySeconds ?? 0)
  assert(
    totalDelaySeconds(data.panels[0].general, 'SounderDelayMM', 'SounderDelaySS') ===
      expectedSounderDelaySeconds,
    `${fileName}: expected ${expectedSounderDelaySeconds} second sounder delay`
  )

  const expectedFireBrigadeDelaySeconds = Number(expected?.fireBrigadeDelaySeconds ?? 0)
  assert(
    totalDelaySeconds(data.panels[0].general, 'FireBrigadeDelayMM', 'FireBrigadeDelaySS') ===
      expectedFireBrigadeDelaySeconds,
    `${fileName}: expected ${expectedFireBrigadeDelaySeconds} second fire brigade delay`
  )

  const expectedDelayedSounders = Boolean(expected?.delayedSounders)
  for (const zoneNumber of [1, 2, 3]) {
    assert(
      zoneByNumber(data, zoneNumber)?.delayedSounders === expectedDelayedSounders,
      `${fileName}: expected Zone ${zoneNumber} delayedSounders=${expectedDelayedSounders}`
    )
  }

  if (fileName.includes('manual-callpoint') || fileName.includes('realistic-building')) {
    assert(
      deviceByAddress(data, 4)?.overrideDelays === true,
      `${fileName}: expected address 4 OverrideDelays=true`
    )
    assert(
      deviceByAddress(data, 14)?.overrideDelays === true,
      `${fileName}: expected address 14 OverrideDelays=true`
    )
    assert(
      deviceByAddress(data, 24)?.overrideDelays === true,
      `${fileName}: expected address 24 OverrideDelays=true`
    )
  }

  if (fileName.includes('disabled-and-inhibited') || fileName.includes('realistic-building')) {
    assert(
      deviceByAddress(data, 21)?.disabled === true,
      `${fileName}: expected address 21 disabled=true`
    )
    assert(
      deviceByAddress(data, 17)?.inhibitRelays === true,
      `${fileName}: expected address 17 inhibitRelays=true`
    )
  }

  if (
    fileName.includes('io-stage') ||
    fileName.includes('delay-edge') ||
    fileName.includes('realistic-building')
  ) {
    assert(zone1.ioGroup1Alarm1 === 1, `${fileName}: expected Zone 1 stage 1 I/O Group 1`)
    assert(zone1.ioGroup1Alarm2 === 2, `${fileName}: expected Zone 1 stage 2 I/O Group 2`)
    assert(groupIds(data.ioGroups).includes(1), `${fileName}: expected I/O Group 1`)
    assert(groupIds(data.ioGroups).includes(2), `${fileName}: expected I/O Group 2`)
  }
}

if (!existsSync(manifestPath)) {
  fail(`Missing manifest: ${manifestPath}`)
}

if (!existsSync(extractor)) {
  fail(`Missing extractor: ${extractor}`)
}

mkdirSync(extractedDir, { recursive: true })

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const results = []

for (const fixture of manifest.fixtures) {
  const cpdPath = join(fixtureDir, fixture.fileName)
  assert(existsSync(cpdPath), `Missing fixture file: ${fixture.fileName}`)
  const data = runExtractor(fixture.fileName)
  validateFixture(fixture.fileName, data, fixture.expected)
  results.push({
    fileName: fixture.fileName,
    extracted: basename(fixture.fileName, '.cpd') + '.json',
    devices: data.devices.length,
    zones: data.zones.length,
    sounderGroups: data.sounderGroups.length,
    ioGroups: data.ioGroups.length
  })
}

const reportPath = resolve(root, '.codex-dev-run/cpd-fixture-extractor-report.json')
writeFileSync(reportPath, JSON.stringify({ passed: true, results }, null, 2))
console.log(`Verified ${results.length} CPD fixtures. Report: ${reportPath}`)
