import { AIClient } from '../../packages/ai-client/src/client';

async function testDirect() {
  console.log('Creating AI client...');
  const aiClient = new AIClient();

  const mockHarga = {
    id: 9999,
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
    kodeProvinsi: '11',
    kodeKabKota: '1113',
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

  const mockVariant = {
    id: 1,
    komoditasId: 1,
    satuanId: 1,
    nama: 'Beras Medium',
    namaSp2kp: 'Beras Medium',
    hargaMin: 8000,
    hargaMax: 15000,
    kenaikanMax: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('Environment AI_BASE_URL:', process.env.AI_BASE_URL);
  console.log('Sending direct completions request...');
  const start = Date.now();
  try {
    const res = await aiClient.detectAnomalies(mockHarga as any, mockVariant as any);
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error(`Failed in ${Date.now() - start}ms:`, err);
  }
}

testDirect();
