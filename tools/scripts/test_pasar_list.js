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
  console.log('--- Testing /master/api/pasar ---');
  const url = 'https://api-sp2kp.kemendag.go.id/master/api/pasar?take=1000';
  const result = await getApi(url);
  console.log('Status:', result.status);
  if (result.data) {
    console.log('Keys:', Object.keys(result.data));
    if (result.data.data) {
      console.log('Total markets found:', result.data.data.length);
      console.log('Total Count in Meta:', result.data.totalCount);
      if (result.data.data.length > 0) {
        console.log('First market sample:', {
          id: result.data.data[0].id,
          nama: result.data.data[0].nama,
          kab: result.data.data[0].kode_kab_kota,
          prov: result.data.data[0].kode_provinsi
        });
      }
    }
  } else {
    console.log('Failed:', result);
  }
})();
