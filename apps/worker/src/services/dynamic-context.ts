/**
 * Dynamic Context Service — Versi 2 (Perbaikan Epistemologis)
 *
 * Sumber data real-time:
 * 1. Hari Libur Nasional  → api-hari-libur.vercel.app (SKB 3 Menteri Agama/Naker/PANRB)
 * 2. Kurs USD/IDR         → frankfurter.app (ECB-based) — digunakan sebagai PROXY karena
 *                           BI JISDOR (kurs resmi Indonesia) tidak memiliki REST API publik.
 *                           Untuk keputusan formal, gunakan JISDOR dari bi.go.id.
 *
 * Sumber data deterministik (berbasis referensi resmi):
 * 3. Kalender Tanam       → SI Katam Terpadu Kementan (per provinsi, bukan nasional)
 * 4. Neraca Pangan        → Bapanas, Keppres 66/2021 (query dari DB, update tahunan)
 *
 * YANG TIDAK DISERTAKAN (tidak ada sumber data real-time yang dapat diakses):
 * - Stok CBP Bulog: Bulog tidak memiliki API publik; data hanya via siaran pers manual
 * - Prakiraan musim BMKG: BMKG tidak memiliki API prakiraan musim (hanya cuaca harian)
 * - Kurs JISDOR resmi BI: Hanya tersedia via SOAP lama, tidak ada REST JSON endpoint
 */

import { db, komoditas, neracaPanganProvinsi } from '@harga/db';
import { and, eq } from 'drizzle-orm';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface HariRayaInfo {
  nama: string;
  tanggal: string;
  hariLagi: number;
  isMusimRaya: boolean;
}

export interface MusimInfo {
  musimKemarau: boolean;
  musimPanen: {
    beras: boolean;
    cabai: boolean;
    bawangMerah: boolean;
  };
  keterangan: string;
  // Kualifikasi penting: pola ini berbasis rata-rata historis. El Niño/La Niña dapat
  // menggeser musim kemarau 4-8 minggu dan memperparah dampaknya.
  kualifikasi: string;
}

export interface KursMataUang {
  usdIdr: number;
  tanggal: string;
  level: 'stabil' | 'melemah' | 'menguat';
  dampakImport: string;
  sumberData: string; // transparansi sumber
}

export interface NeracaProvinsiInfo {
  statusNeraca: 'surplus' | 'defisit' | 'seimbang';
  implikasiIntervensi: string;
}

export interface DynamicContext {
  tanggalAnalisis: string;
  hariRayaTerdekat: HariRayaInfo | null;
  hariRayaBesar: HariRayaInfo[];
  musim: MusimInfo;
  kurs: KursMataUang;
  // Map komoditasId → neraca provinsi (diisi saat dipanggil per provinsi)
  neracaPerKomoditas: Record<number, NeracaProvinsiInfo>;
  ringkasan: string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let contextCache: { data: DynamicContext; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

// ─── Kalender Tanam Provinsi (SI Katam Terpadu, Kementan) ───────────────────

/**
 * Pola panen per provinsi berbasis SI Katam Terpadu (Kementan) & data BPS Luas Panen.
 * Format: [[bulanMulai, bulanSelesai], ...] untuk setiap panen dalam setahun.
 * Komoditas: beras (MT I & MT II), cabai, bawangMerah
 *
 * Sumber: Sistem Informasi Kalender Tanam Terpadu (katam.litbang.pertanian.go.id)
 *         BPS: Luas Panen dan Produksi Padi Menurut Provinsi (publikasi tahunan)
 */
const KALENDER_TANAM_PROVINSI: Record<
  string,
  {
    beras: [number, number][];
    cabai: [number, number][];
    bawangMerah: [number, number][];
    keteranganWilayah: string;
  }
> = {
  // Zona Jawa & Bali — irigasi teknis, 2x/tahun
  '31': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'DKI Jakarta (pola Jawa)',
  },
  '32': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'Jawa Barat',
  },
  '33': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'Jawa Tengah (sentra Brebes)',
  },
  '34': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'DI Yogyakarta',
  },
  '35': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'Jawa Timur',
  },
  '36': {
    beras: [
      [3, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [5, 6],
      [10, 11],
    ],
    keteranganWilayah: 'Banten',
  },
  '51': {
    beras: [
      [2, 4],
      [7, 9],
    ],
    cabai: [
      [1, 3],
      [7, 9],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Bali (Subak, 3x/tahun)',
  },
  // Zona Sumatera — pola mirip Jawa, sedikit lebih awal
  '11': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Aceh',
  },
  '12': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sumatera Utara',
  },
  '13': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [12, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sumatera Barat',
  },
  '14': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Riau',
  },
  '15': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Jambi',
  },
  '16': {
    beras: [
      [2, 4],
      [7, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sumatera Selatan',
  },
  '17': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Bengkulu',
  },
  '18': {
    beras: [
      [2, 4],
      [7, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Lampung',
  },
  '19': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Bangka Belitung',
  },
  '21': {
    beras: [
      [2, 4],
      [8, 9],
    ],
    cabai: [
      [1, 2],
      [7, 8],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Kepulauan Riau',
  },
  // Zona Kalimantan — sawah tadah hujan dominan, 1x/tahun, geser ke Juni-Agustus
  '61': {
    beras: [[6, 8]],
    cabai: [[5, 8]],
    bawangMerah: [[5, 7]],
    keteranganWilayah: 'Kalimantan Barat (tadah hujan)',
  },
  '62': {
    beras: [[6, 8]],
    cabai: [[5, 8]],
    bawangMerah: [[5, 7]],
    keteranganWilayah: 'Kalimantan Tengah',
  },
  '63': {
    beras: [
      [5, 7],
      [9, 11],
    ],
    cabai: [[5, 7]],
    bawangMerah: [[5, 7]],
    keteranganWilayah: 'Kalimantan Selatan',
  },
  '64': {
    beras: [[6, 8]],
    cabai: [[5, 8]],
    bawangMerah: [[5, 7]],
    keteranganWilayah: 'Kalimantan Timur',
  },
  '65': {
    beras: [[6, 8]],
    cabai: [[5, 8]],
    bawangMerah: [[5, 7]],
    keteranganWilayah: 'Kalimantan Utara',
  },
  // Zona Sulawesi — pola MT berbeda, Sulsel adalah lumbung beras ke-3 nasional
  '71': {
    beras: [
      [3, 5],
      [8, 10],
    ],
    cabai: [
      [2, 4],
      [8, 10],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sulawesi Utara',
  },
  '72': {
    beras: [
      [3, 5],
      [8, 10],
    ],
    cabai: [
      [2, 4],
      [8, 10],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sulawesi Tengah',
  },
  '73': {
    beras: [
      [4, 6],
      [9, 11],
    ],
    cabai: [
      [3, 5],
      [9, 11],
    ],
    bawangMerah: [
      [4, 6],
      [10, 12],
    ],
    keteranganWilayah:
      'Sulawesi Selatan (lumbung beras ke-3 nasional, pola MT geser +2 bulan dari Jawa)',
  },
  '74': {
    beras: [
      [4, 6],
      [9, 11],
    ],
    cabai: [
      [3, 5],
      [9, 11],
    ],
    bawangMerah: [
      [4, 6],
      [10, 12],
    ],
    keteranganWilayah: 'Sulawesi Tenggara',
  },
  '75': {
    beras: [
      [4, 6],
      [9, 10],
    ],
    cabai: [
      [3, 5],
      [8, 10],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Gorontalo',
  },
  '76': {
    beras: [
      [4, 6],
      [9, 11],
    ],
    cabai: [
      [3, 5],
      [9, 11],
    ],
    bawangMerah: [
      [4, 6],
      [9, 11],
    ],
    keteranganWilayah: 'Sulawesi Barat',
  },
  // Zona Nusa Tenggara — 1x/tahun, sangat bergantung curah hujan
  '52': {
    beras: [[3, 5]],
    cabai: [[3, 5]],
    bawangMerah: [[4, 6]],
    keteranganWilayah: 'NTB (sentra bawang merah Bima)',
  },
  '53': {
    beras: [[3, 5]],
    cabai: [[3, 5]],
    bawangMerah: [[4, 5]],
    keteranganWilayah: 'NTT (1x/tahun, tadah hujan)',
  },
  // Zona Maluku & Papua — ketergantungan tinggi pada logistik laut/udara dari Jawa/Sulawesi
  '81': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [[4, 6]],
    keteranganWilayah: 'Maluku (mayoritas impor dari Sulawesi)',
  },
  '82': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [[4, 6]],
    keteranganWilayah: 'Maluku Utara',
  },
  '91': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [],
    keteranganWilayah: 'Papua Barat (sangat defisit, bergantung logistik)',
  },
  '92': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [],
    keteranganWilayah: 'Papua (sangat defisit, bergantung logistik)',
  },
  '93': { beras: [[4, 6]], cabai: [[3, 6]], bawangMerah: [], keteranganWilayah: 'Papua Selatan' },
  '94': { beras: [[4, 6]], cabai: [[3, 6]], bawangMerah: [], keteranganWilayah: 'Papua Tengah' },
  '95': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [],
    keteranganWilayah: 'Papua Pegunungan',
  },
  '96': {
    beras: [[4, 6]],
    cabai: [[3, 6]],
    bawangMerah: [],
    keteranganWilayah: 'Papua Barat Daya',
  },
};

// Fallback: pola Jawa (digunakan jika kode provinsi tidak ada di lookup)
const POLA_DEFAULT = {
  beras: [
    [3, 4],
    [8, 9],
  ],
  cabai: [
    [1, 2],
    [7, 8],
  ],
  bawangMerah: [
    [5, 6],
    [10, 11],
  ],
  keteranganWilayah: 'Pola default Jawa',
};

/**
 * Cek apakah bulan saat ini masuk dalam salah satu window panen
 */
function isInPanenWindow(bulan: number, windows: [number, number][]): boolean {
  return windows.some(([start, end]) => {
    if (start <= end) {
      return bulan >= start && bulan <= end;
    }
    // Window yang melewati pergantian tahun (misal: [12, 2])
    return bulan >= start || bulan <= end;
  });
}

/**
 * Hitung musim dan fase panen per provinsi.
 * Berbasis SI Katam Terpadu Kementan + data BPS Luas Panen per Provinsi.
 */
export function hitungMusimProvinsi(tanggal: string, kodeProvinsi?: string): MusimInfo {
  const bulan = new Date(tanggal).getMonth() + 1;
  const pola = kodeProvinsi
    ? (KALENDER_TANAM_PROVINSI[kodeProvinsi] ?? POLA_DEFAULT)
    : POLA_DEFAULT;

  // Musim kemarau: rata-rata historis nasional Juni-September (BMKG)
  // KUALIFIKASI: El Niño dapat memajukan/memperpanjang kemarau 4-8 minggu dan memperparahnya.
  // La Niña dapat memperpendek kemarau atau menggantinya dengan hujan sepanjang tahun.
  // Tidak ada API prakiraan musim BMKG yang dapat diakses secara terprogram.
  const musimKemarau = bulan >= 6 && bulan <= 9;

  const panenBeras = isInPanenWindow(bulan, pola.beras);
  const panenCabai = isInPanenWindow(bulan, pola.cabai);
  const panenBawangMerah = isInPanenWindow(bulan, pola.bawangMerah);

  const kondisi: string[] = [];
  if (musimKemarau) {
    kondisi.push('musim kemarau (risiko stres air)');
  } else {
    kondisi.push('musim hujan (risiko banjir lahan, distribusi terganggu)');
  }

  if (panenBeras) kondisi.push(`panen raya beras ${pola.keteranganWilayah}`);
  else if (bulan >= 10 || bulan <= 2) kondisi.push('fase tanam beras (stok menipis)');
  else kondisi.push('fase pengisian gabah beras');

  if (!panenCabai) kondisi.push('off-season cabai (harga volatile)');
  if (!panenBawangMerah && pola.bawangMerah.length > 0) kondisi.push('off-season bawang merah');

  const kualifikasi = `Data pola panen ini berbasis rata-rata historis SI Katam Kementan per wilayah. 
Dalam kondisi El Niño (kemarau lebih awal/parah) atau La Niña (hujan sepanjang tahun), 
pola aktual dapat bergeser 4-8 minggu dari normal. 
Prakiraan musim BMKG tidak tersedia via API — pertimbangkan berita terkini jika ada indikasi anomali iklim.`;

  return {
    musimKemarau,
    musimPanen: { beras: panenBeras, cabai: panenCabai, bawangMerah: panenBawangMerah },
    keterangan: kondisi.join('; '),
    kualifikasi,
  };
}

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Hitung jarak antar dua titik koordinat menggunakan formula Haversine.
 * Menggantikan nilai hardcoded jarakKm: 120 yang tidak akurat.
 */
export function hitungJarakHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius bumi dalam km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Estimasi ongkos kirim per ton berdasarkan jarak dan mode transportasi.
 * Didasarkan pada rata-rata tarif angkutan BPS dan data YLKI.
 */
export function estimasiOngkosKirimPerTon(jarakKm: number): number {
  if (jarakKm <= 100) return 350_000; // Angkutan truk jarak dekat
  if (jarakKm <= 300) return 600_000; // Angkutan truk jarak menengah
  if (jarakKm <= 800) return 900_000; // Angkutan darat + feri
  return 2_500_000; // Angkutan laut/udara (kepulauan)
}

// ─── Hari Libur ──────────────────────────────────────────────────────────────

async function fetchHariLibur(year: number): Promise<{ date: string; description: string }[]> {
  try {
    const res = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data: { date: string; description: string }[] };
    return json.data || [];
  } catch (e: any) {
    console.warn(`[DynamicContext] Gagal fetch hari libur ${year}:`, e.message);
    return [];
  }
}

const HARI_RAYA_PANGAN_KEYWORDS = [
  'Idul Fitri',
  'Idul Adha',
  'Natal',
  'Tahun Baru',
  "Isra Mi'raj",
  'Maulid Nabi',
  'Nyepi',
  'Waisak',
  'Imlek',
];

function isDampakPangan(desc: string): boolean {
  return HARI_RAYA_PANGAN_KEYWORDS.some((kw) => desc.toLowerCase().includes(kw.toLowerCase()));
}

// ─── Kurs (frankfurter/ECB sebagai proxy) ─────────────────────────────────────

async function fetchKurs(): Promise<KursMataUang> {
  const THRESHOLD_MELEMAH = 16500;
  const THRESHOLD_MENGUAT = 15500;

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { amount: number; date: string; rates: { IDR: number } };
    const usdIdr = json.rates.IDR;

    let level: 'stabil' | 'melemah' | 'menguat' = 'stabil';
    let dampakImport: string;

    if (usdIdr > THRESHOLD_MELEMAH) {
      level = 'melemah';
      dampakImport = `Rupiah melemah ke Rp${usdIdr.toLocaleString('id-ID')}/USD (>Rp16.500). Komoditas impor (kedelai, gula mentah, daging sapi beku, gandum) berpotensi naik harga secara struktural. Produsen tahu-tempe dan roti kemungkinan akan meneruskan kenaikan ke konsumen.`;
    } else if (usdIdr < THRESHOLD_MENGUAT) {
      level = 'menguat';
      dampakImport = `Rupiah menguat ke Rp${usdIdr.toLocaleString('id-ID')}/USD (<Rp15.500). Tekanan harga impor berkurang, pasokan gula mentah dan kedelai lebih terjangkau bagi importir.`;
    } else {
      dampakImport = `Kurs Rp${usdIdr.toLocaleString('id-ID')}/USD dalam kisaran normal (Rp15.500–16.500). Harga komoditas impor relatif stabil.`;
    }

    return {
      usdIdr,
      tanggal: json.date,
      level,
      dampakImport,
      // Transparansi sumber — penting agar AI tidak over-claim
      sumberData:
        'frankfurter.app (ECB-based, proxy). Kurs resmi JISDOR BI tidak tersedia via API publik. Untuk keputusan formal, cek bi.go.id/hargajisdor.',
    };
  } catch (e: any) {
    console.warn('[DynamicContext] Gagal fetch kurs:', e.message);
    return {
      usdIdr: 0,
      tanggal: '',
      level: 'stabil',
      dampakImport: 'Data kurs tidak tersedia. Asumsi kondisi normal.',
      sumberData: 'Tidak tersedia (fallback)',
    };
  }
}

// ─── Neraca Pangan Provinsi (dari DB, seed dari Bapanas) ────────────────────

export async function fetchNeracaProvinsi(
  kodeProvinsi: string,
): Promise<Record<number, NeracaProvinsiInfo>> {
  try {
    const rows = await db
      .select({
        komoditasId: neracaPanganProvinsi.komoditasId,
        statusNeraca: neracaPanganProvinsi.statusNeraca,
        implikasiIntervensi: neracaPanganProvinsi.implikasiIntervensi,
      })
      .from(neracaPanganProvinsi)
      .where(eq(neracaPanganProvinsi.kodeProvinsi, kodeProvinsi));

    const result: Record<number, NeracaProvinsiInfo> = {};
    for (const row of rows) {
      result[row.komoditasId] = {
        statusNeraca: row.statusNeraca as 'surplus' | 'defisit' | 'seimbang',
        implikasiIntervensi: row.implikasiIntervensi || '',
      };
    }
    return result;
  } catch (e: any) {
    console.warn(`[DynamicContext] Gagal fetch neraca pangan provinsi ${kodeProvinsi}:`, e.message);
    return {};
  }
}

// ─── Main: getDynamicContext ──────────────────────────────────────────────────

/**
 * Ambil semua konteks dinamis (1-jam cache).
 * Neraca pangan tidak di-cache di sini karena per-provinsi — diambil terpisah via fetchNeracaProvinsi().
 */
export async function getDynamicContext(tanggal: string): Promise<DynamicContext> {
  if (contextCache && Date.now() - contextCache.fetchedAt < CACHE_TTL_MS) {
    return { ...contextCache.data, tanggalAnalisis: tanggal };
  }

  const today = new Date(tanggal);
  const tahunIni = today.getFullYear();

  const [liburIni, liburDepan, kurs] = await Promise.all([
    fetchHariLibur(tahunIni),
    fetchHariLibur(tahunIni + 1),
    fetchKurs(),
  ]);

  const semuaLibur = [...liburIni, ...liburDepan];
  const hariRayaMendatang: HariRayaInfo[] = semuaLibur
    .map((h) => {
      const diffMs = new Date(h.date).getTime() - today.getTime();
      const hariLagi = Math.ceil(diffMs / 86_400_000);
      return {
        nama: h.description,
        tanggal: h.date,
        hariLagi,
        isMusimRaya: hariLagi >= -7 && hariLagi <= 14,
      };
    })
    .filter((h) => h.hariLagi >= -7 && h.hariLagi <= 90 && isDampakPangan(h.nama))
    .sort((a, b) => a.hariLagi - b.hariLagi);

  const hariRayaTerdekat = hariRayaMendatang[0] ?? null;

  // Gunakan musim nasional (tanpa kode provinsi) untuk konteks global
  const musim = hitungMusimProvinsi(tanggal);

  const bagian: string[] = [];
  if (hariRayaTerdekat) {
    if (hariRayaTerdekat.hariLagi <= 0) {
      bagian.push(
        `Saat ini berlangsung masa ${hariRayaTerdekat.nama} (${Math.abs(hariRayaTerdekat.hariLagi)} hari pasca hari H). Demand pangan naik 20-40%, pasar tradisional banyak tutup.`,
      );
    } else if (hariRayaTerdekat.hariLagi <= 14) {
      bagian.push(
        `H-${hariRayaTerdekat.hariLagi} menuju ${hariRayaTerdekat.nama} (${hariRayaTerdekat.tanggal}). Window kritis: demand naik signifikan, spekulan aktif menimbun stok.`,
      );
    } else {
      bagian.push(
        `${hariRayaTerdekat.nama} dalam ${hariRayaTerdekat.hariLagi} hari (${hariRayaTerdekat.tanggal}). Pedagang besar mulai bangun stok.`,
      );
    }
  }
  bagian.push(`Kondisi musim: ${musim.keterangan}.`);
  if (kurs.usdIdr > 0) bagian.push(kurs.dampakImport);

  const result: DynamicContext = {
    tanggalAnalisis: tanggal,
    hariRayaTerdekat,
    hariRayaBesar: hariRayaMendatang.slice(0, 5),
    musim,
    kurs,
    neracaPerKomoditas: {}, // Diisi per-provinsi saat dibutuhkan
    ringkasan: bagian.join(' '),
  };

  contextCache = { data: result, fetchedAt: Date.now() };

  console.log(`[DynamicContext] Context built for ${tanggal}:`, {
    hariRayaTerdekat: hariRayaTerdekat?.nama,
    hariLagi: hariRayaTerdekat?.hariLagi,
    musim: musim.keterangan,
    kursUsdIdr: kurs.usdIdr,
    sumberKurs: kurs.sumberData,
  });

  return result;
}
