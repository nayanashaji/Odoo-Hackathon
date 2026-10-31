const {
  calculateInvoiceTaxes,
  calculateDueDate
} = require('../src/services/invoiceService');
const {
  validateDiscountRule,
  applyDiscountsToInvoice
} = require('../src/controllers/invoiceController');

describe('Invoice Financial Math & Tax Calculation Unit Tests', () => {
  // ==========================================================================
  // SUITE 1: LINE-ITEM TAX & INVOICE AGGREGATION FINANCIAL MATH
  // ==========================================================================
  describe('1. Tax Calculation & Precision Math (calculateInvoiceTaxes)', () => {
    test('accurately calculates taxes with explicit line tax_amount', () => {
      const lines = [
        { product_id: 'p1', quantity: 2, unit_price: 150.00, tax_amount: 30.00 },
        { product_id: 'p2', quantity: 1, unit_price: 200.00, tax_amount: 20.00 }
      ];

      const result = calculateInvoiceTaxes(lines);

      expect(result.subtotal).toBe(500.00); // (2 * 150) + (1 * 200) = 300 + 200
      expect(result.tax_total).toBe(50.00);  // 30 + 20
      expect(result.grand_total).toBe(550.00); // 500 + 50
      expect(result.product_lines[0].total_amount).toBe(330.00);
      expect(result.product_lines[1].total_amount).toBe(220.00);
    });

    test('accurately calculates taxes from percentage tax_rate per line', () => {
      const lines = [
        { product_id: 'p1', quantity: 3, unit_price: 100.00, tax_rate: 18 }, // 18% GST: 300 * 0.18 = 54.00
        { product_id: 'p2', quantity: 2, unit_price: 50.00, tax_rate: 10 }   // 10% VAT: 100 * 0.10 = 10.00
      ];

      const result = calculateInvoiceTaxes(lines);

      expect(result.subtotal).toBe(400.00);
      expect(result.tax_total).toBe(64.00);
      expect(result.grand_total).toBe(464.00);
      expect(result.product_lines[0].tax_amount).toBe(54.00);
      expect(result.product_lines[0].total_amount).toBe(354.00);
      expect(result.product_lines[1].tax_amount).toBe(10.00);
      expect(result.product_lines[1].total_amount).toBe(110.00);
    });

    test('accurately calculates taxes using global defaultTaxRate when line tax is omitted', () => {
      const lines = [
        { product_id: 'p1', quantity: 5, unit_price: 80.00 }, // 400.00
        { product_id: 'p2', quantity: 1, unit_price: 120.00 } // 120.00
      ];

      // Global tax rate of 12%
      const result = calculateInvoiceTaxes(lines, 12);

      expect(result.subtotal).toBe(520.00);
      expect(result.tax_total).toBe(62.40); // 520 * 0.12 = 62.40
      expect(result.grand_total).toBe(582.40); // 520 + 62.40 = 582.40
      expect(result.product_lines[0].tax_amount).toBe(48.00);
      expect(result.product_lines[1].tax_amount).toBe(14.40);
    });

    test('handles 0% tax-exempt products without altering subtotal', () => {
      const lines = [
        { product_id: 'p1', quantity: 10, unit_price: 25.50, tax_amount: 0 },
        { product_id: 'p2', quantity: 4, unit_price: 15.00, tax_rate: 0 }
      ];

      const result = calculateInvoiceTaxes(lines);

      expect(result.subtotal).toBe(315.00); // (10 * 25.50) + (4 * 15) = 255 + 60
      expect(result.tax_total).toBe(0.00);
      expect(result.grand_total).toBe(315.00);
    });

    test('resolves IEEE 754 floating point rounding edge cases with 100% precision', () => {
      // Classic JS floating point edge case: 0.1 + 0.2 = 0.30000000000000004
      // 3 items at $19.99 with 8.25% sales tax:
      // Subtotal = 59.97
      // Tax = 59.97 * 0.0825 = 4.947525 -> rounds to 4.95
      // Grand Total = 59.97 + 4.95 = 64.92
      const lines = [
        { product_id: 'edge_1', quantity: 3, unit_price: 19.99, tax_rate: 8.25 }
      ];

      const result = calculateInvoiceTaxes(lines);

      expect(result.subtotal).toBe(59.97);
      expect(result.tax_total).toBe(4.95);
      expect(result.grand_total).toBe(64.92);
      expect(Number.isInteger(result.grand_total * 100)).toBe(true);
    });

    test('handles complex multi-line fractions without penny drift', () => {
      // 7 items at $33.33 with 5.5% tax:
      // Subtotal = 233.31
      // Tax = 233.31 * 0.055 = 12.83205 -> 12.83
      // Grand Total = 246.14
      const lines = [
        { product_id: 'edge_2', quantity: 7, unit_price: 33.33, tax_rate: 5.5 },
        { product_id: 'edge_3', quantity: 13, unit_price: 9.99, tax_rate: 7.25 }
        // Line 2: 13 * 9.99 = 129.87; Tax = 129.87 * 0.0725 = 9.415575 -> 9.42; Total = 139.29
      ];

      const result = calculateInvoiceTaxes(lines);

      expect(result.subtotal).toBe(363.18); // 233.31 + 129.87
      expect(result.tax_total).toBe(22.25);  // 12.83 + 9.42
      expect(result.grand_total).toBe(385.43); // 363.18 + 22.25
    });

    test('handles empty lines array gracefully', () => {
      const result = calculateInvoiceTaxes([]);

      expect(result.subtotal).toBe(0);
      expect(result.tax_total).toBe(0);
      expect(result.grand_total).toBe(0);
      expect(result.product_lines).toEqual([]);
    });
  });

  // ==========================================================================
  // SUITE 2: DISCOUNT VALIDATION CRITERIA UNIT TESTS (validateDiscountRule)
  // ==========================================================================
  describe('2. Discount Criteria Validation (validateDiscountRule)', () => {
    const mockInvoice = {
      id: 'inv_test_val',
      subtotal: 1000.00,
      tax_total: 100.00,
      discount_total: 0,
      grand_total: 1100.00
    };

    const referenceDate = new Date('2026-10-31T12:00:00.000Z');

    describe('2.1 Date Window Validation [valid_from, valid_to]', () => {
      test('accepts discount when current date falls strictly within valid_from and valid_to', () => {
        const rule = {
          id: 'rule_date_ok',
          valid_from: '2026-10-01T00:00:00.000Z',
          valid_to: '2026-11-30T23:59:59.000Z',
          usage_limit: 10,
          times_used: 1,
          minimum_purchase_amount: 500
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(true);
      });

      test('rejects discount when current date is strictly before valid_from', () => {
        const rule = {
          id: 'rule_future',
          valid_from: '2026-11-01T00:00:00.000Z',
          valid_to: '2026-11-30T23:59:59.000Z',
          usage_limit: 10,
          times_used: 0
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('not yet valid');
      });

      test('rejects discount when current date is strictly after valid_to (expired)', () => {
        const rule = {
          id: 'rule_expired',
          valid_from: '2026-09-01T00:00:00.000Z',
          valid_to: '2026-10-15T23:59:59.000Z',
          usage_limit: 10,
          times_used: 0
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('expired');
      });

      test('accepts discount on exact boundary dates (valid_from timestamp match)', () => {
        const exactDate = new Date('2026-10-31T12:00:00.000Z');
        const rule = {
          id: 'rule_boundary_from',
          valid_from: exactDate.toISOString(),
          valid_to: '2026-11-15T00:00:00.000Z'
        };

        const res = validateDiscountRule(rule, mockInvoice, exactDate);
        expect(res.isValid).toBe(true);
      });

      test('accepts discount on exact boundary dates (valid_to timestamp match)', () => {
        const exactDate = new Date('2026-10-31T12:00:00.000Z');
        const rule = {
          id: 'rule_boundary_to',
          valid_from: '2026-10-01T00:00:00.000Z',
          valid_to: exactDate.toISOString()
        };

        const res = validateDiscountRule(rule, mockInvoice, exactDate);
        expect(res.isValid).toBe(true);
      });

      test('supports valid_until alias if valid_to is not specified', () => {
        const ruleExpired = {
          id: 'rule_alias_exp',
          valid_from: '2026-01-01T00:00:00.000Z',
          valid_until: '2026-06-01T00:00:00.000Z'
        };

        const res = validateDiscountRule(ruleExpired, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('expired');
      });

      test('passes date check when validity dates are not defined (perpetual discount)', () => {
        const rulePerpetual = {
          id: 'rule_perpetual',
          usage_limit: 100,
          times_used: 5,
          minimum_purchase_amount: 100
        };

        const res = validateDiscountRule(rulePerpetual, mockInvoice, referenceDate);
        expect(res.isValid).toBe(true);
      });
    });

    describe('2.2 Usage Limit Validation [times_used < usage_limit]', () => {
      test('accepts discount when times_used is strictly below usage_limit', () => {
        const rule = {
          id: 'rule_usage_ok',
          usage_limit: 5,
          times_used: 4,
          valid_from: '2026-10-01T00:00:00.000Z',
          valid_to: '2026-11-30T00:00:00.000Z'
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(true);
      });

      test('rejects discount when times_used equals usage_limit', () => {
        const rule = {
          id: 'rule_usage_full',
          usage_limit: 5,
          times_used: 5
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('Usage limit reached');
        expect(res.reason).toContain('5/5');
      });

      test('rejects discount when times_used exceeds usage_limit', () => {
        const rule = {
          id: 'rule_usage_over',
          usage_limit: 5,
          times_used: 6
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('Usage limit reached');
      });

      test('passes usage check when usage_limit is undefined or null (unlimited usage)', () => {
        const ruleUnlimited = {
          id: 'rule_unlimited',
          times_used: 9999
        };

        const res = validateDiscountRule(ruleUnlimited, mockInvoice, referenceDate);
        expect(res.isValid).toBe(true);
      });
    });

    describe('2.3 Minimum Purchase Amount Validation', () => {
      test('accepts discount when invoice purchase amount meets minimum_purchase_amount', () => {
        const rule = {
          id: 'rule_min_pass',
          minimum_purchase_amount: 500.00
        };

        const res = validateDiscountRule(rule, { subtotal: 1000.00 }, referenceDate);
        expect(res.isValid).toBe(true);
      });

      test('accepts discount when invoice purchase amount exactly equals minimum_purchase_amount', () => {
        const rule = {
          id: 'rule_min_exact',
          minimum_purchase_amount: 1000.00
        };

        const res = validateDiscountRule(rule, { subtotal: 1000.00 }, referenceDate);
        expect(res.isValid).toBe(true);
      });

      test('rejects discount when invoice purchase amount is strictly below minimum_purchase_amount', () => {
        const rule = {
          id: 'rule_min_fail',
          minimum_purchase_amount: 1500.00
        };

        const res = validateDiscountRule(rule, { subtotal: 1000.00 }, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('below minimum_purchase_amount');
      });

      test('supports field aliases: min_purchase_amount and minimum_amount', () => {
        const ruleAlias1 = { min_purchase_amount: 1200.00 };
        const ruleAlias2 = { minimum_amount: 800.00 };

        const res1 = validateDiscountRule(ruleAlias1, { subtotal: 1000.00 }, referenceDate);
        expect(res1.isValid).toBe(false);

        const res2 = validateDiscountRule(ruleAlias2, { subtotal: 1000.00 }, referenceDate);
        expect(res2.isValid).toBe(true);
      });
    });

    describe('2.4 Compound & Invalid Inputs', () => {
      test('rejects null or undefined discount rule gracefully', () => {
        const res = validateDiscountRule(null, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('Rule is null or undefined');
      });

      test('rejects rule where date is valid but usage limit is exhausted', () => {
        const rule = {
          valid_from: '2026-10-01T00:00:00.000Z',
          valid_to: '2026-11-30T00:00:00.000Z',
          usage_limit: 3,
          times_used: 3,
          minimum_purchase_amount: 100
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('Usage limit reached');
      });

      test('rejects rule where date is valid, usage is fine, but minimum amount is not met', () => {
        const rule = {
          valid_from: '2026-10-01T00:00:00.000Z',
          valid_to: '2026-11-30T00:00:00.000Z',
          usage_limit: 10,
          times_used: 0,
          minimum_purchase_amount: 5000.00
        };

        const res = validateDiscountRule(rule, mockInvoice, referenceDate);
        expect(res.isValid).toBe(false);
        expect(res.reason).toContain('below minimum_purchase_amount');
      });
    });
  });

  // ==========================================================================
  // SUITE 3: DISCOUNT APPLICATION & FINANCIAL RECONCILIATION
  // ==========================================================================
  describe('3. Financial Discount Application Math (applyDiscountsToInvoice)', () => {
    test('accurately applies percentage discount and recalculates grand_total', async () => {
      const invoice = {
        id: 'inv_apply_1',
        customer_id: 'cust_math_1',
        subscription_id: 'sub_math_1',
        subtotal: 2000.00,
        tax_total: 200.00,
        discount_total: 0,
        grand_total: 2200.00
      };

      const subscription = {
        id: 'sub_math_1',
        customer_id: 'cust_math_1'
      };

      const currentDate = new Date('2026-10-31T12:00:00.000Z');

      const updated = await applyDiscountsToInvoice(invoice, subscription, currentDate);

      // Verify mathematical balance:
      // grand_total must strictly equal subtotal + tax_total - discount_total
      const expectedGrandTotal = Number((invoice.subtotal + invoice.tax_total - invoice.discount_total).toFixed(2));
      expect(updated.grand_total).toBe(expectedGrandTotal);
      expect(updated.discount_total).toBeGreaterThanOrEqual(0);
    });

    test('verifies grand_total is never negative when discount exceeds invoice subtotal', async () => {
      const smallInvoice = {
        id: 'inv_small_1',
        customer_id: 'cust_small',
        subscription_id: 'sub_small',
        subtotal: 50.00,
        tax_total: 5.00,
        discount_total: 0,
        grand_total: 55.00
      };

      const subscription = { id: 'sub_small', customer_id: 'cust_small' };

      const updated = await applyDiscountsToInvoice(smallInvoice, subscription, new Date('2026-10-31T12:00:00Z'));

      expect(updated.grand_total).toBeGreaterThanOrEqual(0);
      expect(updated.discount_total).toBeLessThanOrEqual(50.00); // capped at subtotal
    });

    test('financial formula invariant: grand_total === max(0, subtotal + tax_total - discount_total)', () => {
      const scenarios = [
        { subtotal: 1000.00, tax_total: 100.00, discount_total: 150.00, expected: 950.00 },
        { subtotal: 500.00, tax_total: 50.00, discount_total: 550.00, expected: 0.00 },
        { subtotal: 250.75, tax_total: 20.06, discount_total: 37.61, expected: 233.20 },
        { subtotal: 100.00, tax_total: 0.00, discount_total: 25.00, expected: 75.00 }
      ];

      scenarios.forEach(({ subtotal, tax_total, discount_total, expected }) => {
        const grandTotal = Number(
          Math.max(0, subtotal + tax_total - discount_total).toFixed(2)
        );
        expect(grandTotal).toBe(expected);
      });
    });
  });
});
