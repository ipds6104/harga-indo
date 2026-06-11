export interface Satuan {
  id: number;
  display: string;
  deskripsi: string | null;
}

export interface Provinsi {
  kode: string;
  nama: string;
}

export interface Kota {
  kode: string;
  nama: string;
  kode_provinsi: string;
}

export interface Pasar {
  id: number;
  kode: string | null;
  nama: string;
  kode_provinsi: string;
  kode_kab_kota: string;
  lat: string | null;
  lon: string | null;
  tipe_pasar_id: number | null;
  kelompok: string | null;
  is_active: boolean;
  is_nasional: boolean;
}

export interface Komoditas {
  id: number;
  kode: string | null;
  nama: string;
  tipe_komoditas_id: number;
  is_active: boolean;
}

export interface Variant {
  id: number;
  kode: string | null;
  komoditas_id: number;
  nama: string;
  satuan_id: number;
  harga_min: number | null;
  harga_max: number | null;
  kenaikan_max: number | null;
  penurunan_max: number | null;
  coicop_7: string | null;
  coicop_10: string | null;
}

export interface Produk {
  id: number;
  kode: string | null;
  variant_id: number;
  nama: string;
  satuan_id: number;
}

export interface Pedagang {
  id: number;
  nama: string;
  telepon: string | null;
  pasar_id: number;
  lantai: string | null;
  nomor_los: string | null;
  is_active: boolean;
}

export interface HargaHarian {
  id: number; // SP2KP ID
  pasar_id: number;
  komoditas_id: number;
  variant_id: number;
  produk_id: number;
  satuan_id: number;
  tanggal: string; // YYYY-MM-DD
  harga: number;
  harga_sebelumnya: number;
  prosentase_perubahan: number;
  kuantitas: number | null;
  pasokan: number | null;
  jumlah_pedagang: number;
  kode_provinsi: string;
  kode_kab_kota: string;
  status_verifikasi_1: string | null;
  verifikasi_1_at: string | null;
  status_verifikasi_2: string | null;
  verifikasi_2_at: string | null;
  is_active: boolean;
  is_closed: boolean;
  is_harga_still_zero: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HargaHarianDetail {
  id: number; // SP2KP Detail ID
  harga_harian_id: number;
  pedagang_id: number;
  harga: number;
  harga_sebelumnya: number;
  tanggal_sebelumnya: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AIInsight {
  id: string;
  tanggal: string; // YYYY-MM-DD
  kode_provinsi: string | null;
  komoditas_id: number | null;
  tipe: 'anomaly' | 'trend' | 'summary' | 'kpi';
  konten_json: any;
  model_used: string;
  created_at?: string;
}

export interface IngestionLog {
  id: string;
  run_id: string;
  tanggal_fetch: string;
  pasar_id: number;
  status: 'pending' | 'success' | 'failed';
  records_fetched: number;
  error_message: string | null;
  duration_ms: number;
  created_at?: string;
}

export interface JobPayload {
  pasar_id: number;
  tanggal_start: string;
  tanggal_end: string;
  tipe_komoditas_id: number;
  run_id: string;
  trigger_ai?: boolean;
  expected_count?: number;
}
