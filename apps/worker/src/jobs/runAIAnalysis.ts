import { AIClient } from '@harga/ai-client';
import { aiInsights, db, hargaHarian, komoditas, provinsi, variant } from '@harga/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { evaluatePrice } from '../services/alert-evaluator';

const aiClient = new AIClient();

export async function runAIAnalysis(payload: { tanggal: string; runId: string }) {
  const { tanggal, runId } = payload;
  console.log(`[AIAnalysis] Running analysis for date: ${tanggal} (run: ${runId})`);

  try {
    // 1. Fetch all provinces
    const provList = await db.select().from(provinsi);
    console.log(`[AIAnalysis] Found ${provList.length} provinces to analyze.`);

    // Keep track of anomalies and prices to compile national KPI summary
    let nationalAnomaliesCount = 0;
    const criticalRegions: string[] = [];
    const priceIncreases: { name: string; pct: number }[] = [];

    // Helper function to analyze a single province
    const analyzeProvince = async (prov: (typeof provList)[0]) => {
      // Fetch today's prices in this province
      const todayPrices = await db
        .select({
          harga: hargaHarian,
          v: variant,
          k: komoditas,
        })
        .from(hargaHarian)
        .leftJoin(variant, eq(hargaHarian.variantId, variant.id))
        .leftJoin(komoditas, eq(hargaHarian.komoditasId, komoditas.id))
        .where(and(eq(hargaHarian.tanggal, tanggal), eq(hargaHarian.kodeProvinsi, prov.kode)));

      if (todayPrices.length === 0) return null;

      console.log(
        `[AIAnalysis] Analyzing ${todayPrices.length} price records in province ${prov.nama}`,
      );

      const hargaHarianListForSummary: any[] = [];
      const evaluationPromises: Promise<any>[] = [];

      for (const item of todayPrices) {
        // Build average representation
        hargaHarianListForSummary.push({
          namaKomoditas: item.v?.nama || 'Komoditas',
          harga: item.harga.harga,
          perubahan: item.harga.prosentasePerubahan,
        });

        // Evaluate price for TPID Alert & state machine in parallel
        evaluationPromises.push(
          evaluatePrice({
            tanggal,
            kodeProvinsi: prov.kode,
            kodeKabKota: item.harga.kodeKabKota || '',
            komoditasId: item.harga.komoditasId,
            variantId: item.harga.variantId,
            hargaRataRata: item.harga.harga,
            jumlahPedagang: item.harga.jumlahPedagang,
          }),
        );
      }

      // Execute evaluations in parallel (fast DB ops)
      await Promise.all(evaluationPromises);

      // Batch detect anomalies for this province
      const anomalyResults = await aiClient.detectAnomaliesBatch(
        todayPrices.map((item) => ({ harga: item.harga, v: item.v })),
      );

      const provinceAnomalies: any[] = [];
      let localAnomaliesCount = 0;
      const localPriceIncreases: { name: string; pct: number }[] = [];

      for (let i = 0; i < todayPrices.length; i++) {
        const item = todayPrices[i];
        const result = anomalyResults[i];

        if (item.harga.prosentasePerubahan > 0) {
          localPriceIncreases.push({
            name: item.v?.nama || 'Komoditas',
            pct: item.harga.prosentasePerubahan,
          });
        }

        if (result.isAnomaly) {
          provinceAnomalies.push({
            komoditasId: item.harga.komoditasId,
            variantId: item.harga.variantId,
            nama: item.v?.nama || 'Komoditas',
            harga: item.harga.harga,
            perubahan: item.harga.prosentasePerubahan,
            reason: result.reason,
            severity: result.severity,
          });
          localAnomaliesCount++;
        }
      }

      // If we have anomalies, write to AI Insights
      if (provinceAnomalies.length > 0) {
        await db
          .insert(aiInsights)
          .values({
            id: crypto.randomUUID(),
            tanggal,
            kodeProvinsi: prov.kode,
            tipe: 'anomaly',
            kontenJson: JSON.stringify(provinceAnomalies),
            modelUsed: 'gemini-1.5-flash-stub',
          })
          .onConflictDoNothing(); // prevent duplication
      }

      // Generate Trend Narrative
      // Fetch last 7 days history for this province
      const lastWeekPrices = await db
        .select({
          tanggal: hargaHarian.tanggal,
          harga: hargaHarian.harga,
          namaKomoditas: variant.nama,
        })
        .from(hargaHarian)
        .leftJoin(variant, eq(hargaHarian.variantId, variant.id))
        .where(
          and(eq(hargaHarian.kodeProvinsi, prov.kode), sql`${hargaHarian.tanggal} <= ${tanggal}`),
        )
        .orderBy(desc(hargaHarian.tanggal))
        .limit(100);

      const historyData = lastWeekPrices.map((p) => ({
        tanggal: p.tanggal,
        harga: p.harga,
        namaKomoditas: p.namaKomoditas || 'Komoditas',
      }));

      const trendResult = await aiClient.generateTrendNarrative(prov.nama, historyData);
      await db
        .insert(aiInsights)
        .values({
          id: crypto.randomUUID(),
          tanggal,
          kodeProvinsi: prov.kode,
          tipe: 'trend',
          kontenJson: JSON.stringify(trendResult),
          modelUsed: 'gemini-1.5-flash-stub',
        })
        .onConflictDoNothing();

      // Generate Daily Household Summary per province
      const dailySummary = await aiClient.generateDailySummary(
        `Provinsi ${prov.nama}`,
        hargaHarianListForSummary.slice(0, 10), // feed top 10 items
      );
      await db
        .insert(aiInsights)
        .values({
          id: crypto.randomUUID(),
          tanggal,
          kodeProvinsi: prov.kode,
          tipe: 'summary',
          kontenJson: JSON.stringify(dailySummary),
          modelUsed: 'gemini-1.5-flash-stub',
        })
        .onConflictDoNothing();

      return {
        anomaliesCount: localAnomaliesCount,
        priceIncreases: localPriceIncreases,
        provNama: prov.nama,
        hasAnomalies: provinceAnomalies.length > 0,
      };
    };

    // Run provincial analysis in batches of 5 concurrent provinces
    const concurrency = 5;
    for (let i = 0; i < provList.length; i += concurrency) {
      const batch = provList.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (prov) => {
          try {
            return await analyzeProvince(prov);
          } catch (err: any) {
            console.error(`[AIAnalysis] Failed to analyze province ${prov.nama}:`, err.message);
            return null;
          }
        }),
      );

      for (const res of batchResults) {
        if (res) {
          nationalAnomaliesCount += res.anomaliesCount;
          priceIncreases.push(...res.priceIncreases);
          if (res.hasAnomalies) {
            criticalRegions.push(res.provNama);
          }
        }
      }
    }

    // 2. Generate National Management KPI Summary
    priceIncreases.sort((a, b) => b.pct - a.pct);
    const kenaikanTertinggi =
      priceIncreases.length > 0
        ? `${priceIncreases[0].name} (+${priceIncreases[0].pct.toFixed(2)}%)`
        : 'Tidak ada kenaikan';

    const kpiSummary = await aiClient.generateManagementKPI({
      totalPasar: 1228,
      totalAnomali: nationalAnomaliesCount,
      kenaikanTertinggi,
      daerahKritis: criticalRegions.slice(0, 5), // top 5 critical provinces
    });

    await db
      .insert(aiInsights)
      .values({
        id: crypto.randomUUID(),
        tanggal,
        kodeProvinsi: null, // national
        tipe: 'kpi',
        kontenJson: JSON.stringify(kpiSummary),
        modelUsed: 'gemini-1.5-flash-stub',
      })
      .onConflictDoNothing();

    console.log(`[AIAnalysis] Successfully completed AI analysis for date ${tanggal}`);
    return { success: true, anomaliesCount: nationalAnomaliesCount };
  } catch (error) {
    console.error('[AIAnalysis] AI analysis failed:', error);
    throw error;
  }
}
