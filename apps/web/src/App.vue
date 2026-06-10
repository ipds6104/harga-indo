<template>
  <f7-app v-bind="f7params">
    <!-- Panel Left for navigation -->
    <f7-panel left cover class="glass-panel">
      <f7-view>
        <f7-page class="gradient-bg">
          <f7-navbar title="Hargia Menu" class="navbar-custom"></f7-navbar>
          
          <f7-block-title class="title-outfit" style="color: hsl(var(--accent-primary))">PERSONA PENGGUNA</f7-block-title>
          <f7-list dividers inset>
            <f7-list-item 
              title="Rumah Tangga (Cek Belanja)" 
              link="#" 
              panel-close
              @click="setPersona('household')"
              :badge="currentPersona === 'household' ? 'Aktif' : ''"
              badge-color="blue"
            >
              <template #media>
                <span class="icon-circle">🛒</span>
              </template>
            </f7-list-item>
            <f7-list-item 
              title="Kemenko Pangan (Analitik)" 
              link="#" 
              panel-close
              @click="setPersona('management')"
              :badge="currentPersona === 'management' ? 'Aktif' : ''"
              badge-color="purple"
            >
              <template #media>
                <span class="icon-circle">📊</span>
              </template>
            </f7-list-item>
          </f7-list>

          <f7-block-title class="title-outfit">NAVIGASI</f7-block-title>
          <f7-list dividers inset v-if="currentPersona === 'household'">
            <f7-list-item title="Beranda Belanja" link="/" view=".view-main" panel-close></f7-list-item>
            <f7-list-item title="Daftar Pasar" link="/pasar-list" view=".view-main" panel-close></f7-list-item>
          </f7-list>

          <f7-list dividers inset v-else>
            <f7-list-item title="Dashboard Nasional" link="/dashboard" view=".view-main" panel-close></f7-list-item>
            <f7-list-item title="Laporan AI & Analisis" link="/laporan" view=".view-main" panel-close></f7-list-item>
            <f7-list-item title="Status Ingestion" link="/ingestion-status" view=".view-main" panel-close></f7-list-item>
          </f7-list>
          
          <f7-block class="text-center" style="margin-top: 40px; color: hsl(var(--text-muted))">
            <small>Hargia v1.0.0<br>© 2026 Kemenko Pangan, Kemendag & Bapanas</small>
          </f7-block>
        </f7-page>
      </f7-view>
    </f7-panel>

    <!-- Main View -->
    <f7-view main class="safe-areas" url="/"></f7-view>
  </f7-app>
</template>

<script>
import { f7 } from 'framework7-vue';
import { provide, ref } from 'vue';
import DashboardPage from './pages/DashboardPage.vue';
import HomePage from './pages/HomePage.vue';
import IngestionStatusPage from './pages/IngestionStatusPage.vue';
import KomoditasDetailPage from './pages/KomoditasDetailPage.vue';
import LaporanPage from './pages/LaporanPage.vue';
import PasarListPage from './pages/PasarListPage.vue';
import ProvinsiDetailPage from './pages/ProvinsiDetailPage.vue';

export default {
  setup() {
    const currentPersona = ref('household'); // 'household' | 'management'
    const apiBaseUrl = ref(import.meta.env.VITE_API_URL || 'http://localhost:3005'); // default API endpoint

    provide('currentPersona', currentPersona);
    provide('apiBaseUrl', apiBaseUrl);

    const setPersona = (persona) => {
      currentPersona.value = persona;
      const mainView = f7.views.main;
      if (persona === 'household') {
        mainView.router.navigate('/', { reloadAll: true });
      } else {
        mainView.router.navigate('/dashboard', { reloadAll: true });
      }
    };

    // Framework7 parameters
    const f7params = {
      name: 'Hargia',
      theme: 'ios', // iOS look for premium PWA experience
      routes: [
        {
          path: '/',
          component: HomePage,
        },
        {
          path: '/komoditas/:id',
          component: KomoditasDetailPage,
        },
        {
          path: '/pasar-list',
          component: PasarListPage,
        },
        {
          path: '/dashboard',
          component: DashboardPage,
        },
        {
          path: '/provinsi/:kode',
          component: ProvinsiDetailPage,
        },
        {
          path: '/laporan',
          component: LaporanPage,
        },
        {
          path: '/ingestion-status',
          component: IngestionStatusPage,
        },
      ],
    };

    return {
      f7params,
      currentPersona,
      setPersona,
    };
  },
};
</script>

<style scoped>
.glass-panel {
  border-right: 1px solid var(--glass-border);
}

.icon-circle {
  background: hsl(var(--bg-tertiary));
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.95rem;
}
</style>
