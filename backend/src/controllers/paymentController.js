
const {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentsByInvoiceId
} = require("../services/paymentService");

const addPayment = (req, res) => {
    try {
        const payment = createPayment(req.body);

        res.status(201).json({
            message: "Payment recorded successfully",
            payment
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

const fetchAllPayments = (req, res) => {
    res.status(200).json(getAllPayments());
};

const fetchPaymentById = (req, res) => {
    const payment = getPaymentById(req.params.id);

    if (!payment) {
        return res.status(404).json({
            message: "Payment not found"
        });
    }

    res.status(200).json(payment);
};

const fetchPaymentsByInvoice = (req, res) => {
    const payments = getPaymentsByInvoiceId(req.params.invoiceId);

    res.status(200).json(payments);
};

module.exports = {
    addPayment,
    fetchAllPayments,
    fetchPaymentById,
    fetchPaymentsByInvoice
};
