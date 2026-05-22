<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFireProjectStore } from '../../stores/fireProjectStore'
import type {
  FireDevice,
  FirePanel,
  GroupMember,
  IOGroup,
  SounderGroup
} from '../../domain/fire/types'
import type { OutputActivation } from '../../domain/fire/simulation/types'

type InspectGroupKind = 'sounder' | 'io'

const props = defineProps<{
  panelId?: string | null
  kind?: InspectGroupKind | null
  groupId?: number | null
}>()

const store = useFireProjectStore()
const { project, selectedPanelId, selectedDeviceId, simulationState } = storeToRefs(store)

const selectedDevice = computed(() =>
  selectedDeviceId.value
    ? (project.value.devices.find((device) => device.id === selectedDeviceId.value) ?? null)
    : null
)

const inspectedKind = computed<InspectGroupKind | null>(() => {
  if (props.kind) return props.kind
  const device = selectedDevice.value
  if (!device) return null
  if (device.ioGroupId !== undefined) return 'io'
  if (device.sounderGroupId !== undefined || device.isSounder) return 'sounder'
  return null
})

const inspectedGroupId = computed<number | null>(() => {
  if (props.groupId !== undefined && props.groupId !== null) return props.groupId
  const device = selectedDevice.value
  if (!device) return null
  return inspectedKind.value === 'io' ? (device.ioGroupId ?? null) : (device.sounderGroupId ?? null)
})

const panel = computed<FirePanel | null>(() => {
  const id = props.panelId ?? selectedDevice.value?.panelId ?? selectedPanelId.value
  if (!id) return null
  return (
    project.value.networks
      .flatMap((network) => network.panels)
      .find((candidate) => candidate.id === id) ?? null
  )
})

const sounderGroup = computed<SounderGroup | null>(() => {
  if (inspectedKind.value !== 'sounder' || inspectedGroupId.value === null) return null
  return (
    panel.value?.sounderGroups.find((group) => group.groupId === inspectedGroupId.value) ?? null
  )
})

const ioGroup = computed<IOGroup | null>(() => {
  if (inspectedKind.value !== 'io' || inspectedGroupId.value === null) return null
  return panel.value?.ioGroups.find((group) => group.groupId === inspectedGroupId.value) ?? null
})

const title = computed(() => {
  if (sounderGroup.value)
    return sounderGroup.value.title || `Sounder Group ${sounderGroup.value.groupId}`
  if (ioGroup.value) return `I/O Group ${ioGroup.value.groupId}`
  if (inspectedKind.value === 'sounder' && inspectedGroupId.value !== null) {
    return `Sounder Group ${inspectedGroupId.value}`
  }
  if (inspectedKind.value === 'io' && inspectedGroupId.value !== null) {
    return `I/O Group ${inspectedGroupId.value}`
  }
  return 'Group Inspector'
})

const description = computed(() => {
  if (sounderGroup.value?.description) return sounderGroup.value.description
  const rawDescription = ioGroup.value?.raw?.description
  return rawDescription ? String(rawDescription) : ''
})

const memberRows = computed(() => {
  const currentPanel = panel.value
  if (!currentPanel) return []

  if (sounderGroup.value) {
    return resolveMembers(currentPanel, sounderGroup.value.addressableMembers)
  }

  if (ioGroup.value) {
    return resolveMembers(currentPanel, ioGroup.value.members)
  }

  return []
})

const nonAddressableRows = computed(() => sounderGroup.value?.nonAddressableMembers ?? [])

const sourceZones = computed(() => {
  const currentPanel = panel.value
  const groupId = inspectedGroupId.value
  if (!currentPanel || groupId === null) return []

  return currentPanel.zones.filter((zone) => {
    if (inspectedKind.value === 'sounder') {
      return zone.sounderGroupAlarm1 === groupId || zone.sounderGroupAlarm2 === groupId
    }

    return [
      zone.ioGroup1Alarm1,
      zone.ioGroup1Alarm2,
      zone.ioGroup2Alarm1,
      zone.ioGroup3Alarm1,
      zone.ioGroup4Alarm1
    ].includes(groupId)
  })
})

const output = computed<OutputActivation | null>(() => {
  const currentPanel = panel.value
  const groupId = inspectedGroupId.value
  const kind = inspectedKind.value
  if (!currentPanel || groupId === null || !kind) return null

  const prefix = kind === 'sounder' ? 'sounder-group' : 'io-group'
  return (
    simulationState.value.outputs.find(
      (candidate) => candidate.outputId === `${prefix}:${currentPanel.id}:${groupId}`
    ) ?? null
  )
})

function resolveMembers(
  panel: FirePanel,
  members: GroupMember[]
): Array<{
  key: string
  device: FireDevice | null
  loop: string
  address: string
  zone: string
  location: string
}> {
  return members.map((member, index) => {
    const device =
      project.value.devices.find(
        (candidate) =>
          candidate.panelId === panel.id &&
          candidate.loopId === member.loopId &&
          candidate.address === member.physicalAddress
      ) ?? null

    return {
      key: `${member.loopId ?? 'na'}:${member.physicalAddress ?? index}`,
      device,
      loop: valueOrDash(member.loopId),
      address: valueOrDash(member.physicalAddress),
      zone: valueOrDash(device?.zoneNumber),
      location: valueOrDash(device?.location)
    }
  })
}

function valueOrDash(value: unknown): string {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}
</script>

<template>
  <aside class="group-inspector">
    <template v-if="inspectedKind && inspectedGroupId !== null">
      <header class="inspector-header">
        <div>
          <h2>{{ title }}</h2>
          <p>{{ description || panel?.panelName || 'Panel group' }}</p>
        </div>
        <span class="state-chip" :class="output?.state ?? 'normal'">
          {{ output?.state ?? 'normal' }}
        </span>
      </header>

      <section class="summary-grid">
        <div>
          <span>Group ID</span>
          <strong>{{ inspectedGroupId }}</strong>
        </div>
        <div>
          <span>Panel</span>
          <strong>{{ panel?.panelName || '-' }}</strong>
        </div>
        <div>
          <span>Delay</span>
          <strong>{{ output?.remainingDelaySeconds ?? 0 }}s</strong>
        </div>
        <div>
          <span>Reason</span>
          <strong>{{ output?.reason || '-' }}</strong>
        </div>
      </section>

      <section class="inspector-section">
        <h3>Members</h3>
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Loop</th>
              <th>Address</th>
              <th>Zone</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in memberRows" :key="member.key">
              <td>
                <strong>{{
                  member.device?.description || member.device?.friendlyTypeName || '-'
                }}</strong>
                <span>{{ member.location }}</span>
              </td>
              <td>{{ member.loop }}</td>
              <td>{{ member.address }}</td>
              <td>{{ member.zone }}</td>
            </tr>
            <tr v-if="memberRows.length === 0">
              <td colspan="4" class="empty-cell">No addressable members</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="nonAddressableRows.length > 0" class="inspector-section">
        <h3>Non-addressable</h3>
        <ul>
          <li v-for="(member, index) in nonAddressableRows" :key="index">
            CIE {{ valueOrDash(member.cieId) }}:
            {{ member.nonAddressable1 ? 'Channel 1' : '' }}
            {{ member.nonAddressable2 ? 'Channel 2' : '' }}
          </li>
        </ul>
      </section>

      <section class="inspector-section">
        <h3>Triggering Zones</h3>
        <ul>
          <li v-for="zone in sourceZones" :key="zone.id">
            Zone {{ zone.zoneNumber }}<span v-if="zone.text"> - {{ zone.text }}</span>
          </li>
          <li v-if="sourceZones.length === 0">-</li>
        </ul>
      </section>
    </template>

    <div v-else class="empty-inspector">No group selected</div>
  </aside>
</template>

<style scoped>
.group-inspector {
  height: 100%;
  min-width: 320px;
  overflow: auto;
  border-left: 1px solid #d8dee8;
  background: #ffffff;
  color: #172033;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  font-size: 16px;
}

p {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.state-chip {
  align-self: flex-start;
  border-radius: 999px;
  padding: 3px 8px;
  background: #e2e8f0;
  color: #334155;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.state-chip.active {
  background: #fee2e2;
  color: #991b1b;
}

.state-chip.delayActive {
  background: #fef3c7;
  color: #92400e;
}

.state-chip.inhibited,
.state-chip.disabled {
  background: #e5e7eb;
  color: #4b5563;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #edf2f7;
}

.summary-grid div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.summary-grid span,
th {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.summary-grid strong {
  min-width: 0;
  color: #172033;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.inspector-section {
  padding: 13px 14px;
  border-bottom: 1px solid #edf2f7;
}

h3 {
  margin-bottom: 9px;
  color: #334155;
  font-size: 12px;
  text-transform: uppercase;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 6px 4px;
  border-bottom: 1px solid #edf2f7;
  text-align: left;
  vertical-align: top;
}

td strong,
td span {
  display: block;
}

td span {
  color: #64748b;
}

ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.empty-cell,
.empty-inspector {
  color: #64748b;
  font-weight: 700;
  text-align: center;
}

.empty-inspector {
  display: grid;
  min-height: 160px;
  place-items: center;
}
</style>
