import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createI18n } from 'vue-i18n'
import Planner2D from './components/fire/Planner2D.vue'
import { useFireProjectStore, type FireProjectDocument } from './stores/fireProjectStore'
import en from './i18n/en'

const project: FireProjectDocument = {
  schemaVersion: 1,
  projectId: 'planner-check',
  name: 'Planner Check',
  createdAt: 1,
  updatedAt: 1,
  language: 'en',
  networks: [
    {
      id: 'network-1',
      name: 'Network 1',
      sourceFileName: 'planner.cpd',
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
            evacuateDelaySeconds: 0,
            sounderDelaySeconds: 0,
            inputOutputDelaySeconds: 0,
            fireBrigadeDelaySeconds: 0,
            onManualCallPoints: false,
            onTwoDevices: false,
            delayOffAtNight: false,
            raw: {}
          },
          loops: [
            {
              id: 'loop-1',
              networkId: 'network-1',
              panelId: 'panel-1',
              loopId: 1,
              name: 'Loop 1',
              configuredDeviceOrder: ['device-a', 'device-b', 'device-c', 'device-d'],
              manualDeviceOrder: [],
              color: '#2563eb'
            }
          ],
          zones: [
            {
              id: 'zone-1',
              networkId: 'network-1',
              panelId: 'panel-1',
              zoneNumber: 1,
              text: 'Zone 1',
              enabled: true,
              delayedSounders: false,
              alarmMode: 'single',
              visualAreas: [],
              raw: {}
            }
          ],
          sounderGroups: [],
          ioGroups: [],
          sounders: { raw: {} }
        }
      ]
    }
  ],
  buildings: [
    {
      id: 'building-1',
      name: 'Building 1',
      floors: [
        {
          id: 'floor-1',
          buildingId: 'building-1',
          name: 'Floor 1',
          levelIndex: 0,
          mapWidth: 800,
          mapHeight: 500,
          camera2D: { x: 0, y: 0, scale: 1 },
          floorHeight3D: 3,
          floorScale3D: 1
        }
      ],
      position: { x: 0, y: 0 },
      size: { width: 800, depth: 500 },
      rotation: 0
    }
  ],
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
  devices: ['a', 'b', 'c', 'd'].map((suffix, index) => ({
    id: `device-${suffix}`,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId: 1,
    address: index + 1,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    description: `Device ${suffix.toUpperCase()}`,
    zoneNumber: 1,
    isInputCapable: true,
    isOutputCapable: false,
    isSounder: false,
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
    placement: {
      status: 'placed',
      buildingId: 'building-1',
      floorId: 'floor-1',
      position: { x: 120 + index * 150, y: 220, z: 0 }
    },
    raw: {}
  })),
  issues: [],
  nonAddressableSounderPoints: []
}

const pinia = createPinia()
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const app = createApp({ render: () => h(Planner2D) })

app.use(pinia)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

const store = useFireProjectStore(pinia)
store.loadFireProject(project)
