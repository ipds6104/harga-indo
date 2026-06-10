<template>
  <div
    class="glass-card price-card pulse-hover"
    @click="viewDetails(item.variantId)"
  >
    <!-- Avatar -->
    <div class="card-avatar-wrap">
      <img
        v-if="getAvatarUrl(item.variantNama) && !imageFailed"
        :src="getAvatarUrl(item.variantNama)"
        :alt="item.variantNama"
        @error="imageFailed = true"
        class="card-avatar-img"
        loading="lazy"
      />
      <div v-else class="card-avatar-fallback">
        {{ getFallbackEmoji(item.variantNama) }}
      </div>
      <!-- Change badge overlaid on avatar -->
      <div :class="['change-overlay', getPriceChangeClass(item.avgPerubahan)]">
        {{ item.avgPerubahan > 0 ? '▲' : item.avgPerubahan < 0 ? '▼' : '●' }}
      </div>
    </div>

    <!-- Info -->
    <div class="card-info">
      <span class="commodity-name" :title="item.variantNama">{{ item.variantNama }}</span>

      <div class="price-main">
        <NumberFlow
          :value="Math.round(item.avgHarga)"
          locales="id-ID"
          :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
        />
      </div>

      <div class="price-row-bottom">
        <span class="prev-label">Sebelumnya</span>
        <span class="prev-value">
          <NumberFlow
            :value="Math.round(item.avgHargaSebelumnya)"
            locales="id-ID"
            :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
          />
        </span>
        <span :class="['pct-badge', getPriceChangeClass(item.avgPerubahan)]">
          {{ item.avgPerubahan > 0 ? '+' : '' }}{{ Math.abs(item.avgPerubahan).toFixed(1) }}%
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';
import { ref } from 'vue';

export default {
  components: { NumberFlow },
  props: {
    item: Object,
    getAvatarUrl: Function,
    getFallbackEmoji: Function,
    getPriceChangeClass: Function,
    viewDetails: Function,
  },
  setup() {
    const imageFailed = ref(false);
    return { imageFailed };
  },
};
</script>
