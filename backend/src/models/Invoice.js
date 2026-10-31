const createInvoiceObject = (invoiceData) => {
    return {
        id: invoiceData.id,
        subscription_id: invoiceData.subscription_id,
        customer_id: invoiceData.customer_id,
        issue_date: invoiceData.issue_date,
        due_date: invoiceData.due_date,
        status: invoiceData.status || "Draft",
        subtotal: invoiceData.subtotal,
        tax_total: invoiceData.tax_total || 0,
        discount_total: invoiceData.discount_total || 0,
        grand_total: invoiceData.grand_total,
        product_lines: invoiceData.product_lines || []
    };
};

module.exports = createInvoiceObject;