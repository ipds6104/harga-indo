import { db, pasar } from '@harga/db';
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const pasarRoutes = new Elysia().get(
  '/api/v1/pasar',
  async ({ query }) => {
    const { provinsi_id, kota_id } = query;
    const conditions = [];

    if (provinsi_id) {
      conditions.push(eq(pasar.kodeProvinsi, provinsi_id));
    }
    if (kota_id) {
      conditions.push(eq(pasar.kodeKabKota, kota_id));
    }

    const queryBuilder = db.select().from(pasar);
    if (conditions.length > 0) {
      return await queryBuilder.where(and(...conditions));
    }
    return await queryBuilder;
  },
  {
    query: t.Object({
      provinsi_id: t.Optional(t.String()),
      kota_id: t.Optional(t.String()),
    }),
  },
);
