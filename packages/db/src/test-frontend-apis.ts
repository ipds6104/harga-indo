import { desc, eq } from 'drizzle-orm';
import { AIClient } from '../../ai-client/src/client';
import { aiInsights, db, hargaHarian, kota, provinsi, variant } from './index';

async function runTests() {
  console.log('==================================================');
  console.log('      HARGIA FRONTEND API INTEGRATION TESTER      ');
  console.log('==================================================\n');

  const baseUrl = 'http://localhost:3005';

  // 1. Fetch real master data from DB to use in dynamic testing parameters
  console.log('Fetching test parameters dynamically from DB...');
  const provList = await db.select().from(provinsi).limit(1);
  const variantList = await db.select().from(variant).limit(1);

  if (provList.length === 0 || variantList.length === 0) {
    console.error('Cannot proceed: Provinsi or Variant tables are empty.');
    process.exit(1);
  }

  const testProv = provList[0];
  const testVar = variantList[0];

  // Get a city in that province
  const cities = await db.select().from(kota).where(eq(kota.kodeProvinsi, testProv.kode)).limit(1);
  const testKota = cities[0] || { kode: '1113', nama: 'Default City' };

  console.log(`Dynamic parameters selected for testing:
  - Province: ${testProv.nama} (${testProv.kode})
  - City: ${testKota.nama} (${testKota.kode})
  - Variant: ${testVar.nama} (${testVar.id})\n`);

  // Define endpoints to query
  const endpoints = [
    { name: 'GET master provinsi', path: '/api/v1/provinsi' },
    { name: 'GET master komoditas', path: '/api/v1/komoditas' },
    { name: 'GET master pasar', path: '/api/v1/pasar' },
    { name: 'GET harga hari ini', path: `/api/v1/harga/hari-ini?provinsi_id=${testProv.kode}` },
    { name: 'GET historical trend', path: `/api/v1/harga/trend?variant_id=${testVar.id}&days=7` },
    {
      name: 'GET perbandingan pasar',
      path: `/api/v1/harga/perbandingan-pasar?variant_id=${testVar.id}&kode_kab_kota=${testKota.kode}`,
    },
    { name: 'GET HET/HA latest', path: `/api/v1/harga/het-ha?variant_id=${testVar.id}` },
    { name: 'GET harga anomali AI report', path: '/api/v1/harga/anomali' },
    {
      name: 'GET insights daily household summary',
      path: `/api/v1/insights/daily?kode_provinsi=${testProv.kode}`,
    },
    { name: 'GET insights management KPI', path: '/api/v1/insights/management' },
    { name: 'GET data ingestion status', path: '/api/v1/ingestion/status' },
    { name: 'GET TPID alerts list', path: '/api/tpid/alerts' },
    { name: 'GET TPID audit trail logs', path: '/api/tpid/audit-trail' },
    {
      name: 'GET TPID sentra matchmaking',
      path: `/api/tpid/sentra-produksi/match?komoditasId=${testVar.komoditasId}&kodeProvinsi=${testProv.kode}`,
    },
  ];

  let successCount = 0;
  let failCount = 0;

  console.log('--- STARTING HTTP API ENDPOINT CHECKS ---');
  for (const ep of endpoints) {
    const url = `${baseUrl}${ep.path}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const status = response.status;

      if (response.ok) {
        let details = 'OK';
        try {
          const body = await response.json();
          if (Array.isArray(body)) {
            details = `${body.length} records`;
          } else if (body && typeof body === 'object') {
            details = 'JSON Object';
          }
        } catch {
          details = 'Raw text/empty';
        }

        console.log(`[  OK  ] ${ep.name.padEnd(36)} -> ${status} (${details})`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.error(`[ FAIL ] ${ep.name.padEnd(36)} -> ${status} - ${errorText.slice(0, 60)}`);
        failCount++;
      }
    } catch (err: any) {
      console.error(`[ ERROR] ${ep.name.padEnd(36)} -> Connection failed: ${err.message}`);
      failCount++;
    }
  }

  // 2. Test Live AI Proxy client connectivity
  console.log('\n--- STARTING LIVE GEMINI PROXY COMPLETIONS TEST ---');
  const aiClient = new AIClient();

  const hargaMock = {
    id: 9999,
    pasarId: 1,
    komoditasId: testVar.komoditasId,
    variantId: testVar.id,
    produkId: testVar.id,
    satuanId: testVar.satuanId,
    tanggal: new Date().toISOString().split('T')[0],
    harga: 28000,
    hargaSebelumnya: 12000,
    prosentasePerubahan: 133.3,
    kuantitas: 0,
    pasokan: 0,
    jumlahPedagang: 5,
    kodeProvinsi: testProv.kode,
    kodeKabKota: testKota.kode,
    statusVerifikasi1: null,
    verifikasi1At: null,
    statusVerifikasi2: null,
    verifikasi2At: null,
    isActive: true,
    isClosed: false,
    isHargaStillZero: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    console.log('Sending direct anomaly detection query to Gemini Proxy...');
    const result = await aiClient.detectAnomalies(hargaMock, testVar);
    console.log('Gemini Proxy Anomaly Result:', JSON.stringify(result));
    console.log('[  OK  ] Live AI Proxy completions -> Successful connection & parsed response');
    successCount++;
  } catch (error: any) {
    console.error(`[ FAIL ] Live AI Proxy completions -> Error: ${error.message}`);
    failCount++;
  }

  console.log('\n==================================================');
  console.log('                  TEST SUMMARY                    ');
  console.log('==================================================');
  console.log(`Total Succeeded: ${successCount}`);
  console.log(`Total Failed:    ${failCount}`);
  console.log('==================================================');

  if (failCount > 0) {
    console.error('\n❌ SOME INTEGRATION TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL FRONTEND API ENDPOINTS OPERATIONAL AND VALID');
    process.exit(0);
  }
}

runTests();
