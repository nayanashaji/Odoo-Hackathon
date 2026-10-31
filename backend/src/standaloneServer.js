/**
 * Standalone API Server for Subscription Lifecycle & State Machine
 * Runs with Node.js built-in HTTP module (zero dependencies).
 * Fully handles PUT /api/subscriptions/:id/state and rejects invalid jumps.
 */

const http = require('http');
const url = require('url');
const ctrl = require('./controllers/subscriptionStateController');

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

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

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

  // State Machine Definition endpoint
  if (pathname === '/api/subscriptions/state-machine/definition' && method === 'GET') {
    return ctrl.getStateMachineDefinition(req, expressRes);
  }

  // GET /api/subscriptions
  if (pathname === '/api/subscriptions' && method === 'GET') {
    return ctrl.getAllSubscriptions({ query: parsedUrl.query }, expressRes);
  }

  // POST /api/subscriptions
  if (pathname === '/api/subscriptions' && method === 'POST') {
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      ctrl.createSubscription({ body }, expressRes);
    });
  }

  // PUT /api/subscriptions/:id/state
  const stateMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)\/state$/);
  if (stateMatch && method === 'PUT') {
    const id = stateMatch[1];
    return readBody((err, body) => {
      if (err) return expressRes.status(400).json({ success: false, error: 'Invalid JSON body' });
      ctrl.updateSubscriptionState({ params: { id }, body }, expressRes);
    });
  }

  // GET /api/subscriptions/:id
  const getSubMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (getSubMatch && method === 'GET') {
    const id = getSubMatch[1];
    return ctrl.getSubscriptionById({ params: { id } }, expressRes);
  }

  // 404
  return expressRes.status(404).json({
    success: false,
    error: `Route not found: ${method} ${pathname}`
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Subscription Lifecycle Engine Running on Port ${PORT}`);
    console.log(`📍 State Transition Endpoint: PUT http://localhost:${PORT}/api/subscriptions/:id/state`);
    console.log(`📦 State Flow: Draft → Quotation → Confirmed → Active → Closed`);
    console.log(`📦 Mock Customer: usr_123 (Claire Dupont) | Mock Product: prod_1`);
    console.log(`============================================================\n`);
  });
}

module.exports = server;

