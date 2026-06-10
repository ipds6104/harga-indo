<template>
  <f7-page class="tpid-page">
    <f7-navbar title="TPID Inflation Control Dashboard" back-link="Back"></f7-navbar>

    <!-- Role Switcher Panel -->
    <div class="tpid-section">
      <div class="glass-card">
        <h3 class="title-outfit card-title">Simulasi Peran Pejabat TPID</h3>
        <p class="card-subtitle">Pilih peran untuk menguji alur persetujuan bertingkat (Human-in-the-Loop).</p>
        <f7-segmented raised class="role-segmented">
          <f7-button :active="selectedRole === 'kadisdag'" @click="setRole('kadisdag')">Kadisdag</f7-button>
          <f7-button :active="selectedRole === 'sekda'" @click="setRole('sekda')">Sekda (Ketua TAPD)</f7-button>
        </f7-segmented>
      </div>
    </div>

    <!-- Active Alerts Header -->
    <div class="tpid-section-title">Daftar Alert Inflasi Daerah</div>

    <!-- Loading state -->
    <div v-if="loading" class="tpid-section text-center">
      <f7-preloader color="blue"></f7-preloader>
      <p class="card-subtitle" style="margin-top: 12px;">Memuat data gejolak harga...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="alerts.length === 0" class="tpid-section">
      <div class="glass-card text-center" style="padding: 40px 20px;">
        <span style="font-size: 3rem;">✅</span>
        <h4 class="title-outfit" style="margin: 12px 0 8px;">Semua Harga Komoditas Stabil</h4>
        <p class="card-subtitle">Tidak ada anomali harga di atas ambang batas (Z-Score &amp; HAP) hari ini.</p>
      </div>
    </div>

    <!-- Alert Cards -->
    <div v-else class="tpid-section">
      <div v-for="item in alerts" :key="item.alert.id" class="glass-card alert-card">
        <!-- Card Header -->
        <div class="alert-header">
          <div>
            <span class="region-badge">{{ item.provinsi?.nama }} - {{ item.kota?.nama || 'Seluruh Daerah' }}</span>
            <h3 class="commodity-title title-outfit">{{ item.variant?.nama }}</h3>
          </div>
          <span :class="['status-badge', 'status-' + item.alert.status]">
            {{ getStatusLabel(item.alert.status) }}
          </span>
        </div>

        <!-- Alert Details -->
        <div class="alert-details">
          <div class="detail-row">
            <span class="detail-label">Harga Rata-rata:</span>
            <span class="detail-value val-danger">Rp {{ item.alert.hargaRataRata.toLocaleString('id-ID') }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">HAP / HET Nasional:</span>
            <span class="detail-value">Rp {{ item.alert.thresholdHap.toLocaleString('id-ID') }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Volatilitas (Z-Score):</span>
            <span class="detail-value">{{ item.alert.zScore.toFixed(2) }} (Ambang Batas: >{{ item.alert.komoditasId === 2 ? '2.50' : '1.50' }})</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Tanggal Deteksi:</span>
            <span class="detail-value">{{ item.alert.tanggal }}</span>
          </div>
          <div class="detail-row" v-if="item.alert.status === 'cooldown'">
            <span class="detail-label">Masa Cooldown (Tunggu):</span>
            <span class="detail-value val-warning">Hingga {{ item.alert.cooldownEndTanggal }}</span>
          </div>
        </div>

        <!-- Cooldown Information Banner -->
        <div class="info-banner info-banner--blue" v-if="item.alert.status === 'cooldown'">
          🛡️ <strong>Masa Tunggu 3 Hari Aktif:</strong> Berdasarkan data historis, 67.87% gejolak harga jangka pendek mereda dengan sendirinya. Sistem menunda notifikasi resmi untuk menghindari pemborosan anggaran.
        </div>

        <!-- DSS Recommendation -->
        <div class="info-banner info-banner--purple" v-if="item.alert.status !== 'cooldown' && item.alert.status !== 'resolved'">
          <h4 class="title-outfit dss-title">💡 Rekomendasi Aksi Taktis (DSS)</h4>
          <p class="dss-text">{{ getRecommendationText(item) }}</p>
          <f7-button outline small round color="purple" class="matchmaker-btn" @click="openMatchmaker(item)">
            🔍 Cari Sentra Surplus (Matchmaker)
          </f7-button>
        </div>

        <!-- Approval Form Area -->
        <div class="approval-area" v-if="canApprove(item.alert.status)">
          <h4 class="title-outfit approval-title">Persetujuan Pejabat Berwenang</h4>
          <div class="approval-fields">
            <div class="approval-field">
              <label class="field-label">Catatan Kebijakan / Penjelasan Tindakan</label>
              <input
                class="field-input"
                type="text"
                placeholder="Masukkan instruksi atau catatan audit BPK..."
                :value="approvals[item.alert.id]?.catatan || ''"
                @input="approvals[item.alert.id] = { ...approvals[item.alert.id], catatan: $event.target.value }"
              />
            </div>
            <div class="approval-field">
              <label class="field-label">Tanda Tangan Digital (PIN / Kunci Otentikasi)</label>
              <input
                class="field-input"
                type="password"
                placeholder="Masukkan PIN tanda tangan digital..."
                :value="approvals[item.alert.id]?.signature || ''"
                @input="approvals[item.alert.id] = { ...approvals[item.alert.id], signature: $event.target.value }"
              />
            </div>
          </div>
          <div class="approval-buttons">
            <f7-button fill color="green" preloader :loading="submitting === item.alert.id" @click="submitApproval(item.alert, 'approve')">
              Setujui &amp; Tandatangan
            </f7-button>
            <f7-button fill color="red" @click="submitApproval(item.alert, 'reject')">
              Tolak / Abaikan
            </f7-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Matchmaker Sheet Modal -->
    <f7-sheet
      class="matchmaker-sheet"
      :opened="matchmakerOpen"
      @sheet:closed="matchmakerOpen = false"
      swipe-to-close
      backdrop
    >
      <f7-page-content class="matchmaker-sheet-content">
        <div class="tpid-section">
          <h2 class="title-outfit sheet-title">🗺️ Matchmaking Sentra Produksi Surplus</h2>
          <p class="card-subtitle">Mencari sentra produksi surplus terdekat untuk menyuplai daerah defisit secara efisien.</p>

          <div v-if="loadingMatch" class="text-center" style="padding: 20px;">
            <f7-preloader color="purple"></f7-preloader>
            <p class="card-subtitle" style="margin-top: 12px;">Menghitung rute logistik...</p>
          </div>

          <div v-else-if="matches.length === 0" class="text-center card-subtitle" style="padding: 20px;">
            ⚠️ Tidak ada data sentra produksi surplus yang terdaftar untuk komoditas ini.
          </div>

          <div v-else>
            <div v-for="match in matches" :key="match.sentraId" class="glass-card match-route-card">
              <div class="match-header">
                <div>
                  <h4 class="title-outfit" style="margin: 0 0 4px;">Sentra: {{ match.provinsiNama }}</h4>
                  <p class="card-subtitle" style="margin: 0;">Komoditas: {{ match.komoditasNama }}</p>
                </div>
                <span class="surplus-badge">Surplus: {{ match.surplusTon }} Ton</span>
              </div>
              <div class="match-details">
                <div class="detail-row">
                  <span class="detail-label">Jarak Logistik:</span>
                  <span class="detail-value">{{ match.distanceKm }} km</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Estimasi Subsidi Ongkos Angkut:</span>
                  <span class="detail-value val-danger">Rp {{ match.estimatedLogisticsCost.toLocaleString('id-ID') }}</span>
                </div>
              </div>
              <p class="route-desc">
                🚀 <em>Rencana aksi:</em> Gunakan anggaran BTT daerah untuk subsidi transportasi pengiriman sebesar Rp {{ match.estimatedLogisticsCost.toLocaleString('id-ID') }} guna memangkas harga eceran.
              </p>
            </div>
          </div>
        </div>
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
/* ─── Page Layout ────────────────────────────────────────────── */
.tpid-page {
  --f7-page-bg-color: hsl(230, 40%, 8%);
  color: #ffffff;
}

.tpid-section {
  padding: 0 16px 16px;
}

.tpid-section-title {
  padding: 16px 16px 8px;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  color: hsl(var(--accent-primary));
  letter-spacing: -0.01em;
}

/* ─── Cards ──────────────────────────────────────────────────── */
.alert-card {
  margin-bottom: 16px;
}

.card-title {
  margin: 0 0 6px;
  font-size: 1.1rem;
}

.card-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: hsl(var(--text-secondary));
  line-height: 1.5;
}

/* ─── Role Switcher ──────────────────────────────────────────── */
.role-segmented {
  margin-top: 14px;
  width: 100%;
}

/* ─── Alert Header ───────────────────────────────────────────── */
.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.region-badge {
  display: inline-block;
  font-size: 0.72rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px 8px;
  border-radius: 12px;
  color: hsl(var(--text-secondary));
  margin-bottom: 6px;
}

.commodity-title {
  margin: 0;
  font-size: 1.3rem;
}

/* ─── Status Badges ──────────────────────────────────────────── */
.status-badge {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.status-cooldown {
  background: hsla(var(--accent-primary), 0.15);
  color: hsl(var(--accent-primary));
  border: 1px solid hsla(var(--accent-primary), 0.35);
}

.status-active_level_1 {
  background: hsla(var(--status-warning), 0.15);
  color: hsl(var(--status-warning));
  border: 1px solid hsla(var(--status-warning), 0.35);
}

.status-active_level_2 {
  background: hsla(var(--status-danger), 0.15);
  color: hsl(var(--status-danger));
  border: 1px solid hsla(var(--status-danger), 0.35);
}

.status-resolved {
  background: hsla(var(--status-success), 0.15);
  color: hsl(var(--status-success));
  border: 1px solid hsla(var(--status-success), 0.35);
}

.status-escalated {
  background: hsla(var(--status-danger), 0.25);
  color: hsl(var(--status-danger));
  border: 1px solid hsla(var(--status-danger), 0.55);
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

/* ─── Detail Rows ────────────────────────────────────────────── */
.alert-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.875rem;
  gap: 8px;
}

.detail-label {
  color: hsl(var(--text-secondary));
  flex-shrink: 0;
}

.detail-value {
  font-weight: 600;
  text-align: right;
}

.val-danger {
  color: hsl(var(--status-danger));
}

.val-warning {
  color: hsl(var(--status-warning));
}

/* ─── Info Banners ───────────────────────────────────────────── */
.info-banner {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.5;
  border-left: 3px solid;
}

.info-banner--blue {
  background: hsla(var(--accent-primary), 0.1);
  border-color: hsl(var(--accent-primary));
  color: hsl(var(--text-secondary));
}

.info-banner--purple {
  background: hsla(var(--accent-purple), 0.1);
  border-color: hsl(var(--accent-purple));
  color: hsl(var(--text-secondary));
}

.dss-title {
  margin: 0 0 6px;
  font-size: 0.9rem;
  color: hsl(var(--text-primary));
}

.dss-text {
  margin: 0 0 10px;
  font-size: 0.83rem;
}

.matchmaker-btn {
  display: inline-block;
  width: auto;
}

/* ─── Approval Area ──────────────────────────────────────────── */
.approval-area {
  margin-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

.approval-title {
  margin: 0 0 14px;
  font-size: 0.95rem;
  color: hsl(var(--accent-primary));
}

.approval-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.approval-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: hsl(var(--text-secondary));
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: #ffffff;
  padding: 12px 16px;
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.field-input:focus {
  border-color: hsl(var(--accent-primary));
  box-shadow: 0 0 0 3px hsla(var(--accent-primary), 0.2);
}

.field-input::placeholder {
  color: hsl(var(--text-muted));
}

.approval-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* ─── Matchmaker Sheet ───────────────────────────────────────── */
.matchmaker-sheet {
  height: 72vh;
}

.matchmaker-sheet-content {
  background: linear-gradient(160deg, hsl(230, 40%, 8%), hsl(280, 50%, 5%));
  color: #ffffff;
}

.sheet-title {
  margin: 0 0 6px;
  font-size: 1.25rem;
}

.match-route-card {
  margin-bottom: 14px;
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
}

.match-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.surplus-badge {
  flex-shrink: 0;
  background: hsla(var(--status-success), 0.15);
  color: hsl(var(--status-success));
  border: 1px solid hsla(var(--status-success), 0.35);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.route-desc {
  background: rgba(255, 255, 255, 0.06);
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 10px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: hsl(var(--text-secondary));
}
</style>
