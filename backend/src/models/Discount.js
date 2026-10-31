const createDiscountObject = (discountData) => ({
    id: discountData.id,
    type: discountData.type,
    value: discountData.value,
    usage_limit: discountData.usage_limit,
    applies_to: discountData.applies_to
});

module.exports = createDiscountObject;