const { firefox } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('Starting Playwright...');
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  const apiLogs = [];

  // Listen to requests
  page.on('request', request => {
    const resourceType = request.resourceType();
    if (resourceType === 'fetch' || resourceType === 'xhr') {
      const log = {
        type: 'REQUEST',
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        payload: request.postData() || null,
        timestamp: new Date().toISOString()
      };
      apiLogs.push(log);
      console.log(`[REQ] ${log.method} ${log.url}`);
    }
  });

  // Listen to responses
  page.on('response', async response => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (resourceType === 'fetch' || resourceType === 'xhr') {
      const url = response.url();
      const status = response.status();
      let body = null;
      let isJson = false;

      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          body = await response.json();
          isJson = true;
        } else {
          body = await response.text();
        }
      } catch (e) {
        body = `[Error reading body: ${e.message}]`;
      }

      const log = {
        type: 'RESPONSE',
        url: url,
        status: status,
        isJson: isJson,
        body: body,
        timestamp: new Date().toISOString()
      };
      apiLogs.push(log);
      console.log(`[RES] ${log.status} ${log.url}`);
    }
  });

  try {
    console.log('Navigating to https://sp2kp.kemendag.go.id/ ...');
    await page.goto('https://sp2kp.kemendag.go.id/', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Page loaded. Waiting 5 seconds for background fetches...');
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Error during navigation:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');

    // Save logs to file
    fs.writeFileSync('api_traffic.json', JSON.stringify(apiLogs, null, 2));
    console.log(`Saved ${apiLogs.length} request/response logs to api_traffic.json`);
  }
})();
