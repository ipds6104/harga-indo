<template>
  <div class="location-filters">
    <div class="filter-row">
      <div class="filter-item">
        <label class="filter-label">Provinsi</label>
        <div class="select-wrapper">
          <select :value="selectedProv" @change="$emit('update:selectedProv', $event.target.value)" class="filter-select">
            <option value="">🌐 Seluruh Indonesia</option>
            <option v-for="prov in provinsiList" :key="prov.kode" :value="prov.kode">{{ prov.nama }}</option>
          </select>
          <svg class="select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div class="filter-item" :class="{ disabled: !selectedProv }">
        <label class="filter-label">Kab / Kota</label>
        <div class="select-wrapper">
          <select :value="selectedKota" @change="$emit('update:selectedKota', $event.target.value)" class="filter-select" :disabled="!selectedProv">
            <option value="">{{ selectedProv ? 'Semua Kota' : '— Pilih Provinsi dahulu' }}</option>
            <option v-for="c in kotaList" :key="c.kode" :value="c.kode">{{ c.nama }}</option>
          </select>
          <svg class="select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div class="filter-item">
        <label class="filter-label">Tanggal</label>
        <f7-list no-hairlines-md style="margin: 0;">
          <f7-list-input
            type="datepicker"
            placeholder="Hari Ini"
            readonly
            :calendar-params="{ dateFormat: 'yyyy-mm-dd', closeOnSelect: true }"
            :value="datepickerValue"
            @calendar:change="$emit('calendar:change', $event)"
            class="date-input"
          />
        </f7-list>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    provinsiList: Array,
    kotaList: Array,
    selectedProv: String,
    selectedKota: String,
    datepickerValue: Array,
  },
  emits: ['update:selectedProv', 'update:selectedKota', 'calendar:change'],
};
</script>
