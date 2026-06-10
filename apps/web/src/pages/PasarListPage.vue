<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="Daftar Pasar" back-link="Kembali" class="navbar-custom"></f7-navbar>

    <f7-block class="margin-vertical-half">
      <!-- Search Bar -->
      <div class="glass-card" style="margin-bottom: 16px; padding: 12px 16px;">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Cari nama pasar..." 
          class="custom-input"
          style="background: rgba(15, 23, 42, 0.6);"
        />
      </div>

      <!-- Markets List -->
      <div v-if="loading" class="text-center" style="padding: 40px 0;">
        <f7-preloader color="blue"></f7-preloader>
      </div>

      <div v-else-if="filteredPasars.length === 0" class="text-center glass-card" style="padding: 40px 20px;">
        <p style="color: hsl(var(--text-secondary));">Tidak ada pasar yang ditemukan.</p>
      </div>

      <div v-else class="grid-responsive">
        <div 
          v-for="p in filteredPasars" 
          :key="p.id" 
          class="glass-card pasar-card pulse-hover"
        >
          <div class="flex-row justify-between align-center">
            <h4 class="title-outfit" style="margin: 0; font-size: 1.15rem;">{{ p.nama }}</h4>
            <span v-if="p.isNasional" class="badge-nasional">Nasional</span>
          </div>
          <p style="color: hsl(var(--text-secondary)); font-size: 0.85rem; margin: 8px 0 0 0;">
            Kelompok: {{ p.kelompok || 'Umum' }}
          </p>
          <div class="flex-row justify-between align-center" style="margin-top: 14px;">
            <span class="text-label" style="font-size: 0.7rem;">ID: {{ p.id }}</span>
            <span class="status-active" :style="{ color: p.isActive ? 'hsl(var(--status-success))' : 'hsl(var(--status-danger))' }">
              ● {{ p.isActive ? 'Aktif' : 'Nonaktif' }}
            </span>
          </div>
        </div>
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import { computed, inject, onMounted, ref } from 'vue';

export default {
  setup() {
    const apiBaseUrl = inject('apiBaseUrl');
    const pasars = ref([]);
    const searchQuery = ref('');
    const loading = ref(true);

    const fetchPasars = async () => {
      loading.value = true;
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/v1/pasar`);
        if (res.ok) {
          pasars.value = await res.json();
        }
      } catch (err) {
        console.error('Error fetching markets:', err);
      } finally {
        loading.value = false;
      }
    };

    const filteredPasars = computed(() => {
      if (!searchQuery.value) return pasars.value;
      const q = searchQuery.value.toLowerCase();
      return pasars.value.filter((p) => p.nama.toLowerCase().includes(q));
    });

    onMounted(() => {
      fetchPasars();
    });

    return {
      searchQuery,
      loading,
      filteredPasars,
    };
  },
};
</script>

<style scoped>
.pasar-card {
  padding: 16px;
}

.badge-nasional {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-active {
  font-size: 0.75rem;
  font-weight: 600;
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
