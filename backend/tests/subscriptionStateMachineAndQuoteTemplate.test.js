const assert = require('assert');
const subscriptionCtrl = require('../src/controllers/subscriptionStateController');
const planCtrl = require('../src/controllers/planController');
const quoteCtrl = require('../src/controllers/quoteTemplateController');

console.log('================================================================');
console.log('RUNNING SUBSCRIPTION STATE MACHINE & QUOTE TEMPLATE VERIFICATION');
console.log('================================================================\n');

// Mock Express response helper
function createMockRes() {
  return {
    _status: 200,
    _data: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._data = data;
      return this;
    }
  };
}

async function runTests() {
  // Reset in-memory stores
  subscriptionCtrl._resetStore();
  quoteCtrl._resetQuotesStore();

  // --------------------------------------------------------------------------
  // TEST SUITE 1: SUBSCRIPTION STATE MACHINE (DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED)
  // --------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Subscription State Machine Strict Transitions ---');

  // 1.1 Initial State Creation: Must start in Draft
  console.log('1.1 Testing subscription creation:');
  {
    const res = createMockRes();
    await subscriptionCtrl.createSubscription({
      body: {
        customer_id: 'usr_123',
        plan_id: 'plan_1',
        grand_total: 8888
      }
    }, res);
    assert.strictEqual(res._status, 201);
    assert.strictEqual(res._data.data.status, 'Draft');
    console.log('   ✓ Subscription created in "Draft" state');
  }

  // 1.2 Creation Rejection: Cannot create directly in Active/Confirmed/Closed state
  {
    const res = createMockRes();
    await subscriptionCtrl.createSubscription({
      body: {
        customer_id: 'usr_123',
        status: 'Active'
      }
    }, res);
    assert.strictEqual(res._status, 400, 'Creation in Active state must be rejected');
    assert.strictEqual(res._data.success, false);
    assert.strictEqual(res._data.error, 'Invalid initial state');
    console.log('   ✓ Rejects creating subscription directly in "Active" state');
  }

  // 1.3 Sequential Progression: Happy Path
  console.log('1.2 Testing sequential progression (Draft -> Quotation -> Confirmed -> Active -> Closed):');
  let subId;
  {
    const res = createMockRes();
    await subscriptionCtrl.createSubscription({
      body: { customer_id: 'usr_123', grand_total: 5000 }
    }, res);
    subId = res._data.data.id;

    // Step 1: Draft -> Quotation
    const step1 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: subId },
      body: { state: 'Quotation' }
    }, step1);
    assert.strictEqual(step1._status, 200);
    assert.strictEqual(step1._data.data.status, 'Quotation');
    console.log('   ✓ Draft -> Quotation successful (200)');

    // Step 2: Quotation -> Confirmed
    const step2 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: subId },
      body: { state: 'Confirmed' }
    }, step2);
    assert.strictEqual(step2._status, 200);
    assert.strictEqual(step2._data.data.status, 'Confirmed');
    console.log('   ✓ Quotation -> Confirmed successful (200)');

    // Step 3: Confirmed -> Active
    const step3 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: subId },
      body: { state: 'Active' }
    }, step3);
    assert.strictEqual(step3._status, 200);
    assert.strictEqual(step3._data.data.status, 'Active');
    console.log('   ✓ Confirmed -> Active successful (200)');

    // Step 4: Active -> Closed
    const step4 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: subId },
      body: { state: 'Closed' }
    }, step4);
    assert.strictEqual(step4._status, 200);
    assert.strictEqual(step4._data.data.status, 'Closed');
    assert.strictEqual(step4._data.data.is_terminal, true);
    console.log('   ✓ Active -> Closed successful (200, terminal)');
  }

  // 1.4 Rejection of Invalid Forward Skips
  console.log('1.3 Testing rejection of invalid skips:');
  {
    // Fresh Draft subscription
    const createRes = createMockRes();
    await subscriptionCtrl.createSubscription({ body: { customer_id: 'usr_123' } }, createRes);
    const testId = createRes._data.data.id;

    // Skip 1: Draft -> Confirmed (Skipping Quotation)
    const skip1 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Confirmed' }
    }, skip1);
    assert.strictEqual(skip1._status, 400);
    assert.strictEqual(skip1._data.error, 'Invalid state transition');
    console.log('   ✓ Draft -> Confirmed skip rejected with HTTP 400');

    // Skip 2: Draft -> Active (Skipping Quotation & Confirmed)
    const skip2 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Active' }
    }, skip2);
    assert.strictEqual(skip2._status, 400);
    assert.strictEqual(skip2._data.error, 'Invalid state transition');
    console.log('   ✓ Draft -> Active skip rejected with HTTP 400');

    // Skip 3: Draft -> Closed (Skipping all intermediate states)
    const skip3 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Closed' }
    }, skip3);
    assert.strictEqual(skip3._status, 400);
    assert.strictEqual(skip3._data.error, 'Invalid state transition');
    console.log('   ✓ Draft -> Closed skip rejected with HTTP 400');

    // Advance to Quotation
    const advanceQuotation = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Quotation' }
    }, advanceQuotation);
    assert.strictEqual(advanceQuotation._status, 200);

    // Skip 4: Quotation -> Active (Skipping Confirmed)
    const skip4 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Active' }
    }, skip4);
    assert.strictEqual(skip4._status, 400);
    assert.strictEqual(skip4._data.error, 'Invalid state transition');
    console.log('   ✓ Quotation -> Active skip rejected with HTTP 400');

    // Skip 5: Quotation -> Closed (Skipping Confirmed & Active)
    const skip5 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Closed' }
    }, skip5);
    assert.strictEqual(skip5._status, 400);
    assert.strictEqual(skip5._data.error, 'Invalid state transition');
    console.log('   ✓ Quotation -> Closed skip rejected with HTTP 400');

    // Advance to Confirmed
    const advanceConfirmed = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Confirmed' }
    }, advanceConfirmed);
    assert.strictEqual(advanceConfirmed._status, 200);

    // Skip 6: Confirmed -> Closed (Skipping Active)
    const skip6 = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: testId },
      body: { state: 'Closed' }
    }, skip6);
    assert.strictEqual(skip6._status, 400);
    assert.strictEqual(skip6._data.error, 'Invalid state transition');
    console.log('   ✓ Confirmed -> Closed skip rejected with HTTP 400');
  }

  // 1.5 Terminal State Locking: Once Closed, no further transitions permitted
  console.log('1.4 Testing terminal state locking on Closed subscriptions:');
  {
    // subId is currently in 'Closed' state
    for (const target of ['Active', 'Confirmed', 'Quotation', 'Draft', 'Cancelled']) {
      const res = createMockRes();
      await subscriptionCtrl.updateSubscriptionState({
        params: { id: subId },
        body: { state: target }
      }, res);
      assert.strictEqual(res._status, 400, `Closed -> ${target} must be rejected`);
      assert.strictEqual(res._data.error, 'Invalid state transition');
    }
    console.log('   ✓ Closed subscription permanently locked against all further transitions');
  }

  // 1.6 Verification through planController delegation
  console.log('1.5 Testing planController delegation exports:');
  {
    assert.strictEqual(typeof planCtrl.updateSubscriptionState, 'function');
    assert.strictEqual(typeof planCtrl.createSubscription, 'function');
    assert.strictEqual(typeof planCtrl.validateStateTransition, 'function');
    assert.strictEqual(planCtrl.validateStateTransition('Draft', 'Active'), false);
    assert.strictEqual(planCtrl.validateStateTransition('Draft', 'Quotation'), true);
    assert.strictEqual(planCtrl.validateStateTransition('Quotation', 'Confirmed'), true);
    assert.strictEqual(planCtrl.validateStateTransition('Confirmed', 'Active'), true);
    assert.strictEqual(planCtrl.validateStateTransition('Active', 'Closed'), true);
    assert.strictEqual(planCtrl.validateStateTransition('Closed', 'Active'), false);
    console.log('   ✓ planController exposes matching state machine transition validation');
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 2: QUOTATION TEMPLATE CONSTRAINTS & VALIDITY PERIOD ENFORCEMENT
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Quotation Template Constraints (e.g. 14 Days) ---');

  // 2.1 Dynamic Expiration Date Calculation (14 days)
  console.log('2.1 Testing validity calculation for 14-day template:');
  {
    const baseDate = new Date('2026-10-01T00:00:00.000Z');
    const validity = quoteCtrl.computeValidityDetails(14, 'days', baseDate);

    assert.strictEqual(validity.validity_duration, 14);
    assert.strictEqual(validity.validity_unit, 'days');
    assert.strictEqual(validity.quotation_date, '2026-10-01T00:00:00.000Z');
    assert.strictEqual(validity.expiration_date, '2026-10-15T00:00:00.000Z');
    console.log('   ✓ computeValidityDetails adds exactly 14 days to base date');
  }

  // 2.2 Preview Quote From Template Respects 14-Day Validity
  console.log('2.2 Testing previewQuoteFromTemplate with 14-day template (tmpl_14_days):');
  {
    const res = createMockRes();
    await quoteCtrl.previewQuoteFromTemplate({
      params: { id: 'tmpl_14_days' },
      body: { quotation_date: '2026-10-01T00:00:00.000Z' }
    }, res);

    assert.strictEqual(res._status, 200);
    const quote = res._data.data;
    assert.strictEqual(quote.template_id, 'tmpl_14_days');
    assert.strictEqual(quote.validity_period_days, 14);
    assert.strictEqual(quote.order_date, '2026-10-01T00:00:00.000Z');
    assert.strictEqual(quote.expiration_date, '2026-10-15T00:00:00.000Z');
    console.log('   ✓ Preview quote generated with strictly enforced 14-day expiration date');
  }

  // 2.3 Generate Quote From Template Strictly Respects Template Validity Duration
  console.log('2.3 Testing generateQuoteFromTemplate:');
  {
    const res = createMockRes();
    const issueDate = new Date();
    await quoteCtrl.generateQuoteFromTemplate({
      params: { id: 'tmpl_14_days' },
      body: {
        customer_id: 'usr_123',
        quotation_date: issueDate.toISOString()
      }
    }, res);

    assert.strictEqual(res._status, 201);
    const genQuote = res._data.data;
    assert.strictEqual(genQuote.status, 'Quotation');
    assert.strictEqual(genQuote.validity_duration, 14);
    assert.strictEqual(genQuote.validity_unit, 'days');

    const expectedExp = new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const actualExp = new Date(genQuote.expiration_date);
    const diffHours = Math.abs(actualExp - expectedExp) / (1000 * 60 * 60);
    assert.ok(diffHours < 1, 'Expiration date must be 14 days from issue date');
    console.log('   ✓ Generated quote strictly reflects template 14-day validity');
  }

  // 2.4 Rejection of Client Tampering With Validity Period
  console.log('2.4 Testing rejection of client override attempting to bypass 14-day validity:');
  {
    const res = createMockRes();
    const issueDate = new Date('2026-10-01T00:00:00.000Z');
    const illegalExpiration = new Date('2026-11-30T00:00:00.000Z'); // Client tries 60 days instead of 14

    await quoteCtrl.generateQuoteFromTemplate({
      params: { id: 'tmpl_14_days' },
      body: {
        customer_id: 'usr_123',
        quotation_date: issueDate.toISOString(),
        expiration_date: illegalExpiration.toISOString()
      }
    }, res);

    assert.strictEqual(res._status, 400);
    assert.strictEqual(res._data.success, false);
    assert.strictEqual(res._data.error, 'Validity period constraint violation');
    console.log('   ✓ Attempt to expand validity period beyond template 14 days rejected with HTTP 400');
  }

  // 2.5 Expired Quotation Cannot Transition to Confirmed
  console.log('2.5 Testing expired quotation cannot transition Quotation -> Confirmed:');
  {
    // Create a subscription with an expired quotation date (e.g. 30 days ago with 14-day validity)
    const oldIssueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expDate = new Date(oldIssueDate.getTime() + 14 * 24 * 60 * 60 * 1000); // Expired 16 days ago

    const createRes = createMockRes();
    await subscriptionCtrl.createSubscription({ body: { customer_id: 'usr_123' } }, createRes);
    const expiredSubId = createRes._data.data.id;

    // Advance to Quotation
    const advRes = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: expiredSubId },
      body: { state: 'Quotation' }
    }, advRes);
    assert.strictEqual(advRes._status, 200);

    // Attach expired quotation date
    const sub = subscriptionCtrl.enrichSubscription
      ? subscriptionCtrl._getStore().find(s => s.id === expiredSubId)
      : null;
    if (sub) {
      sub.expiration_date = expDate.toISOString();
      sub.validity_duration = 14;
    }

    // Attempt to Confirm expired quotation
    const confirmRes = createMockRes();
    await subscriptionCtrl.updateSubscriptionState({
      params: { id: expiredSubId },
      body: { state: 'Confirmed' }
    }, confirmRes);

    assert.strictEqual(confirmRes._status, 400);
    assert.strictEqual(confirmRes._data.error, 'Quotation expired');
    console.log('   ✓ Expired quotation transition to "Confirmed" rejected with HTTP 400');
  }

  console.log('\n================================================================');
  console.log('✅ ALL SUBSCRIPTION STATE MACHINE & QUOTE TEMPLATE TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
