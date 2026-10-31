const assert = require('assert');
const {
  validateDiscountRule,
  applyDiscountsToInvoice,
  generateInvoice
} = require('../src/controllers/invoiceController');
const { subscriptions, invoices, discounts, products } = require('../data/mockData');

console.log('================================================================');
console.log('RUNNING INVOICE BILLING DAY DISCOUNT RULES VERIFICATION');
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
  const currentDate = new Date('2026-10-31T12:00:00.000Z');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: UNIT VALIDATION OF DISCOUNT CRITERIA
  // --------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Discount Criteria Validation (validateDiscountRule) ---');

  const baseInvoice = {
    id: 'inv_test_1',
    subtotal: 1000.00,
    tax_total: 100.00,
    discount_total: 0,
    grand_total: 1100.00
  };

  // 1.1 Date Window Validation
  console.log('1.1 Testing valid_from and valid_to date window:');
  {
    // A. Valid: Date is within range
    const validRule = {
      id: 'disc_date_valid',
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_to: '2026-11-30T23:59:59.000Z',
      usage_limit: 10,
      times_used: 0,
      minimum_purchase_amount: 500
    };
    const resA = validateDiscountRule(validRule, baseInvoice, currentDate);
    assert.strictEqual(resA.isValid, true, 'Current date within range must be valid');
    console.log('   ✓ Date within [valid_from, valid_to] is valid');

    // B. Invalid: Current date is before valid_from
    const notYetValidRule = {
      id: 'disc_future',
      valid_from: '2026-11-15T00:00:00.000Z',
      valid_to: '2026-12-31T23:59:59.000Z',
      usage_limit: 10,
      times_used: 0
    };
    const resB = validateDiscountRule(notYetValidRule, baseInvoice, currentDate);
    assert.strictEqual(resB.isValid, false, 'Date before valid_from must be rejected');
    assert.ok(resB.reason.includes('not yet valid'));
    console.log('   ✓ Date before valid_from rejected');

    // C. Invalid: Current date is after valid_to (expired)
    const expiredRule = {
      id: 'disc_expired',
      valid_from: '2026-09-01T00:00:00.000Z',
      valid_to: '2026-10-15T23:59:59.000Z',
      usage_limit: 10,
      times_used: 0
    };
    const resC = validateDiscountRule(expiredRule, baseInvoice, currentDate);
    assert.strictEqual(resC.isValid, false, 'Date after valid_to must be rejected as expired');
    assert.ok(resC.reason.includes('expired'));
    console.log('   ✓ Date after valid_to rejected as expired');
  }

  // 1.2 Usage Limit Validation (times_used < usage_limit)
  console.log('1.2 Testing usage_limit and times_used:');
  {
    // A. Valid: times_used is below usage_limit
    const usableRule = {
      id: 'disc_usable',
      usage_limit: 5,
      times_used: 4
    };
    const resA = validateDiscountRule(usableRule, baseInvoice, currentDate);
    assert.strictEqual(resA.isValid, true, 'times_used < usage_limit must be valid');
    console.log('   ✓ times_used (4) < usage_limit (5) is valid');

    // B. Invalid: times_used equals usage_limit
    const maxedRule = {
      id: 'disc_maxed',
      usage_limit: 5,
      times_used: 5
    };
    const resB = validateDiscountRule(maxedRule, baseInvoice, currentDate);
    assert.strictEqual(resB.isValid, false, 'times_used == usage_limit must be rejected');
    assert.ok(resB.reason.includes('Usage limit reached'));
    console.log('   ✓ times_used (5) == usage_limit (5) rejected');

    // C. Invalid: times_used exceeds usage_limit
    const exceededRule = {
      id: 'disc_exceeded',
      usage_limit: 5,
      times_used: 6
    };
    const resC = validateDiscountRule(exceededRule, baseInvoice, currentDate);
    assert.strictEqual(resC.isValid, false, 'times_used > usage_limit must be rejected');
    assert.ok(resC.reason.includes('Usage limit reached'));
    console.log('   ✓ times_used (6) > usage_limit (5) rejected');
  }

  // 1.3 Minimum Purchase Amount Validation
  console.log('1.3 Testing minimum_purchase_amount:');
  {
    // A. Valid: invoice subtotal meets minimum
    const meetRule = {
      id: 'disc_min_meet',
      minimum_purchase_amount: 1000
    };
    const resA = validateDiscountRule(meetRule, baseInvoice, currentDate);
    assert.strictEqual(resA.isValid, true, 'subtotal (1000) >= min (1000) must be valid');
    console.log('   ✓ Invoice subtotal ($1000) >= minimum ($1000) is valid');

    // B. Invalid: invoice subtotal is below minimum
    const unmetRule = {
      id: 'disc_min_unmet',
      minimum_purchase_amount: 1500
    };
    const resB = validateDiscountRule(unmetRule, baseInvoice, currentDate);
    assert.strictEqual(resB.isValid, false, 'subtotal (1000) < min (1500) must be rejected');
    assert.ok(resB.reason.includes('below minimum_purchase_amount'));
    console.log('   ✓ Invoice subtotal ($1000) < minimum ($1500) rejected');
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 2: AUTOMATIC APPLICATION & COUNTER INCREMENT
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Discount Application & times_used Increment ---');

  // 2.1 Percentage Discount tied to customer
  console.log('2.1 Testing percentage discount tied to customer:');
  {
    const customerId = 'usr_vip_cust';
    const subId = 'sub_vip_1';

    // Clear and configure mock discount rule
    discounts.length = 0;
    const rule1 = {
      id: 'disc_cust_10_percent',
      type: 'percentage',
      value: 10, // 10%
      customer_id: customerId,
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_to: '2026-11-30T23:59:59.000Z',
      usage_limit: 10,
      times_used: 2,
      minimum_purchase_amount: 500
    };
    discounts.push(rule1);

    const invoice = {
      id: 'inv_vip_1',
      subscription_id: subId,
      customer_id: customerId,
      subtotal: 2000.00,
      tax_total: 100.00,
      discount_total: 0,
      grand_total: 2100.00
    };

    const sub = { id: subId, customer_id: customerId };

    await applyDiscountsToInvoice(invoice, sub, currentDate);

    // 10% of $2000 = $200 discount
    assert.strictEqual(invoice.discount_total, 200.00, 'discount_total must be 200.00');
    // grand_total = 2000 + 100 - 200 = 1900.00
    assert.strictEqual(invoice.grand_total, 1900.00, 'grand_total must be 1900.00');
    // times_used must increment by 1: from 2 to 3
    assert.strictEqual(rule1.times_used, 3, 'times_used must increment from 2 to 3');
    assert.strictEqual(invoice.applied_discounts.length, 1);
    assert.strictEqual(invoice.applied_discounts[0].discount_amount, 200.00);
    console.log('   ✓ 10% discount applied: discount_total = $200, grand_total = $1900');
    console.log('   ✓ Rule times_used incremented: 2 -> 3');
  }

  // 2.2 Fixed Amount Discount tied to subscription
  console.log('2.2 Testing fixed amount discount tied to subscription:');
  {
    const customerId = 'usr_regular_cust';
    const subId = 'sub_cloud_dedicated';

    discounts.length = 0;
    const rule2 = {
      id: 'disc_sub_fixed_75',
      type: 'fixed',
      value: 75.00, // $75 off
      subscription_id: subId,
      valid_from: '2026-10-15T00:00:00.000Z',
      valid_to: '2026-11-15T23:59:59.000Z',
      usage_limit: 3,
      times_used: 0,
      minimum_purchase_amount: 100
    };
    discounts.push(rule2);

    const invoice = {
      id: 'inv_sub_1',
      subscription_id: subId,
      customer_id: customerId,
      subtotal: 500.00,
      tax_total: 50.00,
      discount_total: 0,
      grand_total: 550.00
    };

    const sub = { id: subId, customer_id: customerId };

    await applyDiscountsToInvoice(invoice, sub, currentDate);

    // $75 fixed discount
    assert.strictEqual(invoice.discount_total, 75.00, 'discount_total must be 75.00');
    // grand_total = 500 + 50 - 75 = 475.00
    assert.strictEqual(invoice.grand_total, 475.00, 'grand_total must be 475.00');
    // times_used must increment from 0 to 1
    assert.strictEqual(rule2.times_used, 1, 'times_used must increment to 1');
    console.log('   ✓ $75 fixed discount applied: discount_total = $75, grand_total = $475');
    console.log('   ✓ Rule times_used incremented: 0 -> 1');
  }

  // 2.3 Multiple Rules & Non-Matching Rule Filtering
  console.log('2.3 Testing discount rule isolation (only rules tied to customer/sub apply):');
  {
    const targetCustId = 'usr_target';
    const otherCustId = 'usr_other';
    const targetSubId = 'sub_target';

    discounts.length = 0;
    // Rule for target customer
    const matchingRule = {
      id: 'disc_match',
      type: 'percentage',
      value: 5, // 5%
      customer_id: targetCustId,
      usage_limit: 10,
      times_used: 0
    };
    // Rule for other customer (must NOT apply)
    const otherRule = {
      id: 'disc_unrelated',
      type: 'fixed',
      value: 500,
      customer_id: otherCustId,
      usage_limit: 10,
      times_used: 0
    };
    discounts.push(matchingRule, otherRule);

    const invoice = {
      id: 'inv_target_1',
      subscription_id: targetSubId,
      customer_id: targetCustId,
      subtotal: 1000.00,
      tax_total: 0,
      discount_total: 0,
      grand_total: 1000.00
    };

    await applyDiscountsToInvoice(invoice, { id: targetSubId, customer_id: targetCustId }, currentDate);

    // Only 5% of 1000 = $50 should be applied
    assert.strictEqual(invoice.discount_total, 50.00);
    assert.strictEqual(invoice.grand_total, 950.00);
    assert.strictEqual(matchingRule.times_used, 1, 'Matching rule times_used incremented');
    assert.strictEqual(otherRule.times_used, 0, 'Unrelated rule times_used must remain 0');
    console.log('   ✓ Unrelated customer discounts are strictly ignored and not incremented');
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 3: END-TO-END generateInvoice CONTROLLER INTEGRATION
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Full generateInvoice Controller Integration ---');
  {
    const testSubId = 'sub_e2e_discount_test';
    const testCustId = 'usr_e2e_cust';

    // Clear and seed test product if needed
    if (!products.find(p => p.id === 'prod_101')) {
      products.push({
        id: 'prod_101',
        sales_price: 1200.00,
        variants: [{ variant_id: 'var_1', price_modifier: 560.00 }]
      });
    }

    // Provision mock subscription
    subscriptions.length = 0;
    subscriptions.push({
      id: testSubId,
      customer_id: testCustId,
      payment_terms: 'Net 30',
      status: 'Active',
      lines: [
        {
          line_id: 'line_1',
          product_id: 'prod_101',
          variant_id: 'var_1',
          quantity: 2,
          unit_price: 1200.00,
          tax_amount: 100.00,
          total_amount: 2500.00
        }
      ]
    });

    // Subtotal = 2 * 1200 = 2400. Tax = 100.
    // Configure matching Admin-created discount rule: 15% discount
    discounts.length = 0;
    const adminRule = {
      id: 'disc_admin_e2e',
      type: 'percentage',
      value: 15, // 15%
      customer_id: testCustId,
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_to: '2026-11-30T23:59:59.000Z',
      usage_limit: 10,
      times_used: 1,
      minimum_purchase_amount: 1000
    };
    discounts.push(adminRule);

    // Reset mock invoices
    invoices.length = 0;

    const req = {
      body: { subscription_id: testSubId },
      user: { id: testCustId, role: 'customer' }
    };
    const res = createMockRes();

    await generateInvoice(req, res);

    assert.strictEqual(res._status, 201);
    const generatedInv = res._data.invoice;

    // Subtotal: $2400. 15% discount: 2400 * 0.15 = $360.
    assert.strictEqual(generatedInv.subtotal, 2400.00);
    assert.strictEqual(generatedInv.tax_total, 100.00);
    assert.strictEqual(generatedInv.discount_total, 360.00, 'discount_total must be 360.00');
    // Grand total: 2400 + 100 - 360 = 2140.00
    assert.strictEqual(generatedInv.grand_total, 2140.00, 'grand_total must be 2140.00');
    // Rule times_used must be incremented from 1 to 2
    assert.strictEqual(adminRule.times_used, 2, 'adminRule times_used must be incremented to 2');
    console.log('   ✓ generateInvoice automatically applied $360 (15%) discount to discount_total');
    console.log('   ✓ generateInvoice correctly calculated grand_total = $2140.00');
    console.log('   ✓ adminRule times_used incremented from 1 to 2');
  }

  console.log('\n================================================================');
  console.log('✅ ALL INVOICE BILLING DAY DISCOUNT TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
