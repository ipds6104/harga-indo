# Hargia — Indonesia National Commodity Price Intelligence Platform

Hargia adalah platform enterprise monitoring dan intelijen harga komoditas pangan nasional Indonesia. Platform ini mengintegrasikan data transaksi granular per pedagang langsung dari **SP2KP Kemendag (Sistem Pemantauan Pasar Kebutuhan Pokok)**, melakukan analisis berbasis AI, serta mendistribusikan laporan ke pembuat kebijakan perdagangan dan pangan (Kementerian Koordinator Bidang Pangan, Badan Pangan Nasional, & Kementerian Perdagangan) serta rumah tangga harian.

---

## 🌟 Fitur Utama

- **Granular Data Ingestion (Track B)**: Mengambil data harga kebutuhan pokok per pedagang secara terjadwal setiap hari pukul **07:30 WIB** dari **1.228 pasar** aktif di seluruh Indonesia.
- **High Concurrency Scraper**: Ingestion Engine berbasis Bun Fetch dengan limit stabilitas **15 concurrency paralel** (estimasi waktu penyelesaian <2 menit untuk seluruh Indonesia).
- **Dual Persona PWA (Mobile-First)**:
  - **Rumah Tangga**: Cek belanja harian, rekomendasi belanja cerdas, serta peta harga pasar termurah di wilayah sekitar.
  - **Manajemen Kemendag & Bapanas**: Dashboard analitik indeks stabilitas harga, peta disparities nasional, serta visualisasi tren.
- **AI-Powered Analytics & Audits**:
  - Deteksi anomali harga otomatis berbasis dekomposisi musiman (STL LOESS) dan deviasi Z-score historis PIHPS BI.
  - Laporan tren narasi harian per provinsi dan ringkasan eksekutif (KPI score) untuk manajemen tingkat atas.
  - **Closed-Loop AI Intervention Engine**: Menghubungkan deteksi anomali, rekomendasi taktis DSS bertingkat (HITL Kadisdag & Sekda), dasar hukum pergeseran BTT instan, penelusuran distribusi BULOG (QR Code), hingga evaluasi *exit criteria* pasca-tindakan (`T+3` s.d `T+7`).
- **Unified Monorepo & Pre-commit Safety**: Orkestrasi build monorepo berbasis Turborepo dengan pre-commit check Biome untuk menjamin format dan kepatuhan kode sebelum commit.

---

## 🛠️ Stack Teknologi

| Komponen | Teknologi | Versi | Detail / Rationale |
| :--- | :--- | :--- | :--- |
| **Runtime** | **Bun** | `1.3.10` | Menggantikan Node.js untuk pemrosesan I/O cepat dan manajemen workspace. |
| **Backend** | **ElysiaJS** | `1.4.28` | Web framework berbasis Bun dengan performa tinggi & tipe data Eden Treaty. |
| **Frontend** | **Framework7 Vue** | `9.0.5` | PWA framework mobile-first dengan look & feel iOS/Android premium. |
| **Database** | **PostgreSQL** | `18` | Database transaksional utama untuk ribuan data harga harian pasar. |
| **ORM** | **Drizzle ORM** | `latest` | Type-safe SQL builder untuk interaksi database berkecepatan tinggi. |
| **Job Queue** | **BullMQ + Redis** | `latest` | Pengatur antrean job scraping & analisis AI dengan concurrency limit. |
| **Build & Lint** | **Turborepo + Biome**| `latest` | Pipeline orkestrasi build dan lint/format kode instan (~10ms). |
| **VCS Hooks** | **Lefthook** | `latest` | Integrasi pre-commit hook berkecepatan tinggi. |

---

## 📂 Struktur Monorepo

```
hargia/
├── apps/
│   ├── api/            # ElysiaJS API Server (menyuplai data ke PWA)
│   ├── web/            # Framework7 Vue PWA (Mobile-first, Vite build)
│   ├── worker/         # BullMQ consumer (Fetch SP2KP & AI Analytics)
│   └── scheduler/      # Elysia Cron Scheduler (Trigger scraping harian 07:30 WIB)
├── packages/
│   ├── db/             # Drizzle ORM schema, config, dan file migrasi SQL
│   ├── shared/         # Konstanta, tipe TypeScript, dan utilitas bersama
│   └── ai-client/      # Wrapper SDK ke AI Proxy dengan fallback rules-engine
├── infra/
│   ├── compose/        # File docker-compose.dev.yaml (Postgres, Redis, pgAdmin)
│   └── dockerfiles/    # File Dockerfile multi-resource untuk rilis production
├── docs/api/           # OpenAPI Spec SP2KP dan dokumentasi API
├── reference/          # Referensi lama & analisis proses bisnis
│   ├── harga_legacy/   # Logika bisnis sistem lama (Laravel)
│   └── tpid/           # Analisis Proses Bisnis TPID & Mitigasi Risiko (Analisis_Proses_Bisnis_TPID.md)
├── tools/scripts/      # Skrip riset satu kali jalan (concurrency, probe API)
├── biome.json          # Konfigurasi formatting & linting terpadu
└── lefthook.yml        # Konfigurasi Git pre-commit hooks
```

---

## 🚀 Panduan Memulai (Local Setup)

### 1. Prasyarat
Pastikan Anda telah menginstal runtime berikut di mesin Anda:
- [Bun](https://bun.sh) (v1.3.0 ke atas)
- [Docker & Docker Compose](https://www.docker.com/)

### 2. Kloning & Instalasi Dependensi
```bash
# Clone repository
git clone <url-repo-harga-indo>
cd harga-indo

# Instal dependensi dan siapkan Git hooks
bun install
```

### 3. Konfigurasi Environment
Buat berkas `.env` di root direktori dengan menyalin dari contoh konfigurasi sub-aplikasi yang dibutuhkan:
```env
DATABASE_URL=postgresql://harga:harga_dev@127.0.0.1:5435/harga_indo
REDIS_URL=redis://localhost:6379
AI_PROXY_URL=https://api.ai-proxy.local
AI_PROXY_KEY=your-ai-proxy-api-key
```

### 4. Menjalankan Infrastruktur Dev (Docker)
Jalankan Postgres dan Redis lokal menggunakan file docker-compose:
```bash
docker compose -f infra/compose/compose.dev.yaml up -d
```

### 5. Migrasi Skema Database
Hasilkan tabel-tabel di PostgreSQL menggunakan Drizzle:
```bash
# Menjalankan migrasi SQL ke database
bun --filter @harga/db db:migrate
```

### 6. Jalankan dalam Mode Pengembangan (Development)
Gunakan skrip `dev.sh` untuk menjalankan database/queue Docker secara otomatis, membersihkan port yang tersangkut, dan menjalankan seluruh sub-aplikasi monorepo secara paralel:
```bash
./dev.sh
```
*(Skrip ini menjamin pembersihan seluruh proses anak saat Anda melakukan `Ctrl+C` sehingga tidak meninggalkan proses yatim/orphan)*


Aplikasi dapat diakses pada alamat berikut:
- **PWA Frontend**: `http://localhost:5173`
- **Elysia API Server**: `http://localhost:3005`
- **Scheduler Server**: `http://localhost:3010`
- **Worker Monitor**: `http://localhost:3020`
- **pgAdmin**: `http://localhost:5050` (Email: `admin@harga.local`, Password: `admin`)

---

## 🧹 Linting, Formatting & Pre-commit

Kami menggunakan **Biome** untuk memastikan kualitas kode tetap terjaga dengan performa tinggi. Biome bertindak sebagai linter sekaligus formatter.

Untuk menjalankan pemeriksaan secara manual:
```bash
# Menjalankan linter
bun run lint

# Menjalankan auto-formatter & autofix
bun run format
```

> [!NOTE]
> **Pre-commit Hook**: Saat Anda melakukan `git commit`, **Lefthook** akan secara otomatis menjalankan `biome check` pada file yang masuk antrean commit (`staged`). Jika kode tidak rapi atau memiliki kesalahan linter, commit akan ditolak hingga kesalahan tersebut diperbaiki.

---

## 📊 Analisis Ingestion & Concurrency
Berdasarkan hasil uji beban concurrency pada SP2KP API:
- **Batas Concurrency Stabil**: **15 requests paralel** secara bersamaan.
- **Estimasi Kecepatan**:
  - Total pasar: 1.228 pasar.
  - Jumlah tipe komoditas aktif: 1 (Sembako).
  - Waktu eksekusi rata-rata per request: ~1.4 detik.
  - **Total Waktu Scraping Harian Nasional**: **~115 detik (~2 menit)**.

---

## 🚢 Rilis & Deployment (Coolify)
Aplikasi dikonfigurasi untuk auto-deploy di **Coolify** menggunakan Dockerfile terpisah per servis. Berikut pemetaan deploy paths:

| Nama Layanan | Dockerfile | Watch Paths (Auto-trigger) |
| :--- | :--- | :--- |
| `harga-api` | `infra/dockerfiles/Dockerfile.api` | `apps/api/**`, `packages/**` |
| `harga-worker` | `infra/dockerfiles/Dockerfile.worker` | `apps/worker/**`, `packages/**` |
| `harga-scheduler` | `infra/dockerfiles/Dockerfile.scheduler` | `apps/scheduler/**`, `packages/**` |
| `harga-web` | `infra/dockerfiles/Dockerfile.web` | `apps/web/**` |

---

## 📊 Analisis Proses Bisnis TPID & Pengendalian Inflasi

Platform Hargia dirancang agar selaras dengan tata kelola pengendalian inflasi daerah riil di Indonesia (2024–2025). Dokumen evaluasi pemangku kepentingan (*stakeholders*), analisis celah operasional (*gap analysis*), rancangan proses bisnis *To-Be* yang melibatkan *Human-in-the-Loop* bertingkat (Kadisdag & Sekda), serta landasan hukum (SE Mendagri No. 500/4825/SJ, Permendagri No. 77/2020) telah didokumentasikan di berkas:
- [Analisis Proses Bisnis TPID & Mitigasi Risiko Hargia](file:///home/ihza/projects/bps/harga-indo/reference/tpid/Analisis_Proses_Bisnis_TPID.md)

---

## 📅 Roadmap Pengembangan Fitur TPID (Berdasarkan Analisis Proses Bisnis)

Berikut adalah daftar fitur yang perlu dibangun di platform Hargia sesuai dengan rekomendasi pada [Analisis Proses Bisnis TPID](file:///home/ihza/projects/bps/harga-indo/reference/tpid/Analisis_Proses_Bisnis_TPID.md) untuk menjaga validitas rekomendasi dan efisiensi anggaran daerah:

| Modul | Deskripsi Fitur | Prioritas | Status | Target Sub-App / Package |
| :--- | :--- | :--- | :--- | :--- |
| **Data Ingestion** | Integrasi API PIHPS BI sebagai fallback & baseline historis sejak 2016 (Gap 6 & 7) | Tinggi | `[ ]` Belum Mulai | `apps/worker`, `packages/db` |
| **Data Ingestion** | Jalur Input Ringan via WhatsApp/Telegram Bot API untuk pasar terpencil (Seksi 7) | Sedang | `[ ]` Belum Mulai | `apps/api`, `apps/worker` |
| **AI Engine** | Algoritma Dekomposisi Musiman (STL LOESS) untuk menyaring tren hari raya (Gap 2) | Tinggi | `[ ]` Belum Mulai | `apps/worker`, `packages/ai-client` |
| **AI Engine** | Perhitungan Z-Score Dinamis & filter noise berdasarkan keaktifan `jumlah_pedagang` (Gap 2) | Tinggi | `[ ]` Belum Mulai | `apps/worker`, `packages/db` |
| **AI Engine** | *Cooldown Period* (Masa Tunggu 3 Hari) sebelum alert resmi dipicu (Gap 4) | Tinggi | `[ ]` Belum Mulai | `apps/worker` |
| **Security & Legal** | *Immutable Audit Trail* untuk pencatatan riwayat keputusan pejabat BPK-ready (Gap 9) | Tinggi | `[ ]` Belum Mulai | `packages/db`, `apps/api` |
| **TPID Dashboard** | PWA Interface untuk persetujuan bertingkat (*Approval Kadisdag/Sekda*) (Gap 10) | Tinggi | `[ ]` Belum Mulai | `apps/web`, `apps/api` |
| **TPID Dashboard** | Sistem Rekomendasi Aksi Taktis (Format DSS) di PWA (Gap 8) | Sedang | `[ ]` Belum Mulai | `apps/web` |
| **Logistics Match** | Skema database `sentra_produksi` & integrasi pencocokan rute KAD surplus-defisit (Seksi 4) | Sedang | `[ ]` Belum Mulai | `packages/db`, `apps/api` |
| **Feedback Loop** | Monitoring pasca-intervensi (T+3 s.d T+7), exit criteria (<5% HAP), & eskalasi SLA otomatis (Gap 4 & 5) | Tinggi | `[ ]` Belum Mulai | `apps/worker`, `apps/api` |


