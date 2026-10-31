const express = require("express");

const discountRoutes = require("./src/routes/discountRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Brightloop Discount API is running"
    });
});

app.use("/api/discounts", discountRoutes);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});