const express = require("express");
const invoiceRoutes = require("./src/routes/invoiceRoutes");

const app = express();

app.use(express.json());

app.use("/api/invoices", invoiceRoutes);

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});