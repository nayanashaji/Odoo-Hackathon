
const createPaymentObject = (paymentData) => ({
    id: paymentData.id,
    invoice_id: paymentData.invoice_id,
    method: paymentData.method,
    amount: paymentData.amount,
    date: paymentData.date,
    note: paymentData.note || ""
});

module.exports = createPaymentObject;
