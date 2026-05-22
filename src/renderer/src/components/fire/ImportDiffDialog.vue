<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CpdDiffResult } from '../../domain/fire/cpdDiff'

defineProps<{
  visible: boolean
  diff: CpdDiffResult | null
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t } = useI18n()
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="t('fire.diff.title')"
    width="640px"
    @update:model-value="(value) => !value && emit('cancel')"
  >
    <div v-if="diff" class="diff-dialog">
      <section class="diff-summary">
        <div>
          <span>{{ t('fire.diff.matched') }}</span>
          <strong>{{ diff.matched.length }}</strong>
        </div>
        <div>
          <span>{{ t('fire.diff.added') }}</span>
          <strong>{{ diff.added.length }}</strong>
        </div>
        <div>
          <span>{{ t('fire.diff.removed') }}</span>
          <strong>{{ diff.removed.length }}</strong>
        </div>
        <div>
          <span>{{ t('fire.diff.changed') }}</span>
          <strong>{{ diff.changed.length }}</strong>
        </div>
      </section>

      <section class="diff-section">
        <h3>{{ t('fire.diff.added') }}</h3>
        <ul>
          <li v-for="deviceId in diff.added" :key="deviceId">{{ deviceId }}</li>
          <li v-if="diff.added.length === 0">-</li>
        </ul>
      </section>

      <section class="diff-section">
        <h3>{{ t('fire.diff.removed') }}</h3>
        <ul>
          <li v-for="deviceId in diff.removed" :key="deviceId">{{ deviceId }}</li>
          <li v-if="diff.removed.length === 0">-</li>
        </ul>
      </section>

      <section class="diff-section">
        <h3>{{ t('fire.diff.changed') }}</h3>
        <ul>
          <li v-for="change in diff.changed" :key="change.deviceId">
            <strong>{{ change.deviceId }}</strong>
            <span>{{ change.fields.join(', ') }}</span>
          </li>
          <li v-if="diff.changed.length === 0">-</li>
        </ul>
      </section>
    </div>

    <template #footer>
      <el-button @click="emit('cancel')">{{ t('fire.common.cancel') }}</el-button>
      <el-button type="primary" :disabled="!diff" @click="emit('confirm')">{{
        t('fire.common.apply')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.diff-dialog {
  display: grid;
  gap: 14px;
}

.diff-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.diff-summary div {
  display: grid;
  gap: 4px;
  border-radius: 8px;
  background: #f8fafc;
  padding: 10px;
}

.diff-summary span,
h3 {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.diff-summary strong {
  font-size: 22px;
  color: #172033;
}

.diff-section {
  display: grid;
  gap: 7px;
}

h3 {
  margin: 0;
}

ul {
  display: grid;
  gap: 6px;
  max-height: 130px;
  overflow: auto;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  list-style: none;
}

li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  font-size: 13px;
}

li span {
  min-width: 0;
  color: #64748b;
  overflow-wrap: anywhere;
}
</style>
