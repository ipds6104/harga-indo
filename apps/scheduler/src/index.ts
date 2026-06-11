import { cron } from '@elysiajs/cron';
import { db, pasar } from '@harga/db';
import { INGESTION_CRON, INGESTION_TIMEZONE } from '@harga/shared';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

// Setup BullMQ Queue
const fetchQueue = new Queue('sp2kp-fetch', { connection });
const masterSyncQueue = new Queue('master-sync', { connection });
const aiAnalysisQueue = new Queue('ai-analysis', { connection });

console.log('Scheduler started connecting to Redis:', redisUrl);

// Helper function to enqueue daily fetch
async function enqueueDailyFetch() {
  const runId = crypto.randomUUID();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  console.log(`[Scheduler] Enqueuing daily fetch for date ${today}, run_id: ${runId}`);

  // Fetch all active markets from database
  const activePasars = await db.select().from(pasar).where(eq(pasar.isActive, true));

  // If DB is empty, enqueue a master sync first
  if (activePasars.length === 0) {
    console.log('[Scheduler] No markets found in DB, enqueuing master sync first...');
    await masterSyncQueue.add('sync-all', { runId });
    // Sleep or return - the worker's syncMaster job will trigger the fetch after it finishes syncing,
    // or we can sync master then check again. Let's just enqueue sync-all and wait for the worker.
    return;
  }

  console.log(`[Scheduler] Enqueuing ${activePasars.length} markets into sp2kp-fetch queue...`);

  // Bulk add to queue for efficiency
  const jobs = activePasars.map((p) => ({
    name: `fetch-${p.id}-${today}`,
    data: {
      pasar_id: p.id,
      tanggal_start: today,
      tanggal_end: today,
      tipe_komoditas_id: 1, // Sembako
      run_id: runId,
      trigger_ai: true,
      expected_count: activePasars.length,
    },
    opts: {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }));

  // Enqueue in chunks of 100 to prevent Redis blocking
  const chunkSize = 100;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    await fetchQueue.addBulk(chunk);
  }

  console.log(`[Scheduler] Enqueued ${jobs.length} fetch jobs successfully.`);
}

const app = new Elysia()
  .get('/health', () => ({ status: 'ok', service: 'scheduler' }))
  .post('/trigger-fetch', async () => {
    await enqueueDailyFetch();
    return { status: 'triggered', message: 'Daily fetch process started manually' };
  })
  .post('/trigger-sync', async () => {
    const runId = crypto.randomUUID();
    await masterSyncQueue.add('sync-all', { runId });
    return { status: 'triggered', message: 'Master sync started manually', runId };
  })
  .use(
    cron({
      name: 'sp2kp-daily',
      pattern: INGESTION_CRON, // "30 7 * * *"
      timezone: INGESTION_TIMEZONE, // "Asia/Jakarta"
      async run() {
        console.log('[Scheduler] Cron triggered daily fetch...');
        try {
          await enqueueDailyFetch();
        } catch (error) {
          console.error('[Scheduler] Error during daily fetch cron execution:', error);
        }
      },
    }),
  )
  .use(
    cron({
      name: 'master-sync-weekly',
      pattern: '0 0 * * 0', // 12:00 AM Sunday
      timezone: INGESTION_TIMEZONE,
      async run() {
        console.log('[Scheduler] Cron triggered weekly master sync...');
        try {
          const runId = crypto.randomUUID();
          await masterSyncQueue.add('sync-all', { runId });
        } catch (error) {
          console.error('[Scheduler] Error during weekly master sync cron execution:', error);
        }
      },
    }),
  )
  .listen(process.env.PORT || 3010);

console.log(`Scheduler Elysia application listening on port ${app.server?.port}`);
export type App = typeof app;
