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
  private model: string;

  // Circuit Breaker State (shared across all instances)
  private static failureCount = 0;
  private static lastFailureTime = 0;
  private static isBypassed = false;
  private static readonly FAILURE_THRESHOLD = 3;
  private static readonly BYPASS_DURATION_MS = 5 * 60 * 1000; // 5 minutes bypass cooldown

  constructor() {
    // Standard AI credentials matching fintr configurations
    this.url = process.env.AI_BASE_URL || 'https://ai.dvlpid.my.id/v1';
    this.key = process.env.AI_API_KEY || 'sk-af6376fcf20b4a148672456a6cae1902';
    this.model = process.env.AI_MODEL || 'gemini-3-flash';
  }

  private async callProxy<T>(
    systemPrompt: string,
    userPrompt: string,
    fallbackData: T,
  ): Promise<T> {
    if (!this.url || !this.key) {
      return fallbackData;
    }

    // Check Circuit Breaker status
    if (AIClient.isBypassed) {
      const timeSinceLastFailure = Date.now() - AIClient.lastFailureTime;
      if (timeSinceLastFailure > AIClient.BYPASS_DURATION_MS) {
        // Cooldown period expired, reset and try again
        AIClient.isBypassed = false;
        AIClient.failureCount = 0;
        console.log('[AIClient] Circuit breaker cooldown expired. Retrying proxy connection...');
      } else {
        // Still in bypassed state
        const remainingTimeSec = Math.ceil(
          (AIClient.BYPASS_DURATION_MS - timeSinceLastFailure) / 1000,
        );
        console.warn(
          `[AIClient] Circuit breaker is ACTIVE. Bypassing AI proxy call. Cooldown remaining: ${remainingTimeSec}s`,
        );
        return fallbackData;
      }
    }

    try {
      const response = await fetch(`${this.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`AI Proxy responded with status ${response.status}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content || '';

      // Reset failure counter on successful request
      AIClient.failureCount = 0;
      AIClient.isBypassed = false;

      // Clean JSON markdown wrapper blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr) as T;
    } catch (error: any) {
      AIClient.failureCount++;
      AIClient.lastFailureTime = Date.now();

      console.error(
        `[AIClient] AI Proxy error on completions API (${AIClient.failureCount}/${AIClient.FAILURE_THRESHOLD}):`,
        error.message || error,
      );

      if (AIClient.failureCount >= AIClient.FAILURE_THRESHOLD) {
        AIClient.isBypassed = true;
        console.error(
          `[AIClient] Circuit breaker TRIPPED. Bypassing AI proxy calls for ${AIClient.BYPASS_DURATION_MS / 60000} minutes.`,
        );
      }

      return fallbackData;
    }
  }

  async detectAnomalies(harga: HargaHarian, v: Variant | null): Promise<AnomalyResult> {
    // 1. Establish fallback/rules-based baseline first
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

    // Rules-First Pre-filtering: If mathematically determined to be normal,
    // bypass the AI API call entirely to conserve rate limits and prevent slowdowns.
    if (!isAnomaly) {
      return fallback;
    }

    const systemPrompt = `Kamu adalah asisten AI TPID Indonesia yang bertugas menganalisis harga komoditas pangan untuk mendeteksi anomali.
Analisis data harga harian saat ini terhadap batas Harga Eceran Tertinggi (HET) / Harga Acuan Penjualan (HAP).
Kembalikan respon dalam format JSON saja, tanpa markdown atau teks penjelasan tambahan:
{
  "isAnomaly": boolean,
  "reason": "Alasan singkat mengapa harga dianggap anomali (misal: melewati HAP atau kenaikan ekstrim)",
  "severity": "low" | "medium" | "high"
}`;

    const userPrompt = `Komoditas: ${JSON.stringify(v)}
Transaksi: ${JSON.stringify(harga)}`;

    return this.callProxy<AnomalyResult>(systemPrompt, userPrompt, fallback);
  }

  async generateTrendNarrative(
    provinsi: string,
    history: { tanggal: string; harga: number; namaKomoditas: string }[],
  ): Promise<TrendResult> {
    // 1. Establish fallback baseline
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

    const systemPrompt = `Kamu adalah analis pangan nasional yang menganalisis tren harga komoditas di wilayah Indonesia.
Analisis data deret waktu harga historis dan tentukan tren harga serta proyeksi 3 hari ke depan.
Kembalikan respon dalam format JSON saja, tanpa markdown atau teks penjelasan tambahan:
{
  "trend": "rising" | "stable" | "falling",
  "narrative": "Penjelasan singkat dalam bahasa Indonesia mengenai pergerakan harga saat ini",
  "projection": "Penjelasan singkat mengenai proyeksi harga 3 hari ke depan"
}`;

    const userPrompt = `Provinsi: ${provinsi}
Riwayat Harga: ${JSON.stringify(history)}`;

    return this.callProxy<TrendResult>(systemPrompt, userPrompt, fallback);
  }

  async generateManagementKPI(summaryData: {
    totalPasar: number;
    totalAnomali: number;
    kenaikanTertinggi: string;
    daerahKritis: string[];
  }): Promise<KPIResult> {
    // 1. Establish fallback baseline
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

    const systemPrompt = `Kamu adalah sekretaris eksekutif Kemenko Pangan yang menyusun KPI pengendalian inflasi nasional untuk manajemen tingkat tinggi.
Berdasarkan ringkasan data nasional, buat skor KPI (0-100), status tingkat kerawanan, highlight utama, serta rekomendasi taktis.
Kembalikan respon dalam format JSON saja, tanpa markdown atau teks penjelasan tambahan:
{
  "score": number,
  "status": "normal" | "warning" | "critical",
  "highlights": string[],
  "recommendations": string[]
}`;

    const userPrompt = `Data Ringkasan Nasional: ${JSON.stringify(summaryData)}`;

    return this.callProxy<KPIResult>(systemPrompt, userPrompt, fallback);
  }

  async generateDailySummary(
    pasarNama: string,
    hargaHarianList: { namaKomoditas: string; harga: number; perubahan: number }[],
  ): Promise<DailySummaryResult> {
    // 1. Establish fallback baseline
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

    const systemPrompt = `Kamu adalah asisten belanja ibu rumah tangga cerdas di Indonesia yang memberikan rekomendasi belanja hemat.
Berdasarkan daftar harga komoditas di pasar tertentu, berikan judul saran belanja, ringkasan situasi pasar, dan tips berbelanja hemat.
Kembalikan respon dalam format JSON saja, tanpa markdown atau teks penjelasan tambahan:
{
  "title": "Saran Belanja Pasar X",
  "summary": "Ringkasan situasi harga pangan hari ini di pasar tersebut",
  "tips": string[]
}`;

    const userPrompt = `Pasar: ${pasarNama}
Daftar Harga: ${JSON.stringify(hargaHarianList)}`;

    return this.callProxy<DailySummaryResult>(systemPrompt, userPrompt, fallback);
  }
}
