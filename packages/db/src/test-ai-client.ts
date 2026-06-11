import { AIClient } from '../../ai-client/src/client';

async function test() {
  console.log('Testing direct AI Proxy connection...');
  const client = new AIClient();

  const hargaMockAnomaly = {
    id: 1,
    pasarId: 1,
    komoditasId: 1,
    variantId: 1,
    produkId: 1,
    satuanId: 1,
    tanggal: '2026-06-10',
    harga: 28000,
    hargaSebelumnya: 12000,
    prosentasePerubahan: 133.3,
    kuantitas: 0,
    pasokan: 0,
    jumlahPedagang: 5,
    kodeProvinsi: '31',
    kodeKabKota: '3171',
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

  const hargaMockNormal = {
    ...hargaMockAnomaly,
    harga: 11000,
    hargaSebelumnya: 11000,
    prosentasePerubahan: 0,
  };

  const variantMock = {
    id: 1,
    kode: 'BERAS',
    komoditasId: 1,
    nama: 'Beras Medium',
    satuanId: 1,
    hargaMin: 10000,
    hargaMax: 14000,
    kenaikanMax: 10,
    penurunanMax: 10,
    coicop7: '01',
    coicop10: '0101',
  };

  console.log('\n--- 1. Testing Rules-First Pre-filtering (Normal Price, should NOT query AI) ---');
  console.log('Sending normal price anomaly detection request...');
  const normalResult = await client.detectAnomalies(hargaMockNormal, variantMock);
  console.log('Result for Normal Price (expected immediately, no API logs):', normalResult);

  console.log(
    '\n--- 2. Testing Circuit Breaker (Consecutive Anomaly Queries with invalid key) ---',
  );
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Loop #${i} ---`);
    const start = Date.now();
    const result = await client.detectAnomalies(hargaMockAnomaly, variantMock);
    const duration = Date.now() - start;
    console.log(`Loop #${i} Result (took ${duration}ms):`, JSON.stringify(result));
  }

  process.exit(0);
}

test();
