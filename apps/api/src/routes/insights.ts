import { aiInsights, db } from '@harga/db';
import { and, desc, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const insightsRoutes = new Elysia()
  // 7. Get daily insights/household summary per province
  .get(
    '/api/v1/insights/daily',
    async ({ query }) => {
      const { tanggal, kode_provinsi } = query;
      let targetDate = tanggal;

      if (!targetDate) {
        const latest = await db
          .select({ tanggal: aiInsights.tanggal })
          .from(aiInsights)
          .where(eq(aiInsights.tipe, 'summary'))
          .orderBy(desc(aiInsights.tanggal))
          .limit(1)
          .execute();
        if (latest.length === 0) return null;
        targetDate = latest[0].tanggal;
      }

      const conditions = [eq(aiInsights.tanggal, targetDate), eq(aiInsights.tipe, 'summary')];
      if (kode_provinsi) {
        conditions.push(eq(aiInsights.kodeProvinsi, kode_provinsi));
      }

      const results = await db
        .select()
        .from(aiInsights)
        .where(and(...conditions))
        .limit(1)
        .execute();
      if (results.length === 0) return null;

      return {
        ...results[0],
        kontenJson: JSON.parse(results[0].kontenJson),
      };
    },
    {
      query: t.Object({
        tanggal: t.Optional(t.String()),
        kode_provinsi: t.Optional(t.String()),
      }),
    },
  )

  // 8. Get Management KPIs
  .get(
    '/api/v1/insights/management',
    async ({ query }) => {
      const { date } = query;
      let targetDate = date;

      if (!targetDate) {
        const latest = await db
          .select({ tanggal: aiInsights.tanggal })
          .from(aiInsights)
          .where(eq(aiInsights.tipe, 'kpi'))
          .orderBy(desc(aiInsights.tanggal))
          .limit(1)
          .execute();
        if (latest.length === 0) return null;
        targetDate = latest[0].tanggal;
      }

      const results = await db
        .select()
        .from(aiInsights)
        .where(and(eq(aiInsights.tanggal, targetDate), eq(aiInsights.tipe, 'kpi')))
        .limit(1)
        .execute();

      if (results.length === 0) return null;

      return {
        ...results[0],
        kontenJson: JSON.parse(results[0].kontenJson),
      };
    },
    {
      query: t.Object({
        date: t.Optional(t.String()),
      }),
    },
  );
