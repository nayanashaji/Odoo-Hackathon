
const express = require("express");

const discountRoutes = require("./src/routes/discountRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Brightloop Backend API is running"
    });
});

app.use("/api/discounts", discountRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
