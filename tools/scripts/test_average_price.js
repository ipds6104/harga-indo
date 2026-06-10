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
  console.log('--- Testing average-price-public ---');
  const res1 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09');
  console.log('Status:', res1.status);
  if (res1.status === 200 && res1.data) {
    console.log('Keys:', Object.keys(res1.data));
    if (res1.data.data) {
      console.log('Data count:', Array.isArray(res1.data.data) ? res1.data.data.length : 'Not an array');
      if (Array.isArray(res1.data.data) && res1.data.data.length > 0) {
        console.log('Sample item:', res1.data.data[0]);
      }
    }
  } else {
    console.log('Failed:', res1);
  }

  console.log('\n--- Testing average-price-komoditas-public ---');
  const res2 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-komoditas-public?tanggal=2026-06-09');
  console.log('Status:', res2.status);
  if (res2.status === 200 && res2.data) {
    console.log('Keys:', Object.keys(res2.data));
    if (res2.data.data) {
      console.log('Data count:', Array.isArray(res2.data.data) ? res2.data.data.length : 'Not an array');
      if (Array.isArray(res2.data.data) && res2.data.data.length > 0) {
        console.log('Sample item:', res2.data.data[0]);
      }
    }
  } else {
    console.log('Failed:', res2);
  }

  console.log('\n--- Testing with specific market/pasar ---');
  // Let's try passing pasar_id=1, or kab_kota_id=1, or provinsi_id=1, or variant_id=52
  const res3 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09&pasar_id=1');
  console.log('Status with pasar_id=1:', res3.status);
  if (res3.status === 200 && res3.data && res3.data.data) {
    console.log('Data count with pasar_id=1:', res3.data.data.length);
    if (res3.data.data.length > 0) {
      console.log('Sample item with pasar_id=1:', res3.data.data[0]);
    }
  }

  const res4 = await getApi('https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09&provinsi_id=11'); // 11 is typical Aceh province code
  console.log('Status with provinsi_id=11:', res4.status);
  if (res4.status === 200 && res4.data && res4.data.data) {
    console.log('Data count with provinsi_id=11:', res4.data.data.length);
    if (res4.data.data.length > 0) {
      console.log('Sample item with provinsi_id=11:', res4.data.data[0]);
    }
  }
})();
