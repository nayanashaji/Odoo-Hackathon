/**
 * Standalone API Server for Quotes & Subscriptions Domain
 * Runs using Node.js built-in HTTP module (Zero external dependencies required).
 * Handles both Quote Templates and Subscription Lifecycle State Machine.
 */

const http = require('http');
const url = require('url');
const subscriptionCtrl = require('./controllers/subscriptionStateController');
const quoteCtrl = require('./controllers/quoteTemplateController');

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
    _code: 200,
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

  // ==========================================
  // SUBSCRIPTION STATE MACHINE ROUTES
  // ==========================================
  if (pathname === '/api/subscriptions/state-machine/definition' && method === 'GET') {
    return subscriptionCtrl.getStateMachineDefinition(req, expressRes);
  }

  if (pathname === '/api/subscriptions' && method === 'GET') {
    return subscriptionCtrl.getAllSubscriptions({ query: parsedUrl.query }, expressRes);
  }

  if (pathname === '/api/subscriptions' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      subscriptionCtrl.createSubscription({ body }, expressRes);
    });
  }

  const stateMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)\/state$/);
  if (stateMatch && method === 'PUT') {
    const id = stateMatch[1];
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      subscriptionCtrl.updateSubscriptionState({ params: { id }, body }, expressRes);
    });
  }

  const getSubMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (getSubMatch && method === 'GET') {
    const id = getSubMatch[1];
    return subscriptionCtrl.getSubscriptionById({ params: { id } }, expressRes);
  }

  // ==========================================
  // QUOTE TEMPLATES ROUTES
  // ==========================================
  if (pathname === '/api/quote-templates/mock-dependencies' && method === 'GET') {
    return quoteCtrl.getMockDependencies({ query: parsedUrl.query }, expressRes);
  }

  if (pathname === '/api/quote-templates/calculate-validity' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      quoteCtrl.calculateValidity({ body }, expressRes);
    });
  }

  if (pathname === '/api/quote-templates' && method === 'GET') {
    return quoteCtrl.getQuoteTemplates({ query: parsedUrl.query }, expressRes);
  }

  if (pathname === '/api/quote-templates' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      quoteCtrl.createQuoteTemplate({ body }, expressRes);
    });
  }

  const match = pathname.match(/^\/api\/quote-templates\/([^/]+)(\/(duplicate|preview-quote))?$/);
  if (match) {
    const id = match[1];
    const subAction = match[3];

    if (subAction === 'duplicate' && method === 'POST') {
      return quoteCtrl.duplicateQuoteTemplate({ params: { id }, expressRes });
    }

    if (subAction === 'preview-quote' && method === 'POST') {
      return readBody((err, body) => {
        if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
        quoteCtrl.previewQuoteFromTemplate({ params: { id }, body }, expressRes);
      });
    }

    if (!subAction) {
      if (method === 'GET') {
        return quoteCtrl.getQuoteTemplateById({ params: { id } }, expressRes);
      }
      if (method === 'PUT') {
        return readBody((err, body) => {
          if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
          quoteCtrl.updateQuoteTemplate({ params: { id }, body }, expressRes);
        });
      }
      if (method === 'DELETE') {
        return quoteCtrl.deleteQuoteTemplate({ params: { id } }, expressRes);
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
    console.log(`🚀 API Server Running on Port ${PORT}`);
    console.log(`📍 Subscriptions Endpoint: http://localhost:${PORT}/api/subscriptions`);
    console.log(`📍 Quote Templates Endpoint: http://localhost:${PORT}/api/quote-templates`);
    console.log(`📦 State Flow: Draft → Quotation → Confirmed → Active → Closed`);
    console.log(`============================================================\n`);
  });
}

module.exports = server;