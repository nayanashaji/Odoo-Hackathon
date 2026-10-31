const { Router } = require('express');
const mongoose = require('mongoose');
const requireFinanceAccess = require('../middleware/requireFinanceAccess');

const router = Router();
const startOfPeriod = period => {
  const now = new Date();
  if (period === 'all') return null;
  return period === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
};
const collection = name => mongoose.connection.db.collection(name);
const rounded = value => Math.round((value ?? 0) * 100) / 100;

router.get('/summary', requireFinanceAccess, async (req, res, next) => {
  try {
    const period = ['month', 'year', 'all'].includes(req.query.period) ? req.query.period : 'month';
    const start = startOfPeriod(period);
    const now = new Date();
    const openStatuses = { $nin: ['Paid', 'paid', 'Cancelled', 'Canceled', 'cancelled', 'canceled'] };
    const paymentDateFilter = start ? { date: { $gte: start, $lte: now } } : {};
    const invoiceDateFilter = start ? { issue_date: { $gte: start, $lte: now } } : {};
    const payments = collection('payments');
    const invoices = collection('invoices');
    const subscriptions = collection('subscriptions');

    const [activeCount, paidTotals, openTotals, overdueCount, overdueInvoices, periodPayments, monthlyTotals] = await Promise.all([
      subscriptions.countDocuments({ status: 'Active' }),
      invoices.aggregate([{ $match: { status: { $in: ['Paid', 'paid'] }, ...invoiceDateFilter } }, { $group: { _id: null, total: { $sum: '$grand_total' } } }]).toArray(),
      invoices.aggregate([{ $match: { status: openStatuses } }, { $group: { _id: null, total: { $sum: '$grand_total' }, count: { $sum: 1 } } }]).toArray(),
      invoices.countDocuments({ status: openStatuses, due_date: { $lt: now } }),
      invoices.find({ status: openStatuses, due_date: { $lt: now } }, { projection: { _id: 0, id: 1, status: 1, grand_total: 1, due_date: 1 } }).sort({ due_date: 1 }).limit(6).toArray(),
      payments.aggregate([{ $match: paymentDateFilter }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
      payments.aggregate([
        { $match: { date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1), $lte: now } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]).toArray()
    ]);

    return res.json({
      period,
      metrics: {
        activeSubscriptions: activeCount,
        revenue: rounded(periodPayments[0]?.total),
        paymentCount: periodPayments[0]?.count ?? 0,
        outstandingAmount: rounded(openTotals[0]?.total),
        outstandingInvoiceCount: openTotals[0]?.count ?? 0,
        overdueInvoiceCount: overdueCount,
        paidInvoiceTotal: rounded(paidTotals[0]?.total)
      },
      overdueInvoices,
      revenueByMonth: monthlyTotals.map(row => ({ year: row._id.year, month: row._id.month, amount: rounded(row.amount) }))
    });
  } catch (error) { next(error); }
});

module.exports = router;
