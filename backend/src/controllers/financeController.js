const { Router } = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const requireFinanceAccess = require('../middleware/requireFinanceAccess');
const { subscriptions: mockSubscriptions, invoices: mockInvoices, payments: mockPayments } = require('../../data/mockData');

const router = Router();
const roundMoney = value => Math.round((value ?? 0) * 100) / 100;
const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
const databaseCollection = name => mongoose.connection.db.collection(name);
const asDate = field => ({ $convert: { input: field, to: 'date', onError: null, onNull: null } });

/**
 * Safely extracts user session from req.user, req.auth, or Bearer token.
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
      /* Invalid or expired */
    }
  }

  if (req.headers && req.headers['x-user-role']) {
    return {
      id: req.headers['x-user-id'] || 'usr_123',
      role: req.headers['x-user-role']
    };
  }

  return null;
}

const selectedPeriod = (period, now) => {
  if (period === 'all') return null;
  return period === 'year'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
};

function paymentDateMatch(start, now, customerMatch = null) {
  const paymentDate = asDate('$payment_date');
  const exprConditions = [{ $ne: [paymentDate, null] }, { $lte: [paymentDate, now] }];
  if (start) exprConditions.push({ $gte: [paymentDate, start] });

  const matchStages = [{ $expr: { $and: exprConditions } }];
  if (customerMatch) {
    matchStages.push(customerMatch);
  }

  return { $match: { $and: matchStages } };
}

function overduePipeline(now, tail = [], customerMatch = null) {
  const matchConditions = [
    { status: { $nin: ['Draft', 'draft', 'Paid', 'paid', 'Cancelled', 'Canceled', 'cancelled', 'canceled'] } },
    { __dueDate: { $lt: now } }
  ];

  if (customerMatch) {
    matchConditions.push(customerMatch);
  }

  return [
    { $addFields: { __dueDate: asDate('$due_date') } },
    { $match: { $and: matchConditions } },
    ...tail
  ];
}

/**
 * GET /api/finance/summary
 * Enforces customer portal constraint: When a user with the role 'customer' requests data,
 * forcefully appends a filter (customer_id = req.user.id) to all database queries so they
 * can never view another user's subscriptions, invoices, or revenue metrics.
 */
router.get('/summary', requireFinanceAccess, async (req, res, next) => {
  try {
    const user = getAuthenticatedUser(req);
    const isCustomer = user && user.role === 'customer';
    const customerId = user ? (user.id || user._id) : null;

    // Customer portal query constraint: forcefully append customer_id filter
    const customerMatch = isCustomer && customerId
      ? { $or: [{ customer_id: customerId }, { 'customer.id': customerId }] }
      : null;

    const period = ['month', 'year', 'all'].includes(req.query.period) ? req.query.period : 'month';
    const now = new Date();
    const start = selectedPeriod(period, now);

    // Fallback if MongoDB is not connected
    if (!isDbConnected()) {
      let filteredSubs = mockSubscriptions.filter(s => s.status === 'Active');
      let filteredInvoices = [...mockInvoices];
      let filteredPayments = [...mockPayments];

      // Forcefully apply customer constraint to mock datasets
      if (isCustomer && customerId) {
        filteredSubs = filteredSubs.filter(s => s.customer_id === customerId || s.customer?.id === customerId);
        filteredInvoices = filteredInvoices.filter(i => i.customer_id === customerId || i.customer?.id === customerId);
        filteredPayments = filteredPayments.filter(p => p.customer_id === customerId || p.customer?.id === customerId);
      }

      const paidInvoices = filteredInvoices.filter(i => ['Paid', 'paid'].includes(i.status));
      const openInvoices = filteredInvoices.filter(i => !['Draft', 'draft', 'Paid', 'paid', 'Cancelled', 'cancelled'].includes(i.status));
      const overdueInvoices = openInvoices.filter(i => i.due_date && new Date(i.due_date) < now);

      const paidTotal = paidInvoices.reduce((sum, i) => sum + (Number(i.grand_total) || 0), 0);
      const openTotal = openInvoices.reduce((sum, i) => sum + (Number(i.grand_total) || 0), 0);
      const revenueTotal = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      return res.json({
        period,
        metrics: {
          activeSubscriptions: filteredSubs.length,
          revenue: roundMoney(revenueTotal),
          paymentCount: filteredPayments.length,
          outstandingAmount: roundMoney(openTotal),
          outstandingInvoiceCount: openInvoices.length,
          overdueInvoiceCount: overdueInvoices.length,
          paidInvoiceTotal: roundMoney(paidTotal)
        },
        overdueInvoices: overdueInvoices.slice(0, 6).map(i => ({
          id: i.id,
          status: i.status,
          grand_total: i.grand_total,
          due_date: i.due_date
        })),
        revenueByMonth: []
      });
    }

    // Database Connected - Execute MongoDB queries with forceful customer_id constraint
    const payments = databaseCollection('payments');
    const invoices = databaseCollection('invoices');
    const subscriptions = databaseCollection('subscriptions');

    // 1. Subscriptions Query with customer filter
    const subQuery = { status: 'Active' };
    if (customerMatch) {
      subQuery.$and = [customerMatch];
    }

    // 2. Paid totals match conditions
    const paidMatch = [{ status: { $in: ['Paid', 'paid'] } }];
    if (customerMatch) paidMatch.push(customerMatch);

    // 3. Open totals match conditions
    const openMatch = [
      { status: { $nin: ['Draft', 'draft', 'Paid', 'paid', 'Cancelled', 'Canceled', 'cancelled', 'canceled'] } }
    ];
    if (customerMatch) openMatch.push(customerMatch);

    const [
      activeSubscriptions,
      paidTotals,
      openTotals,
      overdueCounts,
      overdueInvoices,
      periodTotals,
      monthlyTotals
    ] = await Promise.all([
      subscriptions.countDocuments(subQuery),
      invoices.aggregate([
        { $match: { $and: paidMatch } },
        { $group: { _id: null, total: { $sum: '$grand_total' } } }
      ]).toArray(),
      invoices.aggregate([
        { $match: { $and: openMatch } },
        { $group: { _id: null, total: { $sum: '$grand_total' }, count: { $sum: 1 } } }
      ]).toArray(),
      invoices.aggregate(overduePipeline(now, [{ $count: 'count' }], customerMatch)).toArray(),
      invoices.aggregate(overduePipeline(now, [
        { $sort: { __dueDate: 1 } },
        { $limit: 6 },
        { $project: { _id: 0, id: 1, status: 1, grand_total: 1, due_date: '$__dueDate' } }
      ], customerMatch)).toArray(),
      payments.aggregate([
        paymentDateMatch(start, now, customerMatch),
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]).toArray(),
      payments.aggregate([
        paymentDateMatch(new Date(now.getFullYear(), now.getMonth() - 5, 1), now, customerMatch),
        { $group: { _id: { year: { $year: asDate('$payment_date') }, month: { $month: asDate('$payment_date') } }, amount: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]).toArray()
    ]);

    return res.json({
      period,
      metrics: {
        activeSubscriptions,
        revenue: roundMoney(periodTotals[0]?.total),
        paymentCount: periodTotals[0]?.count ?? 0,
        outstandingAmount: roundMoney(openTotals[0]?.total),
        outstandingInvoiceCount: openTotals[0]?.count ?? 0,
        overdueInvoiceCount: overdueCounts[0]?.count ?? 0,
        paidInvoiceTotal: roundMoney(paidTotals[0]?.total)
      },
      overdueInvoices,
      revenueByMonth: monthlyTotals.map(row => ({ year: row._id.year, month: row._id.month, amount: roundMoney(row.amount) }))
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/finance/invoices
 * Returns invoices. Forcefully appends (customer_id = req.user.id) for customer role.
 */
router.get('/invoices', requireFinanceAccess, async (req, res, next) => {
  try {
    const user = getAuthenticatedUser(req);
    const isCustomer = user && user.role === 'customer';
    const customerId = user ? (user.id || user._id) : null;

    const query = {};
    if (isCustomer && customerId) {
      query.$or = [{ customer_id: customerId }, { 'customer.id': customerId }];
    }

    if (isDbConnected()) {
      const items = await databaseCollection('invoices').find(query).toArray();
      return res.json({ invoices: items });
    }

    let items = [...mockInvoices];
    if (isCustomer && customerId) {
      items = items.filter(i => i.customer_id === customerId || i.customer?.id === customerId);
    }
    return res.json({ invoices: items });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/finance/subscriptions
 * Returns subscriptions. Forcefully appends (customer_id = req.user.id) for customer role.
 */
router.get('/subscriptions', requireFinanceAccess, async (req, res, next) => {
  try {
    const user = getAuthenticatedUser(req);
    const isCustomer = user && user.role === 'customer';
    const customerId = user ? (user.id || user._id) : null;

    const query = {};
    if (isCustomer && customerId) {
      query.$or = [{ customer_id: customerId }, { 'customer.id': customerId }];
    }

    if (isDbConnected()) {
      const items = await databaseCollection('subscriptions').find(query).toArray();
      return res.json({ subscriptions: items });
    }

    let items = [...mockSubscriptions];
    if (isCustomer && customerId) {
      items = items.filter(s => s.customer_id === customerId || s.customer?.id === customerId);
    }
    return res.json({ subscriptions: items });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
