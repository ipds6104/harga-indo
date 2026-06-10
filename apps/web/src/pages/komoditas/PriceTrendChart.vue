<template>
  <div class="glass-card" style="margin-top: 16px; min-height: 280px;">
    <div class="flex-row justify-between align-center" style="margin-bottom: 20px;">
      <h4 class="title-outfit" style="margin: 0;">Tren Harga Harian</h4>
      <div class="toggle-group">
        <button 
          v-for="d in [7, 30]" 
          :key="d" 
          @click="$emit('update:days', d)"
          :class="['toggle-btn', days === d ? 'active' : '']"
        >
          {{ d }} Hari
        </button>
      </div>
    </div>
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script>
import Chart from 'chart.js/auto';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export default {
  props: {
    history: {
      type: Array,
      required: true,
    },
    days: {
      type: Number,
      required: true,
    },
    hetHaInfo: {
      type: Object,
      default: null,
    },
  },
  emits: ['update:days'],
  setup(props) {
    const chartCanvas = ref(null);
    let chartInstance = null;

    const renderChart = () => {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      if (!chartCanvas.value) return;

      const ctx = chartCanvas.value.getContext('2d');
      // API returns desc (latest first), reverse it for chronological chart display
      const data = [...props.history].reverse();
      const labels = data.map((d) => d.tanggal);
      const prices = data.map((d) => d.harga);

      const gradient = ctx.createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

      const datasets = [
        {
          label: 'Harga (Rp)',
          data: prices,
          borderColor: '#3b82f6',
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#60a5fa',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ];

      if (props.hetHaInfo) {
        datasets.push({
          label: props.hetHaInfo.tipe,
          data: Array(prices.length).fill(props.hetHaInfo.harga),
          borderColor: props.hetHaInfo.tipe === 'HET' ? '#ec4899' : '#3b82f6',
          borderWidth: 2,
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0,
        });
      }

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: !!props.hetHaInfo,
              labels: {
                color: '#94a3b8',
                font: { family: 'Outfit, sans-serif', size: 11 },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' },
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#94a3b8',
                callback: (val) => `Rp${val.toLocaleString('id-ID')}`,
              },
            },
          },
        },
      });
    };

    watch(
      [() => props.history, () => props.hetHaInfo],
      () => {
        nextTick(() => {
          renderChart();
        });
      },
      { deep: true },
    );

    onMounted(() => {
      nextTick(() => {
        renderChart();
      });
    });

    onBeforeUnmount(() => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    });

    return {
      chartCanvas,
    };
  },
};
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 240px;
  width: 100%;
}

.toggle-group {
  background: hsl(var(--bg-secondary));
  padding: 2px;
  border-radius: 8px;
  display: flex;
}

.toggle-btn {
  border: none;
  background: transparent;
  color: hsl(var(--text-secondary));
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.toggle-btn.active {
  background: hsl(var(--bg-tertiary));
  color: hsl(var(--text-primary));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
</style>
