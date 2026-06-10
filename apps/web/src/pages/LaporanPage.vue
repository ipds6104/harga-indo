<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="Laporan & Ringkasan AI" back-link="Kembali" class="navbar-custom"></f7-navbar>

    <f7-block class="margin-vertical-half">
      <!-- Welcome Intro -->
      <div class="glass-card header-card" style="margin-bottom: 16px;">
        <h3 class="title-outfit font-20" style="margin: 0;">Laporan Analitik AI</h3>
        <p style="color: hsl(var(--text-secondary)); font-size: 0.9rem; margin: 4px 0 0 0;">
          Kumpulan rangkuman narasi tren, analisis anomali, dan ringkasan eksekutif untuk manajemen tingkat atas.
        </p>
      </div>

      <div v-if="loading" class="text-center" style="padding: 40px 0;">
        <f7-preloader color="purple"></f7-preloader>
      </div>

      <div v-else>
        <!-- Trend Reports -->
        <div v-for="t in trendReports" :key="t.id" class="glass-card report-item" style="margin-bottom: 16px;">
          <div class="flex-row justify-between align-center" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px; margin-bottom: 12px;">
            <div class="flex-row align-center gap-xs">
              <span>📋</span>
              <span class="report-badge">Tren Regional</span>
            </div>
            <span class="text-label" style="font-size: 0.75rem;">{{ t.tanggal }}</span>
          </div>
          <p style="margin: 0; font-size: 0.95rem; line-height: 1.5;">{{ t.kontenJson.narrative }}</p>
          <div v-if="t.kontenJson.projection" style="margin-top: 10px; font-size: 0.85rem; color: hsl(var(--text-muted)); font-style: italic;">
            Proyeksi: "{{ t.kontenJson.projection }}"
          </div>
        </div>

        <!-- KPI / National Summaries -->
        <div v-for="k in kpiReports" :key="k.id" class="glass-card report-item purple-border" style="margin-bottom: 16px;">
          <div class="flex-row justify-between align-center" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px; margin-bottom: 12px;">
            <div class="flex-row align-center gap-xs">
              <span>👑</span>
              <span class="report-badge purple">Eksekutif KPI</span>
            </div>
            <span class="text-label" style="font-size: 0.75rem;">{{ k.tanggal }}</span>
          </div>
          <div class="kpi-block">
            <strong>Highlights:</strong>
            <ul style="margin: 4px 0 12px 0; padding-left: 20px; font-size: 0.9rem; color: hsl(var(--text-secondary));">
              <li v-for="(h, idx) in k.kontenJson.highlights" :key="idx">{{ h }}</li>
            </ul>
            <strong>Rekomendasi Kebijakan:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 0.9rem; color: hsl(var(--text-secondary));">
              <li v-for="(r, idx) in k.kontenJson.recommendations" :key="idx">{{ r }}</li>
            </ul>
          </div>
        </div>
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import { inject, onMounted, ref } from 'vue';

export default {
  setup() {
    const apiBaseUrl = inject('apiBaseUrl');
    const trendReports = ref([]);
    const kpiReports = ref([]);
    const loading = ref(true);

    const loadReports = async () => {
      loading.value = true;
      try {
        // Fetch all trends
        const res = await fetch(`${apiBaseUrl.value}/api/v1/harga/anomali`); // this route queries aiInsights
        if (res.ok) {
          const list = await res.json();
          // Sort reports locally or by category
          trendReports.value = list.filter((r) => r.tipe === 'trend');
          kpiReports.value = list.filter((r) => r.tipe === 'kpi');
        }
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      loadReports();
    });

    return {
      trendReports,
      kpiReports,
      loading,
    };
  },
};
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.5) 100%);
}

.report-item {
  border-left: 4px solid #3b82f6;
}

.report-item.purple-border {
  border-left: 4px solid #a855f7;
}

.report-badge {
  font-weight: 700;
  font-size: 0.8rem;
  color: #3b82f6;
  text-transform: uppercase;
}

.report-badge.purple {
  color: #a855f7;
}

.kpi-block strong {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: hsl(var(--text-muted));
  display: block;
}

.gap-xs {
  gap: 8px;
}

.flex-row {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.align-center {
  align-items: center;
}
</style>
