const https = require('https');

function getApi(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 500) });
        }
      });
    }).on('error', err => {
      resolve({ status: 0, error: err.message });
    });
  });
}

(async () => {
  console.log('--- Testing average-price-public with take=100 ---');
  const res1 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09&take=100');
  if (res1.data) {
    console.log('Data length with take=100:', res1.data.data ? res1.data.data.length : 'N/A');
    console.log('Total Count in Meta:', res1.data.totalCount);
    console.log('Meta:', res1.data.meta);
  }

  console.log('\n--- Testing pagination ---');
  const res2 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09&take=10&page=2');
  if (res2.data && res2.data.data) {
    console.log('Page 2 first item:', {
      id: res2.data.data[0].id,
      pasar: res2.data.data[0].pasar.nama,
      kab: res2.data.data[0].nama_kab_kota,
      komoditas: res2.data.data[0].komoditas.nama,
      harga: res2.data.data[0].harga
    });
  }
})();
