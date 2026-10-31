const request = require('supertest');
const express = require('express');
const subscriptionRoutes = require('../src/routes/subscriptionRoutes');
const ctrl = require('../src/controllers/subscriptionStateController');

// Build an isolated Express test application mounting the subscription routes
const app = express();
app.use(express.json());
app.use('/api/subscriptions', subscriptionRoutes);

describe('Subscription State Machine — PUT /api/subscriptions/:id/state', () => {
  let testSubscriptionId;

  // Reset the in-memory store and provision a fresh Draft subscription before each test
  beforeEach(async () => {
    ctrl._resetStore();

    // Create a pristine mock subscription in 'Draft' state
    const createRes = await request(app)
      .post('/api/subscriptions')
      .send({
        customer_id: 'usr_123',
        plan_id: 'plan_1',
        grand_total: 8888,
        lines: [
          {
            product_id: 'prod_1',
            product_name: 'Brightloop Enterprise Cloud Server',
            quantity: 5,
            unit_price: 1200,
            price_modifier: 560,
            total_amount: 8888
          }
        ]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('Draft');
    testSubscriptionId = createRes.body.data.id;
  });

  // ==========================================================================
  // SCENARIO 1: THE HAPPY PATH
  // ==========================================================================
  describe('1. The Happy Path (Sequential Progression)', () => {
    test('successfully transitions sequentially through Draft → Quotation → Confirmed → Active with HTTP 200 responses', async () => {
      // Step 1: Draft → Quotation
      const step1 = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Quotation',
          reason: 'Official quotation generated and delivered to customer'
        });

      expect(step1.status).toBe(200);
      expect(step1.body.success).toBe(true);
      expect(step1.body.data.status).toBe('Quotation');
      expect(step1.body.data.next_sequential_state).toBe('Confirmed');
      expect(step1.body.message).toContain('Draft');
      expect(step1.body.message).toContain('Quotation');

      // Step 2: Quotation → Confirmed
      const step2 = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Confirmed',
          reason: 'Customer online signature approved agreement terms'
        });

      expect(step2.status).toBe(200);
      expect(step2.body.success).toBe(true);
      expect(step2.body.data.status).toBe('Confirmed');
      expect(step2.body.data.next_sequential_state).toBe('Active');

      // Step 3: Confirmed → Active
      const step3 = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Active',
          reason: 'Cloud nodes provisioned; live billing activated'
        });

      expect(step3.status).toBe(200);
      expect(step3.body.success).toBe(true);
      expect(step3.body.data.status).toBe('Active');
      expect(step3.body.data.next_sequential_state).toBe('Closed');

      // Step 4: Verify full audit trail history has captured all sequential transitions
      const getRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(getRes.status).toBe(200);
      const history = getRes.body.data.transition_history;

      expect(history.length).toBeGreaterThanOrEqual(4);
      const toStates = history.map((h) => h.to_state);
      expect(toStates).toContain('Draft');
      expect(toStates).toContain('Quotation');
      expect(toStates).toContain('Confirmed');
      expect(toStates).toContain('Active');
    });

    test('case-insensitivity support preserves canonical capitalized state', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'quotation' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Quotation');
    });
  });

  // ==========================================================================
  // SCENARIO 2: INVALID FORWARD SKIPS
  // ==========================================================================
  describe('2. Invalid Forward Skips', () => {
    test('explicitly rejects skipping from Draft directly to Confirmed with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Confirmed',
          reason: 'Attempting to skip Quotation stage'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state transition');
      expect(res.body.message).toMatch(/cannot transition from 'draft' directly to 'confirmed'/i);
      expect(res.body.details.allowed_transitions).toEqual(['Quotation', 'Cancelled']);

      // Ensure state was not modified
      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Draft');
    });

    test('explicitly rejects skipping from Draft directly to Active with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Active',
          reason: 'Attempting illegal jump straight to Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state transition');
      expect(res.body.message).toMatch(/cannot transition from 'draft' directly to 'active'/i);
      expect(res.body.details.current_state).toBe('Draft');
      expect(res.body.details.attempted_state).toBe('Active');

      // Ensure state remains Draft
      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Draft');
    });

    test('explicitly rejects skipping from Draft directly to Closed with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Closed' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state transition');
    });

    test('explicitly rejects skipping from Quotation directly to Active with HTTP 400 Bad Request', async () => {
      // Advance from Draft to Quotation first
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Quotation' });

      // Attempt to jump from Quotation to Active (skipping Confirmed)
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Active' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot transition from 'quotation' directly to 'active'/i);
    });
  });

  // ==========================================================================
  // SCENARIO 3: INVALID BACKWARD JUMPS
  // ==========================================================================
  describe('3. Invalid Backward Jumps', () => {
    beforeEach(async () => {
      // Progress subscription to 'Active' state legitimately
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Quotation' });
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Confirmed' });
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Active' });

      const check = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(check.body.data.status).toBe('Active');
    });

    test('rejects reverting an Active subscription back to Draft to prevent tampering with finalized deals', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Draft',
          reason: 'Illegal attempt to revert active contract back to draft'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state transition');
      expect(res.body.message).toMatch(/cannot transition from 'active' directly to 'draft'/i);

      // Verify the subscription remains strictly Active
      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Active');
    });

    test('rejects reverting an Active subscription back to Quotation', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Quotation',
          reason: 'Illegal attempt to downgrade active subscription to quotation'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot transition from 'active' directly to 'quotation'/i);

      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Active');
    });

    test('rejects reverting an Active subscription back to Confirmed', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Confirmed' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Active');
    });
  });

  // ==========================================================================
  // SCENARIO 4: TERMINAL STATES
  // ==========================================================================
  describe('4. Terminal States (Closed State Locking)', () => {
    beforeEach(async () => {
      // Complete full lifecycle to 'Closed'
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Quotation' });
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Confirmed' });
      await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Active' });
      const closeRes = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Closed', reason: 'Subscription reached end-of-term' });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('Closed');
      expect(closeRes.body.data.allowed_transitions).toEqual([]);
      expect(closeRes.body.data.is_terminal).toBe(true);
    });

    test('permanently locks Closed subscriptions and rejects transition to Active', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({
          state: 'Active',
          reason: 'Attempting to revive a closed subscription'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state transition');
      expect(res.body.message).toMatch(/cannot transition from 'closed' directly to 'active'/i);
      expect(res.body.details.allowed_transitions).toEqual([]);

      // Verify the state remains strictly Closed
      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Closed');
    });

    test('permanently locks Closed subscriptions against any transition (Quotation, Confirmed, Cancelled)', async () => {
      const statesToAttempt = ['Quotation', 'Confirmed', 'Draft', 'Cancelled'];

      for (const target of statesToAttempt) {
        const res = await request(app)
          .put(`/api/subscriptions/${testSubscriptionId}/state`)
          .send({ state: target });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Invalid state transition');
      }

      // Verify state was never changed
      const checkRes = await request(app).get(`/api/subscriptions/${testSubscriptionId}`);
      expect(checkRes.body.data.status).toBe('Closed');
    });
  });

  // ==========================================================================
  // SCENARIO 5: PAYLOAD VALIDATION
  // ==========================================================================
  describe('5. Payload Validation', () => {
    test('returns strict HTTP 400 validation error for unrecognized state string "Pending"', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Pending' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state name');
      expect(res.body.message).toContain("State 'Pending' is not recognized");
      expect(res.body.message).toContain('Draft, Quotation, Confirmed, Active, Closed, Cancelled');
    });

    test('returns strict HTTP 400 validation error for fake/arbitrary state strings like "FakeState"', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'FakeState' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid state name');
      expect(res.body.message).toContain("State 'FakeState' is not recognized");
    });

    test('returns HTTP 400 when body lacks state field entirely', async () => {
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Missing required field');
      expect(res.body.message).toContain('A target state must be provided');
    });

    test('returns HTTP 400 when attempting transition to identical current state', async () => {
      // Current is Draft; request transition to Draft
      const res = await request(app)
        .put(`/api/subscriptions/${testSubscriptionId}/state`)
        .send({ state: 'Draft' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Identical state');
      expect(res.body.message).toContain("already in state 'Draft'");
    });

    test('returns HTTP 404 when targeting a non-existent subscription ID', async () => {
      const res = await request(app)
        .put('/api/subscriptions/sub_non_existent_9999/state')
        .send({ state: 'Quotation' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Subscription not found');
    });
  });
});

