<template>
  <div class="glass-card" style="margin-bottom: 24px; padding: 20px;">
    <h4 class="title-outfit" style="margin: 0 0 12px 0; color: #3b82f6;">Audit Kelengkapan Database</h4>
    <p style="color: hsl(var(--text-secondary)); font-size: 0.85rem; margin-top: -8px; margin-bottom: 20px;">
      Audit kelengkapan data harian dari seluruh pasar. Temukan tanggal yang kosong atau tidak lengkap dan isi secara otomatis.
    </p>

    <div class="location-filters" style="margin-bottom: 20px;">
      <div class="filter-col">
        <span class="text-label">MULAI AUDIT</span>
        <f7-list no-hairlines-md style="margin: 0;">
          <f7-list-input
            type="datepicker"
            placeholder="Pilih Mulai Audit"
            readonly
            :calendar-params="{ dateFormat: 'yyyy-mm-dd', closeOnSelect: true, minDate: minDateObj, maxDate: maxDateObj }"
            :value="auditStart ? [new Date(auditStart)] : []"
            @calendar:change="(val) => {
              if (val && val.length > 0) {
                $emit('update:auditStart', val[0].toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }));
              }
            }"
          />
        </f7-list>
      </div>
      <div class="filter-col">
        <span class="text-label">SELESAI AUDIT</span>
        <f7-list no-hairlines-md style="margin: 0;">
          <f7-list-input
            type="datepicker"
            placeholder="Pilih Selesai Audit"
            readonly
            :calendar-params="{ dateFormat: 'yyyy-mm-dd', closeOnSelect: true, minDate: minDateObj, maxDate: maxDateObj }"
            :value="auditEnd ? [new Date(auditEnd)] : []"
            @calendar:change="(val) => {
              if (val && val.length > 0) {
                $emit('update:auditEnd', val[0].toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }));
              }
            }"
          />
        </f7-list>
      </div>
    </div>

    <div class="flex-row gap-xs" style="margin-bottom: 20px;">
      <button @click="$emit('run-audit')" class="btn-action secondary" style="flex: 1;" :disabled="auditLoading">
        {{ auditLoading ? 'Mengaudit...' : '🔍 Jalankan Audit' }}
      </button>
      <button @click="$emit('trigger-backfill-gaps')" class="btn-action primary" style="flex: 2;" :disabled="gapsLoading || !coverageSummary">
        {{ gapsLoading ? 'Mengisi Gaps...' : '⚡ Isi Semua Data Bolong' }}
      </button>
    </div>

    <!-- Audit Results -->
    <div v-if="coverageSummary" class="audit-results-panel">
      <div class="flex-row justify-between align-center" style="margin-bottom: 12px;">
        <span class="text-label">Indeks Kelengkapan</span>
        <span style="font-weight: bold; color: hsl(var(--status-success)); font-size: 1.1rem; display: flex; align-items: center; gap: 2px;">
          <NumberFlow :value="coverageSummary.completenessPercentage" />% Lengkap
        </span>
      </div>

      <!-- Progress Bar -->
      <div class="progress-bar-container" style="margin-bottom: 20px; height: 10px;">
        <div class="progress-bar-fill success" :style="{ width: coverageSummary.completenessPercentage + '%' }"></div>
      </div>

      <!-- Stats Grid -->
      <div class="metrics-grid" style="margin-bottom: 20px;">
        <div class="metric-box">
          <span class="text-label">TOTAL HARI</span>
          <span class="metric-val" style="color: hsl(var(--text-primary)); display: flex; justify-content: center;">
            <NumberFlow :value="coverageSummary.totalDays" />
          </span>
        </div>
        <div class="metric-box">
          <span class="text-label">LENGKAP</span>
          <span class="metric-val success" style="display: flex; justify-content: center;">
            <NumberFlow :value="coverageSummary.fullyIngestedDays" />
          </span>
        </div>
        <div class="metric-box">
          <span class="text-label">BOLONG (0%)</span>
          <span class="metric-val failed" style="display: flex; justify-content: center;">
            <NumberFlow :value="coverageSummary.missingDays" />
          </span>
        </div>
        <div class="metric-box">
          <span class="text-label">SEBAGIAN</span>
          <span class="metric-val warning-text" style="display: flex; justify-content: center;">
            <NumberFlow :value="coverageSummary.partiallyIngestedDays" />
          </span>
        </div>
      </div>

      <!-- Completed jobs in audit range -->
      <div class="flex-row justify-between align-center" style="margin-bottom: 24px; font-size: 0.85rem; background: rgba(255, 255, 255, 0.03); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--glass-border);">
        <span class="text-label" style="font-size: 0.75rem;">JOB TERSELESAIKAN DI RENTANG INI:</span>
        <span style="font-weight: bold; color: hsl(var(--status-success)); display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-flex;"><NumberFlow :value="coverageSummary.totalSucceededJobs" /></span> Sukses, 
          <span style="display: inline-flex; color: hsl(var(--status-danger));"><NumberFlow :value="coverageSummary.totalFailedJobs" /></span> Gagal 
          <span style="color: hsl(var(--text-muted)); font-weight: normal; margin-left: 2px;">(dari <span style="display: inline-flex;"><NumberFlow :value="coverageSummary.totalExpectedJobs" /></span> target)</span>
        </span>
      </div>

      <!-- Missing Dates Detail -->
      <div v-if="coverageSummary.missingDates.length > 0" style="margin-top: 16px;">
        <h5 class="title-outfit" style="margin: 0 0 8px 0; font-size: 0.85rem; color: hsl(var(--status-danger)); display: flex; align-items: center; gap: 4px;">
          <span>TANGGAL KOSONG SAMA SEKALI (</span>
          <NumberFlow :value="coverageSummary.missingDates.length" />
          <span>)</span>
        </h5>
        <div class="gaps-tags-container">
          <span v-for="d in coverageSummary.missingDates.slice(0, 15)" :key="d" class="gap-tag danger">
            {{ d }} <span @click="$emit('tarik-date', d)" class="tag-action">⚡</span>
          </span>
          <span v-if="coverageSummary.missingDates.length > 15" class="gap-tag-more" style="display: inline-flex; align-items: center; gap: 2px;">
            + <NumberFlow :value="coverageSummary.missingDates.length - 15" /> lainnya
          </span>
        </div>
      </div>

      <!-- Incomplete Dates Detail -->
      <div v-if="coverageSummary.incompleteDates.length > 0" style="margin-top: 16px;">
        <h5 class="title-outfit" style="margin: 0 0 8px 0; font-size: 0.85rem; color: hsl(var(--status-warning)); display: flex; align-items: center; gap: 4px;">
          <span>DATA HANYA SEBAGIAN (</span>
          <NumberFlow :value="coverageSummary.incompleteDates.length" />
          <span>)</span>
        </h5>
        <div class="gaps-tags-container">
          <span v-for="d in coverageSummary.incompleteDates.slice(0, 15)" :key="d.tanggal" class="gap-tag warning" style="display: inline-flex; align-items: center; gap: 2px;">
            {{ d.tanggal }} (<NumberFlow :value="d.percentage" />%) <span @click="$emit('tarik-date', d.tanggal)" class="tag-action">⚡</span>
          </span>
          <span v-if="coverageSummary.incompleteDates.length > 15" class="gap-tag-more" style="display: inline-flex; align-items: center; gap: 2px;">
            + <NumberFlow :value="coverageSummary.incompleteDates.length - 15" /> lainnya
          </span>
        </div>
      </div>
      
      <div v-if="coverageSummary.missingDays === 0 && coverageSummary.partiallyIngestedDays === 0" class="text-center success-box" style="padding: 15px; margin-top: 15px;">
        🎉 Selamat! Kelengkapan data 100% untuk rentang ini.
      </div>
    </div>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';

export default {
  components: { NumberFlow },
  props: {
    auditStart: String,
    auditEnd: String,
    minDateObj: Object,
    maxDateObj: Object,
    auditLoading: Boolean,
    gapsLoading: Boolean,
    coverageSummary: Object,
  },
  emits: [
    'update:auditStart',
    'update:auditEnd',
    'run-audit',
    'trigger-backfill-gaps',
    'tarik-date',
  ],
};
</script>
