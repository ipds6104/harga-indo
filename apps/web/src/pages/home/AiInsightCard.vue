<template>
  <div class="glass-card ai-card">
    <div class="ai-header">
      <div class="ai-icon">🤖</div>
      <div>
        <h4 class="title-outfit ai-title">Ringkasan AI</h4>
        <span class="ai-badge">Hari Ini</span>
      </div>
    </div>
    <p class="summary-text">{{ aiInsight.summary }}</p>
    <div v-if="aiInsight.tips && aiInsight.tips.length" class="tips-list">
      <div v-for="(tip, idx) in aiInsight.tips" :key="idx" class="tip-item">
        <span class="tip-bullet">💡</span>
        <span>{{ tip }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    aiInsight: Object,
  },
};
</script>
