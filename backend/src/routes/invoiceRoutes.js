const express = require("express");

const {
    generateInvoice,
    fetchAllInvoices,
    fetchInvoiceById
} = require("../controllers/invoiceController");

const router = express.Router();

router.post("/generate", generateInvoice);
router.get("/", fetchAllInvoices);
router.get("/:id", fetchInvoiceById);

module.exports = router;