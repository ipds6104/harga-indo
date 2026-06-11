import { db, pasar } from '@harga/db';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { fetchQueue, masterSyncQueue } from '../../lib/queues';
import { connection } from '../../lib/redis';
import { buildFetchJobs } from '../../utils/ingestion';

export const triggerRoutes = new Elysia()
  // 10. Trigger ingestion manual
  .post(
    '/api/v1/ingestion/trigger',
    async ({ body }) => {
      const { type, tanggal } = body;
      const runId = crypto.randomUUID();
      const targetDate =
        tanggal || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

      if (type === 'master') {
        console.log(`[API] Triggering manual master sync for run ${runId}`);
        await masterSyncQueue.add('sync-all', { runId });
        return { status: 'triggered', type: 'master', runId };
      }

      console.log(`[API] Triggering manual prices fetch for date ${targetDate}, run ${runId}`);
      const activePasars = await db.select().from(pasar).where(eq(pasar.isActive, true));

      if (activePasars.length === 0) {
        // Enqueue master sync first, it will fetch after sync
        await masterSyncQueue.add('sync-all', { runId });
        return {
          status: 'triggered',
          type: 'master-before-fetch',
          message: 'No markets found in DB. Triggering master sync first.',
          runId,
        };
      }

      const commodities = [1, 2, 3];
      const triggerAi = body.trigger_ai ?? false;
      const expectedCount = triggerAi ? activePasars.length * commodities.length : undefined;

      const jobs = buildFetchJobs(
        activePasars,
        [{ start: targetDate, end: targetDate }],
        commodities,
        runId,
        1,
        'fetch',
        triggerAi,
        expectedCount,
      );

      const chunkSize = 100;
      for (let i = 0; i < jobs.length; i += chunkSize) {
        await fetchQueue.addBulk(jobs.slice(i, i + chunkSize));
      }

      // Store in Redis to keep track of what was triggered
      try {
        await connection.set('hargia:last-active-date', targetDate);
      } catch (err) {
        console.error('[API] Error saving last active date to Redis:', err);
      }

      return {
        status: 'triggered',
        type: 'prices',
        tanggal: targetDate,
        totalJobs: jobs.length,
        runId,
        triggerAi,
      };
    },
    {
      body: t.Object({
        type: t.Optional(t.String()),
        tanggal: t.Optional(t.String()),
        trigger_ai: t.Optional(t.Boolean()),
      }),
    },
  );
