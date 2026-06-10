<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="TPID Inflation Control Dashboard" back-link="Back" class="navbar-custom"></f7-navbar>

    <!-- Role Switcher Panel -->
    <f7-block class="glass-card compact-margin">
      <div class="row align-items-center">
        <div class="col-60 medium-50">
          <h3 class="title-outfit no-margin-bottom">Simulasi Peran Pejabat TPID</h3>
          <p class="text-muted small no-margin-top">Pilih peran untuk menguji alur persetujuan bertingkat (Human-in-the-Loop).</p>
        </div>
        <div class="col-40 medium-50 text-right">
          <f7-segmented raised>
            <f7-button :active="selectedRole === 'kadisdag'" @click="setRole('kadisdag')">Kadisdag</f7-button>
            <f7-button :active="selectedRole === 'sekda'" @click="setRole('sekda')">Sekda (Ketua TAPD)</f7-button>
          </f7-segmented>
        </div>
      </div>
    </f7-block>

    <!-- Active Alerts Header -->
    <f7-block-title class="title-outfit header-title">Daftar Alert Inflasi Daerah</f7-block-title>

    <f7-block v-if="loading" class="text-center">
      <f7-preloader color="purple"></f7-preloader>
      <p class="text-muted">Memuat data gejolak harga...</p>
    </f7-block>

    <f7-block v-else-if="alerts.length === 0" class="glass-card text-center text-muted" style="padding: 40px 20px;">
      <span style="font-size: 3rem;">✅</span>
      <h4 class="title-outfit no-margin-bottom">Semua Harga Komoditas Stabil</h4>
      <p class="small">Tidak ada anomali harga di atas ambang batas (Z-Score & HAP) hari ini.</p>
    </f7-block>

    <f7-block v-else class="no-padding">
      <div v-for="item in alerts" :key="item.alert.id" class="glass-card alert-card">
        <div class="alert-header">
          <div>
            <span class="region-badge">{{ item.provinsi?.nama }} - {{ item.kota?.nama || 'Seluruh Daerah' }}</span>
            <h3 class="commodity-title title-outfit">{{ item.variant?.nama }}</h3>
          </div>
          <span :class="['status-badge', 'status-' + item.alert.status]">
            {{ getStatusLabel(item.alert.status) }}
          </span>
        </div>

        <div class="alert-details">
          <div class="detail-row">
            <span class="label">Harga Rata-rata:</span>
            <span class="value val-danger">Rp {{ item.alert.hargaRataRata.toLocaleString('id-ID') }}</span>
          </div>
          <div class="detail-row">
            <span class="label">HAP / HET Nasional:</span>
            <span class="value">Rp {{ item.alert.thresholdHap.toLocaleString('id-ID') }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Volatilitas (Z-Score):</span>
            <span class="value z-score">{{ item.alert.zScore.toFixed(2) }} (Ambang Batas: >{{ item.alert.komoditasId === 2 ? '2.50' : '1.50' }})</span>
          </div>
          <div class="detail-row">
            <span class="label">Tanggal Deteksi:</span>
            <span class="value">{{ item.alert.tanggal }}</span>
          </div>
          <div class="detail-row" v-if="item.alert.status === 'cooldown'">
            <span class="label">Masa Cooldown (Tunggu):</span>
            <span class="value val-warning">Hingga {{ item.alert.cooldownEndTanggal }}</span>
          </div>
        </div>

        <!-- Cooldown Information Notification -->
        <f7-block class="cooldown-info" v-if="item.alert.status === 'cooldown'">
          🛡️ <strong>Masa Tunggu 3 Hari Aktif:</strong> Berdasarkan data historis, 67.87% gejolak harga jangka pendek mereda dengan sendirinya. Sistem menunda notifikasi resmi untuk menghindari pemborosan anggaran (*boncos*).
        </f7-block>

        <!-- Decision Support System Recommendation Cards -->
        <f7-block class="dss-recommendation" v-if="item.alert.status !== 'cooldown' && item.alert.status !== 'resolved'">
          <h4 class="title-outfit no-margin-bottom">💡 Rekomendasi Aksi Taktis (DSS)</h4>
          <p class="small no-margin-top" style="color: hsl(var(--text-secondary))">
            {{ getRecommendationText(item) }}
          </p>

          <!-- Matchmaking Trigger Button -->
          <f7-button outline small round color="purple" style="margin-top: 10px; display: inline-block; width: auto;" @click="openMatchmaker(item)">
            🔍 Cari Sentra Surplus (Matchmaker)
          </f7-button>
        </f7-block>

        <!-- Approval Form Area -->
        <div class="approval-action-area" v-if="canApprove(item.alert.status)">
          <h4 class="title-outfit label-input">Persetujuan Pejabat Berwenang</h4>
          <f7-list no-hairlines-md style="margin: 0;">
            <f7-list-input
              label="Catatan Kebijakan / Penjelasan Tindakan"
              type="text"
              placeholder="Masukkan instruksi atau catatan audit BPK..."
              :value="approvals[item.alert.id]?.catatan || ''"
              @input="approvals[item.alert.id] = { ...approvals[item.alert.id], catatan: $event.target.value }"
            ></f7-list-input>
            <f7-list-input
              label="Tanda Tangan Digital (PIN / Kunci Otentikasi)"
              type="password"
              placeholder="Masukkan PIN tanda tangan digital..."
              :value="approvals[item.alert.id]?.signature || ''"
              @input="approvals[item.alert.id] = { ...approvals[item.alert.id], signature: $event.target.value }"
            ></f7-list-input>
          </f7-list>
          <div class="row style-buttons" style="margin-top: 15px;">
            <div class="col-50">
              <f7-button fill color="green" preloader :loading="submitting === item.alert.id" @click="submitApproval(item.alert, 'approve')">
                Setujui & Tandatangan
              </f7-button>
            </div>
            <div class="col-50">
              <f7-button fill color="red" @click="submitApproval(item.alert, 'reject')">
                Tolak / Abaikan
              </f7-button>
            </div>
          </div>
        </div>
      </div>
    </f7-block>

    <!-- Matchmaker Sheet Modal -->
    <f7-sheet
      class="matchmaker-sheet"
      :opened="matchmakerOpen"
      @sheet:closed="matchmakerOpen = false"
      swipe-to-close
      backdrop
    >
      <f7-page-content class="gradient-bg">
        <f7-block-title class="title-outfit no-margin-top" style="font-size: 1.3rem;">
          🗺️ Matchmaking Sentra Produksi Surplus
        </f7-block-title>
        <f7-block class="no-margin-top">
          <p class="small text-muted">Mencari sentra produksi surplus terdekat untuk menyuplai daerah defisit secara efisien.</p>

          <div v-if="loadingMatch" class="text-center" style="padding: 20px;">
            <f7-preloader color="purple"></f7-preloader>
            <p class="small text-muted">Menghitung rute logistik...</p>
          </div>

          <div v-else-if="matches.length === 0" class="text-center text-muted" style="padding: 20px;">
            ⚠️ Tidak ada data sentra produksi surplus yang terdaftar untuk komoditas ini.
          </div>

          <div v-else>
            <div v-for="match in matches" :key="match.sentraId" class="glass-card match-route-card">
              <div class="row no-gutter">
                <div class="col-60">
                  <h4 class="title-outfit no-margin">Sentra: {{ match.provinsiNama }}</h4>
                  <p class="small text-muted no-margin-bottom">Komoditas: {{ match.komoditasNama }}</p>
                </div>
                <div class="col-40 text-right">
                  <span class="surplus-badge">Surplus: {{ match.surplusTon }} Ton</span>
                </div>
              </div>

              <div class="match-details" style="margin-top: 10px; border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 8px;">
                <div class="detail-row">
                  <span class="label">Jarak Logistik:</span>
                  <span class="value">{{ match.distanceKm }} km</span>
                </div>
                <div class="detail-row">
                  <span class="label">Estimasi Subsidi Ongkos Angkut:</span>
                  <span class="value val-danger">Rp {{ match.estimatedLogisticsCost.toLocaleString('id-ID') }}</span>
                </div>
              </div>
              <p class="small route-desc">
                🚀 <em>Rencana aksi:</em> Gunakan anggaran BTT daerah untuk subsidi transportasi pengiriman sebesar Rp {{ match.estimatedLogisticsCost.toLocaleString('id-ID') }} guna memangkas harga eceran.
              </p>
            </div>
          </div>
        </f7-block>
      </f7-page-content>
    </f7-sheet>
  </f7-page>
</template>

<script>
import { f7 } from 'framework7-vue';
import { inject, onMounted, ref } from 'vue';

export default {
  setup() {
    const apiBaseUrl = inject('apiBaseUrl');
    const alerts = ref([]);
    const loading = ref(false);
    const selectedRole = ref('kadisdag'); // 'kadisdag' | 'sekda'

    // User configurations
    const userMap = {
      kadisdag: { id: 1, name: 'Kepala Dinas Perdagangan', role: 'kadisdag' },
      sekda: { id: 2, name: 'Sekretaris Daerah (Ketua TAPD)', role: 'sekda' },
    };

    const approvals = ref({});
    const submitting = ref(null);

    // Matchmaker states
    const matchmakerOpen = ref(false);
    const loadingMatch = ref(false);
    const matches = ref([]);

    const setRole = (role) => {
      selectedRole.value = role;
    };

    const fetchAlerts = async () => {
      loading.value = true;
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/tpid/alerts`);
        if (!res.ok) throw new Error('Failed to fetch alerts');
        alerts.value = await res.json();
      } catch (err) {
        console.error('Fetch alerts failed:', err);
        f7.dialog.alert('Gagal memuat data alert TPID');
      } finally {
        loading.value = false;
      }
    };

    const getStatusLabel = (status) => {
      const labels = {
        cooldown: 'Masa Cooldown (Tunggu)',
        active_level_1: 'Persetujuan Kadisdag (Level 1)',
        active_level_2: 'Persetujuan Sekda (Level 2)',
        resolved: 'Terselesaikan (Resolved)',
        escalated: 'Eskalasi Pusat (Level 3)',
      };
      return labels[status] || status;
    };

    const canApprove = (status) => {
      if (selectedRole.value === 'kadisdag' && status === 'active_level_1') return true;
      if (selectedRole.value === 'sekda' && status === 'active_level_2') return true;
      return false;
    };

    const getRecommendationText = (item) => {
      const isHorti = item.alert.komoditasId === 2;
      const severityText = isHorti
        ? 'volatilitas hortikultura tinggi'
        : 'anomali harga pangan strategis';

      if (item.alert.status === 'active_level_1') {
        return `Deteksi gejolak ${severityText} terkonfirmasi di pasar lokal. Direkomendasikan kepada Kepala Dinas Perdagangan (Kadisdag) untuk menginstruksikan operasi pasar taktis skala mikro dan menyalurkan beras cadangan BULOG SPHP dalam 24 jam.`;
      }
      if (item.alert.status === 'active_level_2') {
        return 'Operasi taktis telah diajukan oleh Kadisdag. Diperlukan otorisasi dari Sekretaris Daerah (Sekda) untuk pergeseran anggaran Belanja Tidak Terduga (BTT) APBD melalui perubahan Perkada berdasarkan SE Mendagri No. 500/4825/SJ guna subsidi ongkos angkut logistik penyeimbang harga.';
      }
      return 'Lakukan pemantauan harga harian eceran pasca intervensi.';
    };

    const submitApproval = async (alert, actionType) => {
      const form = approvals.value[alert.id] || {};
      if (actionType === 'approve' && !form.signature) {
        f7.dialog.alert('Harap masukkan sandi tanda tangan digital untuk verifikasi audit BPK.');
        return;
      }

      submitting.value = alert.id;
      const currentUser = userMap[selectedRole.value];

      const action = selectedRole.value === 'kadisdag' ? 'approve_level_1' : 'approve_level_2';

      try {
        const res = await fetch(`${apiBaseUrl.value}/api/tpid/alerts/${alert.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            action: actionType === 'reject' ? 'reject' : action,
            catatan: form.catatan || '',
            digitalSignature: form.signature || '',
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Request failed');
        }

        f7.toast
          .create({
            text: 'Persetujuan berhasil direkam ke Immutable Audit Trail.',
            closeButton: true,
            destroyOnClose: true,
            position: 'bottom',
          })
          .open();

        // Clear form
        approvals.value[alert.id] = {};
        await fetchAlerts();
      } catch (err) {
        console.error('Submit approval failed:', err);
        f7.dialog.alert(`Gagal menyimpan persetujuan: ${err.message}`);
      } finally {
        submitting.value = null;
      }
    };

    const openMatchmaker = async (item) => {
      matchmakerOpen.value = true;
      loadingMatch.value = true;
      matches.value = [];

      try {
        const res = await fetch(
          `${apiBaseUrl.value}/api/tpid/sentra-produksi/match?komoditasId=${item.alert.komoditasId}&kodeProvinsi=${item.alert.kodeProvinsi}`,
        );
        if (!res.ok) throw new Error('Matchmaker fetch failed');
        matches.value = await res.json();
      } catch (err) {
        console.error('Matchmaker failed:', err);
        f7.dialog.alert('Gagal mencocokkan sentra produksi surplus.');
      } finally {
        loadingMatch.value = false;
      }
    };

    onMounted(() => {
      fetchAlerts();
    });

    return {
      alerts,
      loading,
      selectedRole,
      approvals,
      submitting,
      matchmakerOpen,
      loadingMatch,
      matches,
      setRole,
      getStatusLabel,
      canApprove,
      getRecommendationText,
      submitApproval,
      openMatchmaker,
    };
  },
};
</script>

<style scoped>
.gradient-bg {
  background: linear-gradient(135deg, hsl(230, 40%, 8%), hsl(280, 50%, 5%)) !important;
  color: #ffffff;
}

.compact-margin {
  margin: 15px !important;
}

.header-title {
  color: hsl(var(--accent-primary)) !important;
  font-size: 1.15rem;
}

.alert-card {
  margin: 15px !important;
  padding: 20px;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.region-badge {
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px 8px;
  border-radius: 12px;
  color: hsl(var(--accent-secondary));
}

.commodity-title {
  margin: 6px 0 0 0;
  font-size: 1.35rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.status-cooldown {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.status-active_level_1 {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.status-active_level_2 {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.status-resolved {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.status-escalated {
  background: rgba(220, 38, 38, 0.3);
  color: #f87171;
  border: 1px solid rgba(220, 38, 38, 0.6);
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

.alert-details {
  margin-top: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.detail-row .label {
  color: hsl(var(--text-secondary));
}

.detail-row .value {
  font-weight: 500;
}

.val-danger {
  color: #f87171;
}

.val-warning {
  color: #fbbf24;
}

.cooldown-info {
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid #3b82f6;
  padding: 10px 15px;
  margin: 15px 0 0 0;
  border-radius: 4px;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #93c5fd;
}

.dss-recommendation {
  background: rgba(139, 92, 246, 0.1);
  border-left: 4px solid #8b5cf6;
  padding: 10px 15px;
  margin: 15px 0 0 0;
  border-radius: 4px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.approval-action-area {
  margin-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.label-input {
  color: hsl(var(--accent-primary));
  font-size: 0.95rem;
  margin-bottom: 10px;
}

.matchmaker-sheet {
  background: transparent !important;
  height: 70vh !important;
  color: #fff;
}

.match-route-card {
  margin: 10px 0 !important;
  padding: 15px;
}

.surplus-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
}

.route-desc {
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
}
</style>
