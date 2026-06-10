<template>
  <div>
    <!-- Search Bar -->
    <div class="search-filter-row">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Cari komoditas..."
          class="search-input"
        />
        <button v-if="searchQuery" @click="$emit('update:searchQuery', '')" class="search-clear">✕</button>
      </div>
    </div>

    <!-- Category Pills -->
    <div class="category-pills-scroll">
      <div class="category-pills">
        <button
          v-for="cat in categories"
          :key="cat.key"
          @click="$emit('update:selectedCategory', cat.key)"
          :class="['category-pill', selectedCategory === cat.key ? 'active' : '']"
        >
          <span>{{ cat.emoji }}</span>
          <span>{{ cat.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    searchQuery: String,
    selectedCategory: String,
    categories: Array,
  },
  emits: ['update:searchQuery', 'update:selectedCategory'],
};
</script>
