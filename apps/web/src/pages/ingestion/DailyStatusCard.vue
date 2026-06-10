<template>
  <div class="glass-card" style="margin-bottom: 16px;">
    <div class="flex-row justify-between align-center" style="margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
      <h4 class="title-outfit" style="margin: 0; font-size: 0.95rem;">METRIK SCRAPER</h4>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="text-label" style="font-size: 0.75rem;">MONITOR TANGGAL:</span>
        <input 
          type="date" 
          :value="monitoredDate" 
          @change="$emit('update:monitoredDate', $event.target.value)"
          style="background: rgba(255, 255, 255, 0.08); border: 1px solid var(--glass-border); border-radius: 8px; color: white; padding: 4px 12px; font-size: 0.85rem; font-family: 'Inter', sans-serif; outline: none; cursor: pointer;"
        />
      </div>
    </div>
    
    <div class="flex-row justify-between align-center" style="margin-bottom: 12px;">
      <span class="text-label">Progress Run</span>
      <span style="font-weight: bold; color: hsl(var(--accent-cyan)); display: flex; align-items: center; gap: 4px;">
        <NumberFlow :value="status.succeeded + status.failed" /> / <NumberFlow :value="status.totalMarkets" /> Pasar (<NumberFlow :value="pct" />%)
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar-container">
      <div class="progress-bar-fill success" :style="{ width: pctSuccess + '%' }"></div>
      <div class="progress-bar-fill failed" :style="{ width: pctFailed + '%' }"></div>
    </div>

    <!-- Active Batch Progress Details -->
    <div v-if="status.activeRunId" class="flex-row justify-between align-center" style="margin-top: 14px; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 8px; font-size: 0.8rem;">
      <span class="text-label" style="font-size: 0.72rem; color: hsl(var(--text-muted));">BATCH RUN: {{ status.activeRunId.slice(0, 8) }}...</span>
      <span style="font-weight: 600; color: hsl(var(--text-secondary)); display: flex; align-items: center; gap: 4px;">
        Selesai: <span style="color: hsl(var(--status-success)); font-weight: bold; display: inline-flex;"><NumberFlow :value="status.runCompletedCount" /></span>
        <span style="color: hsl(var(--text-muted)); margin: 0 4px;">|</span>
        Gagal: <span style="color: hsl(var(--status-danger)); font-weight: bold; display: inline-flex;"><NumberFlow :value="status.runFailedCount" /></span>
      </span>
    </div>

    <div class="metrics-grid" style="margin-top: 20px;">
      <div class="metric-box">
        <span class="text-label">SUKSES</span>
        <span class="metric-val success" style="display: flex; justify-content: center;">
          <NumberFlow :value="status.succeeded" />
        </span>
      </div>
      <div class="metric-box">
        <span class="text-label">GAGAL</span>
        <span class="metric-val failed" style="display: flex; justify-content: center;">
          <NumberFlow :value="status.failed" />
        </span>
      </div>
      <div class="metric-box">
        <span class="text-label">ANTRIAN</span>
        <span class="metric-val pending" style="display: flex; justify-content: center;">
          <NumberFlow :value="status.pending" />
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';

export default {
  components: { NumberFlow },
  props: {
    status: Object,
    monitoredDate: String,
    pct: Number,
    pctSuccess: Number,
    pctFailed: Number,
  },
  emits: ['update:monitoredDate'],
};
</script>
