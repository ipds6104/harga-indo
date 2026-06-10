<template>
  <div class="glass-card" style="margin-bottom: 24px;">
    <h4 class="title-outfit" style="margin: 0 0 16px 0;">Cakupan Penarikan Historis</h4>
    
    <div v-if="historicalLogs.length === 0" class="text-center" style="padding: 20px 0; color: hsl(var(--text-muted));">
      Belum ada data penarikan historis di database.
    </div>

    <div v-else>
      <div style="overflow-x: auto; overflow-y: hidden;">
        <table class="styled-table font-sm">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Cakupan Ingestion</th>
              <th class="text-right">Sukses</th>
              <th class="text-right">Gagal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hl in historicalLogs" :key="hl.tanggal">
              <td style="font-weight: 600;">{{ hl.tanggal }}</td>
              <td>
                <div class="flex-row align-center gap-xs">
                  <!-- Micro Progress Indicator -->
                  <div class="progress-bar-container" style="width: 80px; height: 6px;">
                    <div class="progress-bar-fill success" :style="{ width: hl.percentage + '%' }"></div>
                  </div>
                  <span style="font-size: 0.8rem; font-weight: 500; display: flex; align-items: center; gap: 1px;">
                    <NumberFlow :value="hl.percentage" />%
                  </span>
                </div>
              </td>
              <td class="text-right success-text">
                <div style="display: flex; justify-content: flex-end;">
                  <NumberFlow :value="hl.succeeded" />
                </div>
              </td>
              <td class="text-right failed-text">
                <div style="display: flex; justify-content: flex-end;">
                  <NumberFlow :value="hl.failed" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Load More Button -->
      <div v-if="hasMore" style="margin-top: 16px; text-align: center;">
        <button 
          @click="$emit('load-more')" 
          class="btn-load-more" 
          :disabled="loadingMore"
        >
          {{ loadingMore ? 'Memuat...' : '⬇ Tampilkan Lebih Banyak' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';

export default {
  components: {
    NumberFlow,
  },
  props: {
    historicalLogs: {
      type: Array,
      required: true,
    },
    hasMore: {
      type: Boolean,
      default: true,
    },
    loadingMore: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['load-more'],
};
</script>

<style scoped>
.btn-load-more {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: hsl(var(--text-secondary));
  padding: 8px 16px;
  font-size: 0.85rem;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-load-more:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transform: translateY(-1px);
}
.btn-load-more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
