import { f7 } from 'framework7-vue';
import { computed, inject, onMounted, ref } from 'vue';
import { CATEGORIES, CATEGORY_KEYWORDS } from '../constants/categories';
import { COMMODITY_AVATARS } from '../constants/commodities';

export function useHomePage() {
  const currentPersona = inject<any>('currentPersona');
  const apiBaseUrl = inject<any>('apiBaseUrl');

  const provinsiList = ref<any[]>([]);
  const kotaList = ref<any[]>([]);
  const prices = ref<any[]>([]);
  const aiInsight = ref<any>(null);

  // Restore preferences from localStorage
  const savedProv = localStorage.getItem('hargia_prov') || '';
  const savedKota = localStorage.getItem('hargia_kota') || '';
  const savedTanggal =
    localStorage.getItem('hargia_tanggal') ||
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

  const selectedProv = ref(savedProv);
  const selectedKota = ref(savedKota);
  const selectedTanggal = ref(savedTanggal);
  const lastUpdatedDate = ref('');
  const loading = ref(false);
  const failedImages = ref<Record<string, boolean>>({});
  const searchQuery = ref('');
  const selectedCategory = ref('all');

  const categories = CATEGORIES;

  // Greeting based on current Jakarta time
  const jakartaHour = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  });
  const hour = Number.parseInt(jakartaHour);
  const greetEmoji = hour < 11 ? '🌅' : hour < 15 ? '☀️' : hour < 18 ? '🌤️' : '🌙';
  const greetText =
    hour < 11
      ? 'Selamat Pagi!'
      : hour < 15
        ? 'Selamat Siang!'
        : hour < 18
          ? 'Selamat Sore!'
          : 'Selamat Malam!';

  const locationLabel = computed(() => {
    if (selectedProv.value && selectedKota.value) {
      const kotaObj = kotaList.value.find((k) => k.kode === selectedKota.value);
      return `Harga di ${kotaObj ? kotaObj.nama : 'Kota'}`;
    }
    if (selectedProv.value) {
      const provObj = provinsiList.value.find((p) => p.kode === selectedProv.value);
      return `Rata-rata harga Provinsi ${provObj ? provObj.nama : 'Provinsi'}`;
    }
    return 'Rata-rata harga seluruh Indonesia';
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getAvatarUrl = (name: string) => {
    const mapped = COMMODITY_AVATARS[name];
    return mapped
      ? `https://harga-api.dvlp.asia/komoditas/${encodeURIComponent(mapped)}.webp`
      : null;
  };

  const getFallbackEmoji = (name: string) => {
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

  const handleImageError = (name: string) => {
    failedImages.value[name] = true;
  };

  const getCategoryForItem = (name: string) => {
    const n = name.toLowerCase();
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      if (kws.some((kw) => n.includes(kw))) return cat;
    }
    return 'lainnya';
  };

  const filteredPrices = computed(() => {
    let list = prices.value;
    if (selectedCategory.value !== 'all') {
      list = list.filter((item) => getCategoryForItem(item.variantNama) === selectedCategory.value);
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter((item) => item.variantNama.toLowerCase().includes(q));
    }
    return list;
  });

  const pricesUp = computed(() => prices.value.filter((p) => p.avgPerubahan > 0.1).length);
  const pricesDown = computed(() => prices.value.filter((p) => p.avgPerubahan < -0.1).length);
  const pricesStable = computed(
    () => prices.value.filter((p) => Math.abs(p.avgPerubahan) <= 0.1).length,
  );

  const getPriceChangeClass = (val: number) => (val > 0.1 ? 'up' : val < -0.1 ? 'down' : 'stable');

  const clearFilters = () => {
    searchQuery.value = '';
    selectedCategory.value = 'all';
  };

  const switchPersona = () => {
    currentPersona.value = 'management';
    f7.views.main.router.navigate('/dashboard', { reloadAll: true });
  };

  const fetchProvinsi = async () => {
    try {
      const res = await fetch(`${apiBaseUrl.value}/api/v1/provinsi`);
      if (res.ok) provinsiList.value = await res.json();
    } catch (err) {
      console.error('Error fetching provinsi:', err);
    }
  };

  const fetchCities = async () => {
    if (!selectedProv.value) {
      kotaList.value = [];
      selectedKota.value = '';
      return;
    }
    try {
      const res = await fetch(
        `${apiBaseUrl.value}/api/v1/kota?kode_provinsi=${selectedProv.value}`,
      );
      if (res.ok) kotaList.value = await res.json();
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  };

  const onProvChange = async () => {
    selectedKota.value = '';
    localStorage.setItem('hargia_prov', selectedProv.value);
    localStorage.removeItem('hargia_kota');
    await fetchCities();
    fetchPrices();
  };

  const fetchPrices = async () => {
    loading.value = true;
    // Persist choices
    localStorage.setItem('hargia_prov', selectedProv.value);
    localStorage.setItem('hargia_kota', selectedKota.value);
    localStorage.setItem('hargia_tanggal', selectedTanggal.value);

    try {
      let url = `${apiBaseUrl.value}/api/v1/harga/hari-ini?tanggal=${selectedTanggal.value}`;
      if (selectedProv.value) url += `&provinsi_id=${selectedProv.value}`;
      if (selectedKota.value) url += `&kota_id=${selectedKota.value}`;

      const priceRes = await fetch(url);
      if (priceRes.ok) {
        const data = await priceRes.json();
        // Sort: biggest price change first (absolute value), for interesting view
        prices.value = data.sort(
          (a: any, b: any) => Math.abs(b.avgPerubahan) - Math.abs(a.avgPerubahan),
        );
        if (data.length > 0) lastUpdatedDate.value = data[0].tanggal;
      }

      // AI Insight (province-level only)
      if (selectedProv.value) {
        try {
          const insightRes = await fetch(
            `${apiBaseUrl.value}/api/v1/insights/daily?kode_provinsi=${selectedProv.value}`,
          );
          if (insightRes.ok) {
            const insightData = await insightRes.json();
            aiInsight.value = insightData ? insightData.kontenJson : null;
          } else {
            aiInsight.value = null;
          }
        } catch {
          aiInsight.value = null;
        }
      } else {
        aiInsight.value = null;
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
    } finally {
      loading.value = false;
    }
  };

  const getTitleText = computed(() => {
    if (selectedProv.value && selectedKota.value) {
      const kotaObj = kotaList.value.find((k) => k.kode === selectedKota.value);
      return `Harga di ${kotaObj ? kotaObj.nama : 'Kota'}`;
    }
    if (selectedProv.value) {
      const provObj = provinsiList.value.find((p) => p.kode === selectedProv.value);
      return `Rata-rata Provinsi ${provObj ? provObj.nama : ''}`;
    }
    return 'Rata-rata Nasional';
  });

  const datepickerValue = computed(() =>
    selectedTanggal.value ? [new Date(selectedTanggal.value)] : [],
  );

  const onTanggalChange = (val: any) => {
    if (val && val.length > 0) {
      const formatted = val[0].toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      if (formatted !== selectedTanggal.value) {
        selectedTanggal.value = formatted;
        fetchPrices();
      }
    }
  };

  const viewDetails = (variantId: number) => {
    f7.views.main.router.navigate(`/komoditas/${variantId}`);
  };

  const onPageAfterIn = () => {
    // Re-fetch if coming back from detail page (in case data changed)
  };

  onMounted(async () => {
    await fetchProvinsi();
    // If we had a saved province, load its cities too
    if (selectedProv.value) await fetchCities();
    fetchPrices();
  });

  return {
    provinsiList,
    kotaList,
    prices,
    filteredPrices,
    aiInsight,
    selectedProv,
    selectedKota,
    selectedTanggal,
    lastUpdatedDate,
    loading,
    failedImages,
    searchQuery,
    selectedCategory,
    categories,
    greetEmoji,
    greetText,
    locationLabel,
    pricesUp,
    pricesDown,
    pricesStable,
    switchPersona,
    onProvChange,
    fetchPrices,
    getPriceChangeClass,
    viewDetails,
    getTitleText,
    getAvatarUrl,
    getFallbackEmoji,
    handleImageError,
    datepickerValue,
    onTanggalChange,
    formatDate,
    clearFilters,
    onPageAfterIn,
  };
}
