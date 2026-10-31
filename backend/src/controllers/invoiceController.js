const {
    createInvoice,
    getAllInvoices,
    getInvoiceById
} = require("../services/invoiceService");

const generateInvoice = (req, res) => {
    try {
        const { subscription_id } = req.body;

        if (!subscription_id) {
            return res.status(400).json({
                message: "subscription_id is required"
            });
        }

        const invoice = createInvoice(subscription_id);

        res.status(201).json({
            message: "Invoice generated successfully",
            invoice
        });
    } catch (error) {
        res.status(404).json({
            message: error.message
        });
    }
};

const fetchAllInvoices = (req, res) => {
    res.status(200).json(getAllInvoices());
};

const fetchInvoiceById = (req, res) => {
    const invoice = getInvoiceById(req.params.id);

    if (!invoice) {
        return res.status(404).json({
            message: "Invoice not found"
        });
    }

    res.status(200).json(invoice);
};

module.exports = {
    generateInvoice,
    fetchAllInvoices,
    fetchInvoiceById
};