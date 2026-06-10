<template>
  <div class="hero-section">
    <!-- Greeting + Location Context -->
    <div class="hero-greeting">
      <div class="greeting-text">
        <span class="greeting-emoji">{{ greetEmoji }}</span>
        <div>
          <h2 class="title-outfit hero-title">{{ greetText }}</h2>
          <p class="hero-subtitle">
            {{ locationLabel }}
          </p>
        </div>
      </div>
      <div v-if="lastUpdatedDate && lastUpdatedDate !== 'Hari Ini'" class="date-badge">
        📅 {{ formatDate(lastUpdatedDate) }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    greetEmoji: String,
    greetText: String,
    locationLabel: String,
    lastUpdatedDate: String,
    formatDate: Function,
  },
};
</script>
