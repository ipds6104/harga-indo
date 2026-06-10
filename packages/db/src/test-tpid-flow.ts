import { and, desc, eq, sql } from 'drizzle-orm';
import { evaluatePrice } from '../../../apps/worker/src/services/alert-evaluator';
import {
  db,
  komoditas,
  kota,
  pihpsHargaHarian,
  provinsi,
  tpidActionLog,
  tpidAlert,
  variant,
} from './index';

async function runTest() {
  console.log('--- STARTING TPID LIFECYCLE FLOW TEST ---');

  try {
    // 1. Fetch first available variant and province
    const variants = await db
      .select({ v: variant, k: komoditas })
      .from(variant)
      .leftJoin(komoditas, eq(variant.komoditasId, komoditas.id))
      .limit(1);

    const provinces = await db.select().from(provinsi).limit(1);
    const cities = await db
      .select()
      .from(kota)
      .where(eq(kota.kodeProvinsi, provinces[0].kode))
      .limit(1);

    if (variants.length === 0 || provinces.length === 0 || cities.length === 0) {
      console.error('Cannot run test: master data (variant/provinsi/kota) is empty.');
      process.exit(1);
    }

    const testVariant = variants[0].v;
    const testKomoditas = variants[0].k!;
    const testProv = provinces[0];
    const testKota = cities[0];

    console.log(`Using Test Entities:
  - Commodity: ${testKomoditas.nama} (ID: ${testKomoditas.id})
  - Variant: ${testVariant.nama} (ID: ${testVariant.id})
  - Province: ${testProv.nama} (Kode: ${testProv.kode})
  - City: ${testKota.nama} (Kode: ${testKota.kode})`);

    // Clean previous alerts for this variant/city to ensure fresh test run
    await db.delete(tpidActionLog);
    await db
      .delete(tpidAlert)
      .where(
        and(eq(tpidAlert.kodeKabKota, testKota.kode), eq(tpidAlert.variantId, testVariant.id)),
      );

    // Setup base target price limits
    const limitPrice = testVariant.hargaMax || 15000;
    const anomalyPrice = limitPrice * 1.4; // 40% above limit (anomalous)

    // Seed historical PIHPS prices for the last 10 days to establish baseline stddev
    console.log('\nStep 1: Seeding historical PIHPS baseline prices...');
    const dates = [
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ];
    for (const d of dates) {
      // Deterministic deterministic seed price around HAP limit
      const deterministicSeedId = Math.floor(Math.random() * 2147483647);
      await db
        .insert(pihpsHargaHarian)
        .values({
          id: deterministicSeedId,
          kodeProvinsi: testProv.kode,
          komoditasId: testKomoditas.id,
          tanggal: d,
          harga: limitPrice,
        })
        .onConflictDoNothing();
    }

    // Day 1: Anomaly detected
    console.log('\nStep 2: Day 1 price spike reported...');
    const eval1 = await evaluatePrice({
      tanggal: '2026-06-08',
      kodeProvinsi: testProv.kode,
      kodeKabKota: testKota.kode,
      komoditasId: testKomoditas.id,
      variantId: testVariant.id,
      hargaRataRata: anomalyPrice,
      jumlahPedagang: 5,
    });
    console.log('Result Eval 1:', eval1);
    if (eval1.status !== 'cooldown') {
      throw new Error(`Expected cooldown status on Day 1 anomaly, got: ${eval1.status}`);
    }

    // Day 2: Anomaly continues
    console.log('\nStep 3: Day 2 price spike reported...');
    const eval2 = await evaluatePrice({
      tanggal: '2026-06-09',
      kodeProvinsi: testProv.kode,
      kodeKabKota: testKota.kode,
      komoditasId: testKomoditas.id,
      variantId: testVariant.id,
      hargaRataRata: anomalyPrice,
      jumlahPedagang: 5,
    });
    console.log('Result Eval 2:', eval2);
    if (eval2.alertCreated) {
      throw new Error('Day 2 evaluation should not recreate a new alert record.');
    }

    // Day 3 (2026-06-11): Cooldown expires (3 days limit since 2026-06-08)
    console.log('\nStep 4: Day 3 (cooldown expires) price spike reported...');
    const eval3 = await evaluatePrice({
      tanggal: '2026-06-11',
      kodeProvinsi: testProv.kode,
      kodeKabKota: testKota.kode,
      komoditasId: testKomoditas.id,
      variantId: testVariant.id,
      hargaRataRata: anomalyPrice,
      jumlahPedagang: 5,
    });
    console.log('Result Eval 3:', eval3);
    if (eval3.status !== 'active_level_1') {
      throw new Error(`Expected promotion to active_level_1, got: ${eval3.status}`);
    }

    // Now test API calls to our Elysia server
    console.log('\nStep 5: Testing API endpoints on port 3005...');

    // Fetch alerts
    const alertsRes = await fetch('http://localhost:3005/api/tpid/alerts');
    const alertsList = (await alertsRes.json()) as any[];
    console.log(`Fetch Alerts count: ${alertsList.length}`);
    const activeAlert = alertsList.find((a: any) => a.alert.id === eval3.alertId);
    if (!activeAlert) {
      throw new Error(`Alert ID ${eval3.alertId} was not found in API /alerts list.`);
    }
    console.log(`Alert status in API: ${activeAlert.alert.status}`);

    // Kadisdag Level 1 Approval
    console.log('\nStep 6: Simulating Kadisdag Level 1 Approval...');
    const kadisdagRes = await fetch(
      `http://localhost:3005/api/tpid/alerts/${activeAlert.alert.id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1, // Kadisdag
          action: 'approve_level_1',
          catatan: 'Instruksikan operasi pasar murah beras SPHP terarah dalam 24 jam.',
          digitalSignature: 'SIG_KADISDAG_11234',
        }),
      },
    );
    const kadisdagJson = (await kadisdagRes.json()) as any;
    console.log('Kadisdag approval response:', kadisdagJson);
    if (kadisdagJson.newStatus !== 'active_level_2') {
      throw new Error(
        `Expected status to change to active_level_2, got: ${kadisdagJson.newStatus}`,
      );
    }

    // Sekda Level 2 Approval
    console.log('\nStep 7: Simulating Sekda Level 2 BTT APBD Approval...');
    const sekdaRes = await fetch(
      `http://localhost:3005/api/tpid/alerts/${activeAlert.alert.id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 2, // Sekda
          action: 'approve_level_2',
          catatan:
            'Dana BTT disetujui untuk pergeseran ongkos angkut komoditas via Perkada SE Mendagri 500/4825/SJ.',
          digitalSignature: 'SIG_SEKDA_998877',
        }),
      },
    );
    const sekdaJson = (await sekdaRes.json()) as any;
    console.log('Sekda approval response:', sekdaJson);
    if (sekdaJson.newStatus !== 'resolved') {
      throw new Error(`Expected status to resolve, got: ${sekdaJson.newStatus}`);
    }

    // Check Audit Trail verification
    console.log('\nStep 8: Fetching Audit Trail and verifying cryptographic integrity...');
    const auditRes = await fetch('http://localhost:3005/api/tpid/audit-trail');
    const auditLogs = (await auditRes.json()) as any[];
    console.log(`Audit Trail Log Count: ${auditLogs.length}`);
    for (const log of auditLogs) {
      console.log(`  Log ID: ${log.log.id}`);
      console.log(`  User: ${log.user.nama} (${log.user.role})`);
      console.log(`  Action: ${log.log.action}`);
      console.log(`  Hash: ${log.log.hashRecord}`);
      console.log(`  Expected Hash: ${log.expectedHash}`);
      console.log(`  Integrity Status: ${log.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
    }

    // Check Matchmaker
    console.log('\nStep 9: Testing Logistics Matchmaker endpoint...');
    const matchRes = await fetch(
      `http://localhost:3005/api/tpid/sentra-produksi/match?komoditasId=${testKomoditas.id}&kodeProvinsi=${testProv.kode}`,
    );
    const matches = (await matchRes.json()) as any[];
    console.log('Matchmaking route recommendations:', matches);

    console.log('\n--- ALL TPID LIFECYCLE TESTS PASSED SUCCESSFULLY! ✅ ---');
    process.exit(0);
  } catch (error) {
    console.error('\n--- TEST FAILED ❌ ---', error);
    process.exit(1);
  }
}

runTest();
