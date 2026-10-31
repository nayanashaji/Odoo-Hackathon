
const {
    createDiscount,
    getAllDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount,
    calculateDiscount
} = require("../services/discountService");

const addDiscount = (req, res) => {
    try {
        const discount = createDiscount(req.body);

        res.status(201).json({
            message: "Discount created successfully",
            discount
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

const fetchAllDiscounts = (req, res) => {
    res.status(200).json(getAllDiscounts());
};

const fetchDiscountById = (req, res) => {
    const discount = getDiscountById(req.params.id);

    if (!discount) {
        return res.status(404).json({
            message: "Discount not found"
        });
    }

    res.status(200).json(discount);
};

const editDiscount = (req, res) => {
    try {
        const discount = updateDiscount(req.params.id, req.body);

        res.status(200).json({
            message: "Discount updated successfully",
            discount
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

const removeDiscount = (req, res) => {
    try {
        const discount = deleteDiscount(req.params.id);

        res.status(200).json({
            message: "Discount deleted successfully",
            discount
        });
    } catch (error) {
        res.status(404).json({
            message: error.message
        });
    }
};

const applyDiscount = (req, res) => {
    try {
        const { amount } = req.body;

        const result = calculateDiscount(req.params.id, amount);

        res.status(200).json({
            message: "Discount applied successfully",
            result
        });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

module.exports = {
    addDiscount,
    fetchAllDiscounts,
    fetchDiscountById,
    editDiscount,
    removeDiscount,
    applyDiscount
};
