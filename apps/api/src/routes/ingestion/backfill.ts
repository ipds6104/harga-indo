import { db, ingestionLog, pasar } from '@harga/db';
import { and, eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { fetchQueue } from '../../lib/queues';
import { connection } from '../../lib/redis';
import { chunkDateRange, groupContiguousDates } from '../../utils/date';
import { buildFetchJobs } from '../../utils/ingestion';

export const backfillRoutes = new Elysia()
  // 11. Trigger backfill for historical dates (chunked to max 30 days per job)
  .post(
    '/api/v1/ingestion/backfill',
    async ({ body }) => {
      const { tanggal_start, tanggal_end } = body;
      const runId = crypto.randomUUID();

      const start = new Date(`${tanggal_start}T00:00:00.000Z`);
      const end = new Date(`${tanggal_end}T00:00:00.000Z`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        throw new Error('Invalid date range');
      }

      const minDate = new Date('2024-01-01T00:00:00.000Z');

      if (start < minDate) {
        return {
          status: 'failed',
          message:
            'Tanggal mulai berada di luar rentang ketersediaan data SP2KP (data tersedia sejak 2024-01-01). Minimal tanggal: 2024-01-01',
        };
      }

      const activePasars = await db.select().from(pasar).where(eq(pasar.isActive, true));
      if (activePasars.length === 0) {
        return { status: 'failed', message: 'No active markets in database to backfill.' };
      }

      console.log(
        `[API] Ingesting backfill from ${tanggal_start} to ${tanggal_end} (run_id: ${runId})`,
      );

      const chunks = chunkDateRange(tanggal_start, tanggal_end, 30);
      const commodities = [1, 2, 3];
      const jobs = buildFetchJobs(activePasars, chunks, commodities, runId, 10, 'fetch');

      const chunkSize = 100;
      for (let i = 0; i < jobs.length; i += chunkSize) {
        await fetchQueue.addBulk(jobs.slice(i, i + chunkSize));
      }

      // Store last date of backfill in Redis
      try {
        await connection.set('hargia:last-active-date', tanggal_end);
      } catch (err) {
        console.error('[API] Error saving last active date to Redis:', err);
      }

      return {
        status: 'triggered',
        type: 'backfill',
        tanggal_start,
        tanggal_end,
        totalJobs: jobs.length,
        runId,
      };
    },
    {
      body: t.Object({
        tanggal_start: t.String(),
        tanggal_end: t.String(),
      }),
    },
  )

  // 14. Trigger backfill ONLY for missing or incomplete dates in a date range (grouped & chunked)
  .post(
    '/api/v1/ingestion/backfill-gaps',
    async ({ body }) => {
      const { tanggal_start, tanggal_end } = body;
      const runId = crypto.randomUUID();

      const start = new Date(`${tanggal_start}T00:00:00.000Z`);
      const end = new Date(`${tanggal_end}T00:00:00.000Z`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        throw new Error('Invalid date range');
      }

      const minDate = new Date('2024-01-01T00:00:00.000Z');

      if (start < minDate) {
        return {
          status: 'failed',
          message:
            'Tanggal mulai berada di luar rentang ketersediaan data SP2KP (data tersedia sejak 2024-01-01). Minimal tanggal: 2024-01-01',
        };
      }

      const activePasars = await db.select().from(pasar).where(eq(pasar.isActive, true));
      if (activePasars.length === 0) {
        return { status: 'failed', message: 'No active markets in database to backfill.' };
      }

      const totalMarketsCount = activePasars.length;

      // Fetch log counts per date within the range to find existing/complete ones
      const existingLogs = await db
        .select({
          tanggal: ingestionLog.tanggalFetch,
          succeeded: sql<number>`count(case when ${ingestionLog.status} = 'success' then 1 end)`,
        })
        .from(ingestionLog)
        .where(
          and(
            sql`${ingestionLog.tanggalFetch} >= ${tanggal_start}`,
            sql`${ingestionLog.tanggalFetch} <= ${tanggal_end}`,
          ),
        )
        .groupBy(ingestionLog.tanggalFetch)
        .execute();

      const completeDates = new Set(
        existingLogs
          .filter((l) => Number(l.succeeded) / (totalMarketsCount * 3) >= 0.95)
          .map((l) => l.tanggal),
      );

      const datesToBackfill: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (!completeDates.has(dateStr)) {
          datesToBackfill.push(dateStr);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      if (datesToBackfill.length === 0) {
        return {
          status: 'no_action',
          message: 'All dates in the specified range are already complete.',
        };
      }

      const contiguousRanges = groupContiguousDates(datesToBackfill);
      const chunks: { start: string; end: string }[] = [];
      for (const range of contiguousRanges) {
        chunks.push(...chunkDateRange(range.start, range.end, 30));
      }

      console.log(
        `[API] Backfilling gaps for range ${tanggal_start} to ${tanggal_end} (run_id: ${runId}). Found ${datesToBackfill.length} gap dates. Grouped into ${chunks.length} chunks.`,
      );

      const commodities = [1, 2, 3];
      const jobs = buildFetchJobs(activePasars, chunks, commodities, runId, 10, 'fetch-gaps');

      const chunkSize = 100;
      for (let i = 0; i < jobs.length; i += chunkSize) {
        await fetchQueue.addBulk(jobs.slice(i, i + chunkSize));
      }

      // Store the last gap date in Redis
      try {
        if (datesToBackfill.length > 0) {
          await connection.set(
            'hargia:last-active-date',
            datesToBackfill[datesToBackfill.length - 1],
          );
        }
      } catch (err) {
        console.error('[API] Error saving last active date to Redis:', err);
      }

      return {
        status: 'triggered',
        type: 'backfill-gaps',
        tanggal_start,
        tanggal_end,
        gapDaysCount: datesToBackfill.length,
        chunksCount: chunks.length,
        totalJobs: jobs.length,
        runId,
      };
    },
    {
      body: t.Object({
        tanggal_start: t.String(),
        tanggal_end: t.String(),
      }),
    },
  );
