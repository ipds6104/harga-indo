# Hargia — Panduan untuk AI Agent

## Gambaran Proyek

Platform enterprise monitoring harga komoditas nasional Indonesia yang mengambil data dari SP2KP (Sistem Pemantauan Pasar Kebutuhan Pokok) Kemendag, melakukan analisis AI, dan mendistribusikan informasi ke:
- **Kementerian Koordinator Bidang Pangan, Badan Pangan Nasional (Bapanas) & Kemendag** — dashboard analitik, KPI, laporan anomali
- **Rumah Tangga** — cek harga harian sebelum belanja pagi

## Stack Teknologi (WAJIB DIPATUHI)

| Komponen         | Teknologi              | Versi     |
|------------------|------------------------|-----------|
| Runtime          | **Bun** (BUKAN Node.js) | 1.3.14    |
| Backend          | ElysiaJS               | 1.4.28    |
| Frontend         | Framework7 Vue         | 9.0.5     |
| Database         | PostgreSQL             | 18        |
| ORM              | Drizzle ORM            | latest    |
| Job Queue        | BullMQ + Redis         | latest    |
| Container        | Docker Compose v2      | latest    |
| Build Cache      | Turborepo              | latest    |
| Deployment       | Coolify (GitHub App)   | latest    |

### Aturan Runtime KRITIS
- **SELALU gunakan `bun` untuk menjalankan script**, bukan `node`
- **SELALU gunakan `bun install` / `bun add`**, bukan `npm install` / `yarn`
- Import menggunakan ESM (`import`/`export`), bukan `require()`
- Bun native API lebih diutamakan dari Node.js polyfill (e.g., `Bun.file()` bukan `fs.readFile()`)
- Untuk HTTP fetch: gunakan `fetch()` built-in Bun (tidak perlu `axios` atau `node-fetch`)

## Arsitektur Monorepo

```
hargia/
├── apps/
│   ├── api/            # ElysiaJS API Server
│   ├── web/            # Framework7 Vue PWA (mobile-first)
│   ├── worker/         # BullMQ consumer — proses job fetch & AI
│   └── scheduler/      # Cron scheduler — trigger job harian
├── packages/
│   ├── db/             # Drizzle ORM schema & migrations
│   ├── shared/         # Shared types, constants, utilities
│   └── ai-client/      # AI Proxy client
├── infra/
│   ├── compose/        # docker-compose.dev.yaml, docker-compose.prod.yaml
│   └── dockerfiles/    # Dockerfile.api, Dockerfile.worker, dll
├── docs/
│   └── api/            # SP2KP OpenAPI spec, api_summary.md
├── research/           # Riset mentah (api_traffic, js_bundles, dll)
├── reference/          # Referensi lama & analisis proses bisnis
│   ├── harga_legacy/   # Kode lama Laravel
│   └── tpid/           # Peta Proses Bisnis TPID (Analisis_Proses_Bisnis_TPID.md)
└── tools/              # Script riset one-off (Playwright, probe)
```

## Data Ingestion — SP2KP API

### Sumber Data Utama
- **Endpoint**: `https://api-sp2kp.kemendag.go.id/trx/harga-harian`
- **Strategi**: Track B — granular per pedagang, loop per `pasar_id`
- **Jadwal**: Setiap hari pukul **07:30 WIB** (cron: `30 7 * * *` / timezone Asia/Jakarta)
- **Total pasar**: 1.228 pasar se-Indonesia

### Parameter Wajib
```
tanggal_start  — YYYY-MM-DD
tanggal_end    — YYYY-MM-DD
tipe_komoditas_id — 1 (sembako), 2 (hortikultura), 3 (peternakan)
pasar_id       — ID pasar (wajib, tidak bisa fetch semua sekaligus)
take           — max aman: 1000
skip           — untuk pagination
```

### Constraint API & Konfigurasi Lokal
- Query tanpa `pasar_id` → **404**
- `take > 1000` → risiko timeout server
- Batas concurrency aman: **15** (diuji stabil ✅, menyelesaikan 1.228 pasar dalam ~2 menit)
- Data harian per pasar: rata-rata ~47 records (1 hari, 1 tipe)
- Data bulanan per pasar: ~800 records (30 hari, 1 tipe)
- Tidak ada API key / autentikasi — endpoint publik
- **Port Pengembangan Lokal**:
  - PWA Frontend: `5173`
  - Backend API: `3005` (diubah dari `3000` untuk menghindari tabrakan dengan `bps-mcp-server`)
  - Scheduler Server: `3010`
  - Worker Monitor: `3020`
  - PostgreSQL DB: `5435` (diubah dari `5432` untuk menghindari tabrakan dengan native postgres host)
  - Redis Queue: `6379`
  - pgAdmin: `5050`

### Tipe Komoditas
- `tipe_komoditas_id=1` → Sembako (data tersedia, aktif)
- `tipe_komoditas_id=2` → Hortikultura (sering kosong)
- `tipe_komoditas_id=3` → Peternakan (sering kosong)

## Endpoint Penting SP2KP

| Endpoint | Deskripsi |
|---|---|
| `GET /trx/harga-harian` | Data granular per pedagang per pasar (UTAMA) |
| `GET /report/api/average-price-public` | Rata-rata harga per pasar (agregat, lambat 41s/page) |
| `GET /master/api/pasar` | Master data 1.228 pasar |
| `GET /master/api/komoditas` | Master komoditas |
| `GET /master/api/wilayah/provinsi` | Master provinsi |
| `GET /report/api/het-ha/latest` | HET & HA terbaru |

## Konvensi Pengembangan

### Struktur Modul (feature-based)
```
apps/api/src/modules/
├── harga/
│   ├── index.ts    # Route definitions
│   ├── service.ts  # Business logic
│   └── model.ts    # Drizzle query types
└── ...
```

### Penanganan Error
- Semua worker job harus retry max 3x dengan exponential backoff
- Log setiap ingestion run ke tabel `ingestion_log`
- Jika pasar gagal setelah 3x retry, catat sebagai `status=failed` dan lanjutkan

### Environment Variables
Selalu gunakan `.env` di root workspace masing-masing app. Jangan hardcode credential.

## Referensi Historis
- Implementasi Laravel lama ada di `reference/harga_legacy/harga/` — gunakan sebagai referensi logika bisnis saja
- Peta proses bisnis TPID dan analisis gap pengendalian inflasi ada di [Analisis_Proses_Bisnis_TPID.md](file:///home/ihza/projects/bps/harga-indo/reference/tpid/Analisis_Proses_Bisnis_TPID.md)
- File riset one-off ada di `tools/scripts/` dan `research/`

## Roadmap Fitur Pengendalian Inflasi TPID
Semua pengembangan fitur intelijen pangan dan mitigasi kebocoran anggaran Pemda mengacu pada roadmap tabel TODO di [README.md](file:///home/ihza/projects/bps/harga-indo/README.md#roadmap-pengembangan-fitur-tpid-berdasarkan-analisis-proses-bisnis) yang dirumuskan berdasarkan rekomendasi dari [Analisis_Proses_Bisnis_TPID.md](file:///home/ihza/projects/bps/harga-indo/reference/tpid/Analisis_Proses_Bisnis_TPID.md). AI Agent yang bertugas mengembangkan fitur terkait wajib memperbarui status baris tabel di README ketika menyelesaikan fitur-fitur tersebut.
