import { db, pasar } from '@harga/db';
import { eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const historicalRoutes = new Elysia()
  // 11. Get historical ingestion status rate grouped by date (paginated)
  .get(
    '/api/v1/ingestion/historical-status',
    async ({ query }) => {
      const page = query.page ? Math.max(1, Number(query.page)) : 1;
      const limit = query.limit ? Math.max(1, Number(query.limit)) : 30;
      const offset = (page - 1) * limit;

      const queryResult = await db.execute(sql`
        WITH latest_logs AS (
          SELECT DISTINCT ON (tanggal_fetch, pasar_id, tipe_komoditas_id)
                 tanggal_fetch, pasar_id, tipe_komoditas_id, status
          FROM ingestion_log
          ORDER BY tanggal_fetch, pasar_id, tipe_komoditas_id, created_at DESC
        )
        SELECT tanggal_fetch as tanggal,
               count(case when status = 'success' then 1 end)::int as succeeded,
               count(case when status = 'failed' then 1 end)::int as failed
        FROM latest_logs
        GROUP BY tanggal_fetch
        ORDER BY tanggal_fetch DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const results = queryResult.rows as any[];

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pasar)
        .where(eq(pasar.isActive, true));

      const totalMarketsCount = Number(count) || 1228;

      return results.map((r) => ({
        tanggal: r.tanggal,
        succeeded: Number(r.succeeded),
        failed: Number(r.failed),
        totalMarkets: totalMarketsCount * 3,
        pending: Math.max(totalMarketsCount * 3 - (Number(r.succeeded) + Number(r.failed)), 0),
        percentage: Math.min(
          Math.round(((Number(r.succeeded) + Number(r.failed)) / (totalMarketsCount * 3)) * 100),
          100,
        ),
      }));
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );
