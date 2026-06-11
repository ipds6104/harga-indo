import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// Master Provinsi
export const provinsi = pgTable('provinsi', {
  kode: varchar('kode', { length: 10 }).primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull(),
});

// Master Kota/Kabupaten
export const kota = pgTable('kota', {
  kode: varchar('kode', { length: 10 }).primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull(),
  kodeProvinsi: varchar('kode_provinsi', { length: 10 })
    .notNull()
    .references(() => provinsi.kode),
});

// Master Satuan
export const satuan = pgTable('satuan', {
  id: integer('id').primaryKey(),
  display: varchar('display', { length: 50 }).notNull(),
  deskripsi: text('deskripsi'),
});

// Master Pasar
export const pasar = pgTable('pasar', {
  id: integer('id').primaryKey(),
  kode: varchar('kode', { length: 50 }),
  nama: varchar('nama', { length: 255 }).notNull(),
  kodeProvinsi: varchar('kode_provinsi', { length: 10 }).references(() => provinsi.kode),
  kodeKabKota: varchar('kode_kab_kota', { length: 10 }).references(() => kota.kode),
  lat: varchar('lat', { length: 50 }),
  lon: varchar('lon', { length: 50 }),
  tipePasarId: integer('tipe_pasar_id'),
  kelompok: varchar('kelompok', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  isNasional: boolean('is_nasional').default(false).notNull(),
});

// Master Komoditas
export const komoditas = pgTable('komoditas', {
  id: integer('id').primaryKey(),
  kode: varchar('kode', { length: 50 }),
  nama: varchar('nama', { length: 255 }).notNull(),
  tipeKomoditasId: integer('tipe_komoditas_id').notNull(), // 1: sembako, 2: hortikultura, 3: peternakan
  isActive: boolean('is_active').default(true).notNull(),
});

// Master Variant (Turunan Komoditas)
export const variant = pgTable('variant', {
  id: integer('id').primaryKey(),
  kode: varchar('kode', { length: 50 }),
  komoditasId: integer('komoditas_id')
    .notNull()
    .references(() => komoditas.id),
  nama: varchar('nama', { length: 255 }).notNull(),
  satuanId: integer('satuan_id')
    .notNull()
    .references(() => satuan.id),
  hargaMin: doublePrecision('harga_min'),
  hargaMax: doublePrecision('harga_max'),
  kenaikanMax: doublePrecision('kenaikan_max'),
  penurunanMax: doublePrecision('penurunan_max'),
  coicop7: varchar('coicop_7', { length: 50 }),
  coicop10: varchar('coicop_10', { length: 50 }),
  // Jenis instrumen regulasi harga — PENTING untuk menentukan mekanisme intervensi yang legally correct:
  // 'HET'          : Harga Eceran Tertinggi — mengikat, pelanggaran = sanksi (beras: Kepbadan 299/2025, Minyakita: Permendag 43/2025)
  // 'HAP'          : Harga Acuan Penjualan — tidak mengikat, acuan intervensi (cabai, bawang: Perbadan 12/2024)
  // 'HA'           : Harga Acuan di tingkat produsen — untuk daging sapi/kerbau (Perbadan 12/2024)
  // 'tidak_diatur' : Tidak ada regulasi harga nasional, intervensi melalui koordinasi pasokan saja
  jenisThreshold: varchar('jenis_threshold', { length: 20 }).default('tidak_diatur'),
});

// Master Produk (Turunan Variant)
export const produk = pgTable('produk', {
  id: integer('id').primaryKey(),
  kode: varchar('kode', { length: 50 }),
  variantId: integer('variant_id')
    .notNull()
    .references(() => variant.id),
  nama: varchar('nama', { length: 255 }).notNull(),
  satuanId: integer('satuan_id')
    .notNull()
    .references(() => satuan.id),
});

// Master Pedagang
export const pedagang = pgTable('pedagang', {
  id: integer('id').primaryKey(),
  nama: varchar('nama', { length: 255 }).notNull(),
  telepon: varchar('telepon', { length: 50 }),
  pasarId: integer('pasar_id')
    .notNull()
    .references(() => pasar.id),
  lantai: varchar('lantai', { length: 50 }),
  nomorLos: varchar('nomor_los', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
});

// Transaksi Harga Harian (Granular per pasar & komoditas)
export const hargaHarian = pgTable(
  'harga_harian',
  {
    id: integer('id').primaryKey(),
    pasarId: integer('pasar_id')
      .notNull()
      .references(() => pasar.id),
    komoditasId: integer('komoditas_id')
      .notNull()
      .references(() => komoditas.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => variant.id),
    produkId: integer('produk_id')
      .notNull()
      .references(() => produk.id),
    satuanId: integer('satuan_id')
      .notNull()
      .references(() => satuan.id),
    tanggal: varchar('tanggal', { length: 10 }).notNull(), // Format: YYYY-MM-DD
    harga: doublePrecision('harga').notNull(),
    hargaSebelumnya: doublePrecision('harga_sebelumnya').notNull(),
    prosentasePerubahan: doublePrecision('prosentase_perubahan').notNull(),
    kuantitas: doublePrecision('kuantitas'),
    pasokan: doublePrecision('pasokan'),
    jumlahPedagang: integer('jumlah_pedagang').notNull(),
    kodeProvinsi: varchar('kode_provinsi', { length: 10 }).references(() => provinsi.kode),
    kodeKabKota: varchar('kode_kab_kota', { length: 10 }).references(() => kota.kode),
    statusVerifikasi1: varchar('status_verifikasi_1', { length: 10 }),
    verifikasi1At: timestamp('verifikasi_1_at'),
    statusVerifikasi2: varchar('status_verifikasi_2', { length: 10 }),
    verifikasi2At: timestamp('verifikasi_2_at'),
    isActive: boolean('is_active').default(true).notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    isHargaStillZero: boolean('is_harga_still_zero').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      pasarTanggalIdx: index('harga_harian_pasar_tanggal_idx').on(table.pasarId, table.tanggal),
      provinsiTanggalIdx: index('harga_harian_provinsi_tanggal_idx').on(
        table.kodeProvinsi,
        table.tanggal,
      ),
      variantTanggalIdx: index('harga_harian_variant_tanggal_idx').on(
        table.variantId,
        table.tanggal,
      ),
    };
  },
);

// Transaksi Detail Harga Harian (Per pedagang)
export const hargaHarianDetail = pgTable(
  'harga_harian_detail',
  {
    id: integer('id').primaryKey(),
    hargaHarianId: integer('harga_harian_id')
      .notNull()
      .references(() => hargaHarian.id),
    pedagangId: integer('pedagang_id')
      .notNull()
      .references(() => pedagang.id),
    harga: doublePrecision('harga').notNull(),
    hargaSebelumnya: doublePrecision('harga_sebelumnya').notNull(),
    tanggalSebelumnya: varchar('tanggal_sebelumnya', { length: 10 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      hargaHarianIdx: index('harga_detail_harga_harian_idx').on(table.hargaHarianId),
      pedagangIdx: index('harga_detail_pedagang_idx').on(table.pedagangId),
    };
  },
);

// AI Insights (Laporan & Anomali per wilayah)
export const aiInsights = pgTable('ai_insights', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  tanggal: varchar('tanggal', { length: 10 }).notNull(), // Format: YYYY-MM-DD
  kodeProvinsi: varchar('kode_provinsi', { length: 10 }).references(() => provinsi.kode),
  komoditasId: integer('komoditas_id').references(() => komoditas.id),
  tipe: varchar('tipe', { length: 50 }).notNull(), // 'anomaly', 'trend', 'summary', 'kpi'
  kontenJson: text('konten_json').notNull(), // JSON content stored as text
  modelUsed: varchar('model_used', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Ingestion Log (Audit trail)
export const ingestionLog = pgTable(
  'ingestion_log',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID
    runId: varchar('run_id', { length: 36 }).notNull(),
    tanggalFetch: varchar('tanggal_fetch', { length: 10 }).notNull(),
    pasarId: integer('pasar_id')
      .notNull()
      .references(() => pasar.id),
    tipeKomoditasId: integer('tipe_komoditas_id').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull(), // 'pending', 'success', 'failed'
    recordsFetched: integer('records_fetched').default(0).notNull(),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      runIdIdx: index('ingestion_log_run_id_idx').on(table.runId),
      tanggalStatusIdx: index('ingestion_log_tanggal_status_idx').on(
        table.tanggalFetch,
        table.status,
      ),
      dedupIdx: index('ingestion_log_dedup_idx').on(
        table.tanggalFetch,
        table.pasarId,
        table.tipeKomoditasId,
        table.createdAt,
      ),
    };
  },
);

// RELATIONSHIPS
export const provinsiRelations = relations(provinsi, ({ many }) => ({
  kota: many(kota),
  pasar: many(pasar),
  hargaHarian: many(hargaHarian),
}));

export const kotaRelations = relations(kota, ({ one, many }) => ({
  provinsi: one(provinsi, {
    fields: [kota.kodeProvinsi],
    references: [provinsi.kode],
  }),
  pasar: many(pasar),
  hargaHarian: many(hargaHarian),
}));

export const pasarRelations = relations(pasar, ({ one, many }) => ({
  provinsi: one(provinsi, { fields: [pasar.kodeProvinsi], references: [provinsi.kode] }),
  kota: one(kota, { fields: [pasar.kodeKabKota], references: [kota.kode] }),
  pedagang: many(pedagang),
  hargaHarian: many(hargaHarian),
}));

export const komoditasRelations = relations(komoditas, ({ many }) => ({
  variants: many(variant),
  hargaHarian: many(hargaHarian),
}));

export const variantRelations = relations(variant, ({ one, many }) => ({
  komoditas: one(komoditas, { fields: [variant.komoditasId], references: [komoditas.id] }),
  satuan: one(satuan, { fields: [variant.satuanId], references: [satuan.id] }),
  produk: many(produk),
  hargaHarian: many(hargaHarian),
}));

export const produkRelations = relations(produk, ({ one, many }) => ({
  variant: one(variant, { fields: [produk.variantId], references: [variant.id] }),
  satuan: one(satuan, { fields: [produk.satuanId], references: [satuan.id] }),
  hargaHarian: many(hargaHarian),
}));

export const pedagangRelations = relations(pedagang, ({ one, many }) => ({
  pasar: one(pasar, { fields: [pedagang.pasarId], references: [pasar.id] }),
  hargaHarianDetail: many(hargaHarianDetail),
}));

export const hargaHarianRelations = relations(hargaHarian, ({ one, many }) => ({
  pasar: one(pasar, { fields: [hargaHarian.pasarId], references: [pasar.id] }),
  komoditas: one(komoditas, { fields: [hargaHarian.komoditasId], references: [komoditas.id] }),
  variant: one(variant, { fields: [hargaHarian.variantId], references: [variant.id] }),
  produk: one(produk, { fields: [hargaHarian.produkId], references: [produk.id] }),
  satuan: one(satuan, { fields: [hargaHarian.satuanId], references: [satuan.id] }),
  details: many(hargaHarianDetail),
}));

export const hargaHarianDetailRelations = relations(hargaHarianDetail, ({ one }) => ({
  hargaHarian: one(hargaHarian, {
    fields: [hargaHarianDetail.hargaHarianId],
    references: [hargaHarian.id],
  }),
  pedagang: one(pedagang, {
    fields: [hargaHarianDetail.pedagangId],
    references: [pedagang.id],
  }),
}));

// TPID User
export const tpidUser = pgTable('tpid_user', {
  id: integer('id').primaryKey(),
  nama: varchar('nama', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'kadisdag', 'sekda'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sentra Produksi
export const sentraProduksi = pgTable('sentra_produksi', {
  id: integer('id').primaryKey(),
  kodeProvinsi: varchar('kode_provinsi', { length: 10 })
    .notNull()
    .references(() => provinsi.kode),
  kodeKabKota: varchar('kode_kab_kota', { length: 10 }).references(() => kota.kode),
  komoditasId: integer('komoditas_id')
    .notNull()
    .references(() => komoditas.id),
  surplusTep: doublePrecision('surplus_tep').notNull(), // Surplus capacity in Ton Equivalent
  lat: varchar('lat', { length: 50 }),
  lon: varchar('lon', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Neraca Pangan Provinsi
// Sumber data: Peta Neraca Pangan Daerah (Bapanas, publikasi tahunan)
// Kewenangan: Keputusan Presiden No. 66/2021 tentang Badan Pangan Nasional, pasal neraca pangan
// Update: Manual, 1x/tahun saat Bapanas menerbitkan neraca pangan terbaru
export const neracaPanganProvinsi = pgTable(
  'neraca_pangan_provinsi',
  {
    id: integer('id').primaryKey(),
    kodeProvinsi: varchar('kode_provinsi', { length: 10 })
      .notNull()
      .references(() => provinsi.kode),
    komoditasId: integer('komoditas_id')
      .notNull()
      .references(() => komoditas.id),
    // 'surplus': provinsi ini produksi > konsumsi (net exporter)
    // 'defisit': provinsi ini konsumsi > produksi (net importer, bergantung pasokan luar)
    // 'seimbang': produksi ≈ konsumsi, tidak bergantung impor antar-provinsi
    statusNeraca: varchar('status_neraca', { length: 20 }).notNull().default('seimbang'),
    // Implikasi intervensi:
    // surplus + harga naik  → cek hambatan distribusi keluar (hoarding/kartel ekspor)
    // defisit + harga naik  → subsidi logistik impor antar-provinsi (KAD / subsidi angkut)
    // seimbang + harga naik → intervensi lokal (GPM, audit distributor lokal)
    implikasiIntervensi: text('implikasi_intervensi'),
    tahunData: integer('tahun_data').notNull(), // Tahun publikasi neraca Bapanas
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    neracaProvKomIdx: index('neraca_pangan_prov_kom_idx').on(table.kodeProvinsi, table.komoditasId),
  }),
);

// PIHPS BI Historical average caching
export const pihpsHargaHarian = pgTable(
  'pihps_harga_harian',
  {
    id: integer('id').primaryKey(),
    kodeProvinsi: varchar('kode_provinsi', { length: 10 })
      .notNull()
      .references(() => provinsi.kode),
    komoditasId: integer('komoditas_id')
      .notNull()
      .references(() => komoditas.id),
    tanggal: varchar('tanggal', { length: 10 }).notNull(), // YYYY-MM-DD
    harga: doublePrecision('harga').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      provinsiKomoditasTanggalIdx: index('pihps_prov_kom_tgl_idx').on(
        table.kodeProvinsi,
        table.komoditasId,
        table.tanggal,
      ),
    };
  },
);

// TPID Alert State Machine
export const tpidAlert = pgTable(
  'tpid_alert',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID
    tanggal: varchar('tanggal', { length: 10 }).notNull(), // YYYY-MM-DD
    kodeProvinsi: varchar('kode_provinsi', { length: 10 }).references(() => provinsi.kode),
    kodeKabKota: varchar('kode_kab_kota', { length: 10 }).references(() => kota.kode),
    komoditasId: integer('komoditas_id')
      .notNull()
      .references(() => komoditas.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => variant.id),
    status: varchar('status', { length: 20 }).notNull(), // 'cooldown', 'active_level_1', 'active_level_2', 'resolved', 'escalated'
    hargaRataRata: doublePrecision('harga_rata_rata').notNull(),
    thresholdHap: doublePrecision('threshold_hap').notNull(),
    zScore: doublePrecision('z_score').notNull(),
    jumlahPedagang: integer('jumlah_pedagang').notNull(),
    cooldownEndTanggal: varchar('cooldown_end_tanggal', { length: 10 }), // YYYY-MM-DD
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      alertStatusIdx: index('tpid_alert_status_idx').on(table.status),
      alertTanggalIdx: index('tpid_alert_tanggal_idx').on(table.tanggal),
    };
  },
);

// TPID Immutable Action Log (Audit Trail)
export const tpidActionLog = pgTable(
  'tpid_action_log',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID
    alertId: varchar('alert_id', { length: 36 })
      .notNull()
      .references(() => tpidAlert.id),
    userId: integer('user_id')
      .notNull()
      .references(() => tpidUser.id),
    action: varchar('action', { length: 30 }).notNull(), // 'approve_level_1', 'approve_level_2', 'reject', 'resolve'
    catatan: text('catatan'),
    rekomendasiAksi: text('rekomendasi_aksi'),
    digitalSignature: text('digital_signature'),
    hashRecord: varchar('hash_record', { length: 64 }).notNull(), // Cryptographic SHA-256 for audit integrity
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      actionLogAlertIdx: index('tpid_action_log_alert_idx').on(table.alertId),
    };
  },
);

// Relationships
export const tpidUserRelations = relations(tpidUser, ({ many }) => ({
  actionLogs: many(tpidActionLog),
}));

export const sentraProduksiRelations = relations(sentraProduksi, ({ one }) => ({
  provinsi: one(provinsi, { fields: [sentraProduksi.kodeProvinsi], references: [provinsi.kode] }),
  kota: one(kota, { fields: [sentraProduksi.kodeKabKota], references: [kota.kode] }),
  komoditas: one(komoditas, { fields: [sentraProduksi.komoditasId], references: [komoditas.id] }),
}));

export const pihpsHargaHarianRelations = relations(pihpsHargaHarian, ({ one }) => ({
  provinsi: one(provinsi, { fields: [pihpsHargaHarian.kodeProvinsi], references: [provinsi.kode] }),
  komoditas: one(komoditas, { fields: [pihpsHargaHarian.komoditasId], references: [komoditas.id] }),
}));

export const tpidAlertRelations = relations(tpidAlert, ({ one, many }) => ({
  provinsi: one(provinsi, { fields: [tpidAlert.kodeProvinsi], references: [provinsi.kode] }),
  kota: one(kota, { fields: [tpidAlert.kodeKabKota], references: [kota.kode] }),
  komoditas: one(komoditas, { fields: [tpidAlert.komoditasId], references: [komoditas.id] }),
  variant: one(variant, { fields: [tpidAlert.variantId], references: [variant.id] }),
  actionLogs: many(tpidActionLog),
}));

export const tpidActionLogRelations = relations(tpidActionLog, ({ one }) => ({
  alert: one(tpidAlert, { fields: [tpidActionLog.alertId], references: [tpidAlert.id] }),
  user: one(tpidUser, { fields: [tpidActionLog.userId], references: [tpidUser.id] }),
}));

export const neracaPanganProvinsiRelations = relations(neracaPanganProvinsi, ({ one }) => ({
  provinsi: one(provinsi, {
    fields: [neracaPanganProvinsi.kodeProvinsi],
    references: [provinsi.kode],
  }),
  komoditas: one(komoditas, {
    fields: [neracaPanganProvinsi.komoditasId],
    references: [komoditas.id],
  }),
}));
