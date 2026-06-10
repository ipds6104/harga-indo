import { Elysia } from 'elysia';
import { backfillRoutes } from './backfill';
import { coverageRoutes } from './coverage';
import { historicalRoutes } from './historical';
import { monitorRoutes } from './monitor';
import { triggerRoutes } from './trigger';

export const ingestionRoutes = new Elysia()
  .use(monitorRoutes)
  .use(triggerRoutes)
  .use(backfillRoutes)
  .use(coverageRoutes)
  .use(historicalRoutes);
