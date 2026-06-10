import { db, sentraProduksi, tpidUser } from './index';

async function seed() {
  console.log('Starting TPID database seeding...');

  try {
    // 1. Seed TPID Users
    console.log('Seeding TPID users (Kadisdag & Sekda)...');
    await db
      .insert(tpidUser)
      .values([
        {
          id: 1,
          nama: 'Drs. H. Ihza, M.Si',
          email: 'ihza.kadisdag@pemda.go.id',
          role: 'kadisdag',
          isActive: true,
        },
        {
          id: 2,
          nama: 'Dr. Ir. Karu, M.T',
          email: 'karu.sekda@pemda.go.id',
          role: 'sekda',
          isActive: true,
        },
      ])
      .onConflictDoUpdate({
        target: tpidUser.id,
        set: {
          nama: sql`EXCLUDED.nama`,
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
        },
      });

    // 2. Seed Sentra Produksi
    console.log('Seeding sentra produksi surplus nodes...');
    await db
      .insert(sentraProduksi)
      .values([
        {
          id: 1,
          kodeProvinsi: '35', // Jawa Timur
          kodeKabKota: '3524', // Lamongan (example)
          komoditasId: 1, // Beras
          surplusTep: 120.5,
          lat: '-7.12',
          lon: '112.41',
          isActive: true,
        },
        {
          id: 2,
          kodeProvinsi: '33', // Jawa Tengah
          kodeKabKota: '3329', // Brebes (shallot capital)
          komoditasId: 2, // Bawang Merah
          surplusTep: 45.2,
          lat: '-6.87',
          lon: '109.04',
          isActive: true,
        },
        {
          id: 3,
          kodeProvinsi: '32', // Jawa Barat
          kodeKabKota: '3205', // Garut
          komoditasId: 4, // Cabai Merah
          surplusTep: 35.8,
          lat: '-7.22',
          lon: '107.90',
          isActive: true,
        },
        {
          id: 4,
          kodeProvinsi: '53', // NTT
          kodeKabKota: '5303', // Kupang
          komoditasId: 7, // Daging Sapi
          surplusTep: 150.0,
          lat: '-10.17',
          lon: '123.60',
          isActive: true,
        },
      ])
      .onConflictDoUpdate({
        target: sentraProduksi.id,
        set: {
          surplusTep: sql`EXCLUDED.surplus_tep`,
          lat: sql`EXCLUDED.lat`,
          lon: sql`EXCLUDED.lon`,
        },
      });

    console.log('TPID database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('TPID seeding failed:', error);
    process.exit(1);
  }
}

// Helper sql tag for excluded updates
import { sql } from 'drizzle-orm';
seed();
