const express = require("express");

const {
    generateInvoice,
    fetchAllInvoices,
    fetchInvoiceById,
    changeInvoiceStatus
} = require("../controllers/invoiceController");

const router = express.Router();

router.post("/generate", generateInvoice);
router.get("/", fetchAllInvoices);
router.get("/:id", fetchInvoiceById);
router.patch("/:id/status", changeInvoiceStatus);

module.exports = router;