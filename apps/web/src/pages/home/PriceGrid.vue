<template>
  <div>
    <!-- ===== SKELETON LOADING ===== -->
    <div v-if="loading" class="grid-responsive">
      <div v-for="i in 8" :key="i" class="glass-card price-card-skeleton">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-line skeleton-name"></div>
          <div class="skeleton-line skeleton-price"></div>
          <div class="skeleton-line skeleton-sub"></div>
        </div>
      </div>
    </div>

    <!-- ===== EMPTY STATE ===== -->
    <div v-else-if="filteredPrices.length === 0" class="empty-state glass-card">
      <div class="empty-icon">{{ searchQuery || selectedCategory !== 'all' ? '🔍' : '📉' }}</div>
      <h4 class="title-outfit empty-title">
        {{ searchQuery ? `Tidak ditemukan "${searchQuery}"` : selectedCategory !== 'all' ? 'Tidak ada data kategori ini' : 'Tidak ada data harga' }}
      </h4>
      <p class="empty-subtitle">
        {{ searchQuery || selectedCategory !== 'all' ? 'Coba kata kunci atau kategori lain.' : 'Tidak ada data untuk wilayah dan tanggal terpilih.' }}
      </p>
      <button v-if="searchQuery || selectedCategory !== 'all'" @click="$emit('clear-filters')" class="btn-clear-filter">
        Reset Filter
      </button>
    </div>

    <!-- ===== PRICE GRID ===== -->
    <div v-else class="grid-responsive">
      <PriceCard
        v-for="item in filteredPrices"
        :key="item.variantId"
        :item="item"
        :get-avatar-url="getAvatarUrl"
        :get-fallback-emoji="getFallbackEmoji"
        :get-price-change-class="getPriceChangeClass"
        :view-details="viewDetails"
      />
    </div>
  </div>
</template>

<script>
import PriceCard from './PriceCard.vue';

export default {
  components: { PriceCard },
  props: {
    loading: Boolean,
    filteredPrices: Array,
    searchQuery: String,
    selectedCategory: String,
    getAvatarUrl: Function,
    getFallbackEmoji: Function,
    getPriceChangeClass: Function,
    viewDetails: Function,
  },
  emits: ['clear-filters'],
};
</script>
