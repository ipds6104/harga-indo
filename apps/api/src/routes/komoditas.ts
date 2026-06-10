import { db, komoditas, variant } from '@harga/db';
import { Elysia } from 'elysia';

export const komoditasRoutes = new Elysia().get('/api/v1/komoditas', async () => {
  const comList = await db.select().from(komoditas);
  const varList = await db.select().from(variant);

  // Group variants by commodity
  return comList.map((c) => ({
    ...c,
    variants: varList.filter((v) => v.komoditasId === c.id),
  }));
});
