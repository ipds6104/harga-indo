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

    // Map to store price records per province to avoid refetching during summaries/trends
    const provPriceRecords: Map<string, any[]> = new Map();

    // Map to store identified anomalies per province
    const provAnomaliesMap: Map<string, any[]> = new Map();

    // Accumulate all mathematical anomalies across the nation
    const nationalSuspiciousList: {
      harga: any;
      v: any;
      provCode: string;
      index: number;
    }[] = [];

    console.log('[AIAnalysis] Phase 1: Pre-filtering & alert evaluations...');

    for (const prov of provList) {
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

      provPriceRecords.set(prov.kode, todayPrices);

      if (todayPrices.length === 0) continue;

      // Evaluate price for TPID Alert & state machine in parallel
      const evaluationPromises = todayPrices.map((item) =>
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
      await Promise.all(evaluationPromises);

      // Rules-first pre-filtering check locally
      for (let index = 0; index < todayPrices.length; index++) {
        const item = todayPrices[index];
        const v = item.v;
        const harga = item.harga;
        let isSuspicious = false;

        if (v) {
          if (v.hargaMax && harga.harga > v.hargaMax) {
            isSuspicious = true;
          } else if (v.kenaikanMax && harga.prosentasePerubahan > v.kenaikanMax) {
            isSuspicious = true;
          }
        }

        if (isSuspicious) {
          nationalSuspiciousList.push({
            harga,
            v,
            provCode: prov.kode,
            index,
          });
        }
      }
    }

    console.log(
      `[AIAnalysis] Phase 2: National AI Anomaly Detection Batch (${nationalSuspiciousList.length} suspicious prices found)`,
    );

    if (nationalSuspiciousList.length > 0) {
      const anomalyResults = await aiClient.detectAnomaliesBatch(
        nationalSuspiciousList.map((item) => ({ harga: item.harga, v: item.v })),
      );

      // Distribute the national anomalies back to their respective provinces
      for (let i = 0; i < nationalSuspiciousList.length; i++) {
        const susp = nationalSuspiciousList[i];
        const result = anomalyResults[i];

        if (result.isAnomaly) {
          nationalAnomaliesCount++;

          if (!provAnomaliesMap.has(susp.provCode)) {
            provAnomaliesMap.set(susp.provCode, []);
          }

          provAnomaliesMap.get(susp.provCode)!.push({
            komoditasId: susp.harga.komoditasId,
            variantId: susp.harga.variantId,
            nama: susp.v?.nama || 'Komoditas',
            harga: susp.harga.harga,
            perubahan: susp.harga.prosentasePerubahan,
            reason: result.reason,
            severity: result.severity,
          });
        }
      }
    }

    console.log('[AIAnalysis] Phase 3: Generating Trend Narratives and Daily Summaries...');

    // Process provincial insights (summaries & trends) in batches of 5 concurrent provinces
    const concurrency = 5;
    for (let i = 0; i < provList.length; i += concurrency) {
      const batch = provList.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (prov) => {
          try {
            const todayPrices = provPriceRecords.get(prov.kode) || [];
            if (todayPrices.length === 0) return;

            const provinceAnomalies = provAnomaliesMap.get(prov.kode) || [];

            // 1. Write anomaly to DB if exists
            if (provinceAnomalies.length > 0) {
              criticalRegions.push(prov.nama);
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

            // 2. Aggregate price increases for KPI
            for (const item of todayPrices) {
              if (item.harga.prosentasePerubahan > 0) {
                priceIncreases.push({
                  name: item.v?.nama || 'Komoditas',
                  pct: item.harga.prosentasePerubahan,
                });
              }
            }

            // 3. Generate Trend Narrative
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
                and(
                  eq(hargaHarian.kodeProvinsi, prov.kode),
                  sql`${hargaHarian.tanggal} <= ${tanggal}`,
                ),
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

            // 4. Generate Daily Household Summary per province
            const hargaHarianListForSummary = todayPrices.map((item) => ({
              namaKomoditas: item.v?.nama || 'Komoditas',
              harga: item.harga.harga,
              perubahan: item.harga.prosentasePerubahan,
            }));

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
          } catch (err: any) {
            console.error(`[AIAnalysis] Failed to analyze province ${prov.nama}:`, err.message);
          }
        }),
      );
    }

    // 4. Generate National Management KPI Summary
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
