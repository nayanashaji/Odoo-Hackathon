const { subscriptions, products, invoices } = require("../../data/mockData");

const createInvoice = (subscriptionId) => {
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);

    if (!subscription) {
        throw new Error("Subscription not found");
    }

    const existingInvoice = invoices.find(
    invoice => invoice.subscription_id === subscriptionId
);

if (existingInvoice) {
    const error = new Error("An invoice already exists for this subscription");
    error.statusCode = 409;
    throw error;
}

    if (!subscription.lines || subscription.lines.length === 0) {
        throw new Error("Subscription has no product lines");
    }

    const productLines = subscription.lines.map(line => {
        const product = products.find(p => p.id === line.product_id);

        if (!product) {
            throw new Error(`Product not found: ${line.product_id}`);
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            throw new Error("Quantity must be greater than zero");
        }

        if (!Number.isFinite(line.unit_price) || line.unit_price < 0) {
            throw new Error("Unit price cannot be negative");
        }

        if (!Number.isFinite(line.tax_amount) || line.tax_amount < 0) {
            throw new Error("Tax amount cannot be negative");
        }

        if (line.variant_id) {
            const variant = product.variants.find(
                v => v.variant_id === line.variant_id
            );

            if (!variant) {
                throw new Error(`Variant not found: ${line.variant_id}`);
            }
        }

        return {
            line_id: line.line_id,
            product_id: line.product_id,
            variant_id: line.variant_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            tax_amount: line.tax_amount,
            total_amount: Number(
                 (line.quantity * line.unit_price + line.tax_amount).toFixed(2)
            )
        };
    });

    const subtotal = productLines.reduce(
        (sum, line) => sum + line.quantity * line.unit_price, 0
    );

    const taxTotal = productLines.reduce(
        (sum, line) => sum + line.tax_amount, 0
    );

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = {
        id: `inv_${Date.now()}`,
        subscription_id: subscription.id,
        customer_id: subscription.customer_id,
        issue_date: issueDate.toISOString(),
        due_date: dueDate.toISOString(),
        status: "Draft",
        subtotal: Number(subtotal.toFixed(2)),
        tax_total: Number(taxTotal.toFixed(2)),
        discount_total: 0,
        grand_total: Number((subtotal + taxTotal).toFixed(2)),
        product_lines: productLines
    };

    invoices.push(invoice);
    return invoice;
};

const getAllInvoices = () => invoices;

const getInvoiceById = (invoiceId) =>
    invoices.find(invoice => invoice.id === invoiceId);

const updateInvoiceStatus = (invoiceId, newStatus) => {
    const invoice = getInvoiceById(invoiceId);

    if (!invoice) {
        throw new Error("Invoice not found");
    }

    const allowedTransitions = {
        Draft: ["Confirmed"],
        Confirmed: ["Paid"],
        Paid: []
    };

    if (!allowedTransitions[invoice.status]) {
        throw new Error("Invalid invoice status");
    }

    if (!allowedTransitions[invoice.status].includes(newStatus)) {
        throw new Error(
            `Cannot change invoice status from ${invoice.status} to ${newStatus}`
        );
    }

    invoice.status = newStatus;

    return invoice;
};

module.exports = {
    createInvoice,
    getAllInvoices,
    getInvoiceById,
    updateInvoiceStatus
};