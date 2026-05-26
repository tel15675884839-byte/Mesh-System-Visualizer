<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CpdInspectorDevice } from '../../domain/fire/cpdInspectorModel'
import { getDeviceIconHrefByType } from '../../domain/fire/deviceIcons'

const props = defineProps<{
  visible: boolean
  device: CpdInspectorDevice | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { t } = useI18n()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const deviceTitle = computed(() => {
  if (!props.device) return ''
  const addr = props.device.address !== undefined ? `Address ${props.device.address}` : ''
  const loop = props.device.loopId !== undefined ? `Loop ${props.device.loopId}` : ''
  return [loop, addr].filter(Boolean).join(', ') || props.device.id
})

const rawMappingData = [
  { cpd: 'PhysicalAddress', json: 'address', sim: 'address', desc: 'Loop physical address' },
  { cpd: 'DeviceType', json: 'type', sim: 'type', desc: 'Device type' },
  { cpd: 'DeviceClassify', json: 'classify', sim: 'classify', desc: 'Device category' },
  { cpd: 'DeviceLocationText', json: 'location', sim: 'location', desc: 'Display location' },
  { cpd: 'Description', json: 'description', sim: 'description', desc: 'Display description' },
  { cpd: 'Zone', json: 'zone', sim: 'zoneNumber', desc: 'Zone assignment' },
  {
    cpd: 'SounderGroup',
    json: 'sounderGroup',
    sim: 'sounderGroupId',
    desc: 'Sounder group assignment'
  },
  { cpd: 'IOGroup', json: 'ioGroup', sim: 'ioGroupId', desc: 'I/O group assignment' },
  { cpd: 'DeviceDisabled', json: 'disabled', sim: 'disabled', desc: 'Disabled device' },
  {
    cpd: 'OverrideDelays',
    json: 'overrideDelays',
    sim: 'overrideDelays',
    desc: 'Bypass output delays'
  },
  {
    cpd: 'InhibitSounders',
    json: 'inhibitSounders',
    sim: 'inhibitSounders',
    desc: 'Prevent sounder output'
  },
  { cpd: 'InhibitIO', json: 'inhibitIO', sim: 'inhibitIO', desc: 'Prevent I/O output' },
  {
    cpd: 'InhibitRelays',
    json: 'inhibitRelays',
    sim: 'inhibitRelays',
    desc: 'Prevent relay output'
  },
  { cpd: 'EvacuateIO', json: 'evacuateIO', sim: 'evacuateIO', desc: 'Activate I/O on evacuate' },
  {
    cpd: 'IOOverrideDelay',
    json: 'ioOverrideDelay',
    sim: 'ioOverrideDelay',
    desc: 'Bypass I/O delay'
  },
  {
    cpd: 'ImmediateEvacuate',
    json: 'immediateEvacuate',
    sim: 'immediateEvacuate',
    desc: 'Enter evacuate immediately'
  },
  {
    cpd: 'SetEvacuateTimer',
    json: 'setEvacuateTimer',
    sim: 'setEvacuateTimer',
    desc: 'Start evacuate timer'
  },
  {
    cpd: 'SelectedDisablement',
    json: 'selectedDisablement',
    sim: 'selectedDisablement',
    desc: 'Selective disablement'
  },
  {
    cpd: 'SmokeSensitivity',
    json: 'smokeSensitivity',
    sim: 'smokeSensitivity',
    desc: 'Smoke threshold parameter'
  },
  { cpd: 'HeatGrade', json: 'heatGrade', sim: 'heatGrade', desc: 'Heat detector parameter' },
  {
    cpd: 'ReportingDetail',
    json: 'reportingDetail',
    sim: 'reportingDetail',
    desc: 'Reporting detail parameter'
  }
]

const specialProperties = computed(() => {
  if (!props.device) return []
  const dev = props.device.rawDevice
  const list: { key: string; label: string; value: string | boolean }[] = []

  const add = (key: string, val: string | boolean | undefined): void => {
    if (
      val === undefined ||
      val === false ||
      val === '0' ||
      (typeof val === 'string' && val.trim().toLowerCase() === 'normal')
    )
      return
    list.push({ key, label: t(`fire.property.${key}`), value: val })
  }

  add('disabled', dev.disabled)
  add('overrideDelays', dev.overrideDelays)
  add('inhibitSounders', dev.inhibitSounders)
  add('inhibitIO', dev.inhibitIO)
  add('inhibitRelays', dev.inhibitRelays)
  add('evacuateIO', dev.evacuateIO)
  add('ioOverrideDelay', dev.ioOverrideDelay)
  add('immediateEvacuate', dev.immediateEvacuate)
  add('setEvacuateTimer', dev.setEvacuateTimer)
  add('selectedDisablement', dev.selectedDisablement)
  add('smokeSensitivity', dev.smokeSensitivity)
  add('heatGrade', dev.heatGrade)
  add('reportingDetail', dev.reportingDetail)

  return list
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('fire.property.device') + ': ' + deviceTitle"
    width="540px"
    destroy-on-close
  >
    <div v-if="device" class="device-details">
      <!-- Header info -->
      <div class="section-card header-section">
        <div class="device-type-header">
          <div class="icon-wrap">
            <img :src="getDeviceIconHrefByType(device.type)" class="header-icon" alt="" />
          </div>
          <div>
            <h3>{{ device.friendlyTypeName }}</h3>
            <span class="location-text">{{ device.location || t('fire.common.none') }}</span>
          </div>
        </div>
        <p v-if="device.rawDevice.description" class="desc-text">
          {{ device.rawDevice.description }}
        </p>
      </div>

      <!-- CPD Assignment -->
      <div class="section-card">
        <h4 class="section-title">CPD Assignment</h4>
        <div class="meta-grid">
          <div class="grid-item">
            <span class="label">{{ t('fire.property.panel') }}</span>
            <span class="val">Panel {{ device.rawDevice.panelNumber }}</span>
          </div>
          <div class="grid-item">
            <span class="label">{{ t('fire.property.loop') }}</span>
            <span class="val">{{
              device.rawDevice.loopId !== undefined ? `Loop ${device.rawDevice.loopId}` : '-'
            }}</span>
          </div>
          <div class="grid-item">
            <span class="label">{{ t('fire.property.address') }}</span>
            <span class="val">{{
              device.rawDevice.address !== undefined ? device.rawDevice.address : '-'
            }}</span>
          </div>
          <div class="grid-item">
            <span class="label">{{ t('fire.property.zone') }}</span>
            <span class="val">{{
              device.rawDevice.zoneNumber !== undefined
                ? `Zone ${device.rawDevice.zoneNumber}`
                : '-'
            }}</span>
          </div>
          <div class="grid-item">
            <span class="label">{{ t('fire.property.sounderGroup') }}</span>
            <span class="val">{{
              device.rawDevice.sounderGroupId !== undefined && device.rawDevice.sounderGroupId > 0
                ? `Sounder Group ${device.rawDevice.sounderGroupId}`
                : '-'
            }}</span>
          </div>
          <div class="grid-item">
            <span class="label">{{ t('fire.property.ioGroup') }}</span>
            <span class="val">{{
              device.rawDevice.ioGroupId !== undefined && device.rawDevice.ioGroupId > 0
                ? `I/O Group ${device.rawDevice.ioGroupId}`
                : '-'
            }}</span>
          </div>
        </div>
      </div>



      <!-- Raw mapping details -->
      <el-collapse>
        <el-collapse-item name="raw">
          <template #title>
            <span class="collapse-title">CPD to Simulator Field Mapping</span>
          </template>
          <div class="mapping-table-wrap">
            <table class="mapping-table">
              <thead>
                <tr>
                  <th>CPD Field</th>
                  <th>Simulator Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="map in rawMappingData" :key="map.cpd">
                  <td class="code-font">{{ map.cpd }}</td>
                  <td class="code-font">{{ map.sim }}</td>
                  <td class="val-font">
                    {{
                      device.rawDevice.raw[map.cpd] !== undefined
                        ? device.rawDevice.raw[map.cpd]
                        : device.rawDevice[map.sim] !== undefined
                          ? device.rawDevice[map.sim]
                          : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-dialog>
</template>

<style scoped>
.device-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}

.header-section {
  background: #f1f5f9;
}

.device-type-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #475569;
}

.header-icon {
  width: 24px;
  height: 24px;
}

.device-type-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.location-text {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.desc-text {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #475569;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

.grid-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  border-bottom: 1.5px dashed #e2e8f0;
  padding-bottom: 4px;
}

.grid-item .label {
  color: #64748b;
  font-weight: 500;
}

.grid-item .val {
  font-weight: 700;
  color: #0f172a;
}

.props-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prop-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.prop-lbl {
  color: #334155;
  font-weight: 500;
}

.empty-props {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 8px 0;
}

.collapse-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.mapping-table-wrap {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  text-align: left;
}

.mapping-table th,
.mapping-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
}

.mapping-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 1;
}

.code-font {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: #097b7b;
}

.val-font {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: #0f172a;
  word-break: break-all;
}
</style>
