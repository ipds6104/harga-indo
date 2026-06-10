import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { hargaRoutes } from './routes/harga';
import { healthRoutes } from './routes/health';
import { ingestionRoutes } from './routes/ingestion';
import { insightsRoutes } from './routes/insights';
import { komoditasRoutes } from './routes/komoditas';
import { masterRoutes } from './routes/master';
import { pasarRoutes } from './routes/pasar';

export const app = new Elysia()
  .use(cors())
  .onError(({ code, error, set }) => {
    const errMsg = error && 'message' in error ? (error as any).message : '';

    if (errMsg === 'Invalid date range') {
      set.status = 400;
      return { error: 'Invalid date range: start_date must be before or equal to end_date' };
    }
    console.error('[API Error]', error);

    // Propagate standard error statuses if available
    if (error && 'status' in error && typeof (error as any).status === 'number') {
      set.status = (error as any).status;
      return { error: errMsg || 'Error' };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Route not found' };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: errMsg || 'Validation Error' };
    }

    set.status = 500;
    return { error: errMsg || 'Internal Server Error' };
  })
  .use(healthRoutes)
  .use(komoditasRoutes)
  .use(pasarRoutes)
  .use(hargaRoutes)
  .use(insightsRoutes)
  .use(ingestionRoutes)
  .use(masterRoutes);
