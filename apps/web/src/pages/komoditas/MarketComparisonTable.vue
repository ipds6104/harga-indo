<template>
  <div class="glass-card" style="margin-top: 16px;">
    <h4 class="title-outfit" style="margin: 0 0 16px 0;">Perbandingan Antar Pasar</h4>
    
    <div v-if="comparisons.length === 0" class="text-center" style="padding: 20px 0; color: hsl(var(--text-muted));">
      Tidak ada data perbandingan pasar untuk wilayah ini.
    </div>

    <table v-else class="styled-table">
      <thead>
        <tr>
          <th>Pasar</th>
          <th class="text-right">Harga</th>
          <th class="text-right">Perubahan</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in comparisons" :key="c.pasarId">
          <td style="font-weight: 500;">{{ c.pasarNama }}</td>
          <td class="text-right font-semibold" style="display: flex; justify-content: flex-end;">
            <NumberFlow
              :value="Math.round(c.harga)"
              locales="id-ID"
              :format="{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }"
            />
          </td>
          <td class="text-right">
            <span :class="['badge-price', getPriceChangeClass(c.perubahan)]">
              {{ c.perubahan > 0 ? '+' : '' }}{{ c.perubahan.toFixed(1) }}%
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import NumberFlow from '@number-flow/vue';

export default {
  components: {
    NumberFlow,
  },
  props: {
    comparisons: {
      type: Array,
      required: true,
    },
  },
  setup() {
    const getPriceChangeClass = (val) => {
      if (val > 0) return 'up';
      if (val < 0) return 'down';
      return 'stable';
    };

    return {
      getPriceChangeClass,
    };
  },
};
</script>

<style scoped>
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

.badge-price {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-price.up {
  background: rgba(239, 68, 68, 0.12);
  color: hsl(var(--status-danger));
}

.badge-price.down {
  background: rgba(16, 185, 129, 0.12);
  color: hsl(var(--status-success));
}

.badge-price.stable {
  background: rgba(148, 163, 184, 0.12);
  color: hsl(var(--text-secondary));
}
</style>
