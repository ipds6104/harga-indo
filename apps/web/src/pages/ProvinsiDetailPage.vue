<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="Detail Provinsi" back-link="Kembali" class="navbar-custom"></f7-navbar>

    <f7-block class="margin-vertical-half">
      <div v-if="loading" class="text-center" style="padding: 60px 0;">
        <f7-preloader color="purple"></f7-preloader>
      </div>

      <div v-else>
        <!-- Header Card -->
        <div class="glass-card province-header" style="margin-bottom: 16px;">
          <span class="text-label">PROVINSI</span>
          <h2 class="title-outfit font-24" style="margin: 4px 0 0 0;">{{ provName }}</h2>
        </div>

        <!-- AI Trend Card -->
        <div v-if="trend" class="glass-card gradient-accent-bg" style="margin-bottom: 16px;">
          <div class="flex-row align-center gap-xs" style="margin-bottom: 10px;">
            <span style="font-size: 1.2rem;">📈</span>
            <h4 class="title-outfit" style="margin: 0; color: #a855f7;">AI Analisis Tren Regional</h4>
          </div>
          <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: hsl(var(--text-primary));">
            {{ trend.narrative }}
          </p>
          <div class="projection-box" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1);">
            <strong style="font-size: 0.85rem; color: #cbd5e1; display: block; margin-bottom: 4px;">PROYEKSI HARGA (3 HARI)</strong>
            <span style="font-size: 0.9rem; color: hsl(var(--text-secondary));">{{ trend.projection }}</span>
          </div>
        </div>

        <!-- Anomalies Section -->
        <div class="glass-card" style="margin-bottom: 16px;">
          <h4 class="title-outfit" style="margin: 0 0 16px 0; color: hsl(var(--status-danger));">Anomali Harga Terdeteksi</h4>
          
          <div v-if="anomalies.length === 0" class="text-center" style="padding: 20px 0; color: hsl(var(--text-muted));">
            ✅ Tidak ada anomali harga mencurigakan di provinsi ini hari ini.
          </div>

          <div v-else class="anomalies-list">
            <div v-for="(an, idx) in anomalies" :key="idx" class="anomaly-item">
              <div class="flex-row justify-between align-center">
                <span class="anomaly-title">{{ an.nama }}</span>
                <span class="anomaly-badge" :class="an.severity">{{ an.severity }}</span>
              </div>
              <div class="anomaly-details" style="display: flex; align-items: center; gap: 4px;">
                <span>Harga:</span>
                <NumberFlow
                  :value="Math.round(an.harga)"
                  locales="id-ID"
                  :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
                />
                <span>(+{{ an.perubahan }}%)</span>
              </div>
              <p class="anomaly-reason">{{ an.reason }}</p>
            </div>
          </div>
        </div>

        <!-- Province Average Prices -->
        <div class="glass-card">
          <h4 class="title-outfit" style="margin: 0 0 16px 0;">Rata-Rata Harga Sembako</h4>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Komoditas</th>
                <th class="text-right">Harga</th>
                <th class="text-right">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in prices" :key="p.variantId">
                <td style="font-weight: 500;">{{ p.variantNama }}</td>
                <td class="text-right font-semibold" style="display: flex; justify-content: flex-end;">
                  <NumberFlow
                    :value="Math.round(p.avgHarga)"
                    locales="id-ID"
                    :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
                  />
                </td>
                <td class="text-right">
                  <span :class="['badge-price', getPriceChangeClass(p.avgPerubahan)]">
                    {{ p.avgPerubahan > 0 ? '+' : '' }}{{ p.avgPerubahan.toFixed(1) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import NumberFlow from '@number-flow/vue';
import { inject, onMounted, ref } from 'vue';

export default {
  components: {
    NumberFlow,
  },
  props: {
    f7route: Object,
  },
  setup(props) {
    const apiBaseUrl = inject('apiBaseUrl');
    const provCode = props.f7route.params.kode;

    const provName = ref('Memuat...');
    const trend = ref(null);
    const anomalies = ref([]);
    const prices = ref([]);
    const loading = ref(true);

    const getPriceChangeClass = (val) => {
      if (val > 0) return 'up';
      if (val < 0) return 'down';
      return 'stable';
    };

    const loadProvinceData = async () => {
      loading.value = true;
      try {
        // Fetch province name
        const provsRes = await fetch(`${apiBaseUrl.value}/api/v1/provinsi`);
        if (provsRes.ok) {
          const list = await provsRes.json();
          const match = list.find((p) => String(p.kode) === String(provCode));
          if (match) provName.value = match.nama;
        }

        // Fetch prices in province
        const pricesRes = await fetch(
          `${apiBaseUrl.value}/api/v1/harga/hari-ini?provinsi_id=${provCode}`,
        );
        if (pricesRes.ok) {
          prices.value = await pricesRes.json();
        }

        // Fetch anomalies
        const anomRes = await fetch(
          `${apiBaseUrl.value}/api/v1/harga/anomali?kode_provinsi=${provCode}`,
        );
        if (anomRes.ok) {
          const list = await anomRes.json();
          anomalies.value = list.length > 0 ? list[0].kontenJson : [];
        }

        // Fetch AI trends
        const trendRes = await fetch(
          `${apiBaseUrl.value}/api/v1/insights/daily?kode_provinsi=${provCode}`,
        );
        if (trendRes.ok) {
          const tData = await trendRes.json();
          trend.value = tData
            ? tData.kontenJson
            : {
                narrative: `Harga di wilayah ${provName.value} stabil dengan fluktuasi wajar.`,
                projection: 'Stabil dalam jangka pendek.',
              };
        }
      } catch (err) {
        console.error('Error loading province data:', err);
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      loadProvinceData();
    });

    return {
      provName,
      trend,
      anomalies,
      prices,
      loading,
      getPriceChangeClass,
    };
  },
};
</script>

<style scoped>
.province-header {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.5) 100%);
}

.anomaly-item {
  border: 1px solid rgba(239, 68, 68, 0.15);
  background: rgba(239, 68, 68, 0.03);
  padding: 14px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.anomaly-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #f87171;
}

.anomaly-badge {
  padding: 2px 8px;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 700;
  border-radius: 4px;
}

.anomaly-badge.high {
  background: rgba(239, 68, 68, 0.2);
  color: hsl(var(--status-danger));
}

.anomaly-badge.medium {
  background: rgba(245, 158, 11, 0.2);
  color: hsl(var(--status-warning));
}

.anomaly-badge.low {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.anomaly-details {
  font-size: 0.8rem;
  color: hsl(var(--text-secondary));
  margin-top: 4px;
  font-weight: 500;
}

.anomaly-reason {
  margin: 8px 0 0 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #cbd5e1;
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.styled-table th {
  padding: 12px 8px;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: hsl(var(--text-muted));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.styled-table td {
  padding: 14px 8px;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.styled-table tr:last-child td {
  border-bottom: none;
}

.text-right {
  text-align: right;
}

.font-semibold {
  font-weight: 600;
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
