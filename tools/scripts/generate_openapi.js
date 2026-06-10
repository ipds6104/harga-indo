const fs = require('fs');

const traffic = JSON.parse(fs.readFileSync('api_traffic.json', 'utf8'));

// Helper to generate OpenAPI schema from value
function generateSchema(value) {
  if (value === null || value === undefined) {
    return { type: 'string', nullable: true };
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? generateSchema(value[0]) : { type: 'string' }
    };
  }
  if (typeof value === 'object') {
    const properties = {};
    for (const [k, v] of Object.entries(value)) {
      properties[k] = generateSchema(v);
    }
    return {
      type: 'object',
      properties
    };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }
  return { type: 'string' };
}

const openapi = {
  openapi: '3.0.0',
  info: {
    title: 'SP2KP Kemendag API',
    description: 'API untuk mengambil data harga bahan pokok dari sp2kp.kemendag.go.id',
    version: '1.0.0'
  },
  servers: [
    {
      url: 'https://api-sp2kp.kemendag.go.id',
      description: 'Production API server'
    }
  ],
  paths: {}
};

// Map to aggregate data
const apiData = {};

traffic.forEach(item => {
  if (!item.url.includes('api-sp2kp.kemendag.go.id')) return;

  const parsedUrl = new URL(item.url);
  let pathname = parsedUrl.pathname;
  const method = item.method || 'GET';
  const pathParams = [];

  // Path normalization for ID
  // e.g. /master/api/komoditas/41 -> /master/api/komoditas/{id}
  const matchId = pathname.match(/\/master\/api\/komoditas\/(\d+)$/);
  if (matchId) {
    pathname = '/master/api/komoditas/{id}';
    pathParams.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'ID Komoditas'
    });
  }

  const key = `${method} ${pathname}`;

  if (!apiData[key]) {
    apiData[key] = {
      method,
      pathname,
      pathParams,
      queryParams: {},
      payload: null,
      responseBody: null,
      responseStatus: 200
    };
  }

  if (item.type === 'REQUEST') {
    parsedUrl.searchParams.forEach((val, name) => {
      // Try to determine type
      let type = 'string';
      if (!isNaN(val)) type = 'integer';
      if (val === 'true' || val === 'false') type = 'boolean';

      apiData[key].queryParams[name] = {
        name,
        in: 'query',
        required: false,
        schema: { type, example: val }
      };
    });
    if (item.payload) {
      apiData[key].payload = item.payload;
    }
  } else if (item.type === 'RESPONSE' && (item.status === 200 || item.status === 204)) {
    apiData[key].responseStatus = item.status;
    apiData[key].responseBody = item.body;
  }
});

// Build openapi paths
for (const [key, details] of Object.entries(apiData)) {
  const pathItem = openapi.paths[details.pathname] || {};
  
  const parameters = [...details.pathParams, ...Object.values(details.queryParams)];

  const operation = {
    summary: `Endpoint ${details.pathname}`,
    parameters: parameters.length > 0 ? parameters : undefined,
    responses: {}
  };

  if (details.responseStatus === 204) {
    operation.responses['204'] = {
      description: 'No Content'
    };
  } else {
    const schema = details.responseBody ? generateSchema(details.responseBody) : { type: 'string' };
    operation.responses[String(details.responseStatus)] = {
      description: 'Successful Response',
      content: {
        'application/json': {
          schema
        }
      }
    };
  }

  if (details.method === 'POST' && details.payload) {
    // Check if form-data
    if (details.payload.includes('form-data')) {
      operation.requestBody = {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                tanggal: { type: 'string', example: '2026-06-09' },
                tanggal_pembanding: { type: 'string', example: '2026-06-08' }
              }
            }
          }
        }
      };
    } else {
      // Generic JSON payload
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(details.payload);
      } catch (e) {}

      operation.requestBody = {
        content: {
          'application/json': {
            schema: parsedPayload ? generateSchema(parsedPayload) : { type: 'string' }
          }
        }
      };
    }
  }

  pathItem[details.method.toLowerCase()] = operation;
  openapi.paths[details.pathname] = pathItem;
}

fs.writeFileSync('sp2kp_openapi.json', JSON.stringify(openapi, null, 2));
console.log('OpenAPI Swagger spec generated in sp2kp_openapi.json');
