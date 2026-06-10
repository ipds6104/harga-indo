<template>
  <div class="glass-card" style="margin-bottom: 24px;">
    <h4 class="title-outfit" style="margin: 0 0 16px 0;">Log Penarikan Terbaru (100 Terakhir)</h4>
    
    <div v-if="logs.length === 0" class="text-center" style="padding: 20px 0; color: hsl(var(--text-muted));">
      Belum ada log penarikan untuk tanggal ini.
    </div>

    <div v-else style="overflow-x: auto; overflow-y: hidden;">
      <table class="styled-table font-sm">
        <thead>
          <tr>
            <th>Pasar ID</th>
            <th>Records</th>
            <th class="text-right">Durasi</th>
            <th class="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in logs" :key="l.id">
            <td>{{ l.pasarId }}</td>
            <td>{{ l.recordsFetched }} items</td>
            <td class="text-right">{{ l.durationMs }}ms</td>
            <td class="text-right">
              <span :class="['status-dot', l.status === 'success' ? 'success' : 'failed']">
                ● {{ l.status === 'success' ? 'Sukses' : 'Gagal' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    logs: Array,
  },
};
</script>
