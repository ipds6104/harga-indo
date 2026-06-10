<template>
  <f7-page class="gradient-bg">
    <!-- Navbar -->
    <f7-navbar class="navbar-custom">
      <f7-nav-left>
        <f7-link panel-open="left">☰</f7-link>
      </f7-nav-left>
      <f7-nav-title class="title-outfit">📊 Dashboard Analitik Kemenko Pangan</f7-nav-title>
      <f7-nav-right>
        <f7-link @click="switchPersona">🛒 Belanja</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block class="margin-vertical-half">
      <div v-if="loading" class="text-center" style="padding: 60px 0;">
        <f7-preloader color="purple"></f7-preloader>
      </div>

      <div v-else>
        <!-- KPI Summary Hero -->
        <div v-if="kpi" class="glass-card kpi-hero" :class="kpi.status">
          <div class="flex-row justify-between align-start">
            <div>
              <span class="text-label">INDEKS STABILITAS HARGA</span>
              <h1 class="title-outfit score-title" style="margin: 4px 0 0 0; display: flex; align-items: center; gap: 6px;">
                <NumberFlow :value="kpi.score" />
                <span style="font-size: 1.5rem; opacity: 0.8; font-weight: 500;">/ 100</span>
              </h1>
            </div>
            <div :class="['status-badge', kpi.status]">
              {{ kpi.status.toUpperCase() }}
            </div>
          </div>

          <div style="margin-top: 24px;">
            <h4 class="title-outfit" style="margin: 0 0 8px 0; font-size: 0.95rem;">HIGHLIGHT DATA</h4>
            <ul class="highlight-list">
              <li v-for="(h, idx) in kpi.highlights" :key="idx">{{ h }}</li>
            </ul>
          </div>

          <div style="margin-top: 20px;" class="recommendations-box">
            <h4 class="title-outfit" style="margin: 0 0 8px 0; font-size: 0.95rem; color: #d8b4fe;">REKOMENDASI KEBIJAKAN</h4>
            <div v-for="(r, idx) in kpi.recommendations" :key="idx" class="rec-item">
              <span class="rec-bullet">🎯</span>
              <p style="margin: 0; font-size: 0.9rem; line-height: 1.4;">{{ r }}</p>
            </div>
          </div>
        </div>

        <!-- Province Drill Down Section -->
        <h3 class="title-outfit" style="margin: 24px 0 12px 0;">Monitoring Regional (Provinsi)</h3>
        
        <div class="grid-responsive">
          <div 
            v-for="prov in provinces" 
            :key="prov.kode" 
            class="glass-card prov-card pulse-hover"
            @click="viewProvince(prov.kode)"
          >
            <div class="flex-row justify-between align-center">
              <h4 class="title-outfit" style="margin: 0; font-size: 1.1rem;">{{ prov.nama }}</h4>
              <span class="view-details-arrow">➔</span>
            </div>
            <p style="color: hsl(var(--text-muted)); font-size: 0.8rem; margin: 6px 0 0 0;">
              Kode Wilayah: {{ prov.kode }}
            </p>
          </div>
        </div>
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import NumberFlow from '@number-flow/vue';
import { f7 } from 'framework7-vue';
import { inject, onMounted, ref } from 'vue';

export default {
  components: {
    NumberFlow,
  },
  setup() {
    const currentPersona = inject('currentPersona');
    const apiBaseUrl = inject('apiBaseUrl');

    const kpi = ref(null);
    const provinces = ref([]);
    const loading = ref(true);

    const switchPersona = () => {
      currentPersona.value = 'household';
      f7.views.main.router.navigate('/', { reloadAll: true });
    };

    const loadData = async () => {
      loading.value = true;
      try {
        // Fetch KPIs
        const kpiRes = await fetch(`${apiBaseUrl.value}/api/v1/insights/management`);
        if (kpiRes.ok) {
          const raw = await kpiRes.json();
          kpi.value = raw
            ? raw.kontenJson
            : {
                score: 95,
                status: 'normal',
                highlights: ['Sistem baru berjalan.', 'Semua data pasar stabil.'],
                recommendations: ['Lakukan monitoring berkala harian pada pukul 07:30 WIB.'],
              };
        }

        // Fetch Provinces
        const provRes = await fetch(`${apiBaseUrl.value}/api/v1/provinsi`);
        if (provRes.ok) {
          provinces.value = await provRes.json();
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        loading.value = false;
      }
    };

    const viewProvince = (code) => {
      f7.views.main.router.navigate(`/provinsi/${code}`);
    };

    onMounted(() => {
      loadData();
    });

    return {
      kpi,
      provinces,
      loading,
      switchPersona,
      viewProvince,
    };
  },
};
</script>

<style scoped>
.kpi-hero {
  border-left: 6px solid #3b82f6;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
}

.kpi-hero.critical {
  border-left-color: hsl(var(--status-danger));
}

.kpi-hero.warning {
  border-left-color: hsl(var(--status-warning));
}

.kpi-hero.normal {
  border-left-color: hsl(var(--status-success));
}

.score-title {
  font-size: 2.2rem;
  background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid;
}

.status-badge.normal {
  background: rgba(16, 185, 129, 0.15);
  color: hsl(var(--status-success));
  border-color: rgba(16, 185, 129, 0.3);
}

.status-badge.warning {
  background: rgba(245, 158, 11 0.15);
  color: hsl(var(--status-warning));
  border-color: rgba(245, 158, 11, 0.3);
}

.status-badge.critical {
  background: rgba(239, 68, 68, 0.15);
  color: hsl(var(--status-danger));
  border-color: rgba(239, 68, 68, 0.3);
}

.highlight-list {
  padding-left: 20px;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
  line-height: 1.5;
}

.recommendations-box {
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  padding: 16px;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.kpi-hero .text-label {
  color: rgba(255, 255, 255, 0.55);
}

.kpi-hero h4 {
  color: rgba(255, 255, 255, 0.9);
}

.rec-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
}

.rec-bullet {
  flex-shrink: 0;
  font-size: 0.95rem;
}

.prov-card {
  cursor: pointer;
  padding: 18px 20px;
}

.view-details-arrow {
  color: hsl(var(--text-muted));
  font-weight: bold;
  font-size: 1.1rem;
}

.prov-card:hover .view-details-arrow {
  color: hsl(var(--accent-primary));
  transform: translateX(4px);
  transition: all 0.2s;
}

.flex-row {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.align-start {
  align-items: flex-start;
}

.align-center {
  align-items: center;
}
</style>
