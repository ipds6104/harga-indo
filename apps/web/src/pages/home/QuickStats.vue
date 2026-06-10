<template>
  <div class="quick-stats">
    <div class="stat-chip stat-total">
      <span class="stat-num">{{ total }}</span>
      <span class="stat-lbl">Komoditas</span>
    </div>
    <div class="stat-chip stat-up">
      <span>▲</span>
      <span class="stat-num">{{ up }}</span>
      <span class="stat-lbl">Naik</span>
    </div>
    <div class="stat-chip stat-down">
      <span>▼</span>
      <span class="stat-num">{{ down }}</span>
      <span class="stat-lbl">Turun</span>
    </div>
    <div class="stat-chip stat-stable">
      <span>●</span>
      <span class="stat-num">{{ stable }}</span>
      <span class="stat-lbl">Stabil</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    total: Number,
    up: Number,
    down: Number,
    stable: Number,
  },
};
</script>
