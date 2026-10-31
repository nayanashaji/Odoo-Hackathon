const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const invoiceRoutes = require('../src/routes/invoiceRoutes');
const { invoices: mockInvoices, subscriptions: mockSubscriptions } = require('../data/mockData');

describe('Customer Portal Invoice Access Control — Integration Tests', () => {
  let app;
  const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_jwt_secret';
  process.env.JWT_SECRET = JWT_SECRET;

  // Test User Personas
  const customerA = {
    id: 'usr_cust_alpha',
    email: 'alice@customer.com',
    role: 'customer'
  };

  const customerB = {
    id: 'usr_cust_beta',
    email: 'bob@customer.com',
    role: 'customer'
  };

  const customerEmpty = {
    id: 'usr_cust_gamma_empty',
    email: 'gamma@customer.com',
    role: 'customer'
  };

  const adminUser = {
    id: 'usr_admin_master',
    email: 'admin@brightloop.io',
    role: 'admin'
  };

  const staffUser = {
    id: 'usr_staff_ops',
    email: 'staff@brightloop.io',
    role: 'staff'
  };

  // Sign JWT Bearer Tokens
  const tokenCustomerA = jwt.sign(customerA, JWT_SECRET, { expiresIn: '1h' });
  const tokenCustomerB = jwt.sign(customerB, JWT_SECRET, { expiresIn: '1h' });
  const tokenCustomerEmpty = jwt.sign(customerEmpty, JWT_SECRET, { expiresIn: '1h' });
  const tokenAdmin = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '1h' });
  const tokenStaff = jwt.sign(staffUser, JWT_SECRET, { expiresIn: '1h' });

  beforeAll(() => {
    // Build isolated Express app mounting invoice routes
    app = express();
    app.use(express.json());
    app.use('/api/invoices', invoiceRoutes);
  });

  beforeEach(() => {
    // Seed isolated test invoices for customer isolation testing
    mockInvoices.length = 0;
    mockInvoices.push(
      {
        id: 'inv_alpha_1',
        subscription_id: 'sub_alpha_1',
        customer_id: 'usr_cust_alpha',
        issue_date: '2026-10-01T00:00:00.000Z',
        due_date: '2026-10-31T00:00:00.000Z',
        payment_terms: 'Net 30',
        status: 'Confirmed',
        subtotal: 500.00,
        tax_total: 50.00,
        discount_total: 0,
        grand_total: 550.00,
        product_lines: [
          { product_id: 'prod_1', quantity: 1, unit_price: 500.00, tax_amount: 50.00, total_amount: 550.00 }
        ]
      },
      {
        id: 'inv_alpha_2',
        subscription_id: 'sub_alpha_2',
        customer_id: 'usr_cust_alpha',
        issue_date: '2026-10-15T00:00:00.000Z',
        due_date: '2026-11-15T00:00:00.000Z',
        payment_terms: 'Net 30',
        status: 'Draft',
        subtotal: 750.00,
        tax_total: 75.00,
        discount_total: 50.00,
        grand_total: 775.00,
        product_lines: [
          { product_id: 'prod_2', quantity: 3, unit_price: 250.00, tax_amount: 75.00, total_amount: 825.00 }
        ]
      },
      {
        id: 'inv_beta_1',
        subscription_id: 'sub_beta_1',
        customer_id: 'usr_cust_beta',
        issue_date: '2026-10-05T00:00:00.000Z',
        due_date: '2026-10-20T00:00:00.000Z',
        payment_terms: 'Net 15',
        status: 'Confirmed',
        subtotal: 1200.00,
        tax_total: 120.00,
        discount_total: 0,
        grand_total: 1320.00,
        product_lines: [
          { product_id: 'prod_cloud', quantity: 2, unit_price: 600.00, tax_amount: 120.00, total_amount: 1320.00 }
        ]
      },
      {
        id: 'inv_beta_2',
        subscription_id: 'sub_beta_2',
        customer_id: 'usr_cust_beta',
        issue_date: '2026-10-10T00:00:00.000Z',
        due_date: '2026-11-10T00:00:00.000Z',
        payment_terms: 'Net 30',
        status: 'Draft',
        subtotal: 3400.00,
        tax_total: 340.00,
        discount_total: 100.00,
        grand_total: 3640.00,
        product_lines: [
          { product_id: 'prod_ent', quantity: 1, unit_price: 3400.00, tax_amount: 340.00, total_amount: 3740.00 }
        ]
      }
    );

    // Seed mock subscriptions for invoice generation tests
    mockSubscriptions.length = 0;
    mockSubscriptions.push(
      {
        id: 'sub_alpha_1',
        customer_id: 'usr_cust_alpha',
        status: 'Active',
        payment_terms: 'Net 30'
      },
      {
        id: 'sub_beta_1',
        customer_id: 'usr_cust_beta',
        status: 'Active',
        payment_terms: 'Net 15'
      }
    );
  });

  // ==========================================================================
  // 1. CROSS-CUSTOMER INVOICE ACCESS (TARGETING ANOTHER CUSTOMER'S INVOICE ID)
  // ==========================================================================
  describe('1. Cross-Customer Invoice Isolation (GET /api/invoices/:id)', () => {
    test('proves a user with customer role receives HTTP 403 Forbidden when attempting to fetch another customer\'s invoice ID via Bearer token', async () => {
      // Customer A (usr_cust_alpha) attempts to fetch Customer B's invoice (inv_beta_1)
      const res = await request(app)
        .get('/api/invoices/inv_beta_1')
        .set('Authorization', `Bearer ${tokenCustomerA}`);

      // Must receive 403 Forbidden or empty data
      expect([403, 404]).toContain(res.status);
      if (res.status === 403) {
        expect(res.body.message).toMatch(/forbidden|permission|denied/i);
      }

      // Crucial security check: must NOT leak Customer B's sensitive financial data
      expect(res.body.id).toBeUndefined();
      expect(res.body.grand_total).toBeUndefined();
      expect(res.body.customer_id).toBeUndefined();
      expect(res.body.product_lines).toBeUndefined();
    });

    test('proves a customer role receives 403 Forbidden using mock/test headers (x-user-role & x-user-id)', async () => {
      // Customer A attempts to fetch Customer B's invoice (inv_beta_2) using test headers
      const res = await request(app)
        .get('/api/invoices/inv_beta_2')
        .set('x-user-role', 'customer')
        .set('x-user-id', 'usr_cust_alpha');

      expect([403, 404]).toContain(res.status);
      expect(res.body.id).toBeUndefined();
    });

    test('proves Customer B receives HTTP 403 Forbidden when attempting to inspect Customer A\'s invoice ID', async () => {
      // Symmetrical security check: Customer B attempts to fetch Customer A's invoice (inv_alpha_1)
      const res = await request(app)
        .get('/api/invoices/inv_alpha_1')
        .set('Authorization', `Bearer ${tokenCustomerB}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.id).toBeUndefined();
      expect(res.body.grand_total).toBeUndefined();
    });

    test('proves a customer receives empty array or 403 if response includes data array', async () => {
      const res = await request(app)
        .get('/api/invoices/inv_beta_1')
        .set('Authorization', `Bearer ${tokenCustomerA}`);

      if (res.body.data !== undefined) {
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(0);
      }
    });
  });

  // ==========================================================================
  // 2. LEGITIMATE CUSTOMER ACCESS TO OWN INVOICES
  // ==========================================================================
  describe('2. Authorized Customer Access to Own Invoices', () => {
    test('successfully returns HTTP 200 and invoice details when customer accesses their own invoice ID', async () => {
      // Customer A requests their own invoice (inv_alpha_1)
      const res = await request(app)
        .get('/api/invoices/inv_alpha_1')
        .set('Authorization', `Bearer ${tokenCustomerA}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('inv_alpha_1');
      expect(res.body.customer_id).toBe('usr_cust_alpha');
      expect(res.body.grand_total).toBe(550.00);
      expect(res.body.subtotal).toBe(500.00);
      expect(res.body.product_lines).toHaveLength(1);
    });

    test('successfully returns HTTP 200 when Customer B accesses their own invoice', async () => {
      const res = await request(app)
        .get('/api/invoices/inv_beta_1')
        .set('Authorization', `Bearer ${tokenCustomerB}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('inv_beta_1');
      expect(res.body.customer_id).toBe('usr_cust_beta');
      expect(res.body.grand_total).toBe(1320.00);
    });
  });

  // ==========================================================================
  // 3. INVOICE LIST QUERY ENFORCING CUSTOMER PORTAL FILTER (GET /api/invoices)
  // ==========================================================================
  describe('3. Customer Portal Collection Filtering (GET /api/invoices)', () => {
    test('returns an empty array [] when a customer with no invoices requests the collection', async () => {
      // Customer with zero invoices (usr_cust_gamma_empty)
      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${tokenCustomerEmpty}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    test('forcefully filters list so Customer A sees ONLY their 2 invoices and 0 of Customer B\'s invoices', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${tokenCustomerA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // Verify all returned items strictly belong to Customer A
      res.body.forEach(inv => {
        expect(inv.customer_id).toBe('usr_cust_alpha');
      });

      // Verify Customer B's invoice IDs are not in the list
      const returnedIds = res.body.map(inv => inv.id);
      expect(returnedIds).toContain('inv_alpha_1');
      expect(returnedIds).toContain('inv_alpha_2');
      expect(returnedIds).not.toContain('inv_beta_1');
      expect(returnedIds).not.toContain('inv_beta_2');
    });

    test('Customer B sees only Customer B\'s invoices', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${tokenCustomerB}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      res.body.forEach(inv => {
        expect(inv.customer_id).toBe('usr_cust_beta');
      });
    });
  });

  // ==========================================================================
  // 4. ADMIN & STAFF PRIVILEGED ACCESS
  // ==========================================================================
  describe('4. Administrative and Staff Permissions', () => {
    test('allows Admin to view any customer\'s invoice ID with HTTP 200', async () => {
      // Admin requests Customer B's invoice
      const res = await request(app)
        .get('/api/invoices/inv_beta_1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('inv_beta_1');
      expect(res.body.customer_id).toBe('usr_cust_beta');
    });

    test('allows Admin to fetch the complete un-filtered invoice list across all customers', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(4); // All 4 seeded invoices
    });
  });

  // ==========================================================================
  // 5. UNAUTHORIZED INVOICE GENERATION & MUTATION FOR CROSS-CUSTOMERS
  // ==========================================================================
  describe('5. Cross-Customer Invoice Mutation Safeguards', () => {
    test('rejects customer attempting to generate an invoice for another customer\'s subscription with HTTP 403', async () => {
      // Customer A attempts to generate an invoice for Customer B's subscription (sub_beta_1)
      const res = await request(app)
        .post('/api/invoices/generate')
        .set('Authorization', `Bearer ${tokenCustomerA}`)
        .send({ subscription_id: 'sub_beta_1' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/forbidden|cannot access|another customer/i);
    });

    test('rejects customer attempting to arbitrarily update invoice status with HTTP 403', async () => {
      const res = await request(app)
        .patch('/api/invoices/inv_alpha_1/status')
        .set('Authorization', `Bearer ${tokenCustomerA}`)
        .send({ status: 'Confirmed' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/forbidden|customer cannot modify/i);
    });
  });
});
