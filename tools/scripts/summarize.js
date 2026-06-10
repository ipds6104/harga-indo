const fs = require('fs');

const traffic = JSON.parse(fs.readFileSync('api_traffic.json', 'utf8'));

const apis = {};

traffic.forEach(item => {
  if (item.url.includes('api-sp2kp.kemendag.go.id') || item.url.includes('sp2kp.kemendag.go.id/api')) {
    const parsedUrl = new URL(item.url);
    const key = `${item.method || 'GET'} ${parsedUrl.pathname}`;
    
    if (!apis[key]) {
      apis[key] = {
        method: item.method || 'GET',
        path: parsedUrl.pathname,
        host: parsedUrl.host,
        queries: [],
        payloads: [],
        responses: []
      };
    }

    if (item.type === 'REQUEST') {
      const params = Object.fromEntries(parsedUrl.searchParams.entries());
      if (Object.keys(params).length > 0) {
        apis[key].queries.push(params);
      }
      if (item.payload) {
        apis[key].payloads.push(item.payload);
      }
    } else if (item.type === 'RESPONSE') {
      apis[key].responses.push({
        status: item.status,
        body: item.body
      });
    }
  }
});

// Create markdown table summary
let md = `# SP2KP Kemendag API Map (Fetched via Playwright)\n\n`;
md += `Berikut adalah daftar API endpoint yang berhasil ditangkap dari domain **api-sp2kp.kemendag.go.id**:\n\n`;
md += `| Method | Path | Parameter / Query (Contoh) | Deskripsi Respon (Preview) |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

for (const [key, details] of Object.entries(apis)) {
  const sampleQuery = details.queries.length > 0 ? JSON.stringify(details.queries[0]) : '-';
  const samplePayload = details.payloads.length > 0 ? JSON.stringify(details.payloads[0]) : '';
  const paramText = samplePayload ? `Query: ${sampleQuery}<br>Payload: ${samplePayload}` : sampleQuery;

  // Get sample response body summary
  let responseText = '-';
  const successRes = details.responses.find(r => r.status === 200 || r.status === 204);
  if (successRes) {
    if (successRes.status === 204) {
      responseText = '204 No Content';
    } else if (successRes.body) {
      const bodyStr = typeof successRes.body === 'object' ? JSON.stringify(successRes.body) : successRes.body;
      responseText = `200 OK (length: ${bodyStr.length})`;
      if (typeof successRes.body === 'object') {
        const keys = Object.keys(successRes.body);
        if (Array.isArray(successRes.body)) {
          responseText += `<br>Array of objects, e.g., keys: \`${Object.keys(successRes.body[0] || {}).join(', ')}\``;
        } else if (successRes.body.data && Array.isArray(successRes.body.data)) {
          responseText += `<br>Object with data list, e.g., keys: \`${Object.keys(successRes.body.data[0] || {}).join(', ')}\``;
        } else {
          responseText += `<br>Object with keys: \`${keys.join(', ')}\``;
        }
      }
    }
  }

  md += `| **${details.method}** | \`${details.path}\` | \`${paramText}\` | ${responseText} |\n`;
}

fs.writeFileSync('api_summary.md', md);
console.log('Summary markdown created in api_summary.md');
