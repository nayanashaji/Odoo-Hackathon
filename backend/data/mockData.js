const users = [
    {
        id: "usr_12345",
        email: "customer@example.com",
        password_hash: "hashed_string",
        role: "customer"
    }
];

const products = [
    {
        id: "prod_101",
        name: "Brightloop CRM",
        type: "software",
        sales_price: 1200.00,
        cost_price: 200.00,
        notes: "Core CRM module",
        variants: [
            {
                variant_id: "var_1",
                name: "Odoo Brand Add-on",
                price_modifier: 560.00
            }
        ]
    }
];

const plans = [
    {
        id: "plan_202",
        name: "Enterprise Annual",
        cost: 12000.00,
        billing_frequency: "yearly",
        minimum_quantity: 5,
        available_from: "2026-01-01T00:00:00Z",
        available_to: "2026-12-31T23:59:59Z",
        closing_behavior: "renew"
    }
];

const subscriptions = [
    {
        id: "sub_404",
        subscription_number: "SUB-2026-001",
        customer_id: "usr_12345",
        plan_id: "plan_202",
        start_date: "2026-10-31T00:00:00Z",
        expiry_date: "2027-10-31T00:00:00Z",
        payment_terms: "Net 30",
        status: "Active",
        lines: [
            {
                line_id: "line_1",
                product_id: "prod_101",
                variant_id: "var_1",
                quantity: 5,
                unit_price: 1760.00,
                tax_amount: 88.00,
                total_amount: 8888.00
            }
        ]
    }
];

const invoices = [];

module.exports = {
    users,
    products,
    plans,
    subscriptions,
    invoices
};