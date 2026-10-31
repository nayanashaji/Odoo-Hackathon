
const express = require("express");

const {
    addDiscount,
    fetchAllDiscounts,
    fetchDiscountById,
    editDiscount,
    removeDiscount,
    applyDiscount
} = require("../controllers/discountController");

const router = express.Router();

router.post("/", addDiscount);
router.get("/", fetchAllDiscounts);
router.get("/:id", fetchDiscountById);
router.put("/:id", editDiscount);
router.delete("/:id", removeDiscount);
router.post("/:id/apply", applyDiscount);

module.exports = router;
