import { Worker } from 'bullmq';
import { Elysia } from 'elysia';
import Redis from 'ioredis';
import { fetchHargaHarian } from './jobs/fetchHargaHarian';
import { syncPihps } from './jobs/pihps-ingest';
import { runAIAnalysis } from './jobs/runAIAnalysis';
import { syncMaster } from './jobs/syncMaster';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

console.log('Worker started connecting to Redis:', redisUrl);

// 1. Ingestion Worker (Fetch daily harga)
// Concurrency: 30 (increased from 15 for faster batched backfill)
const fetchWorker = new Worker(
  'sp2kp-fetch',
  async (job) => {
    console.log(`[Worker] Processing job: ${job.name} (id: ${job.id})`);
    return await fetchHargaHarian(job.data);
  },
  {
    connection,
    concurrency: 30,
  },
);

// 2. Master Data Ingestion Worker
const masterSyncWorker = new Worker(
  'master-sync',
  async (job) => {
    console.log(`[Worker] Processing master sync job: ${job.name} (id: ${job.id})`);
    return await syncMaster(job.data);
  },
  {
    connection,
    concurrency: 1,
  },
);

// 3. AI Analysis Worker
const aiAnalysisWorker = new Worker(
  'ai-analysis',
  async (job) => {
    console.log(`[Worker] Processing AI analysis job: ${job.name} (id: ${job.id})`);
    return await runAIAnalysis(job.data);
  },
  {
    connection,
    concurrency: 2,
  },
);

// 4. PIHPS Ingestion Worker
const pihpsSyncWorker = new Worker(
  'pihps-sync',
  async (job) => {
    console.log(`[Worker] Processing PIHPS sync job: ${job.name} (id: ${job.id})`);
    return await syncPihps(job.data);
  },
  {
    connection,
    concurrency: 1,
  },
);

// Handle errors
fetchWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.name} failed:`, err.message);
});
masterSyncWorker.on('failed', (job, err) => {
  console.error(`[Worker] Master sync job ${job?.name} failed:`, err.message);
});
aiAnalysisWorker.on('failed', (job, err) => {
  console.error(`[Worker] AI analysis job ${job?.name} failed:`, err.message);
});
pihpsSyncWorker.on('failed', (job, err) => {
  console.error(`[Worker] PIHPS sync job ${job?.name} failed:`, err.message);
});

// Health check server
const app = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    service: 'worker',
    workers: {
      fetch: fetchWorker.isRunning(),
      masterSync: masterSyncWorker.isRunning(),
      aiAnalysis: aiAnalysisWorker.isRunning(),
      pihpsSync: pihpsSyncWorker.isRunning(),
    },
  }))
  .listen(process.env.PORT || 3020);

console.log(`Worker health check server listening on port ${app.server?.port}`);
export type App = typeof app;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`[Worker] Received ${signal}. Starting graceful shutdown...`);
  try {
    // Stop Elysia health server
    await app.stop();

    // Pause workers (stop fetching new jobs)
    await fetchWorker.pause();
    await masterSyncWorker.pause();
    await aiAnalysisWorker.pause();
    await pihpsSyncWorker.pause();

    // Close workers (wait for active jobs to finish)
    await fetchWorker.close();
    await masterSyncWorker.close();
    await aiAnalysisWorker.close();
    await pihpsSyncWorker.close();

    // Disconnect Redis
    await connection.quit();

    console.log('[Worker] Graceful shutdown completed. Exiting.');
    process.exit(0);
  } catch (err: any) {
    console.error('[Worker] Error during graceful shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
