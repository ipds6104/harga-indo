import { aiInsights, db, hargaHarian, pasar, variant } from '@harga/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const hargaRoutes = new Elysia()
  // 3. Get daily prices (grouped by variant for household/dashboard view)
  .get(
    '/api/v1/harga/hari-ini',
    async ({ query }) => {
      const { provinsi_id, kota_id, komoditas_id } = query;

      // Find the latest date with data if not explicitly provided
      const latestRecord = await db
        .select({ tanggal: hargaHarian.tanggal })
        .from(hargaHarian)
        .orderBy(desc(hargaHarian.tanggal))
        .limit(1)
        .execute();

      if (latestRecord.length === 0) {
        return [];
      }

      const targetDate = latestRecord[0].tanggal;
      const conditions = [eq(hargaHarian.tanggal, targetDate)];

      if (provinsi_id) {
        conditions.push(eq(hargaHarian.kodeProvinsi, provinsi_id));
      }
      if (kota_id) {
        conditions.push(eq(hargaHarian.kodeKabKota, kota_id));
      }
      if (komoditas_id) {
        conditions.push(eq(hargaHarian.komoditasId, Number(komoditas_id)));
      }

      // Query average price grouped by variant
      return await db
        .select({
          variantId: hargaHarian.variantId,
          tanggal: hargaHarian.tanggal,
          avgHarga: sql<number>`avg(${hargaHarian.harga})`,
          avgHargaSebelumnya: sql<number>`avg(${hargaHarian.hargaSebelumnya})`,
          avgPerubahan: sql<number>`avg(${hargaHarian.prosentasePerubahan})`,
          variantNama: variant.nama,
        })
        .from(hargaHarian)
        .leftJoin(variant, eq(hargaHarian.variantId, variant.id))
        .where(and(...conditions))
        .groupBy(hargaHarian.variantId, hargaHarian.tanggal, variant.nama)
        .execute();
    },
    {
      query: t.Object({
        provinsi_id: t.Optional(t.String()),
        kota_id: t.Optional(t.String()),
        komoditas_id: t.Optional(t.String()),
      }),
    },
  )

  // 4. Get historical trend line
  .get(
    '/api/v1/harga/trend',
    async ({ query }) => {
      const { variant_id, pasar_id, days } = query;
      const limitDays = days === '30' ? 30 : 7;

      const conditions = [eq(hargaHarian.variantId, Number(variant_id))];
      if (pasar_id) {
        conditions.push(eq(hargaHarian.pasarId, Number(pasar_id)));
      }

      return await db
        .select({
          tanggal: hargaHarian.tanggal,
          harga: sql<number>`avg(${hargaHarian.harga})`,
        })
        .from(hargaHarian)
        .where(and(...conditions))
        .groupBy(hargaHarian.tanggal)
        .orderBy(desc(hargaHarian.tanggal))
        .limit(limitDays)
        .execute();
    },
    {
      query: t.Object({
        variant_id: t.String(),
        pasar_id: t.Optional(t.String()),
        days: t.Optional(t.String()),
      }),
    },
  )

  // 5. Compare markets within a city
  .get(
    '/api/v1/harga/perbandingan-pasar',
    async ({ query }) => {
      const { variant_id, kode_kab_kota, tanggal } = query;
      let targetDate = tanggal;

      if (!targetDate) {
        const latest = await db
          .select({ tanggal: hargaHarian.tanggal })
          .from(hargaHarian)
          .orderBy(desc(hargaHarian.tanggal))
          .limit(1)
          .execute();
        if (latest.length === 0) return [];
        targetDate = latest[0].tanggal;
      }

      return await db
        .select({
          harga: hargaHarian.harga,
          perubahan: hargaHarian.prosentasePerubahan,
          pasarNama: pasar.nama,
          pasarId: pasar.id,
        })
        .from(hargaHarian)
        .leftJoin(pasar, eq(hargaHarian.pasarId, pasar.id))
        .where(
          and(
            eq(hargaHarian.variantId, Number(variant_id)),
            eq(hargaHarian.kodeKabKota, kode_kab_kota),
            eq(hargaHarian.tanggal, targetDate),
          ),
        )
        .orderBy(hargaHarian.harga)
        .execute();
    },
    {
      query: t.Object({
        variant_id: t.String(),
        order_direction: t.Optional(t.String()), // unused in code but query typed
        kode_kab_kota: t.String(),
        tanggal: t.Optional(t.String()),
      }),
    },
  )

  // Get HET/HA latest from SP2KP proxy
  .get(
    '/api/v1/harga/het-ha',
    async ({ query }) => {
      const { variant_id, tanggal } = query;
      if (!variant_id) throw new Error('variant_id is required');

      let url = `https://api-sp2kp.kemendag.go.id/report/api/het-ha/latest?variant_id=${variant_id}`;
      if (tanggal) {
        url += `&tanggal=${tanggal}`;
      }

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Hargia/1.0)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          return { status: 'error', message: 'Failed to fetch from SP2KP' };
        }
        return await res.json();
      } catch (err: any) {
        return { status: 'error', message: err.message };
      }
    },
    {
      query: t.Object({
        variant_id: t.String(),
        tanggal: t.Optional(t.String()),
      }),
    },
  )

  // 6. Get price anomalies
  .get(
    '/api/v1/harga/anomali',
    async ({ query }) => {
      const { tanggal, kode_provinsi } = query;
      let targetDate = tanggal;

      if (!targetDate) {
        const latest = await db
          .select({ tanggal: aiInsights.tanggal })
          .from(aiInsights)
          .where(eq(aiInsights.tipe, 'anomaly'))
          .orderBy(desc(aiInsights.tanggal))
          .limit(1)
          .execute();
        if (latest.length === 0) return [];
        targetDate = latest[0].tanggal;
      }

      const conditions = [eq(aiInsights.tanggal, targetDate), eq(aiInsights.tipe, 'anomaly')];
      if (kode_provinsi) {
        conditions.push(eq(aiInsights.kodeProvinsi, kode_provinsi));
      }

      const results = await db
        .select()
        .from(aiInsights)
        .where(and(...conditions))
        .execute();

      return results.map((r) => ({
        ...r,
        kontenJson: JSON.parse(r.kontenJson),
      }));
    },
    {
      query: t.Object({
        tanggal: t.Optional(t.String()),
        kode_provinsi: t.Optional(t.String()),
      }),
    },
  );
