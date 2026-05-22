<script setup lang="ts">
import { Connection, Finished, Link, RefreshLeft, Remove } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { FireLoop } from '../../domain/fire/types'
import type { FirePlannerTool } from '../../stores/fireProjectStore'

defineProps<{
  loops: FireLoop[]
  selectedLoopId: string | null
  activeTool: FirePlannerTool
  draftOrderCount: number
}>()

const emit = defineEmits<{
  selectLoop: [loopId: string | null]
  startManual: []
  saveManual: []
  clearDraft: []
  restoreDefault: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="loop-toolbar">
    <el-select
      :model-value="selectedLoopId"
      size="small"
      class="loop-select"
      :placeholder="t('fire.loopToolbar.loop')"
      clearable
      @update:model-value="(value) => emit('selectLoop', value || null)"
    >
      <el-option
        v-for="loop in loops"
        :key="loop.id"
        :label="loop.name || `Loop ${loop.loopId}`"
        :value="loop.id"
      />
    </el-select>

    <el-button-group>
      <el-tooltip :content="t('fire.loopToolbar.start')" placement="bottom">
        <el-button
          :type="activeTool === 'manualLoopWiring' ? 'primary' : 'default'"
          :icon="Connection"
          size="small"
          @click="emit('startManual')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.loopToolbar.save')" placement="bottom">
        <el-button
          :disabled="draftOrderCount < 2"
          :icon="Finished"
          size="small"
          @click="emit('saveManual')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.loopToolbar.clear')" placement="bottom">
        <el-button
          :disabled="draftOrderCount === 0"
          :icon="Remove"
          size="small"
          @click="emit('clearDraft')"
        />
      </el-tooltip>
      <el-tooltip :content="t('fire.loopToolbar.restore')" placement="bottom">
        <el-button
          :disabled="!selectedLoopId"
          :icon="RefreshLeft"
          size="small"
          @click="emit('restoreDefault')"
        />
      </el-tooltip>
    </el-button-group>

    <span class="order-count">
      <el-icon><Link /></el-icon>
      {{ draftOrderCount }}
    </span>
  </section>
</template>

<style scoped>
.loop-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.loop-select {
  width: 170px;
}

.order-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 40px;
  height: 22px;
  justify-content: center;
  border-radius: 999px;
  background: #e0f2fe;
  color: #075985;
  font-size: 12px;
  font-weight: 700;
}
</style>
