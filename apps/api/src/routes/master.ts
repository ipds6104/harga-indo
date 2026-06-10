import { db, kota, provinsi } from '@harga/db';
import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const masterRoutes = new Elysia()
  .get('/api/v1/provinsi', async () => {
    return await db.select().from(provinsi).orderBy(provinsi.nama);
  })
  .get(
    '/api/v1/kota',
    async ({ query }) => {
      const { kode_provinsi } = query;
      if (kode_provinsi) {
        return await db
          .select()
          .from(kota)
          .where(eq(kota.kodeProvinsi, kode_provinsi))
          .orderBy(kota.nama);
      }
      return await db.select().from(kota).orderBy(kota.nama);
    },
    {
      query: t.Object({
        kode_provinsi: t.Optional(t.String()),
      }),
    },
  );
