<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="TPID Immutable Audit Trail" back-link="Back" class="navbar-custom"></f7-navbar>

    <f7-block class="glass-card compact-margin">
      <div class="row align-items-center">
        <div class="col-80">
          <h3 class="title-outfit no-margin-bottom">Kepatuhan Audit BPK-Ready</h3>
          <p class="text-muted small no-margin-top">
            Catatan log keputusan bersifat *immutable* (tidak dapat diubah). Setiap entri diverifikasi secara otomatis menggunakan verifikasi tanda tangan kriptografi SHA-256.
          </p>
        </div>
        <div class="col-20 text-right">
          <f7-button outline small round color="green" @click="fetchAuditLogs">Refresh</f7-button>
        </div>
      </div>
    </f7-block>

    <f7-block-title class="title-outfit header-title">Riwayat Log Keputusan & Tindakan</f7-block-title>

    <f7-block v-if="loading" class="text-center">
      <f7-preloader color="purple"></f7-preloader>
      <p class="text-muted">Memverifikasi tanda tangan kriptografi...</p>
    </f7-block>

    <f7-block v-else-if="logs.length === 0" class="glass-card text-center text-muted" style="padding: 40px 20px;">
      <span style="font-size: 3rem;">📋</span>
      <h4 class="title-outfit no-margin-bottom">Belum Ada Riwayat Keputusan</h4>
      <p class="small">Log tindakan akan muncul di sini setelah persetujuan pejabat direkam.</p>
    </f7-block>

    <f7-block v-else class="no-padding">
      <div v-for="item in logs" :key="item.log.id" class="glass-card audit-card">
        <div class="audit-header">
          <div>
            <span class="user-role-badge" :class="'role-' + item.user?.role">
              👤 {{ item.user?.nama }} ({{ getRoleLabel(item.user?.role) }})
            </span>
            <h4 class="action-title title-outfit">{{ getActionLabel(item.log.action) }}</h4>
          </div>
          
          <!-- Integrity Verification Status -->
          <span :class="['integrity-badge', item.isValid ? 'integrity-valid' : 'integrity-invalid']">
            {{ item.isValid ? '✓ Integrity Verified' : '⚠ Tamper Detected' }}
          </span>
        </div>

        <div class="audit-content">
          <div class="audit-row">
            <span class="label">Komoditas & Wilayah:</span>
            <span class="value">{{ item.alert?.variantId ? 'Variant ID: ' + item.alert.variantId : 'Komoditas' }} - {{ item.alert?.kodeProvinsi }}</span>
          </div>
          <div class="audit-row">
            <span class="label">Tanggal Kejadian:</span>
            <span class="value">{{ item.log.createdAt ? formatDate(item.log.createdAt) : '-' }}</span>
          </div>
          <div class="audit-row" style="flex-direction: column; align-items: flex-start; margin-top: 10px;">
            <span class="label">Catatan Pejabat:</span>
            <span class="value policy-notes">"{{ item.log.catatan || 'Tidak ada catatan.' }}"</span>
          </div>
        </div>

        <!-- Hash Codes display (cryptographic proof) -->
        <div class="hash-section">
          <div class="hash-row">
            <span class="hash-label">Record Hash (SHA-256):</span>
            <span class="hash-code">{{ item.log.hashRecord }}</span>
          </div>
          <div class="hash-row" v-if="item.log.digitalSignature">
            <span class="hash-label">Digital Signature PIN:</span>
            <span class="hash-code signature-code">{{ item.log.digitalSignature }}</span>
          </div>
        </div>
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import { f7 } from 'framework7-vue';
import { inject, onMounted, ref } from 'vue';

export default {
  setup() {
    const apiBaseUrl = inject('apiBaseUrl');
    const logs = ref([]);
    const loading = ref(false);

    const fetchAuditLogs = async () => {
      loading.value = true;
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/tpid/audit-trail`);
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        logs.value = await res.json();
      } catch (err) {
        console.error('Fetch audit logs failed:', err);
        f7.dialog.alert('Gagal memuat riwayat audit trail TPID');
      } finally {
        loading.value = false;
      }
    };

    const getRoleLabel = (role) => {
      const roles = {
        kadisdag: 'Kepala Dinas Perdagangan',
        sekda: 'Sekretaris Daerah (Ketua TAPD)',
      };
      return roles[role] || role;
    };

    const getActionLabel = (action) => {
      const actions = {
        approve_level_1: 'Persetujuan Rekomendasi Level 1 (Taktis Harian)',
        approve_level_2: 'Otorisasi Otoritas BTT APBD Level 2 (Strategis)',
        resolve: 'Tindakan Selesai / Resolve',
        reject: 'Rekomendasi Ditolak / Reject',
      };
      return actions[action] || action;
    };

    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return dateString;
      }
    };

    onMounted(() => {
      fetchAuditLogs();
    });

    return {
      logs,
      loading,
      getRoleLabel,
      getActionLabel,
      formatDate,
      fetchAuditLogs,
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

.audit-card {
  margin: 15px !important;
  padding: 20px;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.user-role-badge {
  font-size: 0.8rem;
  font-weight: 500;
}

.role-kadisdag {
  color: #fbbf24;
}

.role-sekda {
  color: #f87171;
}

.action-title {
  margin: 6px 0 0 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.integrity-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.integrity-valid {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.integrity-invalid {
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
  border: 1px solid rgba(220, 38, 38, 0.4);
}

.audit-content {
  margin-top: 15px;
}

.audit-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.audit-row .label {
  color: hsl(var(--text-secondary));
}

.audit-row .value {
  font-weight: 500;
}

.policy-notes {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  border-radius: 4px;
  width: 100%;
  box-sizing: border-box;
  font-style: italic;
  margin-top: 5px;
}

.hash-section {
  margin-top: 15px;
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.hash-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}

.hash-row:last-child {
  margin-bottom: 0;
}

.hash-label {
  font-size: 0.7rem;
  color: hsl(var(--text-muted));
}

.hash-code {
  font-family: monospace;
  font-size: 0.75rem;
  word-break: break-all;
  color: #c084fc;
}

.signature-code {
  color: #60a5fa;
}
</style>
