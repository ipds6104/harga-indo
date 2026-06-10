import type { HargaHarian, Variant } from '@harga/shared';

export interface AnomalyResult {
  isAnomaly: boolean;
  reason: string | null;
  severity: 'low' | 'medium' | 'high';
}

export interface TrendResult {
  trend: 'rising' | 'stable' | 'falling';
  narrative: string;
  projection: string;
}

export interface KPIResult {
  score: number;
  status: 'normal' | 'warning' | 'critical';
  highlights: string[];
  recommendations: string[];
}

export interface DailySummaryResult {
  title: string;
  summary: string;
  tips: string[];
}

export class AIClient {
  private url: string;
  private key: string;

  constructor() {
    this.url = process.env.AI_PROXY_URL || '';
    this.key = process.env.AI_PROXY_KEY || '';
  }

  private async callProxy<T>(endpoint: string, payload: any, fallbackData: T): Promise<T> {
    if (!this.url || !this.key) {
      // Return fallback stub data if not configured
      return fallbackData;
    }

    try {
      const response = await fetch(`${this.url}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`AI Proxy responded with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`AI Proxy error on ${endpoint}:`, error);
      return fallbackData;
    }
  }

  async detectAnomalies(harga: HargaHarian, v: Variant | null): Promise<AnomalyResult> {
    // Basic local rule validation as fallback/enhancer
    let isAnomaly = false;
    let reason = null;
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (v) {
      if (v.hargaMax && harga.harga > v.hargaMax) {
        isAnomaly = true;
        reason = `Harga pasar Rp${harga.harga.toLocaleString('id-ID')} melampaui HET/Harga Max nasional Rp${v.hargaMax.toLocaleString('id-ID')}`;
        severity = 'high';
      } else if (v.kenaikanMax && harga.prosentasePerubahan > v.kenaikanMax) {
        isAnomaly = true;
        reason = `Kenaikan harga harian sebesar ${harga.prosentasePerubahan.toFixed(2)}% melebihi batas toleransi kenaikan max ${v.kenaikanMax}%`;
        severity = 'medium';
      }
    }

    const fallback: AnomalyResult = { isAnomaly, reason, severity };

    return this.callProxy<AnomalyResult>('/v1/detect-anomaly', { harga, variant: v }, fallback);
  }

  async generateTrendNarrative(
    provinsi: string,
    history: { tanggal: string; harga: number; namaKomoditas: string }[],
  ): Promise<TrendResult> {
    const prices = history.map((h) => h.harga);
    const startPrice = prices[0] || 0;
    const endPrice = prices[prices.length - 1] || 0;
    const diffPercent = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    let narrative = `Harga komoditas stabil di wilayah ${provinsi}.`;
    let projection = 'Harga diperkirakan tetap stabil dalam 3 hari ke depan.';

    if (diffPercent > 2) {
      trend = 'rising';
      narrative = `Terjadi tren kenaikan harga komoditas sebesar ${diffPercent.toFixed(1)}% di wilayah ${provinsi} dalam periode ini.`;
      projection = 'Tekanan harga diperkirakan berlanjut karena kendala pasokan harian.';
    } else if (diffPercent < -2) {
      trend = 'falling';
      narrative = `Harga komoditas mengalami penurunan sebesar ${Math.abs(diffPercent).toFixed(1)}% di wilayah ${provinsi}, menunjukkan pasokan yang melimpah.`;
      projection = 'Harga diperkirakan stabil cenderung turun menjelang akhir pekan.';
    }

    const fallback: TrendResult = { trend, narrative, projection };

    return this.callProxy<TrendResult>('/v1/generate-trend', { provinsi, history }, fallback);
  }

  async generateManagementKPI(summaryData: {
    totalPasar: number;
    totalAnomali: number;
    kenaikanTertinggi: string;
    daerahKritis: string[];
  }): Promise<KPIResult> {
    const status =
      summaryData.totalAnomali > 10
        ? 'critical'
        : summaryData.totalAnomali > 3
          ? 'warning'
          : 'normal';
    const score = Math.max(100 - summaryData.totalAnomali * 5, 20);

    const fallback: KPIResult = {
      score,
      status,
      highlights: [
        `Total pasar terdeteksi anomali: ${summaryData.totalAnomali} dari ${summaryData.totalPasar} pasar aktif.`,
        `Kenaikan tertinggi dilaporkan pada komoditas ${summaryData.kenaikanTertinggi}.`,
      ],
      recommendations: [
        `Lakukan operasi pasar taktis di daerah kritis: ${summaryData.daerahKritis.join(', ')}`,
        'Koordinasikan distribusi pasokan pangan tambahan dari daerah surplus.',
      ],
    };

    return this.callProxy<KPIResult>('/v1/generate-kpi', summaryData, fallback);
  }

  async generateDailySummary(
    pasarNama: string,
    hargaHarianList: { namaKomoditas: string; harga: number; perubahan: number }[],
  ): Promise<DailySummaryResult> {
    const naik = hargaHarianList.filter((h) => h.perubahan > 0).map((h) => h.namaKomoditas);
    const turun = hargaHarianList.filter((h) => h.perubahan < 0).map((h) => h.namaKomoditas);

    let summary = `Harga kebutuhan pokok di ${pasarNama} terpantau stabil secara keseluruhan.`;
    if (naik.length > 0) {
      summary += ` Perlu diwaspadai kenaikan harga pada ${naik.join(', ')}.`;
    }
    if (turun.length > 0) {
      summary += ` Pembelian alternatif disarankan pada ${turun.join(', ')} karena sedang mengalami penurunan harga.`;
    }

    const fallback: DailySummaryResult = {
      title: `Rekomendasi Belanja di ${pasarNama}`,
      summary,
      tips: [
        'Belanja lebih pagi untuk mendapatkan kualitas komoditas terbaik.',
        naik.length > 0
          ? `Bila memungkinkan, kurangi porsi pembelian ${naik[0]} untuk sementara waktu.`
          : 'Pilih komoditas lokal untuk harga lebih terjangkau.',
      ],
    };

    return this.callProxy<DailySummaryResult>(
      '/v1/generate-daily-summary',
      { pasarNama, hargaHarianList },
      fallback,
    );
  }
}
