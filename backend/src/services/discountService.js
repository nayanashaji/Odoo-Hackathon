
const { discounts } = require("../../data/mockData");

const createDiscount = (discountData) => {
    const { type, value, usage_limit, applies_to } = discountData;

    if (!type || !["percentage", "fixed"].includes(type)) {
        throw new Error("Discount type must be percentage or fixed");
    }

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Discount value must be greater than zero");
    }

    if (type === "percentage" && value > 100) {
        throw new Error("Percentage discount cannot exceed 100");
    }

    if (!Number.isInteger(usage_limit) || usage_limit <= 0) {
        throw new Error("Usage limit must be a positive integer");
    }

    if (!["subscription", "product", "plan"].includes(applies_to)) {
        throw new Error("Invalid applies_to value");
    }

    const discount = {
        id: `disc_${Date.now()}`,
        type,
        value,
        usage_limit,
        applies_to,
        times_used: 0
    };

    discounts.push(discount);
    return discount;
};

const getAllDiscounts = () => discounts;

const getDiscountById = (id) =>
    discounts.find(discount => discount.id === id);

const updateDiscount = (id, updates) => {
    const discount = getDiscountById(id);

    if (!discount) {
        throw new Error("Discount not found");
    }

    Object.assign(discount, updates);
    return discount;
};

const deleteDiscount = (id) => {
    const index = discounts.findIndex(discount => discount.id === id);

    if (index === -1) {
        throw new Error("Discount not found");
    }

    return discounts.splice(index, 1)[0];
};

const calculateDiscount = (id, amount) => {
    const discount = getDiscountById(id);

    if (!discount) {
        throw new Error("Discount not found");
    }

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid purchase amount");
    }

    if (discount.times_used >= discount.usage_limit) {
        throw new Error("Discount usage limit reached");
    }

    const discountAmount = discount.type === "percentage"
        ? amount * discount.value / 100
        : discount.value;

    const finalDiscount = Math.min(discountAmount, amount);

    discount.times_used += 1;

    return {
        discount_id: discount.id,
        original_amount: amount,
        discount_amount: Number(finalDiscount.toFixed(2)),
        final_amount: Number((amount - finalDiscount).toFixed(2))
    };
};

module.exports = {
    createDiscount,
    getAllDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount,
    calculateDiscount
};
