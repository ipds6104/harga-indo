import { db } from '../../packages/db/src';
import {
  provinsi,
  kota,
  pasar,
  komoditas,
  variant,
  produk,
  pedagang,
  hargaHarian,
  hargaHarianDetail,
  aiInsights,
  ingestionLog,
} from '../../packages/db/src/schema';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("=== Hargia DB State Check ===");

  const tables = [
    { name: 'provinsi', table: provinsi },
    { name: 'kota', table: kota },
    { name: 'pasar', table: pasar },
    { name: 'komoditas', table: komoditas },
    { name: 'variant', table: variant },
    { name: 'produk', table: produk },
    { name: 'pedagang', table: pedagang },
    { name: 'hargaHarian', table: hargaHarian },
    { name: 'hargaHarianDetail', table: hargaHarianDetail },
    { name: 'aiInsights', table: aiInsights },
    { name: 'ingestionLog', table: ingestionLog },
  ];

  for (const t of tables) {
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(t.table);
      console.log(`Table ${t.name.padEnd(18)}: ${count} rows`);
    } catch (err: any) {
      console.error(`Error querying ${t.name}:`, err.message);
    }
  }

  // Get a sample of provinsi and kota for queries
  const provSample = await db.select().from(provinsi).limit(1);
  const kotaSample = await db.select().from(kota).limit(1);
  const pasarSample = await db.select().from(pasar).limit(1);
  const variantSample = await db.select().from(variant).limit(1);

  console.log("\nSamples:");
  console.log("Provinsi :", provSample[0] || "None");
  console.log("Kota     :", kotaSample[0] || "None");
  console.log("Pasar    :", pasarSample[0] || "None");
  console.log("Variant  :", variantSample[0] || "None");

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
