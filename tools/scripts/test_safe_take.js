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
  const takes = [1000, 5000, 10000];
  for (const take of takes) {
    console.log(`--- Testing with take=${take} ---`);
    const start = Date.now();
    const res = await getApi(`https://api-sp2kp.kemendag.go.id/report/api/average-price-public?tanggal=2026-06-09&take=${take}`);
    const duration = Date.now() - start;
    console.log(`Status for take=${take}:`, res.status);
    if (res.data) {
      console.log(`Data length:`, res.data.data ? res.data.data.length : 'N/A');
      console.log(`Duration:`, duration, 'ms');
      if (res.data.data && res.data.data.length > 0) {
        break; // stop if successful
      }
    } else {
      console.log(`Failed for take=${take}`);
    }
  }
})();
