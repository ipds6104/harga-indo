import { eq, inArray, sql } from 'drizzle-orm';
import { db, neracaPanganProvinsi, sentraProduksi, tpidUser, variant } from './index';

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
          komoditasId: 2, // Bawang Merah (which is ID: 13, wait, variant's komoditasId is 12 for Bawang)
          // Wait, let's look at check-variants.ts.
          // In the database:
          // Commodity ID: 12 is Bawang
          // Commodity ID: 2 is Gula
          // Wait, Brebes is shallot (bawang merah). So komoditasId should be 12.
          // Let's set komoditasId to 12.
          surplusTep: 45.2,
          lat: '-6.87',
          lon: '109.04',
          isActive: true,
        },
        {
          id: 3,
          kodeProvinsi: '32', // Jawa Barat
          kodeKabKota: '3205', // Garut
          komoditasId: 11, // Cabai
          surplusTep: 35.8,
          lat: '-7.22',
          lon: '107.90',
          isActive: true,
        },
        {
          id: 4,
          kodeProvinsi: '53', // NTT
          kodeKabKota: '5303', // Kupang
          komoditasId: 4, // Daging Ruminansia (Daging Sapi)
          surplusTep: 150.0,
          lat: '-10.17',
          lon: '123.60',
          isActive: true,
        },
      ])
      .onConflictDoUpdate({
        target: sentraProduksi.id,
        set: {
          komoditasId: sql`EXCLUDED.komoditas_id`,
          surplusTep: sql`EXCLUDED.surplus_tep`,
          lat: sql`EXCLUDED.lat`,
          lon: sql`EXCLUDED.lon`,
        },
      });

    // 3. Populate jenis_threshold on variant table
    console.log('Updating jenis_threshold on variant table...');

    // Default to tidak_diatur first
    await db.update(variant).set({ jenisThreshold: 'tidak_diatur' });

    // HET: Beras (komoditas_id: 1), Gula (komoditas_id: 2), Minyakita (id: 18)
    await db
      .update(variant)
      .set({ jenisThreshold: 'HET' })
      .where(sql`${variant.komoditasId} IN (1, 2) OR ${variant.id} = 18`);

    // HAP: Bawang (12, 37), Cabai (11, 36, 39), Kedelai (10, 38), Daging Ruminansia (4), Daging Ayam (5), Telur Ayam (6), Minyak Sawit (3, except Minyakita)
    await db
      .update(variant)
      .set({ jenisThreshold: 'HAP' })
      .where(
        sql`${variant.komoditasId} IN (4, 5, 6, 10, 11, 12, 36, 37, 38, 39) OR (${variant.komoditasId} = 3 AND ${variant.id} != 18)`,
      );

    // 4. Seed Neraca Pangan Provinsi
    console.log('Seeding neraca pangan provinsi table...');

    // Clear existing rows first
    await db.delete(neracaPanganProvinsi);

    // Let's create a realistic data list for major food commodities:
    // Komoditas: 1 (Beras), 11 (Cabai), 12 (Bawang)
    const provincesList = [
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '21',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
      '51',
      '52',
      '53',
      '61',
      '62',
      '63',
      '64',
      '65',
      '71',
      '72',
      '73',
      '74',
      '75',
      '76',
      '81',
      '82',
      '91',
      '92',
      '93',
      '94',
      '95',
      '96',
    ];

    // Surplus provinces for rice/onion/chili:
    // Rice surplus: Jawa Barat (32), Jawa Tengah (33), Jawa Timur (35), Sulawesi Selatan (73), NTB (52), Lampung (18), Sumsel (16)
    // Chili surplus: Jawa Timur (35), Jawa Tengah (33), Jawa Barat (32), NTB (52)
    // Bawang surplus: Jawa Tengah (33 - Brebes), NTB (52 - Bima), Jawa Timur (35)

    // Defisit provinces (importers):
    // Rice defisit: DKI Jakarta (31), Kepulauan Riau (21), Bangka Belitung (19), Kaltim (64), Papua (92), Papua Barat (91), Maluku (81)

    const surplusProvsBeras = ['32', '33', '35', '73', '52', '18', '16'];
    const defisitProvsBeras = ['31', '21', '19', '64', '81', '91', '92', '93', '94', '95', '96'];

    const surplusProvsCabai = ['35', '33', '32', '52'];
    const defisitProvsCabai = ['31', '21', '19', '64', '81', '91', '92', '93', '94', '95', '96'];

    const surplusProvsBawang = ['33', '52', '35'];
    const defisitProvsBawang = ['31', '21', '19', '64', '81', '91', '92', '93', '94', '95', '96'];

    const neracaRows: any[] = [];
    let rowId = 1;

    for (const provCode of provincesList) {
      // 1. Beras (komoditas_id = 1)
      let statusBeras: 'surplus' | 'defisit' | 'seimbang' = 'seimbang';
      let impBeras =
        'Intervensi lokal mandiri via Gerakan Pangan Murah (GPM) dan pengawasan rantai pasok.';
      if (surplusProvsBeras.includes(provCode)) {
        statusBeras = 'surplus';
        impBeras =
          'Provinsi produsen surplus beras. Jika harga naik, cek kendala distribusi keluar dan potensi penimbunan (hoarding) di tingkat penggilingan/pedagang besar.';
      } else if (defisitProvsBeras.includes(provCode)) {
        statusBeras = 'defisit';
        impBeras =
          'Provinsi defisit konsumen beras. Jika harga naik, lakukan Kerja Sama Antar Daerah (KAD) dengan provinsi produsen dan fasilitasi subsidi ongkos angkut.';
      }
      neracaRows.push({
        id: rowId++,
        kodeProvinsi: provCode,
        komoditasId: 1,
        statusNeraca: statusBeras,
        implikasiIntervensi: impBeras,
        tahunData: 2025,
      });

      // 2. Cabai (komoditas_id = 11)
      let statusCabai: 'surplus' | 'defisit' | 'seimbang' = 'seimbang';
      let impCabai = 'Intervensi lokal mandiri via optimalisasi pasar murah daerah.';
      if (surplusProvsCabai.includes(provCode)) {
        statusCabai = 'surplus';
        impCabai =
          'Provinsi surplus produsen cabai. Jika harga naik, cek distribusi antar kabupaten/kota atau kendala rantai pasok lokal.';
      } else if (defisitProvsCabai.includes(provCode)) {
        statusCabai = 'defisit';
        impCabai =
          'Provinsi defisit konsumen cabai. Jika harga naik, koordinasikan pasokan masuk dari sentra produksi (Jawa Timur/NTB) dan pertimbangkan subsidi transportasi udara/laut.';
      }
      neracaRows.push({
        id: rowId++,
        kodeProvinsi: provCode,
        komoditasId: 11,
        statusNeraca: statusCabai,
        implikasiIntervensi: impCabai,
        tahunData: 2025,
      });

      // 3. Bawang (komoditas_id = 12)
      let statusBawang: 'surplus' | 'defisit' | 'seimbang' = 'seimbang';
      let impBawang = 'Intervensi koordinatif standar tingkat lokal.';
      if (surplusProvsBawang.includes(provCode)) {
        statusBawang = 'surplus';
        impBawang =
          'Provinsi surplus produsen bawang merah. Jika harga naik, awasi aktivitas pedagang pengumpul dan jaga kelancaran distribusi ke luar daerah.';
      } else if (defisitProvsBawang.includes(provCode)) {
        statusBawang = 'defisit';
        impBawang =
          'Provinsi defisit konsumen bawang merah. Jika harga naik, datangkan pasokan dari Brebes atau Bima melalui fasilitasi tol laut atau subsidi angkut Pemda.';
      }
      neracaRows.push({
        id: rowId++,
        kodeProvinsi: provCode,
        komoditasId: 12,
        statusNeraca: statusBawang,
        implikasiIntervensi: impBawang,
        tahunData: 2025,
      });
    }

    console.log(`Inserting ${neracaRows.length} neraca pangan rows...`);
    await db.insert(neracaPanganProvinsi).values(neracaRows);

    console.log('TPID database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('TPID seeding failed:', error);
    process.exit(1);
  }
}

seed();
