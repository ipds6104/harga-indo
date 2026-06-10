<template>
  <div class="glass-card" style="margin-bottom: 24px; padding: 20px;">
    <h4 class="title-outfit" style="margin: 0 0 16px 0; color: #a855f7;">Jalankan Backfill Data Historis</h4>
    <p style="color: hsl(var(--text-secondary)); font-size: 0.85rem; margin-top: -8px; margin-bottom: 20px;">
      Tarik data SP2KP secara massal untuk rentang tanggal tertentu ke antrean BullMQ.
    </p>
    
    <div class="location-filters" style="margin-bottom: 20px;">
      <div class="filter-col">
        <span class="text-label">TANGGAL MULAI</span>
        <f7-list no-hairlines-md style="margin: 0;">
          <f7-list-input
            type="datepicker"
            placeholder="Pilih Tanggal Mulai"
            readonly
            :calendar-params="{ dateFormat: 'yyyy-mm-dd', closeOnSelect: true, minDate: minDateObj, maxDate: maxDateObj }"
            :value="tanggalStart ? [new Date(tanggalStart)] : []"
            @calendar:change="(val) => {
              if (val && val.length > 0) {
                $emit('update:tanggalStart', val[0].toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }));
              }
            }"
          />
        </f7-list>
      </div>
      <div class="filter-col">
        <span class="text-label">TANGGAL SELESAI</span>
        <f7-list no-hairlines-md style="margin: 0;">
          <f7-list-input
            type="datepicker"
            placeholder="Pilih Tanggal Selesai"
            readonly
            :calendar-params="{ dateFormat: 'yyyy-mm-dd', closeOnSelect: true, minDate: minDateObj, maxDate: maxDateObj }"
            :value="tanggalEnd ? [new Date(tanggalEnd)] : []"
            @calendar:change="(val) => {
              if (val && val.length > 0) {
                $emit('update:tanggalEnd', val[0].toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }));
              }
            }"
          />
        </f7-list>
      </div>
    </div>

    <button @click="$emit('trigger-backfill')" class="btn-action primary" style="width: 100%;" :disabled="backfillLoading">
      {{ backfillLoading ? 'Mengirim Antrean...' : '⚡ Jalankan Massal Backfill' }}
    </button>
  </div>
</template>

<script>
export default {
  props: {
    tanggalStart: String,
    tanggalEnd: String,
    minDateObj: Object,
    maxDateObj: Object,
    backfillLoading: Boolean,
  },
  emits: ['update:tanggalStart', 'update:tanggalEnd', 'trigger-backfill'],
};
</script>
