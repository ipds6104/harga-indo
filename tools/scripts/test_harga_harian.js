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
  console.log('--- Testing /trx/harga-harian ---');
  // Querying for Mempawah market (pasar_id = 517) from June 5 to June 9, 2026
  const url = 'https://api-sp2kp.kemendag.go.id/trx/harga-harian?tanggal_start=2026-06-05&tanggal_end=2026-06-09&tipe_komoditas_id=1&pasar_id=517&take=10&skip=0';
  console.log('Requesting:', url);
  const result = await getApi(url);
  console.log('Status:', result.status);
  if (result.data) {
    console.log('Keys:', Object.keys(result.data));
    console.log('Data count:', result.data.data ? result.data.data.length : 'N/A');
    console.log('Meta:', result.data.meta);
    if (result.data.data && result.data.data.length > 0) {
      console.log('Sample item:', JSON.stringify(result.data.data[0], null, 2));
    }
  } else {
    console.log('Failed:', result);
  }
})();
