import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createI18n } from 'vue-i18n'
import CpdInspector from './components/fire/CpdInspector.vue'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import en from './i18n/en'

interface CpdInspectorCheckResult {
  ok: boolean
  checks: Record<string, boolean>
  metrics: Record<string, number>
  errors: string[]
}

declare global {
  interface Window {
    __cpdInspectorCheck?: {
      run: () => Promise<CpdInspectorCheckResult>
    }
  }
}

const project = createHarnessProject()
const pinia = createPinia()
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const app = createApp({ render: () => h(CpdInspector) })

app.use(pinia)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

const store = useFireProjectStore(pinia)
store.loadFireProject(project)

async function run(): Promise<CpdInspectorCheckResult> {
  await nextTick()
  await delay(120)

  const checks: Record<string, boolean> = {}
  const metrics: Record<string, number> = {}
  const errors: string[] = []

  const record = (name: string, passed: boolean): void => {
    checks[name] = passed
    if (!passed) errors.push(name)
  }

  const zoneList = document.getElementById('list-zones') as HTMLElement | null
  const groupList = document.getElementById('list-groups') as HTMLElement | null
  const deviceList = document.getElementById('list-devices') as HTMLElement | null
  const svg = document.querySelector('.svg-canvas')

  record('zone-list-present', Boolean(zoneList))
  record('group-list-present', Boolean(groupList))
  record('device-list-present', Boolean(deviceList))
  record('svg-present', Boolean(svg))

  if (zoneList) {
    metrics.zoneClientHeight = zoneList.clientHeight
    metrics.zoneScrollHeight = zoneList.scrollHeight
    metrics.zoneInitialScrollTop = zoneList.scrollTop
    zoneList.scrollTop = 220
    zoneList.dispatchEvent(new Event('scroll', { bubbles: true }))
    await delay(80)
    metrics.zoneAfterScrollTop = zoneList.scrollTop
    record('zone-list-overflows', zoneList.scrollHeight > zoneList.clientHeight + 24)
    record('zone-list-scrolls', zoneList.scrollTop > 0)
  }

  if (groupList) {
    record('group-cards-rendered', groupList.querySelectorAll('.card').length > 0)
  }

  if (deviceList) {
    record('device-column-renders', deviceList.querySelectorAll('.card').length >= 0)
  }

  return { ok: errors.length === 0, checks, metrics, errors }
}

window.__cpdInspectorCheck = { run }

void run().then((report) => {
  const reportEl = document.getElementById('cpd-inspector-check-report')
  if (reportEl) reportEl.textContent = JSON.stringify(report, null, 2)
})

function createHarnessProject(): FireProjectDocument {
  return {
    schemaVersion: 1,
    projectId: 'cpd-inspector-check',
    name: 'CPD Inspector Check',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [
      {
        id: 'network-1',
        name: 'Network 1',
        sourceFileName: 'cpd-inspector-check.cpd',
        sourceImportedAt: 1,
        sounderMode: 'Programmed',
        panels: [
          {
            id: 'panel-1',
            networkId: 'network-1',
            panelNumber: 1,
            panelName: 'Panel 1',
            general: {
              panelNumber: 1,
              sounderMode: 'Programmed',
              sounderMode1: 'Pulse',
              evacuateDelaySeconds: 0,
              sounderDelaySeconds: 60,
              inputOutputDelaySeconds: 45,
              fireBrigadeDelaySeconds: 0,
              onManualCallPoints: false,
              onTwoDevices: false,
              delayOffAtNight: false,
              raw: {}
            },
            loops: [],
            zones: Array.from({ length: 64 }, (_, index) => {
              const zoneNumber = index + 1
              return {
                id: `zone-${zoneNumber}`,
                networkId: 'network-1',
                panelId: 'panel-1',
                zoneNumber,
                text: `Harness Zone ${zoneNumber}`,
                enabled: true,
                delayedSounders: zoneNumber % 3 === 0,
                alarmMode: 'single' as const,
                sounderGroupAlarm1: ((zoneNumber - 1) % 4) + 1,
                ioGroup1Alarm1: zoneNumber % 4 === 0 ? 1 : undefined,
                visualAreas: [],
                raw: {}
              }
            }),
            sounderGroups: [1, 2, 3, 4].map((groupId) => ({
              id: `sg-${groupId}`,
              networkId: 'network-1',
              panelId: 'panel-1',
              groupId,
              title: `Sounder Group ${groupId}`,
              addressableMembers: [
                { loopId: 1, physicalAddress: 90 + groupId, raw: {} },
                { loopId: 1, physicalAddress: 100 + groupId, raw: {} }
              ],
              nonAddressableMembers: [],
              raw: {}
            })),
            ioGroups: [
              {
                id: 'io-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                groupId: 1,
                members: [{ loopId: 1, physicalAddress: 7, raw: {} }],
                raw: {}
              }
            ],
            sounders: { raw: {} }
          }
        ]
      }
    ],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#111827',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: { timeScale: 1, soundEnabled: true },
    devices: [
      ...[1, 2, 3, 4].flatMap((groupId) => [
        createDevice(`sounder-${groupId}-a`, 90 + groupId, groupId, `Sounder ${groupId}A`),
        createDevice(`sounder-${groupId}-b`, 100 + groupId, groupId, `Sounder ${groupId}B`)
      ]),
      {
        ...createDevice('io-7', 7, 1, 'Input Output 7'),
        type: 'Input_Output',
        friendlyTypeName: 'Input/Output',
        classify: 'Module',
        isSounder: false,
        ioGroupId: 1,
        sounderGroupId: undefined,
        overrideDelays: true
      }
    ],
    issues: [],
    nonAddressableSounderPoints: []
  }
}

function createDevice(
  id: string,
  address: number,
  sounderGroupId: number,
  description: string
): FireProjectDocument['devices'][number] {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address,
    type: 'Sounder',
    friendlyTypeName: 'Sounder',
    description,
    classify: 'Alarm',
    location: description,
    zoneNumber: 1,
    sounderGroupId,
    isInputCapable: false,
    isOutputCapable: true,
    isSounder: true,
    isWirelessType: false,
    disabled: false,
    inhibitSounders: false,
    inhibitIO: false,
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement: { status: 'unplaced' },
    raw: {}
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
