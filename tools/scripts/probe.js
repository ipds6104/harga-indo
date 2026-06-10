const https = require('https');

const candidateEndpoints = [
  '/master/api/wilayah/kabupaten',
  '/master/api/wilayah/kota',
  '/master/api/wilayah/kabupaten-kota',
  '/master/api/wilayah/pasar',
  '/master/api/pasar',
  '/master/api/pasar?take=10',
  '/master/api/pasar-pantau',
  '/master/api/wilayah/provinsi',
  '/report/api/average-price/kabupaten-comparison',
  '/report/api/average-price/pasar-comparison',
  '/report/api/average-price/market-comparison',
  '/report/api/average-price/regency-comparison',
  '/report/api/average-price/district-comparison'
];

function requestEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api-sp2kp.kemendag.go.id',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          data: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({ path, status: 0, error: err.message });
    });

    req.end();
  });
}

(async () => {
  console.log('Probing candidate endpoints to find Pasar, Kabupaten, etc...');
  for (const path of candidateEndpoints) {
    const result = await requestEndpoint(path);
    if (result.status === 200) {
      console.log(`[FOUND] 200 OK: ${path}`);
      try {
        const json = JSON.parse(result.data);
        if (json.data) {
          if (Array.isArray(json.data)) {
            console.log(`   Sample item keys: ${Object.keys(json.data[0] || {}).join(', ')}`);
          } else {
            console.log(`   Data keys: ${Object.keys(json.data).join(', ')}`);
          }
        } else {
          console.log(`   JSON keys: ${Object.keys(json).join(', ')}`);
        }
      } catch (e) {
        console.log(`   Failed to parse JSON, preview: ${result.data.substring(0, 100)}`);
      }
    } else {
      console.log(`[FAILED] ${result.status}: ${path}`);
    }
  }
})();
