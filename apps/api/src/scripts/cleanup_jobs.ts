import { db, hargaHarian, ingestionLog } from '@harga/db';
import { Queue } from 'bullmq';
import { lt } from 'drizzle-orm';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

async function cleanup() {
  console.log('==================================================');
  console.log('   HARGIA - CLEANING UP AGE-OLD JOBS & LOGS       ');
  console.log('==================================================');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 30);
  const minDateStr = minDate.toISOString().split('T')[0];
  console.log(`Earliest allowed data date (30 days ago): ${minDateStr}`);

  // 1. Clean up BullMQ 'sp2kp-fetch' queue jobs
  console.log('\nScanning BullMQ "sp2kp-fetch" queue...');
  const fetchQueue = new Queue('sp2kp-fetch', { connection });

  const jobTypes: ('active' | 'waiting' | 'delayed' | 'failed' | 'completed')[] = [
    'active',
    'waiting',
    'delayed',
    'failed',
    'completed',
  ];

  let cleanedJobsCount = 0;
  for (const type of jobTypes) {
    try {
      const jobs = await fetchQueue.getJobs([type], 0, -1, true);
      console.log(`Found ${jobs.length} '${type}' jobs.`);
      for (const job of jobs) {
        const tStart = job.data?.tanggal_start;
        if (tStart && tStart < minDateStr) {
          await job.remove();
          cleanedJobsCount++;
        }
      }
    } catch (err) {
      console.error(`Error scanning '${type}' jobs:`, err);
    }
  }
  console.log(`Cleaned up ${cleanedJobsCount} old jobs from BullMQ queue.`);

  // 2. Clean up Database: Delete old ingestion logs (older than 30 days)
  console.log('\nCleaning up old logs from database...');
  try {
    const deletedLogs = await db
      .delete(ingestionLog)
      .where(lt(ingestionLog.tanggalFetch, minDateStr))
      .execute();
    console.log(`Deleted old ingestion logs older than ${minDateStr}.`);
  } catch (err) {
    console.error('Error deleting old ingestion logs:', err);
  }

  // 3. Clean up Database: Delete old price records (older than 30 days) just in case
  try {
    const deletedPrices = await db
      .delete(hargaHarian)
      .where(lt(hargaHarian.tanggal, minDateStr))
      .execute();
    console.log(`Deleted old price records older than ${minDateStr}.`);
  } catch (err) {
    console.error('Error deleting old price records:', err);
  }

  console.log('\nCleanup completed successfully!');
  await connection.quit();
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
