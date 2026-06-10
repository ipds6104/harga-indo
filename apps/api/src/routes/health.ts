import { Elysia } from 'elysia';

export const healthRoutes = new Elysia().get('/api/v1/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  service: 'api-server',
}));
