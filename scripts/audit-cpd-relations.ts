import { readFileSync } from 'node:fs'

import { adaptCpdExport } from '../src/renderer/src/domain/fire/cpdAdapter'
import { auditCpdRelations } from '../src/renderer/src/domain/fire/cpdRelationAudit'

const inputJson = process.argv[2]

if (!inputJson) {
  throw new Error('Usage: vite-node scripts/audit-cpd-relations.ts <extractor-output.json>')
}

const extractorData = JSON.parse(readFileSync(inputJson, 'utf8')) as unknown
const adapted = adaptCpdExport(extractorData, 1000)
const report = auditCpdRelations(extractorData, {
  network: adapted.network,
  devices: adapted.devices
})

console.log(JSON.stringify(report, null, 2))
