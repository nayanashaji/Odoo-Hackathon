
const { payments } = require("../../data/mockData");
const createPaymentObject = require("../models/Payment");

const createPayment = (paymentData) => {
    const { invoice_id, method, amount, date, note } = paymentData;

    if (!invoice_id || !method) {
        throw new Error("Invoice ID and payment method are required");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payment amount must be greater than zero");
    }

    const paymentDate = date || new Date().toISOString().split("T")[0];

    if (Number.isNaN(Date.parse(paymentDate))) {
        throw new Error("Invalid payment date");
    }

    const payment = createPaymentObject({
        id: `pay_${Date.now()}`,
        invoice_id,
        method,
        amount,
        date: paymentDate,
        note
    });

    payments.push(payment);
    return payment;
};

const getAllPayments = () => payments;

const getPaymentById = (id) =>
    payments.find(payment => payment.id === id);

const getPaymentsByInvoiceId = (invoiceId) =>
    payments.filter(payment => payment.invoice_id === invoiceId);

module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentsByInvoiceId
};
