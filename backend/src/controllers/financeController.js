const { Router } = require('express');
const mongoose = require('mongoose');
const requireFinanceAccess = require('../middleware/requireFinanceAccess');

const router = Router();
const roundMoney = value => Math.round((value ?? 0) * 100) / 100;
const databaseCollection = name => mongoose.connection.db.collection(name);
const asDate = field => ({ $convert: { input: field, to: 'date', onError: null, onNull: null } });

const selectedPeriod = (period, now) => {
  if (period === 'all') return null;
  return period === 'year'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
};

function paymentDateMatch(start, now) {
  const paymentDate = asDate('$payment_date');
  const conditions = [{ $ne: [paymentDate, null] }, { $lte: [paymentDate, now] }];
  if (start) conditions.push({ $gte: [paymentDate, start] });
  return { $match: { $expr: { $and: conditions } } };
}

function overduePipeline(now, tail = []) {
  return [
    { $addFields: { __dueDate: asDate('$due_date') } },
    { $match: {
      status: { $nin: ['Paid', 'paid', 'Cancelled', 'Canceled', 'cancelled', 'canceled'] },
      __dueDate: { $lt: now }
    } },
    ...tail
  ];
}

router.get('/summary', requireFinanceAccess, async (req, res, next) => {
  try {
    const period = ['month', 'year', 'all'].includes(req.query.period) ? req.query.period : 'month';
    const now = new Date();
    const start = selectedPeriod(period, now);
    const payments = databaseCollection('payments');
    const invoices = databaseCollection('invoices');
    const subscriptions = databaseCollection('subscriptions');

    const [activeSubscriptions, paidTotals, openTotals, overdueCounts, overdueInvoices, periodTotals, monthlyTotals] = await Promise.all([
      subscriptions.countDocuments({ status: 'Active' }),
      invoices.aggregate([
        { $match: { status: { $in: ['Paid', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$grand_total' } } }
      ]).toArray(),
      invoices.aggregate([
        { $match: { status: { $nin: ['Paid', 'paid', 'Cancelled', 'Canceled', 'cancelled', 'canceled'] } } },
        { $group: { _id: null, total: { $sum: '$grand_total' }, count: { $sum: 1 } } }
      ]).toArray(),
      invoices.aggregate(overduePipeline(now, [{ $count: 'count' }])).toArray(),
      invoices.aggregate(overduePipeline(now, [
        { $sort: { __dueDate: 1 } },
        { $limit: 6 },
        { $project: { _id: 0, id: 1, status: 1, grand_total: 1, due_date: '$__dueDate' } }
      ])).toArray(),
      payments.aggregate([
        paymentDateMatch(start, now),
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]).toArray(),
      payments.aggregate([
        paymentDateMatch(new Date(now.getFullYear(), now.getMonth() - 5, 1), now),
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

module.exports = router;
