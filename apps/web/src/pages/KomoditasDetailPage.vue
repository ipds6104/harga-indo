<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="Detail Komoditas" back-link="Kembali" class="navbar-custom"></f7-navbar>

    <f7-block class="margin-vertical-half">
      <div v-if="loading" class="text-center" style="padding: 60px 0;">
        <f7-preloader color="blue"></f7-preloader>
      </div>

      <div v-else>
        <!-- Header / HET/HA Panel -->
        <HetHaPanel
          :variant-name="variantName"
          :het-ha-info="hetHaInfo"
          :current-price="history.length > 0 ? history[0].harga : 0"
          :avatar-url="getAvatarUrl(variantName)"
          :fallback-emoji="getFallbackEmoji(variantName)"
        />

        <!-- Trend Chart Section -->
        <PriceTrendChart
          :history="history"
          v-model:days="days"
          @update:days="onDaysChange"
          :het-ha-info="hetHaInfo"
        />

        <!-- Market Comparisons Table -->
        <MarketComparisonTable
          :comparisons="comparisons"
        />
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import { inject, onMounted, ref } from 'vue';
import { COMMODITY_AVATARS } from '../constants/commodities';
import HetHaPanel from './komoditas/HetHaPanel.vue';
import MarketComparisonTable from './komoditas/MarketComparisonTable.vue';
import PriceTrendChart from './komoditas/PriceTrendChart.vue';

export default {
  components: {
    HetHaPanel,
    PriceTrendChart,
    MarketComparisonTable,
  },
  props: {
    f7route: Object,
  },
  setup(props) {
    const apiBaseUrl = inject('apiBaseUrl');
    const variantId = props.f7route.params.id;

    const variantName = ref('Memuat...');
    const history = ref([]);
    const comparisons = ref([]);
    const days = ref(7);
    const loading = ref(true);
    const hetHaInfo = ref(null);

    const getAvatarUrl = (name) => {
      const mapped = COMMODITY_AVATARS[name];
      return mapped
        ? `https://harga-api.dvlp.asia/komoditas/${encodeURIComponent(mapped)}.webp`
        : null;
    };

    const getFallbackEmoji = (name) => {
      const n = name.toLowerCase();
      if (n.includes('beras')) return '🌾';
      if (n.includes('cabai')) return '🌶️';
      if (n.includes('bawang')) return '🧅';
      if (n.includes('minyak') || n.includes('minyakita')) return '🫙';
      if (n.includes('daging sapi')) return '🥩';
      if (n.includes('daging ayam') || n.includes('ayam')) return '🍗';
      if (n.includes('telur')) return '🥚';
      if (n.includes('ikan') || n.includes('udang')) return '🐟';
      if (n.includes('susu')) return '🥛';
      if (n.includes('tahu') || n.includes('tempe')) return '🟨';
      if (n.includes('gula')) return '🍬';
      if (n.includes('garam')) return '🧂';
      if (n.includes('mie') || n.includes('tepung')) return '🍜';
      if (n.includes('tomat')) return '🍅';
      if (n.includes('kentang')) return '🥔';
      if (n.includes('sawi') || n.includes('kangkung') || n.includes('bayam')) return '🥬';
      if (n.includes('pisang')) return '🍌';
      if (n.includes('jeruk')) return '🍊';
      if (n.includes('kacang')) return '🥜';
      if (n.includes('kedelai')) return '🫘';
      return '📦';
    };

    const fetchTrend = async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl.value}/api/v1/harga/trend?variant_id=${variantId}&days=${days.value}`,
        );
        if (res.ok) {
          history.value = await res.json();
        }
      } catch (err) {
        console.error('Error fetching trend:', err);
      }
    };

    const fetchComparisons = async () => {
      try {
        const savedKota = localStorage.getItem('selectedKota') || '3171';
        const savedTanggal = localStorage.getItem('selectedTanggal') || '';
        let url = `${apiBaseUrl.value}/api/v1/harga/perbandingan-pasar?variant_id=${variantId}&kode_kab_kota=${savedKota}`;
        if (savedTanggal) {
          url += `&tanggal=${savedTanggal}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          comparisons.value = await res.json();
        }
      } catch (err) {
        console.error('Error fetching comparisons:', err);
      }
    };

    const fetchHetHa = async () => {
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/v1/harga/het-ha?variant_id=${variantId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            const savedProvinsi = localStorage.getItem('selectedProvinsi') || '31';
            const matchedItem = json.data.items?.find(
              (item) => String(item.kode_provinsi) === String(savedProvinsi),
            );
            if (matchedItem) {
              hetHaInfo.value = {
                tipe: json.data.tipe,
                harga: matchedItem.harga,
                namaProvinsi: matchedItem.nama_provinsi,
                groupWilayah: matchedItem.group_wilayah,
                tanggal: json.data.tanggal_het_ha,
              };
            }
          }
        }
      } catch (err) {
        console.error('Error fetching HET/HA:', err);
      }
    };

    const onDaysChange = (newDays) => {
      days.value = newDays;
      fetchTrend();
    };

    const initData = async () => {
      loading.value = true;
      try {
        const comRes = await fetch(`${apiBaseUrl.value}/api/v1/komoditas`);
        if (comRes.ok) {
          const comList = await comRes.json();
          for (const c of comList) {
            const v = c.variants.find((x) => String(x.id) === String(variantId));
            if (v) {
              variantName.value = v.nama;
              break;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching variants list:', err);
      }

      await fetchHetHa();
      await Promise.all([fetchTrend(), fetchComparisons()]);
      loading.value = false;
    };

    onMounted(() => {
      initData();
    });

    return {
      variantName,
      history,
      comparisons,
      days,
      loading,
      getAvatarUrl,
      getFallbackEmoji,
      hetHaInfo,
      onDaysChange,
    };
  },
};
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.5) 100%);
}
</style>
