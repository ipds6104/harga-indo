const fs = require('fs');
const https = require('https');

const htmlContent = fs.readFileSync('index.html', 'utf8');

// Extract all /_nuxt/*.js paths
const jsPaths = [];
const regex = /\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js/g;
let match;
while ((match = regex.exec(htmlContent)) !== null) {
  if (!jsPaths.includes(match[0])) {
    jsPaths.push(match[0]);
  }
}

console.log(`Found ${jsPaths.length} JS bundle files in index.html.`);

// Helper to download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

(async () => {
  const downloadDir = './js_bundles';
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }

  const allEndpoints = new Set();

  for (let i = 0; i < jsPaths.length; i++) {
    const jsPath = jsPaths[i];
    const fileName = jsPath.split('/').pop();
    const destPath = `${downloadDir}/${fileName}`;
    const url = `https://sp2kp.kemendag.go.id${jsPath}`;
    
    console.log(`[${i+1}/${jsPaths.length}] Downloading ${fileName}...`);
    try {
      await downloadFile(url, destPath);
      const content = fs.readFileSync(destPath, 'utf8');

      // Search for API endpoints
      // Match patterns like: "/api/xxx" or "/master/api/xxx" or "/report/api/xxx"
      const apiRegex = /["'](?:\/master\/api\/|\/report\/api\/|\/api\/)[a-zA-Z0-9_\-\/\{\}]+["']/g;
      let apiMatch;
      while ((apiMatch = apiRegex.exec(content)) !== null) {
        // clean quotes
        const endpoint = apiMatch[0].replace(/['"]/g, '');
        allEndpoints.add(endpoint);
      }
      
      // Also match full url to api-sp2kp
      const urlRegex = /https:\/\/api-sp2kp\.kemendag\.go\.id\/[a-zA-Z0-9_\-\/\{\}\?&=]+/g;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(content)) !== null) {
        allEndpoints.add(urlMatch[0]);
      }

    } catch (e) {
      console.error(`Failed to process ${fileName}:`, e.message);
    }
  }

  console.log(`\nFound ${allEndpoints.size} unique endpoints/URLs in JS bundles:`);
  const sorted = Array.from(allEndpoints).sort();
  fs.writeFileSync('all_discovered_endpoints.txt', sorted.join('\n'));
  console.log('Saved to all_discovered_endpoints.txt');
})();
