/**
 * Standalone API Server for Quotes & Subscriptions Domain
 * Runs using Node.js built-in HTTP module (Zero external dependencies required).
 * Also compatible with Express environments.
 */

const http = require('http');
const url = require('url');
const ctrl = require('./controllers/quoteTemplateController');

const PORT = process.env.PORT || 5000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Helper response wrapper matching Express response interface
  const expressRes = {
    status: function (code) {
      this._code = code;
      return this;
    },
    json: function (data) {
      sendJson(res, this._code || 200, data);
    }
  };

  // Helper to read JSON request body
  const readBody = (callback) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = bodyStr ? JSON.parse(bodyStr) : {};
        callback(null, parsed);
      } catch (e) {
        callback(e);
      }
    });
  };

  // API Route Dispatcher
  if (pathname === '/api/quote-templates/mock-dependencies' && method === 'GET') {
    return ctrl.getMockDependencies({ query: parsedUrl.query }, expressRes);
  }

  if (pathname === '/api/quote-templates/calculate-validity' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      ctrl.calculateValidity({ body }, expressRes);
    });
  }

  if (pathname === '/api/quote-templates' && method === 'GET') {
    return ctrl.getQuoteTemplates({ query: parsedUrl.query }, expressRes);
  }

  if (pathname === '/api/quote-templates' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      ctrl.createQuoteTemplate({ body }, expressRes);
    });
  }

  // Parameterized routes: /api/quote-templates/:id, :id/duplicate, :id/preview-quote
  const match = pathname.match(/^\/api\/quote-templates\/([^/]+)(\/(duplicate|preview-quote))?$/);
  if (match) {
    const id = match[1];
    const subAction = match[3];

    if (subAction === 'duplicate' && method === 'POST') {
      return ctrl.duplicateQuoteTemplate({ params: { id } }, expressRes);
    }

    if (subAction === 'preview-quote' && method === 'POST') {
      return readBody((err, body) => {
        if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
        ctrl.previewQuoteFromTemplate({ params: { id }, body }, expressRes);
      });
    }

    if (!subAction) {
      if (method === 'GET') {
        return ctrl.getQuoteTemplateById({ params: { id } }, expressRes);
      }
      if (method === 'PUT') {
        return readBody((err, body) => {
          if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
          ctrl.updateQuoteTemplate({ params: { id }, body }, expressRes);
        });
      }
      if (method === 'DELETE') {
        return ctrl.deleteQuoteTemplate({ params: { id } }, expressRes);
      }
    }
  }

  // 404 Not Found
  return expressRes.status(404).json({
    success: false,
    error: `Route not found: ${method} ${pathname}`
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Quotes & Subscriptions Domain API Server Running`);
    console.log(`📍 Endpoint: http://localhost:${PORT}/api/quote-templates`);
    console.log(`📦 Mock Auth User: usr_123 (Claire Dupont)`);
    console.log(`📦 Mock Product Variant: prod_1 (Enterprise Cloud Server) / var_1 (+$560)`);
    console.log(`⏱️  Quotation Validity Engine: Active`);
    console.log(`============================================================\n`);
  });
}

module.exports = server;

