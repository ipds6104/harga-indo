import { Queue } from 'bullmq';
import { connection } from './redis';

export const fetchQueue = new Queue('sp2kp-fetch', { connection });
export const masterSyncQueue = new Queue('master-sync', { connection });
