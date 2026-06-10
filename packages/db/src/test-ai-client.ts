import { AIClient } from '../../ai-client/src/client';

async function test() {
  console.log('Testing direct AI Proxy connection...');
  const client = new AIClient();

  const hargaMock = {
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

  console.log('Sending anomaly detection request to proxy...');
  const result = await client.detectAnomalies(hargaMock, variantMock);
  console.log('Parsed result from Gemini Proxy:', result);
  process.exit(0);
}

test();
