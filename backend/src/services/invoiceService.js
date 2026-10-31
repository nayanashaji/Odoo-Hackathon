const { subscriptions, products, invoices } = require("../../data/mockData");

/**
 * Dynamically calculates the invoice due_date based on subscription payment_terms.
 * Parses terms such as 'Net 30' (+30 days), 'Net 15' (+15 days), 'Net 60' (+60 days),
 * 'Immediate' / 'Due on receipt' (+0 days), or raw day numbers.
 *
 * @param {Date|string} issueDate
 * @param {string|number} paymentTerms
 * @returns {Date}
 */
const calculateDueDate = (issueDate, paymentTerms) => {
    const baseDate = issueDate ? new Date(issueDate) : new Date();
    const dueDate = new Date(baseDate);

    if (!paymentTerms) {
        // Default standard term if unspecified: 30 days
        dueDate.setDate(dueDate.getDate() + 30);
        return dueDate;
    }

    const termsStr = String(paymentTerms).trim();

    // Check for 'Net X' or 'NET X' (e.g., 'Net 30', 'Net 15', 'NET 45', 'Net-60')
    const netMatch = termsStr.match(/net[-_\s]*(\d+)/i);
    if (netMatch) {
        const days = parseInt(netMatch[1], 10);
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate;
    }

    // Check for raw number or 'X days' (e.g., '30', '45 days')
    const daysMatch = termsStr.match(/^(\d+)(?:\s*days?)?$/i);
    if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate;
    }

    // Check for immediate payment terms
    if (/immediate|due\s+on\s+receipt|due\s+upon\s+receipt|cod/i.test(termsStr)) {
        return dueDate;
    }

    // Check for End of Month
    if (/eom|end\s+of\s+month/i.test(termsStr)) {
        return new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);
    }

    // Fallback: default to 30 days
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
};

/**
 * Calculates line totals, subtotal, tax_total, and grand_total for invoice product lines.
 * Guarantees 100% accurate financial arithmetic by rounding each monetary value to 2 decimal places.
 * Supports:
 * - Line-level direct `tax_amount`
 * - Percentage-based `tax_rate` per line or global `defaultTaxRate`
 *
 * @param {Array<Object>} lines - array of line items with quantity, unit_price, and optional tax_amount or tax_rate
 * @param {number} [defaultTaxRate=0] - fallback tax rate percentage (e.g. 10 for 10%)
 * @returns {{
 *   subtotal: number,
 *   tax_total: number,
 *   grand_total: number,
 *   product_lines: Array<Object>
 * }}
 */
const calculateInvoiceTaxes = (lines = [], defaultTaxRate = 0) => {
    let subtotal = 0;
    let taxTotal = 0;

    const processedLines = (lines || []).map((line, idx) => {
        const quantity = Number(line.quantity || 0);
        const unitPrice = Number(line.unit_price || 0);
        const lineSubtotal = Number((quantity * unitPrice).toFixed(2));

        let lineTax = 0;
        if (line.tax_amount !== undefined && line.tax_amount !== null && !isNaN(line.tax_amount)) {
            lineTax = Number(Number(line.tax_amount).toFixed(2));
        } else {
            const rate = line.tax_rate !== undefined && line.tax_rate !== null ? Number(line.tax_rate) : Number(defaultTaxRate || 0);
            lineTax = Number(((lineSubtotal * rate) / 100).toFixed(2));
        }

        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        subtotal += lineSubtotal;
        taxTotal += lineTax;

        return {
            ...line,
            line_id: line.line_id || `line_${idx + 1}`,
            quantity,
            unit_price: unitPrice,
            tax_amount: lineTax,
            total_amount: lineTotal
        };
    });

    const finalSubtotal = Number(subtotal.toFixed(2));
    const finalTaxTotal = Number(taxTotal.toFixed(2));
    const finalGrandTotal = Number((finalSubtotal + finalTaxTotal).toFixed(2));

    return {
        subtotal: finalSubtotal,
        tax_total: finalTaxTotal,
        grand_total: finalGrandTotal,
        product_lines: processedLines
    };
};

const createInvoice = (subscriptionId, options = {}) => {
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

    // Validate product existence and integrity before computing taxes
    subscription.lines.forEach(line => {
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

        if (line.tax_amount !== undefined && (!Number.isFinite(line.tax_amount) || line.tax_amount < 0)) {
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
    });

    const taxCalculation = calculateInvoiceTaxes(subscription.lines);

    // Dynamically calculate due_date by parsing the associated subscription's payment_terms
    const issueDate = options.issueDate ? new Date(options.issueDate) : new Date();
    const paymentTerms = options.paymentTerms || subscription.payment_terms || (subscription.plan && subscription.plan.payment_terms) || "Net 30";
    const dueDate = calculateDueDate(issueDate, paymentTerms);

    const invoice = {
        id: `inv_${Date.now()}`,
        subscription_id: subscription.id,
        customer_id: subscription.customer_id || (subscription.customer && subscription.customer.id),
        issue_date: issueDate.toISOString(),
        due_date: dueDate.toISOString(),
        payment_terms: paymentTerms,
        status: "Draft",
        subtotal: taxCalculation.subtotal,
        tax_total: taxCalculation.tax_total,
        discount_total: 0,
        grand_total: taxCalculation.grand_total,
        product_lines: taxCalculation.product_lines
    };

    invoices.push(invoice);
    return invoice;
};

const getAllInvoices = (filter = {}) => {
    if (filter && filter.customer_id) {
        return invoices.filter(inv => inv.customer_id === filter.customer_id);
    }
    return invoices;
};

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
    calculateDueDate,
    calculateInvoiceTaxes,
    createInvoice,
    getAllInvoices,
    getInvoiceById,
    updateInvoiceStatus
};