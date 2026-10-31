
const express = require("express");

const {
    addPayment,
    fetchAllPayments,
    fetchPaymentById,
    fetchPaymentsByInvoice
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/", addPayment);
router.get("/", fetchAllPayments);
router.get("/invoice/:invoiceId", fetchPaymentsByInvoice);
router.get("/:id", fetchPaymentById);

module.exports = router;
