/**
 * Dynamic Context Service
 *
 * Menggantikan semua data hardcoded (seperti "Idul Adha 15 hari lagi") dengan
 * fetch real-time dari sumber data otoritatif Indonesia:
 *
 * 1. Hari Libur Nasional  → api-hari-libur.vercel.app (berdasarkan SKB 3 Menteri)
 * 2. Kurs USD/IDR         → frankfurter.app (ECB-based, harian)
 * 3. Musim Panen          → Deterministic berdasarkan kalender tanam BPS/Kementan
 *
 * CATATAN tentang epistemologi:
 * - BMKG API butuh kode kelurahan (adm4) yang tidak praktis untuk 1.228 pasar
 * - Musim hujan/kemarau lebih relevan untuk analisis harga pangan daripada cuaca harian
 * - Kurs lebih penting untuk komoditas impor (kedelai, gula, daging sapi)
 * - Hari raya adalah faktor demand-shock paling kuat di Indonesia
 */

export interface HariRayaInfo {
  nama: string;
  tanggal: string;
  hariLagi: number;
  isMusimRaya: boolean; // true jika dalam window ±14 hari dari hari raya besar
}

export interface MusimInfo {
  musimKemarau: boolean; // Juni-September: kemarau → stres air → risiko gagal panen
  musimPanen: {
    beras: boolean; // Maret-April & Agustus-September panen raya
    cabai: boolean; // Panen sepanjang tahun, puncak Januari-Februari & Juli-Agustus
    bawangMerah: boolean; // Panen raya Mei-Juni & Oktober-November
  };
  keterangan: string;
}

export interface KursMataUang {
  usdIdr: number;
  tanggal: string;
  level: 'stabil' | 'melemah' | 'menguat'; // relatif terhadap threshold Rp16.500
  dampakImport: string;
}

export interface DynamicContext {
  tanggalAnalisis: string;
  hariRayaTerdekat: HariRayaInfo | null;
  hariRayaBesar: HariRayaInfo[]; // semua hari raya dalam 60 hari ke depan
  musim: MusimInfo;
  kurs: KursMataUang;
  ringkasan: string; // Ringkasan konteks dalam 1-2 kalimat untuk disematkan di prompt
}

// Cache in-memory untuk menghindari fetch berulang dalam 1 run AI analysis
let contextCache: { data: DynamicContext; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam TTL

/**
 * Fetch daftar hari libur nasional dari API publik (SKB 3 Menteri)
 * Endpoint: https://api-hari-libur.vercel.app/api?year=YYYY
 */
async function fetchHariLibur(year: number): Promise<{ date: string; description: string }[]> {
  try {
    const res = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      data: { date: string; description: string }[];
    };
    return json.data || [];
  } catch (e: any) {
    console.warn(`[DynamicContext] Gagal fetch hari libur ${year}:`, e.message);
    return [];
  }
}

/**
 * Hari raya yang punya dampak signifikan pada permintaan pangan
 * Diurutkan berdasarkan kekuatan dampak demand-shock
 */
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

function isDampakPangan(description: string): boolean {
  return HARI_RAYA_PANGAN_KEYWORDS.some((kw) =>
    description.toLowerCase().includes(kw.toLowerCase()),
  );
}

/**
 * Hitung musim dan fase panen berdasarkan kalender tanam nasional (BPS/Kementan)
 * Data berbasis riset pola tanam Indonesia, bukan real-time (deterministic tapi akurat)
 */
function hitungMusim(tanggal: string): MusimInfo {
  const date = new Date(tanggal);
  const bulan = date.getMonth() + 1; // 1-12

  // Musim kemarau Indonesia: Juni-September (BMKG approx)
  const musimKemarau = bulan >= 6 && bulan <= 9;

  // Pola panen beras nasional (Subak, Jawa, Sumatera):
  // Panen raya 1: Maret-April (tanam Oktober-November)
  // Panen raya 2: Agustus-September (tanam April-Mei)
  const panenBeras = (bulan >= 3 && bulan <= 4) || (bulan >= 8 && bulan <= 9);

  // Pola panen cabai:
  // Puncak panen: Januari-Februari dan Juli-Agustus
  // Off-season: Maret-Juni dan September-Desember → harga cenderung naik
  const panenCabai = (bulan >= 1 && bulan <= 2) || (bulan >= 7 && bulan <= 8);

  // Pola panen bawang merah:
  // Panen raya 1: Mei-Juni (sentra Brebes, Bima)
  // Panen raya 2: Oktober-November
  const panenBawangMerah = (bulan >= 5 && bulan <= 6) || (bulan >= 10 && bulan <= 11);

  let keterangan = '';
  const kondisi: string[] = [];

  if (musimKemarau) {
    kondisi.push('musim kemarau (risiko stres air pada tanaman)');
  } else {
    kondisi.push('musim hujan (risiko banjir di lahan pertanian)');
  }

  if (panenBeras) kondisi.push('fase panen raya beras');
  else if (bulan >= 10 || bulan <= 2) kondisi.push('fase tanam beras (stok menipis)');
  else kondisi.push('fase pengisian gabah');

  if (!panenCabai) kondisi.push('off-season cabai (harga berpotensi tinggi)');
  if (!panenBawangMerah) kondisi.push('off-season bawang merah');

  keterangan = kondisi.join('; ');

  return {
    musimKemarau,
    musimPanen: {
      beras: panenBeras,
      cabai: panenCabai,
      bawangMerah: panenBawangMerah,
    },
    keterangan,
  };
}

/**
 * Fetch kurs USD/IDR dari Frankfurter API (berbasis ECB, diperbarui harian)
 */
async function fetchKurs(): Promise<KursMataUang> {
  const THRESHOLD_MELEMAH = 16500; // Rp16.500 = threshold kritis untuk importir
  const THRESHOLD_MENGUAT = 15500;

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      amount: number;
      base: string;
      date: string;
      rates: { IDR: number };
    };
    const usdIdr = json.rates.IDR;

    let level: 'stabil' | 'melemah' | 'menguat' = 'stabil';
    let dampakImport = '';

    if (usdIdr > THRESHOLD_MELEMAH) {
      level = 'melemah';
      dampakImport = `Rupiah melemah ke Rp${usdIdr.toLocaleString('id-ID')}/USD (>Rp16.500). Komoditas impor (kedelai, gula mentah, daging sapi beku, gandum) berpotensi naik harga secara struktural. Produsen tahu-tempe dan roti kemungkinan menaikkan harga.`;
    } else if (usdIdr < THRESHOLD_MENGUAT) {
      level = 'menguat';
      dampakImport = `Rupiah menguat ke Rp${usdIdr.toLocaleString('id-ID')}/USD (<Rp15.500). Tekanan harga impor berkurang, pasokan gula mentah dan kedelai lebih terjangkau bagi importir.`;
    } else {
      dampakImport = `Kurs Rp${usdIdr.toLocaleString('id-ID')}/USD dalam kisaran normal. Harga komoditas impor relatif stabil.`;
    }

    return { usdIdr, tanggal: json.date, level, dampakImport };
  } catch (e: any) {
    console.warn('[DynamicContext] Gagal fetch kurs:', e.message);
    // Fallback: gunakan kurs indikatif tanpa klaim keakuratan
    return {
      usdIdr: 0,
      tanggal: '',
      level: 'stabil',
      dampakImport: 'Data kurs tidak tersedia saat ini. Asumsi kondisi kurs normal.',
    };
  }
}

/**
 * Fungsi utama: ambil semua konteks dinamis, dengan in-memory cache 1 jam
 */
export async function getDynamicContext(tanggal: string): Promise<DynamicContext> {
  // Cek cache
  if (contextCache && Date.now() - contextCache.fetchedAt < CACHE_TTL_MS) {
    return { ...contextCache.data, tanggalAnalisis: tanggal };
  }

  const today = new Date(tanggal);
  const tahunIni = today.getFullYear();
  const tahunDepan = tahunIni + 1;

  // Fetch paralel: hari libur tahun ini + tahun depan + kurs
  const [liburTahunIni, liburTahunDepan, kurs] = await Promise.all([
    fetchHariLibur(tahunIni),
    fetchHariLibur(tahunDepan),
    fetchKurs(),
  ]);

  const semuaLibur = [...liburTahunIni, ...liburTahunDepan];

  // Filter hari raya yang punya dampak pangan & dalam 90 hari ke depan
  const hariRayaMendatang: HariRayaInfo[] = semuaLibur
    .map((h) => {
      const tglHR = new Date(h.date);
      const diffMs = tglHR.getTime() - today.getTime();
      const hariLagi = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        nama: h.description,
        tanggal: h.date,
        hariLagi,
        isMusimRaya: hariLagi >= -7 && hariLagi <= 14, // window ±7 hari pasca / 14 hari pra
      };
    })
    .filter((h) => h.hariLagi >= -7 && h.hariLagi <= 90 && isDampakPangan(h.nama))
    .sort((a, b) => a.hariLagi - b.hariLagi);

  // Hari raya terdekat (bisa sedang berlangsung)
  const hariRayaTerdekat = hariRayaMendatang.length > 0 ? hariRayaMendatang[0] : null;

  // Hitung musim
  const musim = hitungMusim(tanggal);

  // Bangun ringkasan konteks untuk disematkan ke prompt
  const bagianRingkasan: string[] = [];

  if (hariRayaTerdekat) {
    if (hariRayaTerdekat.hariLagi <= 0) {
      bagianRingkasan.push(
        `Saat ini berlangsung masa ${hariRayaTerdekat.nama} (${Math.abs(hariRayaTerdekat.hariLagi)} hari pasca hari H). Pola historis menunjukkan lonjakan demand pangan 20-40% dan penurunan pasokan pasar tradisional karena pedagang libur.`,
      );
    } else if (hariRayaTerdekat.hariLagi <= 14) {
      bagianRingkasan.push(
        `H-${hariRayaTerdekat.hariLagi} menuju ${hariRayaTerdekat.nama} (${hariRayaTerdekat.tanggal}). Ini adalah window kritis: demand pangan meningkat signifikan dan spekulan pasar aktif menimbun stok.`,
      );
    } else {
      bagianRingkasan.push(
        `${hariRayaTerdekat.nama} dalam ${hariRayaTerdekat.hariLagi} hari (${hariRayaTerdekat.tanggal}). Belum dalam zona kritis, namun pengusaha katering/ritel mulai membangun stok.`,
      );
    }
  }

  bagianRingkasan.push(`Kondisi musim: ${musim.keterangan}.`);

  if (kurs.usdIdr > 0) {
    bagianRingkasan.push(kurs.dampakImport);
  }

  const ringkasan = bagianRingkasan.join(' ');

  const result: DynamicContext = {
    tanggalAnalisis: tanggal,
    hariRayaTerdekat,
    hariRayaBesar: hariRayaMendatang.slice(0, 5), // 5 hari raya terdekat
    musim,
    kurs,
    ringkasan,
  };

  // Simpan ke cache
  contextCache = { data: result, fetchedAt: Date.now() };

  console.log(`[DynamicContext] Context built for ${tanggal}:`, {
    hariRayaTerdekat: hariRayaTerdekat?.nama,
    hariLagi: hariRayaTerdekat?.hariLagi,
    musim: musim.keterangan,
    kursUsdIdr: kurs.usdIdr,
  });

  return result;
}
