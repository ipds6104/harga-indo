<template>
  <div class="glass-card header-card" style="padding: 20px;">
    <div class="flex-row align-center gap-md" style="flex-wrap: wrap; justify-content: space-between; width: 100%;">
      <div class="flex-row align-center gap-sm">
        <div class="card-avatar-wrap" style="width: 64px; height: 64px;">
          <img
            v-if="avatarUrl && !imageFailed"
            :src="avatarUrl"
            @error="imageFailed = true"
            class="card-avatar-img"
            alt="Avatar"
          />
          <div v-else class="card-avatar-fallback" style="font-size: 1.8rem;">
            {{ fallbackEmoji }}
          </div>
        </div>
        <div>
          <span class="text-label">KOMODITAS</span>
          <h2 class="title-outfit font-24" style="margin: 4px 0 0 0;">{{ variantName }}</h2>
          <div v-if="hetHaInfo" style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
            <span class="badge-het" :style="{ background: hetColor }">
              {{ hetHaInfo.tipe }}: Rp {{ hetHaInfo.harga.toLocaleString('id-ID') }}
            </span>
            <span class="text-label" style="font-size: 0.75rem; color: hsl(var(--text-secondary));">
              ({{ hetHaInfo.namaProvinsi }})
            </span>
          </div>
        </div>
      </div>
      
      <div v-if="currentPrice > 0" class="text-right">
        <span class="text-label">RATA-RATA HARGA</span>
        <div class="text-price" style="font-size: 1.8rem; color: hsl(var(--accent-cyan)); display: flex; justify-content: flex-end; font-weight: 700;">
          <NumberFlow
            :value="Math.round(currentPrice)"
            locales="id-ID"
            :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
          />
        </div>
        <div v-if="hetHaInfo" style="margin-top: 4px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
          <span :style="{ color: hetDiffColor }">
            {{ hetDiffText }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';
import { computed, ref, watch } from 'vue';

export default {
  components: {
    NumberFlow,
  },
  props: {
    variantName: {
      type: String,
      required: true,
    },
    hetHaInfo: {
      type: Object,
      default: null,
    },
    currentPrice: {
      type: Number,
      default: 0,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    fallbackEmoji: {
      type: String,
      default: '📦',
    },
  },
  setup(props) {
    const imageFailed = ref(false);

    watch(
      () => props.variantName,
      () => {
        imageFailed.value = false;
      },
    );

    const hetColor = computed(() => {
      if (!props.hetHaInfo) return 'rgba(255, 255, 255, 0.1)';
      return props.hetHaInfo.tipe === 'HET'
        ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
        : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    });

    const hetDiffText = computed(() => {
      if (!props.hetHaInfo || props.currentPrice === 0) return '';
      const refPrice = props.hetHaInfo.harga;
      const diff = props.currentPrice - refPrice;
      const pct = (diff / refPrice) * 100;

      if (diff > 0) {
        return `⚠️ Rp ${Math.round(diff).toLocaleString('id-ID')} (${pct.toFixed(1)}%) di atas ${props.hetHaInfo.tipe}`;
      }
      if (diff < 0) {
        return `✅ Rp ${Math.round(Math.abs(diff)).toLocaleString('id-ID')} (${Math.abs(pct).toFixed(1)}%) di bawah ${props.hetHaInfo.tipe}`;
      }
      return `✓ Sesuai ${props.hetHaInfo.tipe}`;
    });

    const hetDiffColor = computed(() => {
      if (!props.hetHaInfo || props.currentPrice === 0) return 'hsl(var(--text-muted))';
      return props.currentPrice > props.hetHaInfo.harga
        ? 'hsl(var(--status-danger))'
        : 'hsl(var(--status-success))';
    });

    return {
      imageFailed,
      hetColor,
      hetDiffText,
      hetDiffColor,
    };
  },
};
</script>
