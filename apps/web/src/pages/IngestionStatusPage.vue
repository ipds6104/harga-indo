<template>
  <f7-page class="gradient-bg">
    <f7-navbar title="Status Ingestion SP2KP" back-link="Kembali" class="navbar-custom"></f7-navbar>

    <f7-block class="margin-vertical-half">
      <!-- Welcome Intro -->
      <div class="glass-card header-card" style="margin-bottom: 16px;">
        <h3 class="title-outfit font-20" style="margin: 0;">Monitor Ingestion & Scraper</h3>
        <p style="color: hsl(var(--text-secondary)); font-size: 0.9rem; margin: 4px 0 0 0;">
          Pantau proses scraping data harian SP2KP Kemendag untuk 1.228 pasar se-Indonesia.
        </p>
      </div>

      <!-- Controls Card -->
      <div class="glass-card" style="margin-bottom: 16px; padding: 20px;">
        <h4 class="title-outfit" style="margin: 0 0 16px 0;">Kontrol Admin</h4>
        <div class="flex-row gap-sm">
          <button @click="triggerScraper('prices')" class="btn-action primary" :disabled="actionLoading">
            {{ actionLoading ? 'Mengirim...' : '🚀 Jalankan Scraper Harga' }}
          </button>
          <button @click="triggerScraper('master')" class="btn-action secondary" :disabled="actionLoading">
            {{ actionLoading ? 'Mengirim...' : '🔄 Sinkronisasi Master' }}
          </button>
        </div>
      </div>

      <!-- Ingest Status Grid -->
      <div v-if="loading" class="text-center" style="padding: 40px 0;">
        <f7-preloader color="purple"></f7-preloader>
      </div>

      <div v-else>
        <!-- Statistics Panel -->
        <DailyStatusCard
          :status="status"
          :monitored-date="monitoredDate"
          @update:monitoredDate="onMonitoredDateChange"
          :pct="getPct()"
          :pct-success="getPctSuccess()"
          :pct-failed="getPctFailed()"
        />

        <!-- Latest Logs Table -->
        <HistoricalLogsTable :logs="status.logs" />

        <!-- Historical Ingestion Section -->
        <h3 class="title-outfit" style="margin: 32px 0 16px 0;">Riwayat & Backfill Ingestion</h3>

        <!-- Backfill Controls Card -->
        <BackfillControls
          :tanggal-start="tanggalStart"
          @update:tanggalStart="tanggalStart = $event"
          :tanggal-end="tanggalEnd"
          @update:tanggalEnd="tanggalEnd = $event"
          :min-date-obj="minDateObj"
          :max-date-obj="maxDateObj"
          :backfill-loading="backfillLoading"
          @trigger-backfill="triggerBackfill"
        />

        <!-- Historical Ingestion Coverage Status -->
        <HistoricalCakupanTable
          :historical-logs="historicalLogs"
          :has-more="hasMore"
          :loading-more="loadingMore"
          @load-more="loadMoreLogs"
        />

        <!-- Database Coverage & Integrity Check -->
        <h3 class="title-outfit" style="margin: 32px 0 16px 0;">Analisis Kelengkapan & Gap Data</h3>
        
        <CoverageSummaryPanel
          :audit-start="auditStart"
          @update:auditStart="auditStart = $event"
          :audit-end="auditEnd"
          @update:auditEnd="auditEnd = $event"
          :min-date-obj="minDateObj"
          :max-date-obj="maxDateObj"
          :audit-loading="auditLoading"
          :gaps-loading="gapsLoading"
          :coverage-summary="coverageSummary"
          @run-audit="runAudit"
          @trigger-backfill-gaps="triggerBackfillGaps"
          @tarik-date="tarikDate"
        />
      </div>
    </f7-block>
  </f7-page>
</template>

<script>
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import BackfillControls from './ingestion/BackfillControls.vue';
import CoverageSummaryPanel from './ingestion/CoverageSummaryPanel.vue';
import DailyStatusCard from './ingestion/DailyStatusCard.vue';
import HistoricalCakupanTable from './ingestion/HistoricalCakupanTable.vue';
import HistoricalLogsTable from './ingestion/HistoricalLogsTable.vue';

export default {
  components: {
    DailyStatusCard,
    HistoricalLogsTable,
    BackfillControls,
    CoverageSummaryPanel,
    HistoricalCakupanTable,
  },
  setup() {
    const apiBaseUrl = inject('apiBaseUrl');

    const status = ref({
      tanggal: '',
      totalMarkets: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
      logs: [],
      activeRunId: null,
      runCompletedCount: 0,
      runFailedCount: 0,
    });

    const historicalLogs = ref([]);
    const historicalPage = ref(1);
    const hasMore = ref(true);
    const loadingMore = ref(false);

    const tanggalStart = ref('');
    const tanggalEnd = ref('');

    const loading = ref(true);
    const actionLoading = ref(false);
    const backfillLoading = ref(false);

    const monitoredDate = ref('');

    const auditStart = ref('');
    const auditEnd = ref('');
    const coverageSummary = ref(null);
    const auditLoading = ref(false);
    const gapsLoading = ref(false);
    const showAuditResults = ref(false);

    // Enforce SP2KP earliest data availability date (2024-01-01) in Datepicker limits
    const minDateObj = ref(new Date('2024-01-01T00:00:00.000Z'));
    const maxDateObj = ref(new Date());

    const refreshMonitor = async (isInitial = false) => {
      if (isInitial) {
        loading.value = true;
      }
      try {
        const params = new URLSearchParams();
        if (monitoredDate.value) {
          params.append('tanggal', monitoredDate.value);
        }
        if (auditStart.value && auditEnd.value && showAuditResults.value) {
          params.append('audit_start', auditStart.value);
          params.append('audit_end', auditEnd.value);
        }
        params.append('page', '1');
        params.append('limit', '30');

        const res = await fetch(
          `${apiBaseUrl.value}/api/v1/ingestion/monitor?${params.toString()}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.dailyStatus) {
            status.value = data.dailyStatus;
            if (data.dailyStatus.tanggal && !monitoredDate.value) {
              monitoredDate.value = data.dailyStatus.tanggal;
              localStorage.setItem('hargia_monitor_date', data.dailyStatus.tanggal);
            }
          }
          if (data.historicalLogs) {
            historicalLogs.value = data.historicalLogs;
            historicalPage.value = 1;
            hasMore.value = data.historicalLogs.length === 30;
          }
          if (data.coverageSummary) {
            coverageSummary.value = data.coverageSummary;
          }
        }
      } catch (err) {
        console.error('Error refreshing monitor status:', err);
      } finally {
        if (isInitial) {
          loading.value = false;
        }
      }
    };

    const pollDailyStatus = async () => {
      try {
        const params = new URLSearchParams();
        if (monitoredDate.value) {
          params.append('tanggal', monitoredDate.value);
        }
        const res = await fetch(`${apiBaseUrl.value}/api/v1/ingestion/status?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          status.value = data;
          if (data.tanggal && !monitoredDate.value) {
            monitoredDate.value = data.tanggal;
            localStorage.setItem('hargia_monitor_date', data.tanggal);
          }
        }
      } catch (err) {
        console.error('Error polling daily status:', err);
      }
    };

    const loadMoreLogs = async () => {
      if (loadingMore.value || !hasMore.value) return;
      loadingMore.value = true;
      try {
        const nextPage = historicalPage.value + 1;
        const params = new URLSearchParams({
          page: nextPage.toString(),
          limit: '30',
        });
        if (monitoredDate.value) {
          params.append('tanggal', monitoredDate.value);
        }
        const res = await fetch(
          `${apiBaseUrl.value}/api/v1/ingestion/monitor?${params.toString()}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.historicalLogs && data.historicalLogs.length > 0) {
            historicalLogs.value.push(...data.historicalLogs);
            historicalPage.value = nextPage;
            hasMore.value = data.historicalLogs.length === 30;
          } else {
            hasMore.value = false;
          }
        } else {
          hasMore.value = false;
        }
      } catch (err) {
        console.error('Error loading more historical logs:', err);
      } finally {
        loadingMore.value = false;
      }
    };

    const onMonitoredDateChange = (newVal) => {
      if (newVal) {
        monitoredDate.value = newVal;
        localStorage.setItem('hargia_monitor_date', newVal);
        refreshMonitor(false);
      }
    };

    const runAudit = async () => {
      if (!auditStart.value || !auditEnd.value) {
        window.f7.dialog.alert('Harap isi tanggal mulai dan selesai audit.', 'Form Invalid');
        return;
      }

      const minLimitStr = '2024-01-01';
      if (auditStart.value < minLimitStr) {
        auditStart.value = minLimitStr;
      }

      showAuditResults.value = true;
      auditLoading.value = true;
      try {
        persistAuditDates();
        await refreshMonitor(false);
      } finally {
        auditLoading.value = false;
      }
    };

    const triggerBackfillGaps = async () => {
      if (!auditStart.value || !auditEnd.value) return;

      const minLimitStr = '2024-01-01';
      if (auditStart.value < minLimitStr) {
        window.f7.dialog.alert(
          `Data harian SP2KP hanya tersedia sejak tanggal ${minLimitStr}.`,
          'Tanggal Invalid',
        );
        return;
      }

      gapsLoading.value = true;
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/v1/ingestion/backfill-gaps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tanggal_start: auditStart.value,
            tanggal_end: auditEnd.value,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.status === 'no_action') {
            window.f7.dialog.alert(result.message, 'Info');
          } else {
            window.f7.dialog.alert(
              `Backfill data bolong berhasil didaftarkan! Total ${result.totalJobs} jobs untuk ${result.totalDates} hari. Run ID: ${result.runId}`,
              'Berhasil',
            );
          }
          setTimeout(() => {
            refreshMonitor(false);
          }, 1500);
        } else {
          window.f7.dialog.alert('Gagal memicu backfill data bolong.', 'Error');
        }
      } catch (err) {
        window.f7.dialog.alert('Terjadi kesalahan koneksi.', 'Error');
      } finally {
        gapsLoading.value = false;
      }
    };

    const tarikDate = async (d) => {
      window.f7.dialog.preloader('Mengirim job...');
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/v1/ingestion/backfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tanggal_start: d,
            tanggal_end: d,
          }),
        });
        window.f7.dialog.close();
        if (res.ok) {
          window.f7.dialog.alert(`Job penarikan untuk tanggal ${d} berhasil dikirim.`, 'Berhasil');
          monitoredDate.value = d;
          localStorage.setItem('hargia_monitor_date', d);
          setTimeout(() => {
            refreshMonitor(false);
          }, 1500);
        } else {
          window.f7.dialog.alert('Gagal mengirim job.', 'Error');
        }
      } catch (err) {
        window.f7.dialog.close();
        window.f7.dialog.alert('Kesalahan koneksi.', 'Error');
      }
    };

    const triggerScraper = async (type) => {
      actionLoading.value = true;
      try {
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
        const res = await fetch(`${apiBaseUrl.value}/api/v1/ingestion/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, tanggal: todayStr }),
        });
        if (res.ok) {
          const result = await res.json();
          window.f7.dialog.alert(
            `Proses ${type === 'prices' ? 'Scraper Harga' : 'Sync Master'} berhasil dikirim! Run ID: ${result.runId}`,
            'Berhasil',
          );
          if (type === 'prices') {
            monitoredDate.value = todayStr;
            localStorage.setItem('hargia_monitor_date', todayStr);
          }
          setTimeout(() => {
            refreshMonitor(false);
          }, 1500);
        } else {
          window.f7.dialog.alert('Gagal mengirim perintah ke server.', 'Error');
        }
      } catch (err) {
        window.f7.dialog.alert('Terjadi kesalahan koneksi.', 'Error');
      } finally {
        actionLoading.value = false;
      }
    };

    const triggerBackfill = async () => {
      if (!tanggalStart.value || !tanggalEnd.value) {
        window.f7.dialog.alert('Harap isi tanggal mulai dan selesai.', 'Form Invalid');
        return;
      }

      const minLimitStr = '2024-01-01';
      if (tanggalStart.value < minLimitStr) {
        window.f7.dialog.alert(
          `Data harian SP2KP hanya tersedia sejak tanggal ${minLimitStr}.`,
          'Tanggal Invalid',
        );
        return;
      }

      backfillLoading.value = true;
      try {
        const res = await fetch(`${apiBaseUrl.value}/api/v1/ingestion/backfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tanggal_start: tanggalStart.value,
            tanggal_end: tanggalEnd.value,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          window.f7.dialog.alert(
            `Backfill berhasil ditambahkan ke antrean! Total ${result.totalJobs} jobs untuk ${result.totalDates} hari. Run ID: ${result.runId}`,
            'Berhasil',
          );
          monitoredDate.value = tanggalEnd.value;
          localStorage.setItem('hargia_monitor_date', tanggalEnd.value);
          setTimeout(() => {
            refreshMonitor(false);
          }, 1500);
        } else {
          window.f7.dialog.alert('Gagal memicu backfill.', 'Error');
        }
      } catch (err) {
        window.f7.dialog.alert('Terjadi kesalahan koneksi.', 'Error');
      } finally {
        backfillLoading.value = false;
      }
    };

    const getPct = () => {
      if (!status.value.totalMarkets) return 0;
      const total = status.value.succeeded + status.value.failed;
      return Math.round((total / status.value.totalMarkets) * 100);
    };

    const getPctSuccess = () => {
      if (!status.value.totalMarkets) return 0;
      return (status.value.succeeded / status.value.totalMarkets) * 100;
    };

    const getPctFailed = () => {
      if (!status.value.totalMarkets) return 0;
      return (status.value.failed / status.value.totalMarkets) * 100;
    };

    let timer = null;
    const LS_AUDIT_START = 'hargia_audit_start';
    const LS_AUDIT_END = 'hargia_audit_end';

    const persistAuditDates = () => {
      try {
        localStorage.setItem(LS_AUDIT_START, auditStart.value);
        localStorage.setItem(LS_AUDIT_END, auditEnd.value);
      } catch (_) {}
    };

    onMounted(() => {
      const savedMonitorDate = localStorage.getItem('hargia_monitor_date');
      if (savedMonitorDate) {
        monitoredDate.value = savedMonitorDate;
      }

      const savedStart = localStorage.getItem(LS_AUDIT_START);
      const savedEnd = localStorage.getItem(LS_AUDIT_END);
      const minLimitStr = '2024-01-01';

      if (savedStart && savedEnd) {
        auditStart.value = savedStart < minLimitStr ? minLimitStr : savedStart;
        auditEnd.value = savedEnd;
        showAuditResults.value = true;
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        auditEnd.value = end.toISOString().split('T')[0];
        auditStart.value = start.toISOString().split('T')[0];
      }

      const endB = new Date();
      const startB = new Date();
      startB.setDate(startB.getDate() - 7);
      tanggalEnd.value = endB.toISOString().split('T')[0];
      tanggalStart.value = startB.toISOString().split('T')[0];

      refreshMonitor(true);

      timer = setInterval(() => {
        pollDailyStatus();
      }, 5000);
    });

    onBeforeUnmount(() => {
      if (timer) clearInterval(timer);
    });

    return {
      status,
      historicalLogs,
      historicalPage,
      hasMore,
      loadingMore,
      loadMoreLogs,
      tanggalStart,
      tanggalEnd,
      loading,
      actionLoading,
      backfillLoading,
      getPct,
      getPctSuccess,
      getPctFailed,
      triggerScraper,
      triggerBackfill,
      monitoredDate,
      onMonitoredDateChange,
      auditStart,
      auditEnd,
      coverageSummary,
      auditLoading,
      gapsLoading,
      runAudit,
      triggerBackfillGaps,
      tarikDate,
      minDateObj,
      maxDateObj,
    };
  },
};
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.5) 100%);
}

:deep(.btn-action) {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
  font-family: 'Inter', sans-serif;
}

:deep(.btn-action.primary) {
  background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.2);
}

:deep(.btn-action.secondary) {
  background: hsl(var(--bg-tertiary));
  color: hsl(var(--text-primary));
  border: 1px solid var(--glass-border);
}

:deep(.btn-action:hover) {
  transform: translateY(-2px);
}

:deep(.btn-action:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Use :deep selectors so styles apply to subcomponents cleanly */
:deep(.progress-bar-container) {
  height: 8px;
  background: hsl(var(--bg-secondary));
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

:deep(.progress-bar-fill) {
  height: 100%;
  transition: width 0.4s ease;
}

:deep(.progress-bar-fill.success) {
  background: hsl(var(--status-success));
}

:deep(.progress-bar-fill.failed) {
  background: hsl(var(--status-danger));
}

:deep(.metrics-grid) {
  display: flex;
  gap: 12px;
}

:deep(.metric-box) {
  flex: 1;
  background: hsl(var(--bg-secondary));
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

:deep(.metric-val) {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  margin-top: 4px;
}

:deep(.metric-val.success) {
  color: hsl(var(--status-success));
}

:deep(.metric-val.failed) {
  color: hsl(var(--status-danger));
}

:deep(.metric-val.pending) {
  color: hsl(var(--text-muted));
}

:deep(.styled-table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(.styled-table th) {
  padding: 10px 8px;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: hsl(var(--text-muted));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
}

:deep(.styled-table td) {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

:deep(.status-dot) {
  font-weight: 600;
  font-size: 0.8rem;
}

:deep(.status-dot.success) {
  color: hsl(var(--status-success));
}

:deep(.status-dot.failed) {
  color: hsl(var(--status-danger));
}

:deep(.font-sm) {
  font-size: 0.85rem;
}

:deep(.gap-sm) {
  gap: 12px;
}

:deep(.flex-row) {
  display: flex;
}

:deep(.justify-between) {
  justify-content: space-between;
}

:deep(.align-center) {
  align-items: center;
}

:deep(.text-right) {
  text-align: right;
}

:deep(.gaps-tags-container) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

:deep(.gap-tag) {
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.gap-tag.danger) {
  background: rgba(239, 68, 68, 0.15);
  color: hsl(var(--status-danger));
  border: 1px solid rgba(239, 68, 68, 0.25);
}

:deep(.gap-tag.warning) {
  background: rgba(245, 158, 11, 0.15);
  color: hsl(var(--status-warning));
  border: 1px solid rgba(245, 158, 11, 0.25);
}

:deep(.tag-action) {
  cursor: pointer;
  font-weight: bold;
  opacity: 0.8;
}

:deep(.tag-action:hover) {
  opacity: 1;
  transform: scale(1.1);
}

:deep(.gap-tag-more) {
  font-size: 0.8rem;
  color: hsl(var(--text-muted));
  align-self: center;
}

:deep(.warning-text) {
  color: hsl(var(--status-warning));
}

:deep(.success-box) {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 12px;
  color: hsl(var(--status-success));
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
