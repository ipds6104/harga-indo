import { AIClient } from '@harga/ai-client';
import type { AIContextDinamis } from '@harga/ai-client';
import {
  aiInsights,
  db,
  hargaHarian,
  komoditas,
  neracaPanganProvinsi,
  provinsi,
  sentraProduksi,
  tpidAlert,
  variant,
} from '@harga/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { evaluatePrice } from '../services/alert-evaluator';
import {
  estimasiOngkosKirimPerTon,
  fetchNeracaProvinsi,
  getDynamicContext,
  hitungJarakHaversineKm,
  hitungMusimProvinsi,
} from '../services/dynamic-context';

const aiClient = new AIClient();

export async function runAIAnalysis(payload: { tanggal: string; runId: string }) {
  const { tanggal, runId } = payload;
  console.log(`[AIAnalysis] Running analysis for date: ${tanggal} (run: ${runId})`);

  try {
    // 0. Ambil konteks dinamis (hari raya, musim, kurs) SEKALI untuk seluruh run
    // Ini menggantikan semua data hardcoded di AI prompt dan menjamin konsistensi epistemologis
    const dynCtx = await getDynamicContext(tanggal);
    const aiContextDinamis: AIContextDinamis = {
      ringkasan: dynCtx.ringkasan,
      hariRayaTerdekat: dynCtx.hariRayaTerdekat
        ? { nama: dynCtx.hariRayaTerdekat.nama, hariLagi: dynCtx.hariRayaTerdekat.hariLagi }
        : null,
      musimKemarau: dynCtx.musim.musimKemarau,
      panenBeras: dynCtx.musim.musimPanen.beras,
      panenCabai: dynCtx.musim.musimPanen.cabai,
      kursUsdIdr: dynCtx.kurs.usdIdr,
      levelKurs: dynCtx.kurs.level,
      sumberKurs: dynCtx.kurs.sumberData,
    };
    console.log(`[AIAnalysis] Dynamic context loaded: ${dynCtx.ringkasan.substring(0, 100)}...`);

    // 1. Fetch all provinces and load provincial food balance (neraca pangan) cache
    const provList = await db.select().from(provinsi);
    console.log(`[AIAnalysis] Found ${provList.length} provinces to analyze.`);

    const allNeraca = await db.select().from(neracaPanganProvinsi);
    const neracaMap = new Map<
      string,
      { statusNeraca: 'surplus' | 'defisit' | 'seimbang'; implikasiIntervensi: string }
    >();
    for (const row of allNeraca) {
      neracaMap.set(`${row.kodeProvinsi}_${row.komoditasId}`, {
        statusNeraca: row.statusNeraca as 'surplus' | 'defisit' | 'seimbang',
        implikasiIntervensi: row.implikasiIntervensi || '',
      });
    }

    // Keep track of anomalies and prices to compile national KPI summary
    let nationalAnomaliesCount = 0;
    const criticalRegions: string[] = [];
    const priceIncreases: { name: string; pct: number }[] = [];

    // Map to store price records per province to avoid refetching during summaries/trends
    const provPriceRecords: Map<string, any[]> = new Map();

    // Map to store identified anomalies per province
    const provAnomaliesMap: Map<string, any[]> = new Map();

    // Koordinat pusat provinsi (ibu kota) untuk kalkulasi Haversine
    // Digunakan untuk menghitung jarak nyata ke sentra produksi
    // Sumber: koordinat ibu kota provinsi (BIG/BPS)
    const prov_lat_cache = new Map<string, { lat: number; lon: number }>([
      ['11', { lat: 5.55, lon: 95.32 }], // Aceh
      ['12', { lat: 3.59, lon: 98.67 }], // Sumatera Utara
      ['13', { lat: -0.95, lon: 100.35 }], // Sumatera Barat
      ['14', { lat: 0.53, lon: 101.45 }], // Riau
      ['15', { lat: -1.61, lon: 103.61 }], // Jambi
      ['16', { lat: -2.99, lon: 104.75 }], // Sumatera Selatan
      ['17', { lat: -3.8, lon: 102.27 }], // Bengkulu
      ['18', { lat: -5.45, lon: 105.26 }], // Lampung
      ['19', { lat: -2.13, lon: 106.12 }], // Bangka Belitung
      ['21', { lat: 0.92, lon: 104.52 }], // Kepulauan Riau
      ['31', { lat: -6.21, lon: 106.85 }], // DKI Jakarta
      ['32', { lat: -6.91, lon: 107.61 }], // Jawa Barat
      ['33', { lat: -7.0, lon: 110.4 }], // Jawa Tengah
      ['34', { lat: -7.8, lon: 110.36 }], // DI Yogyakarta
      ['35', { lat: -7.75, lon: 112.74 }], // Jawa Timur
      ['36', { lat: -6.12, lon: 106.15 }], // Banten
      ['51', { lat: -8.67, lon: 115.21 }], // Bali
      ['52', { lat: -8.65, lon: 116.32 }], // NTB
      ['53', { lat: -10.17, lon: 123.61 }], // NTT
      ['61', { lat: -0.02, lon: 109.34 }], // Kalimantan Barat
      ['62', { lat: -1.68, lon: 113.38 }], // Kalimantan Tengah
      ['63', { lat: -3.32, lon: 114.59 }], // Kalimantan Selatan
      ['64', { lat: 0.54, lon: 117.14 }], // Kalimantan Timur
      ['65', { lat: 3.07, lon: 116.04 }], // Kalimantan Utara
      ['71', { lat: 1.49, lon: 124.84 }], // Sulawesi Utara
      ['72', { lat: -0.9, lon: 119.87 }], // Sulawesi Tengah
      ['73', { lat: -5.14, lon: 119.42 }], // Sulawesi Selatan
      ['74', { lat: -3.99, lon: 122.51 }], // Sulawesi Tenggara
      ['75', { lat: 0.54, lon: 123.06 }], // Gorontalo
      ['76', { lat: -2.73, lon: 119.46 }], // Sulawesi Barat
      ['81', { lat: -3.7, lon: 128.18 }], // Maluku
      ['82', { lat: 0.78, lon: 127.37 }], // Maluku Utara
      ['91', { lat: -0.87, lon: 131.25 }], // Papua Barat
      ['92', { lat: -4.27, lon: 138.08 }], // Papua
      ['93', { lat: -8.49, lon: 140.4 }], // Papua Selatan
      ['94', { lat: -3.83, lon: 137.32 }], // Papua Tengah
      ['95', { lat: -4.08, lon: 138.92 }], // Papua Pegunungan
      ['96', { lat: -1.33, lon: 132.03 }], // Papua Barat Daya
    ]);

    // Accumulate all mathematical anomalies across the nation
    const nationalSuspiciousList: {
      harga: any;
      v: any;
      provCode: string;
      provinsiNama: string;
      index: number;
      zScore: number;
      historisPihpsRataRata: number;
      historisPihpsStdDev: number;
      surplusSentra: any;
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
          // Query nearest active sentra produksi for this commodity
          const sentraList = await db
            .select()
            .from(sentraProduksi)
            .where(
              and(
                eq(sentraProduksi.komoditasId, item.harga.komoditasId),
                eq(sentraProduksi.isActive, true),
              ),
            )
            .orderBy(desc(sentraProduksi.surplusTep))
            .limit(1);

          // Hitung jarak nyata menggunakan Haversine dari koordinat lat/lon yang tersimpan di DB
          // Menggantikan placeholder jarakKm: 120 yang tidak akurat
          let jarakKmNyata: number | undefined;
          let ongkosKirim: number | undefined;

          if (
            sentraList.length > 0 &&
            sentraList[0].lat &&
            sentraList[0].lon &&
            prov_lat_cache.get(prov.kode)?.lat !== undefined
          ) {
            const provCoord = prov_lat_cache.get(prov.kode)!;
            jarakKmNyata = hitungJarakHaversineKm(
              Number.parseFloat(sentraList[0].lat!),
              Number.parseFloat(sentraList[0].lon!),
              provCoord.lat,
              provCoord.lon,
            );
            ongkosKirim = estimasiOngkosKirimPerTon(jarakKmNyata);
          }

          const surplusSentra =
            sentraList.length > 0
              ? {
                  namaSentra: `Sentra Kab. ${sentraList[0].kodeKabKota} (Prov. ${sentraList[0].kodeProvinsi})`,
                  kapasitasSurplusTon: sentraList[0].surplusTep,
                  jarakKm: jarakKmNyata, // Dihitung via Haversine, bukan hardcoded
                  estimasiOngkosKirimPerTon: ongkosKirim,
                }
              : null;

          // Fetch the created alert record for this variant to retrieve computed Z-Score
          const alertRecs = await db
            .select()
            .from(tpidAlert)
            .where(
              and(
                eq(tpidAlert.kodeProvinsi, prov.kode),
                eq(tpidAlert.variantId, item.harga.variantId),
                eq(tpidAlert.tanggal, tanggal),
              ),
            )
            .limit(1);

          const alertRecord = alertRecs[0];
          const zScore = alertRecord ? alertRecord.zScore : 0;
          const baselineRataRata = alertRecord ? alertRecord.thresholdHap : harga.harga;

          const neracaKey = `${prov.kode}_${item.harga.komoditasId}`;
          const neracaInfo = neracaMap.get(neracaKey) || {
            statusNeraca: 'seimbang' as const,
            implikasiIntervensi:
              'Intervensi lokal mandiri via Gerakan Pangan Murah (GPM) dan pengawasan rantai pasok.',
          };

          nationalSuspiciousList.push({
            harga,
            v,
            provCode: prov.kode,
            provinsiNama: prov.nama,
            index,
            zScore,
            historisPihpsRataRata: baselineRataRata,
            historisPihpsStdDev: baselineRataRata * 0.05,
            surplusSentra,
            neracaInfo,
          });
        }
      }
    }

    console.log(
      `[AIAnalysis] Phase 2: National AI Anomaly Detection Batch (${nationalSuspiciousList.length} suspicious prices found)`,
    );

    if (nationalSuspiciousList.length > 0) {
      const anomalyResults = await aiClient.detectAnomaliesBatch(
        nationalSuspiciousList.map((item) => ({
          harga: item.harga,
          v: item.v,
          provinsiNama: item.provinsiNama,
          zScore: item.zScore,
          historisPihpsRataRata: item.historisPihpsRataRata,
          historisPihpsStdDev: item.historisPihpsStdDev,
          surplusSentra: item.surplusSentra,
          neracaInfo: (item as any).neracaInfo,
        })),
        aiContextDinamis, // konteks real-time
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
            analisisEkonomi: result.analisisEkonomi,
            rekomendasiKadisdag: result.rekomendasiKadisdag,
            rekomendasiSekda: result.rekomendasiSekda,
            rekomendasiSatgasPangan: result.rekomendasiSatgasPangan,
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

            // Fetch neraca pangan dan konteks musim per-provinsi untuk tren yang lebih akurat
            const neracaProvinsi = await fetchNeracaProvinsi(prov.kode);
            const musimProvinsi = hitungMusimProvinsi(tanggal, prov.kode);

            // Buat konteks per-provinsi (extends context global)
            const ctxProvinsi: AIContextDinamis = {
              ...aiContextDinamis,
              // Override musim dengan kalkulasi per-provinsi (SI Katam Kementan)
              musimKemarau: musimProvinsi.musimKemarau,
              panenBeras: musimProvinsi.musimPanen.beras,
              panenCabai: musimProvinsi.musimPanen.cabai,
              // Ringkasan gabungan: global + musim spesifik provinsi
              ringkasan: `${aiContextDinamis.ringkasan} [${prov.nama}] Musim lokal: ${musimProvinsi.keterangan}.`,
              // Neraca pangan provinsi ini — menentukan arah intervensi
              neracaProvinsi: neracaProvinsi[1] ?? null, // komoditas_id=1 (beras) sebagai representasi
            };

            const trendResult = await aiClient.generateTrendNarrative(
              prov.nama,
              historyData,
              ctxProvinsi,
            );

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

    const kpiSummary = await aiClient.generateManagementKPI(
      {
        totalPasar: 1228,
        totalAnomali: nationalAnomaliesCount,
        kenaikanTertinggi,
        daerahKritis: criticalRegions.slice(0, 5),
      },
      aiContextDinamis, // konteks real-time
    );

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
