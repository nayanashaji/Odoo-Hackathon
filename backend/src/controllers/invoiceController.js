const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
    calculateDueDate,
    calculateInvoiceTaxes,
    createInvoice,
    getAllInvoices,
    getInvoiceById,
    updateInvoiceStatus
} = require("../services/invoiceService");
const { subscriptions: mockSubscriptions, invoices: mockInvoices, discounts: mockDiscounts } = require("../../data/mockData");

/**
 * Safely extracts authenticated user from req.user, req.auth, or Authorization Bearer header.
 */
function getAuthenticatedUser(req) {
    if (req.user) return req.user;
    if (req.auth) return req.auth;

    const authHeader = req.get ? req.get('authorization') : req.headers?.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'brightloop_jwt_secret');
            req.user = decoded;
            req.auth = decoded;
            return decoded;
        } catch {
            /* Token invalid or expired */
        }
    }

    // Support mock or test headers if supplied
    if (req.headers && req.headers['x-user-role']) {
        const fallback = {
            id: req.headers['x-user-id'] || 'usr_123',
            role: req.headers['x-user-role']
        };
        req.user = fallback;
        req.auth = fallback;
        return fallback;
    }

    return null;
}

/**
 * Helper to get a MongoDB collection if connected.
 */
function getDbCollection(name) {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
        return mongoose.connection.db.collection(name);
    }
    return null;
}

/**
 * Validates whether an Admin-created discount rule can be applied to an invoice.
 * Criteria:
 * 1. Current date must fall between valid_from and valid_to (inclusive).
 * 2. times_used must be strictly below usage_limit.
 * 3. Invoice purchase amount (subtotal/grand_total) must meet or exceed minimum_purchase_amount.
 *
 * @param {Object} rule
 * @param {Object} invoice
 * @param {Date} currentDate
 * @returns {{ isValid: boolean, reason?: string }}
 */
function validateDiscountRule(rule, invoice, currentDate = new Date()) {
    if (!rule) {
        return { isValid: false, reason: "Rule is null or undefined" };
    }

    const now = currentDate instanceof Date ? currentDate : new Date(currentDate);

    // 1. Date window validation: current date must fall between valid_from and valid_to
    if (rule.valid_from) {
        const fromDate = new Date(rule.valid_from);
        if (!isNaN(fromDate.getTime()) && now < fromDate) {
            return {
                isValid: false,
                reason: `Discount is not yet valid (valid_from: ${fromDate.toISOString()}, current: ${now.toISOString()})`
            };
        }
    }

    const validToDate = rule.valid_to || rule.valid_until;
    if (validToDate) {
        const toDate = new Date(validToDate);
        if (!isNaN(toDate.getTime()) && now > toDate) {
            return {
                isValid: false,
                reason: `Discount has expired (valid_to: ${toDate.toISOString()}, current: ${now.toISOString()})`
            };
        }
    }

    // 2. Usage limit validation: times_used must be strictly below usage_limit
    if (rule.usage_limit !== undefined && rule.usage_limit !== null) {
        const timesUsed = Number(rule.times_used || 0);
        const limit = Number(rule.usage_limit);
        if (timesUsed >= limit) {
            return {
                isValid: false,
                reason: `Usage limit reached (${timesUsed}/${limit})`
            };
        }
    }

    // 3. Minimum purchase amount validation
    const minAmount = rule.minimum_purchase_amount !== undefined
        ? Number(rule.minimum_purchase_amount)
        : rule.min_purchase_amount !== undefined
            ? Number(rule.min_purchase_amount)
            : rule.minimum_amount !== undefined
                ? Number(rule.minimum_amount)
                : null;

    if (minAmount !== null && !isNaN(minAmount) && minAmount > 0) {
        const purchaseAmount = Number(invoice.subtotal !== undefined ? invoice.subtotal : invoice.grand_total || 0);
        if (purchaseAmount < minAmount) {
            return {
                isValid: false,
                reason: `Invoice purchase amount (${purchaseAmount}) is below minimum_purchase_amount (${minAmount})`
            };
        }
    }

    return { isValid: true };
}

/**
 * Queries database for Admin-created discount rules tied to customer or subscription,
 * validates rules, applies discounts to invoice, and increments times_used counter.
 *
 * @param {Object} invoice
 * @param {Object} subscription
 * @param {Date} currentDate
 * @returns {Promise<Object>} updated invoice
 */
async function applyDiscountsToInvoice(invoice, subscription, currentDate = new Date()) {
    const customerId = invoice.customer_id || subscription.customer_id || (subscription.customer && subscription.customer.id);
    const subscriptionId = invoice.subscription_id || subscription.id;

    const discountCollection = getDbCollection('discounts');
    let candidateRules = [];

    // 1. Query database for rules tied to customer or subscription
    if (discountCollection) {
        const query = {
            $or: [
                { customer_id: customerId },
                { 'customer.id': customerId },
                { subscription_id: subscriptionId },
                { target_id: customerId },
                { target_id: subscriptionId },
                { applies_to: 'subscription' },
                { applies_to: 'customer' },
                { applies_to: 'all' }
            ]
        };
        try {
            candidateRules = await discountCollection.find(query).toArray();
        } catch (e) {
            console.warn("MongoDB discount query fallback to mockData:", e.message);
        }
    }

    // Fallback to in-memory store if DB query returned nothing or DB not connected
    if (!candidateRules || candidateRules.length === 0) {
        candidateRules = (mockDiscounts || []).filter(rule => {
            if (rule.customer_id && rule.customer_id === customerId) return true;
            if (rule.subscription_id && rule.subscription_id === subscriptionId) return true;
            if (rule.target_id && (rule.target_id === customerId || rule.target_id === subscriptionId)) return true;
            if (rule.applies_to === 'subscription' || rule.applies_to === 'customer' || rule.applies_to === 'all') return true;
            return false;
        });
    }

    // Filter for Admin-created rules (skip any rules explicitly marked as non-admin)
    const adminRules = candidateRules.filter(r => {
        if (r.created_by_role && r.created_by_role !== 'admin') return false;
        if (r.role && r.role !== 'admin') return false;
        return true;
    });

    let totalDiscount = 0;
    const appliedDiscounts = [];
    let remainingAmount = Number(invoice.subtotal || invoice.grand_total || 0);

    // 2 & 3. Validate each discount rule and apply
    for (const rule of adminRules) {
        if (remainingAmount <= 0) break;

        const validation = validateDiscountRule(rule, invoice, currentDate);
        if (!validation.isValid) {
            continue;
        }

        // Calculate discount value
        let discountAmount = 0;
        if (rule.type === 'percentage') {
            discountAmount = (invoice.subtotal * Number(rule.value)) / 100;
        } else if (rule.type === 'fixed') {
            discountAmount = Number(rule.value);
        } else {
            discountAmount = Number(rule.value) || 0;
        }

        discountAmount = Math.min(discountAmount, remainingAmount);
        if (discountAmount <= 0) continue;

        discountAmount = Number(discountAmount.toFixed(2));
        totalDiscount += discountAmount;
        remainingAmount -= discountAmount;

        appliedDiscounts.push({
            rule_id: rule.id || rule._id,
            type: rule.type,
            value: rule.value,
            discount_amount: discountAmount
        });

        // Increment times_used counter in database and memory
        if (discountCollection && rule._id) {
            await discountCollection.updateOne(
                { _id: rule._id },
                { $inc: { times_used: 1 } }
            );
        } else if (discountCollection && rule.id) {
            await discountCollection.updateOne(
                { id: rule.id },
                { $inc: { times_used: 1 } }
            );
        }

        rule.times_used = (rule.times_used || 0) + 1;
        const mockItem = (mockDiscounts || []).find(d => d.id === rule.id);
        if (mockItem && mockItem !== rule) {
            mockItem.times_used = (mockItem.times_used || 0) + 1;
        }
    }

    // Update invoice financials
    invoice.discount_total = Number(totalDiscount.toFixed(2));
    invoice.grand_total = Number(
        Math.max(0, (invoice.subtotal || 0) + (invoice.tax_total || 0) - totalDiscount).toFixed(2)
    );
    invoice.applied_discounts = appliedDiscounts;

    return invoice;
}

/**
 * Generates an invoice for a given subscription on billing day.
 * 1. Queries database for Admin-created discount rules tied to customer or subscription.
 * 2. Validates validity dates, usage limit, and minimum purchase amount.
 * 3. Applies valid discounts to discount_total and increments times_used counter.
 * 4. Dynamically calculates due_date by parsing payment_terms (e.g. 'Net 30').
 * 5. Enforces customer portal ownership constraint.
 */
const generateInvoice = async (req, res) => {
    try {
        const { subscription_id } = req.body;

        if (!subscription_id) {
            return res.status(400).json({
                message: "subscription_id is required"
            });
        }

        const user = getAuthenticatedUser(req);
        const subCollection = getDbCollection('subscriptions');

        // Locate the target subscription from MongoDB or fallback mockData
        let subscription = null;
        if (subCollection) {
            subscription = await subCollection.findOne({ id: subscription_id });
        }
        if (!subscription) {
            subscription = mockSubscriptions.find((s) => s.id === subscription_id);
        }

        if (!subscription) {
            return res.status(404).json({
                message: "Subscription not found"
            });
        }

        // Enforce customer portal constraint: Customer can only generate/view their own subscriptions
        if (user && user.role === 'customer') {
            const subCustomerId = subscription.customer_id || (subscription.customer && subscription.customer.id);
            if (subCustomerId && subCustomerId !== user.id) {
                return res.status(403).json({
                    message: "Forbidden: You cannot access or generate invoices for another customer's subscription"
                });
            }
        }

        // Dynamically calculate due_date by parsing payment_terms (e.g., 'Net 30' -> +30 days)
        const paymentTerms =
            subscription.payment_terms ||
            (subscription.plan && subscription.plan.payment_terms) ||
            "Net 30";
        const issueDate = new Date();
        const dueDate = calculateDueDate(issueDate, paymentTerms);

        // Generate invoice using service with parsed date terms
        const invoice = createInvoice(subscription_id, {
            issueDate,
            paymentTerms
        });

        // Ensure calculated due_date is explicitly set on invoice
        invoice.due_date = dueDate.toISOString();
        invoice.issue_date = issueDate.toISOString();
        invoice.payment_terms = paymentTerms;

        // Query database for Admin-created Discount rules, validate, apply discounts, and increment times_used
        await applyDiscountsToInvoice(invoice, subscription, issueDate);

        // Persist to MongoDB collection if connected
        const invCollection = getDbCollection('invoices');
        if (invCollection) {
            await invCollection.updateOne(
                { id: invoice.id },
                { $set: invoice },
                { upsert: true }
            );
        }

        res.status(201).json({
            message: "Invoice generated successfully",
            invoice
        });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            message: error.message
        });
    }
};

/**
 * Fetches all invoices.
 * When requested by a user with role 'customer', forcefully appends a filter
 * (customer_id = req.user.id) to the database query so they never see another user's invoices.
 */
const fetchAllInvoices = async (req, res) => {
    try {
        const user = getAuthenticatedUser(req);
        const invCollection = getDbCollection('invoices');

        // Customer portal constraint: forcefully append customer_id filter
        if (user && user.role === 'customer') {
            const customerId = user.id;

            if (invCollection) {
                const query = {
                    $or: [
                        { customer_id: customerId },
                        { 'customer.id': customerId }
                    ]
                };
                const customerInvoices = await invCollection.find(query).toArray();
                return res.status(200).json(customerInvoices);
            }

            // Fallback to in-memory store with forceful customer filter
            const filteredMockInvoices = getAllInvoices({ customer_id: customerId });
            return res.status(200).json(filteredMockInvoices);
        }

        // Admin and Staff: return full dataset
        if (invCollection) {
            const allDbInvoices = await invCollection.find({}).toArray();
            if (allDbInvoices && allDbInvoices.length > 0) {
                return res.status(200).json(allDbInvoices);
            }
        }

        return res.status(200).json(getAllInvoices());
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Fetches an invoice by ID.
 * When requested by a user with role 'customer', ensures the invoice belongs to them.
 */
const fetchInvoiceById = async (req, res) => {
    try {
        const user = getAuthenticatedUser(req);
        const { id } = req.params;
        const invCollection = getDbCollection('invoices');

        let invoice = null;
        if (invCollection) {
            invoice = await invCollection.findOne({ id });
        }
        if (!invoice) {
            invoice = getInvoiceById(id);
        }

        if (!invoice) {
            return res.status(404).json({
                message: "Invoice not found"
            });
        }

        // Customer portal constraint: never allow customer to inspect another user's invoice
        if (user && user.role === 'customer') {
            const invoiceCustomerId = invoice.customer_id || (invoice.customer && invoice.customer.id);
            if (invoiceCustomerId && invoiceCustomerId !== user.id) {
                return res.status(403).json({
                    message: "Forbidden: You do not have permission to view another customer's invoice",
                    data: []
                });
            }
        }

        return res.status(200).json(invoice);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Updates invoice status.
 */
const changeInvoiceStatus = (req, res) => {
    try {
        const user = getAuthenticatedUser(req);
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                message: "Status is required"
            });
        }

        // Prevent customer role from arbitrary status manipulation
        if (user && user.role === 'customer' && status !== 'Paid') {
            return res.status(403).json({
                message: "Forbidden: Customer cannot modify invoice state directly"
            });
        }

        const invoice = updateInvoiceStatus(req.params.id, status);

        res.status(200).json({
            message: "Invoice status updated successfully",
            invoice
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

module.exports = {
    calculateDueDate,
    calculateInvoiceTaxes,
    validateDiscountRule,
    applyDiscountsToInvoice,
    generateInvoice,
    fetchAllInvoices,
    fetchInvoiceById,
    changeInvoiceStatus
};