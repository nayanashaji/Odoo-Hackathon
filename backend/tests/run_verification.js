const assert = require('assert');
const jwt = require('jsonwebtoken');
const { calculateDueDate, generateInvoice, fetchAllInvoices, fetchInvoiceById } = require('../src/controllers/invoiceController');
const financeRouter = require('../src/controllers/financeController');
const { subscriptions, invoices, payments } = require('../data/mockData');

console.log('--- Running Invoice & Finance Controller Verification ---');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_jwt_secret';
process.env.JWT_SECRET = JWT_SECRET;

const customerUser = { id: 'usr_cust_123', email: 'cust1@example.com', role: 'customer' };
const otherCustomerUser = { id: 'usr_cust_999', email: 'cust2@example.com', role: 'customer' };
const adminUser = { id: 'usr_admin', email: 'admin@brightloop.io', role: 'admin' };

const customerToken = jwt.sign(customerUser, JWT_SECRET);
const otherCustomerToken = jwt.sign(otherCustomerUser, JWT_SECRET);
const adminToken = jwt.sign(adminUser, JWT_SECRET);

// 1. Verify dynamic due_date calculation
console.log('1. Testing calculateDueDate parsing payment_terms:');
const issueDate = new Date('2026-10-01T00:00:00.000Z');

const net30Date = calculateDueDate(issueDate, 'Net 30');
const net30Diff = Math.round((net30Date - issueDate) / (1000 * 60 * 60 * 24));
assert.strictEqual(net30Diff, 30, 'Net 30 should add exactly 30 days');
console.log('   ✓ Net 30 calculated correctly (+30 days)');

const net15Date = calculateDueDate(issueDate, 'Net 15');
const net15Diff = Math.round((net15Date - issueDate) / (1000 * 60 * 60 * 24));
assert.strictEqual(net15Diff, 15, 'Net 15 should add exactly 15 days');
console.log('   ✓ Net 15 calculated correctly (+15 days)');

const immediateDate = calculateDueDate(issueDate, 'Immediate');
assert.strictEqual(immediateDate.getTime(), issueDate.getTime(), 'Immediate should have 0 days offset');
console.log('   ✓ Immediate calculated correctly (0 days offset)');

const customDate = calculateDueDate(issueDate, '45 days');
const customDiff = Math.round((customDate - issueDate) / (1000 * 60 * 60 * 24));
assert.strictEqual(customDiff, 45, '45 days should add 45 days');
console.log('   ✓ Custom "45 days" parsed correctly (+45 days)');

// 2. Setup mock invoices for customer constraint test
invoices.length = 0;
invoices.push(
  {
    id: 'inv_user_1',
    subscription_id: 'sub_1',
    customer_id: 'usr_cust_123',
    issue_date: '2026-10-01T00:00:00.000Z',
    due_date: '2026-10-31T00:00:00.000Z',
    payment_terms: 'Net 30',
    status: 'Confirmed',
    grand_total: 1000
  },
  {
    id: 'inv_user_2',
    subscription_id: 'sub_2',
    customer_id: 'usr_cust_999',
    issue_date: '2026-10-01T00:00:00.000Z',
    due_date: '2026-10-15T00:00:00.000Z',
    payment_terms: 'Net 15',
    status: 'Confirmed',
    grand_total: 2500
  }
);

// 3. Test customer portal constraint on fetchAllInvoices
console.log('2. Testing customer portal constraint on invoiceController:');
async function testCustomerInvoices() {
  // Test customer fetchAll
  let resStatus = 200;
  let resData = null;
  const mockRes = {
    status(s) { resStatus = s; return this; },
    json(d) { resData = d; return this; }
  };

  await fetchAllInvoices({
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  }, mockRes);

  assert.strictEqual(Array.isArray(resData), true, 'Invoices should be an array');
  assert.strictEqual(resData.length, 1, 'Customer should only see 1 invoice');
  assert.strictEqual(resData[0].id, 'inv_user_1', 'Customer should see only inv_user_1');
  assert.strictEqual(resData[0].customer_id, 'usr_cust_123');
  console.log('   ✓ fetchAllInvoices forcefully filtered by customer_id = req.user.id for customer');

  // Test admin fetchAll
  await fetchAllInvoices({
    user: adminUser,
    get: () => `Bearer ${adminToken}`
  }, mockRes);

  assert.strictEqual(resData.length, 2, 'Admin should see all invoices');
  console.log('   ✓ fetchAllInvoices returns all invoices for admin');

  // Test customer inspecting another customer invoice
  resStatus = 200;
  resData = null;
  await fetchInvoiceById({
    params: { id: 'inv_user_2' },
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  }, mockRes);

  assert.ok([403, 404].includes(resStatus), 'Customer cannot access another customer invoice (expected 403/404)');
  console.log('   ✓ fetchInvoiceById blocks cross-customer invoice access');

  // Test customer inspecting own invoice
  await fetchInvoiceById({
    params: { id: 'inv_user_1' },
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  }, mockRes);

  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resData.id, 'inv_user_1');
  console.log('   ✓ fetchInvoiceById allows customer access to own invoice');

  // 4. Test customer portal constraint on financeController
  console.log('3. Testing customer portal constraint on financeController:');
  
  // Seed mock subscriptions and payments
  subscriptions.length = 0;
  subscriptions.push(
    { id: 'sub_1', customer_id: 'usr_cust_123', status: 'Active', plan: { name: 'Growth', billing_interval: 'Month' } },
    { id: 'sub_2', customer_id: 'usr_cust_999', status: 'Active', plan: { name: 'Scale', billing_interval: 'Month' } }
  );

  payments.length = 0;
  payments.push(
    { id: 'pay_1', customer_id: 'usr_cust_123', amount: 1000, payment_date: new Date().toISOString() },
    { id: 'pay_2', customer_id: 'usr_cust_999', amount: 2500, payment_date: new Date().toISOString() }
  );

  // Helper to invoke Express router route handler directly
  async function invokeRoute(router, method, path, reqObj) {
    const route = router.stack.find(s => s.route && s.route.path === path && s.route.methods[method.toLowerCase()]);
    if (!route) throw new Error(`Route not found: ${method} ${path}`);
    let result = null;
    let statusCode = 200;
    const res = {
      status(s) { statusCode = s; return this; },
      json(d) { result = d; return this; }
    };
    // The last handler in route.route.stack is the controller function
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    await handler(reqObj, res, (err) => { if (err) throw err; });
    return { statusCode, data: result };
  }

  // A. Test GET /summary for customer
  const custSummary = await invokeRoute(financeRouter, 'GET', '/summary', {
    query: { period: 'month' },
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  });
  assert.strictEqual(custSummary.statusCode, 200);
  assert.strictEqual(custSummary.data.metrics.activeSubscriptions, 1, 'Customer should only see 1 active subscription');
  assert.strictEqual(custSummary.data.metrics.revenue, 1000, 'Customer should only see their revenue 1000');
  console.log('   ✓ /api/finance/summary filtered activeSubscriptions and revenue for customer');

  // B. Test GET /summary for admin
  const adminSummary = await invokeRoute(financeRouter, 'GET', '/summary', {
    query: { period: 'month' },
    user: adminUser,
    get: () => `Bearer ${adminToken}`
  });
  assert.strictEqual(adminSummary.data.metrics.activeSubscriptions, 2, 'Admin should see all subscriptions');
  assert.strictEqual(adminSummary.data.metrics.revenue, 3500, 'Admin should see total revenue (1000 + 2500)');
  console.log('   ✓ /api/finance/summary returns all data for admin');

  // C. Test GET /invoices for customer
  const custInvoices = await invokeRoute(financeRouter, 'GET', '/invoices', {
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  });
  assert.strictEqual(custInvoices.data.invoices.length, 1);
  assert.strictEqual(custInvoices.data.invoices[0].id, 'inv_user_1');
  console.log('   ✓ /api/finance/invoices filtered by customer_id for customer');

  // D. Test GET /subscriptions for customer
  const custSubs = await invokeRoute(financeRouter, 'GET', '/subscriptions', {
    user: customerUser,
    get: () => `Bearer ${customerToken}`
  });
  assert.strictEqual(custSubs.data.subscriptions.length, 1);
  assert.strictEqual(custSubs.data.subscriptions[0].id, 'sub_1');
  console.log('   ✓ /api/finance/subscriptions filtered by customer_id for customer');
}

testCustomerInvoices().then(() => {
  console.log('\n--- ALL INVOICE & FINANCE TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
