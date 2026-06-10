<template>
  <f7-page class="gradient-bg" @page:afterin="onPageAfterIn">
    <!-- Navbar -->
    <f7-navbar class="navbar-custom">
      <f7-nav-left>
        <f7-link panel-open="left">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </f7-link>
      </f7-nav-left>
      <f7-nav-title class="title-outfit">🛒 Hargia</f7-nav-title>
      <f7-nav-right>
        <f7-link @click="switchPersona" class="admin-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>Dashboard</span>
        </f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block class="margin-vertical-half home-block">
      <!-- ===== HERO SECTION ===== -->
      <HeroSection
        :greet-emoji="greetEmoji"
        :greet-text="greetText"
        :location-label="locationLabel"
        :last-updated-date="lastUpdatedDate"
        :format-date="formatDate"
      />

      <!-- ===== LOCATION FILTERS ===== -->
      <LocationFilters
        :provinsi-list="provinsiList"
        :kota-list="kotaList"
        v-model:selectedProv="selectedProv"
        @update:selectedProv="onProvChange"
        v-model:selectedKota="selectedKota"
        @update:selectedKota="fetchPrices"
        :datepicker-value="datepickerValue"
        @calendar:change="onTanggalChange"
      />

      <!-- ===== QUICK STATS ===== -->
      <QuickStats
        v-if="!loading && prices.length > 0"
        :total="prices.length"
        :up="pricesUp"
        :down="pricesDown"
        :stable="pricesStable"
      />

      <!-- ===== AI INSIGHT ===== -->
      <AiInsightCard
        v-if="aiInsight"
        :ai-insight="aiInsight"
      />

      <!-- ===== SEARCH + CATEGORY FILTER ===== -->
      <SearchFilterBar
        v-model:searchQuery="searchQuery"
        v-model:selectedCategory="selectedCategory"
        :categories="categories"
      />

      <!-- ===== GRID HEADER ===== -->
      <div class="grid-header">
        <h3 class="title-outfit grid-title">{{ getTitleText }}</h3>
        <span class="results-count" v-if="!loading">{{ filteredPrices.length }} item</span>
      </div>

      <!-- ===== PRICE GRID ===== -->
      <PriceGrid
        :loading="loading"
        :filtered-prices="filteredPrices"
        :search-query="searchQuery"
        :selected-category="selectedCategory"
        :get-avatar-url="getAvatarUrl"
        :get-fallback-emoji="getFallbackEmoji"
        :get-price-change-class="getPriceChangeClass"
        :view-details="viewDetails"
        @clear-filters="clearFilters"
      />
    </f7-block>
  </f7-page>
</template>

<script>
import { useHomePage } from '../composables/useHomePage';
import AiInsightCard from './home/AiInsightCard.vue';
import HeroSection from './home/HeroSection.vue';
import LocationFilters from './home/LocationFilters.vue';
import PriceGrid from './home/PriceGrid.vue';
import QuickStats from './home/QuickStats.vue';
import SearchFilterBar from './home/SearchFilterBar.vue';

export default {
  components: {
    HeroSection,
    LocationFilters,
    QuickStats,
    AiInsightCard,
    SearchFilterBar,
    PriceGrid,
  },
  setup() {
    const homeState = useHomePage();
    return {
      ...homeState,
    };
  },
};
</script>

<style scoped>

/* ===== LAYOUT ===== */
.home-block {
  padding-bottom: 40px;
}

/* ===== HERO ===== */
:deep(.hero-section) {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.9) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

:deep(.hero-greeting) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
}

:deep(.greeting-text) {
  display: flex;
  align-items: center;
  gap: 12px;
}

:deep(.greeting-emoji) {
  font-size: 2rem;
  line-height: 1;
}

:deep(.hero-title) {
  margin: 0 0 2px 0;
  font-size: 1.2rem;
  color: #ffffff;
}

:deep(.hero-subtitle) {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.3;
}

:deep(.date-badge) {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 0.75rem;
  color: #93c5fd;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ===== FILTERS ===== */
:deep(.location-filters) {
  margin-bottom: 16px;
}

:deep(.filter-row) {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

@media (max-width: 480px) {
  :deep(.filter-row) {
    grid-template-columns: 1fr;
  }
}

:deep(.filter-item) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: opacity 0.2s;
}

:deep(.filter-item.disabled) {
  opacity: 0.5;
}

:deep(.filter-label) {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 600;
  padding-left: 2px;
}

:deep(.select-wrapper) {
  position: relative;
}

:deep(.filter-select) {
  width: 100%;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 11px 36px 11px 13px;
  color: white;
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  appearance: none;
  cursor: pointer;
  transition: all 0.25s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.filter-select:focus) {
  outline: none;
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

:deep(.filter-select option) {
  background: #1e293b;
  color: white;
}

:deep(.select-arrow) {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255, 255, 255, 0.4);
}

/* ===== QUICK STATS ===== */
:deep(.quick-stats) {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

:deep(.stat-chip) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  flex: 1;
  justify-content: center;
}

:deep(.stat-num) {
  font-size: 0.95rem;
  font-weight: 700;
}

:deep(.stat-lbl) {
  font-size: 0.7rem;
  opacity: 0.8;
}

:deep(.stat-total) {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

:deep(.stat-up) {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

:deep(.stat-down) {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

:deep(.stat-stable) {
  background: rgba(100, 116, 139, 0.12);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.2);
}

/* ===== AI CARD ===== */
:deep(.ai-card) {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.15) 100%);
  border: 1px solid rgba(147, 51, 234, 0.25);
  margin-bottom: 16px;
}

:deep(.ai-header) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

:deep(.ai-icon) {
  font-size: 1.6rem;
  line-height: 1;
}

:deep(.ai-title) {
  margin: 0 0 2px 0;
  font-size: 0.95rem;
  color: #c084fc;
}

:deep(.ai-badge) {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(192, 132, 252, 0.7);
  font-weight: 600;
}

:deep(.summary-text) {
  font-size: 0.9rem;
  line-height: 1.55;
  margin: 0 0 12px 0;
  color: hsl(var(--text-primary));
}

:deep(.tips-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.tip-item) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.85rem;
  color: hsl(var(--text-secondary));
  line-height: 1.4;
}

:deep(.tip-bullet) { flex-shrink: 0; }

/* ===== SEARCH + FILTER ===== */
:deep(.search-filter-row) {
  margin-bottom: 12px;
}

:deep(.search-box) {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 10px 14px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: border-color 0.2s;
}

:deep(.search-box:focus-within) {
  border-color: hsl(var(--accent-primary));
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

:deep(.search-icon) {
  color: hsl(var(--text-muted));
  flex-shrink: 0;
}

:deep(.search-input) {
  flex: 1;
  border: none;
  background: transparent;
  color: hsl(var(--text-primary));
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  outline: none;
}

:deep(.search-input::placeholder) {
  color: hsl(var(--text-muted));
}

:deep(.search-clear) {
  border: none;
  background: rgba(100, 116, 139, 0.2);
  color: hsl(var(--text-muted));
  font-size: 0.7rem;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

:deep(.search-clear:hover) {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* ===== CATEGORY PILLS ===== */
:deep(.category-pills-scroll) {
  overflow-x: auto;
  margin-bottom: 16px;
  /* hide scrollbar */
  scrollbar-width: none;
}
:deep(.category-pills-scroll::-webkit-scrollbar) { display: none; }

:deep(.category-pills) {
  display: flex;
  gap: 8px;
  width: max-content;
  padding-bottom: 2px;
}

:deep(.category-pill) {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: hsl(var(--text-secondary));
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.category-pill:hover) {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

:deep(.category-pill.active) {
  background: linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-purple)));
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

/* ===== GRID HEADER ===== */
.grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.grid-title {
  margin: 0;
  font-size: 1rem;
}

.results-count {
  font-size: 0.75rem;
  color: hsl(var(--text-muted));
  background: hsl(var(--bg-secondary));
  padding: 3px 10px;
  border-radius: 20px;
}

/* ===== SKELETON ===== */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

:deep(.price-card-skeleton) {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px;
}

:deep(.skeleton-avatar) {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

:deep(.skeleton-content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.skeleton-line) {
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

:deep(.skeleton-name) { height: 14px; width: 70%; }
:deep(.skeleton-price) { height: 22px; width: 50%; }
:deep(.skeleton-sub) { height: 11px; width: 85%; }

/* ===== EMPTY STATE ===== */
:deep(.empty-state) {
  text-align: center;
  padding: 48px 24px;
}

:deep(.empty-icon) {
  font-size: 3.5rem;
  display: block;
  margin-bottom: 16px;
}

:deep(.empty-title) {
  margin: 0 0 8px 0;
  font-size: 1.05rem;
}

:deep(.empty-subtitle) {
  color: hsl(var(--text-secondary));
  font-size: 0.88rem;
  margin: 0 0 20px 0;
}

:deep(.btn-clear-filter) {
  border: 1px solid hsl(var(--accent-primary));
  background: transparent;
  color: hsl(var(--accent-primary));
  padding: 10px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.2s;
}

:deep(.btn-clear-filter:hover) {
  background: hsl(var(--accent-primary));
  color: white;
}

/* ===== PRICE CARDS ===== */
:deep(.price-card) {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.price-card:hover) {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(59, 130, 246, 0.12);
}

:deep(.card-avatar-wrap) {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
}

:deep(.card-avatar-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid var(--glass-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s;
}

:deep(.price-card:hover .card-avatar-img) {
  transform: scale(1.08);
}

:deep(.card-avatar-fallback) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
  border: 2px solid var(--glass-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

:deep(.change-overlay) {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.55rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid hsl(var(--bg-primary));
}

:deep(.change-overlay.up) {
  background: hsl(var(--status-danger));
  color: white;
}

:deep(.change-overlay.down) {
  background: hsl(var(--status-success));
  color: white;
}

:deep(.change-overlay.stable) {
  background: hsl(var(--text-muted));
  color: white;
}

:deep(.card-info) {
  flex: 1;
  min-width: 0;
}

:deep(.commodity-name) {
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  color: hsl(var(--text-primary));
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

:deep(.price-main) {
  font-family: 'Outfit', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--text-primary));
  line-height: 1.2;
  margin-bottom: 4px;
}

:deep(.price-row-bottom) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

:deep(.prev-label) {
  font-size: 0.72rem;
  color: hsl(var(--text-muted));
}

:deep(.prev-value) {
  font-size: 0.78rem;
  color: hsl(var(--text-secondary));
}

:deep(.pct-badge) {
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  margin-left: auto;
}

:deep(.pct-badge.up) {
  background: rgba(239, 68, 68, 0.12);
  color: hsl(var(--status-danger));
  border: 1px solid rgba(239, 68, 68, 0.18);
}

:deep(.pct-badge.down) {
  background: rgba(16, 185, 129, 0.12);
  color: hsl(var(--status-success));
  border: 1px solid rgba(16, 185, 129, 0.18);
}

:deep(.pct-badge.stable) {
  background: rgba(100, 116, 139, 0.12);
  color: hsl(var(--text-secondary));
  border: 1px solid rgba(100, 116, 139, 0.18);
}

/* ===== NAVBAR ===== */
.admin-link {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  padding-right: 4px;
}

/* ===== Datepicker overrides inside hero ===== */
:deep(.filter-item .list) {
  margin: 0 !important;
  --f7-list-bg-color: transparent;
}
:deep(.filter-item .item-content) {
  padding-left: 0 !important;
  min-height: auto !important;
}
:deep(.filter-item .item-inner) {
  padding: 0 !important;
  min-height: auto !important;
}
:deep(.filter-item .item-input-wrap) {
  margin: 0 !important;
  padding: 0 !important;
}
:deep(.filter-item .item-input-wrap input) {
  width: 100% !important;
  background: rgba(15, 23, 42, 0.7) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important;
  color: white !important;
  padding: 11px 13px !important;
  font-size: 0.82rem !important;
  height: auto !important;
  font-family: 'Inter', sans-serif !important;
  cursor: pointer !important;
}
:deep(.filter-item .item-input-wrap input:focus) {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
  outline: none !important;
}
:deep(.filter-item .input-clear-button) {
  display: none !important;
}
</style>
