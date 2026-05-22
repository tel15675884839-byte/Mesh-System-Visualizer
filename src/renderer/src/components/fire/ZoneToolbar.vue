<script setup lang="ts">
import { Close, Crop, EditPen, Pointer } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { FirePlannerTool } from '../../stores/fireProjectStore'
import type { FireZone } from '../../domain/fire/types'

defineProps<{
  zones: FireZone[]
  selectedZoneId: string | null
  activeTool: FirePlannerTool
  polygonPointCount: number
}>()

const emit = defineEmits<{
  selectZone: [zoneId: string | null]
  selectTool: [tool: FirePlannerTool]
  cancelPolygon: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="zone-toolbar">
    <el-select
      :model-value="selectedZoneId"
      size="small"
      class="zone-select"
      :placeholder="t('fire.zoneToolbar.zone')"
      clearable
      @update:model-value="(value) => emit('selectZone', value || null)"
    >
      <el-option
        v-for="zone in zones"
        :key="zone.id"
        :label="`Zone ${zone.zoneNumber}${zone.text ? ` - ${zone.text}` : ''}`"
        :value="zone.id"
      />
    </el-select>

    <el-button-group>
      <el-tooltip :content="t('fire.zoneToolbar.select')" placement="bottom">
        <el-button
          :type="activeTool === 'select' ? 'primary' : 'default'"
          :icon="Pointer"
          size="small"
          @click="emit('selectTool', 'select')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.zoneToolbar.rectangle')" placement="bottom">
        <el-button
          :type="activeTool === 'zoneRectangle' ? 'primary' : 'default'"
          :icon="Crop"
          size="small"
          @click="emit('selectTool', 'zoneRectangle')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.zoneToolbar.polygon')" placement="bottom">
        <el-button
          :type="activeTool === 'zonePolygon' ? 'primary' : 'default'"
          :icon="EditPen"
          size="small"
          @click="emit('selectTool', 'zonePolygon')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.zoneToolbar.cancelPolygon')" placement="bottom">
        <el-button
          :disabled="polygonPointCount === 0"
          :icon="Close"
          size="small"
          @click="emit('cancelPolygon')"
        />
      </el-tooltip>
    </el-button-group>

    <span v-if="polygonPointCount > 0" class="point-count">{{ polygonPointCount }}</span>
  </section>
</template>

<style scoped>
.zone-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.zone-select {
  width: 190px;
}

.point-count {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 12px;
  font-weight: 700;
}
</style>
