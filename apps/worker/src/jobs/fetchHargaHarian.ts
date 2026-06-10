import {
  db,
  hargaHarian,
  hargaHarianDetail,
  ingestionLog,
  komoditas,
  pasar,
  pedagang,
  produk,
  satuan,
  variant,
} from '@harga/db';
import type { JobPayload } from '@harga/shared';
import { SP2KP_BASE_URL, SP2KP_TAKE, SP2KP_TIMEOUT_MS } from '@harga/shared';
import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import Redis from 'ioredis';

export async function fetchHargaHarian(payload: JobPayload) {
  const { pasar_id, tanggal_start, tanggal_end, tipe_komoditas_id, run_id } = payload;
  const startTime = Date.now();
  let recordsFetched = 0;
  let skip = 0;
  let totalCount = 0;
  let hasMore = true;

  console.log(
    `[FetchHargaHarian] Ingesting pasar_id=${pasar_id} from ${tanggal_start} to ${tanggal_end} (run_id=${run_id})`,
  );

  try {
    while (hasMore) {
      const url = `${SP2KP_BASE_URL}/trx/harga-harian?tanggal_start=${tanggal_start}&tanggal_end=${tanggal_end}&tipe_komoditas_id=${tipe_komoditas_id}&pasar_id=${pasar_id}&take=${SP2KP_TAKE}&skip=${skip}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Hargia/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(SP2KP_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as any;
      const data = json.data || [];
      totalCount = json.totalCount ?? data.length;
      recordsFetched += data.length;

      console.log(
        `[FetchHargaHarian] Ingested ${data.length} records (totalCount=${totalCount}) for pasar_id=${pasar_id}`,
      );

      // Process and insert records in a database transaction
      await db.transaction(async (tx) => {
        for (const item of data) {
          // Dynamic master table updates if missing (safeguard)
          if (item.satuan) {
            await tx
              .insert(satuan)
              .values({
                id: item.satuan.id,
                display: item.satuan.display || item.satuan.nama,
                deskripsi: item.satuan.deskripsi || null,
              })
              .onConflictDoNothing();
          }

          if (item.komoditas) {
            await tx
              .insert(komoditas)
              .values({
                id: item.komoditas.id,
                kode: item.komoditas.kode || null,
                nama: item.komoditas.nama,
                tipeKomoditasId: tipe_komoditas_id,
              })
              .onConflictDoNothing();
          }

          if (item.variant) {
            await tx
              .insert(variant)
              .values({
                id: item.variant.id,
                kode: item.variant.kode || null,
                komoditasId: item.komoditas_id,
                nama: item.variant.nama,
                satuanId: item.satuan_id,
                hargaMin: item.variant.harga_min ? Number(item.variant.harga_min) : null,
                hargaMax: item.variant.harga_max ? Number(item.variant.harga_max) : null,
                kenaikanMax: item.variant.kenaikan_max ? Number(item.variant.kenaikan_max) : null,
                penurunanMax: item.variant.penurunan_max
                  ? Number(item.variant.penurunan_max)
                  : null,
              })
              .onConflictDoNothing();
          }

          if (item.produk) {
            await tx
              .insert(produk)
              .values({
                id: item.produk.id,
                kode: item.produk.kode || null,
                variantId: item.variant_id,
                nama: item.produk.nama,
                satuanId: item.satuan_id,
              })
              .onConflictDoNothing();
          }

          // Insert top-level Harga Harian record
          await tx
            .insert(hargaHarian)
            .values({
              id: item.id,
              pasarId: item.pasar_id,
              komoditasId: item.komoditas_id,
              variantId: item.variant_id,
              produkId: item.produk_id,
              satuanId: item.satuan_id,
              tanggal: item.tanggal || tanggal_start,
              harga: Number(item.harga),
              hargaSebelumnya: Number(item.harga_sebelumnya),
              prosentasePerubahan: Number(item.prosentase_perubahan),
              kuantitas: item.kuantitas ? Number(item.kuantitas) : null,
              pasokan: item.pasokan ? Number(item.pasokan) : null,
              jumlahPedagang: item.jumlah_pedagang ?? 0,
              kodeProvinsi:
                item.kode_provinsi && item.kode_provinsi.trim() !== ''
                  ? item.kode_provinsi.trim()
                  : null,
              kodeKabKota:
                item.kode_kab_kota && item.kode_kab_kota.trim() !== ''
                  ? item.kode_kab_kota.trim()
                  : null,
              statusVerifikasi1: item.status_verifikasi_1 || null,
              verifikasi1At: item.verifikasi_1_at ? new Date(item.verifikasi_1_at) : null,
              statusVerifikasi2: item.status_verifikasi_2 || null,
              verifikasi2At: item.verifikasi_2_at ? new Date(item.verifikasi_2_at) : null,
              isActive: item.is_active ?? true,
              isClosed: item.is_closed ?? false,
              isHargaStillZero: item.is_harga_still_zero ?? false,
            })
            .onConflictDoUpdate({
              target: hargaHarian.id,
              set: {
                harga: Number(item.harga),
                hargaSebelumnya: Number(item.harga_sebelumnya),
                prosentasePerubahan: Number(item.prosentase_perubahan),
                kuantitas: item.kuantitas ? Number(item.kuantitas) : null,
                pasokan: item.pasokan ? Number(item.pasokan) : null,
                jumlahPedagang: item.jumlah_pedagang ?? 0,
                statusVerifikasi1: item.status_verifikasi_1 || null,
                verifikasi1At: item.verifikasi_1_at ? new Date(item.verifikasi_1_at) : null,
                statusVerifikasi2: item.status_verifikasi_2 || null,
                verifikasi2At: item.verifikasi_2_at ? new Date(item.verifikasi_2_at) : null,
                updatedAt: new Date(),
              },
            });

          // Insert nested pedagang and detailed trader prices
          if (item.harga_harian_detail && Array.isArray(item.harga_harian_detail)) {
            for (const d of item.harga_harian_detail) {
              if (d.pedagang) {
                // Upsert pedagang
                await tx
                  .insert(pedagang)
                  .values({
                    id: d.pedagang.id,
                    nama: d.pedagang.nama,
                    telepon: d.pedagang.telepon || null,
                    pasarId: item.pasar_id,
                    lantai: d.pedagang.lantai || null,
                    nomorLos: d.pedagang.nomor_los || null,
                    isActive: d.pedagang.is_active ?? true,
                  })
                  .onConflictDoUpdate({
                    target: pedagang.id,
                    set: {
                      nama: d.pedagang.nama,
                      telepon: d.pedagang.telepon || null,
                      lantai: d.pedagang.lantai || null,
                      nomorLos: d.pedagang.nomor_los || null,
                      isActive: d.pedagang.is_active ?? true,
                    },
                  });
              }

              // Insert detail
              await tx
                .insert(hargaHarianDetail)
                .values({
                  id: d.id,
                  hargaHarianId: item.id,
                  pedagangId: d.pedagang_id || d.pedagang?.id,
                  harga: Number(d.harga),
                  hargaSebelumnya: Number(d.harga_sebelumnya),
                  tanggalSebelumnya: d.tanggal_sebelumnya || null,
                  isActive: d.is_active ?? true,
                })
                .onConflictDoUpdate({
                  target: hargaHarianDetail.id,
                  set: {
                    harga: Number(d.harga),
                    hargaSebelumnya: Number(d.harga_sebelumnya),
                    tanggalSebelumnya: d.tanggal_sebelumnya || null,
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      });

      skip += SP2KP_TAKE;
      hasMore = skip < totalCount && data.length > 0;
    }

    // Generate dates in range
    const dates: string[] = [];
    const current = new Date(tanggal_start);
    const end = new Date(tanggal_end);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Success log
    const duration = Date.now() - startTime;
    const logsToInsert = dates.map((d) => ({
      id: crypto.randomUUID(),
      runId: run_id,
      tanggalFetch: d,
      pasarId: pasar_id,
      tipeKomoditasId: tipe_komoditas_id,
      status: 'success' as const,
      recordsFetched,
      errorMessage: null,
      durationMs: duration,
    }));

    if (logsToInsert.length > 0) {
      await db.insert(ingestionLog).values(logsToInsert);
    }

    console.log(`[FetchHargaHarian] Successfully ingested pasar_id=${pasar_id} in ${duration}ms`);

    // Check if this was the last market in this run to trigger AI analysis
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ingestionLog)
        .where(eq(ingestionLog.runId, run_id));

      const [{ activeCount }] = await db
        .select({ activeCount: sql<number>`count(*)` })
        .from(pasar)
        .where(eq(pasar.isActive, true));

      if (Number(count) >= Number(activeCount) * 3) {
        console.log(
          `[FetchHargaHarian] All active markets for all commodities (${count}/${Number(activeCount) * 3}) processed. Triggering AI analysis...`,
        );
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
        const aiAnalysisQueue = new Queue('ai-analysis', { connection });
        await aiAnalysisQueue.add('analyze-date', { tanggal: tanggal_end, runId: run_id });
        await connection.quit();
      }
    } catch (e: any) {
      console.error('[FetchHargaHarian] Error checking/enqueuing AI analysis job:', e.message);
    }

    return { success: true, recordsFetched, durationMs: duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[FetchHargaHarian] Failed to ingest pasar_id=${pasar_id}:`, error.message);

    // Error log
    try {
      // Generate dates in range for error logging
      const errorDates: string[] = [];
      const current = new Date(tanggal_start);
      const end = new Date(tanggal_end);
      while (current <= end) {
        errorDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const errorLogsToInsert = errorDates.map((d) => ({
        id: crypto.randomUUID(),
        runId: run_id,
        tanggalFetch: d,
        pasarId: pasar_id,
        tipeKomoditasId: tipe_komoditas_id,
        status: 'failed' as const,
        recordsFetched,
        errorMessage: error.message,
        durationMs: duration,
      }));

      if (errorLogsToInsert.length > 0) {
        await db.insert(ingestionLog).values(errorLogsToInsert);
      }
    } catch (dbErr: any) {
      console.error('[FetchHargaHarian] Failed to write failure log to DB:', dbErr.message);
    }

    throw error;
  }
}
