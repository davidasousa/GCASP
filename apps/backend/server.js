require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { sequelize } = require("./models");
const friendRoutes = require("./routes/friends");
const setupSwagger = require("./swagger");

const app = express();
app.use(cors());
app.use(express.json());

setupSwagger(app);

app.use("/friends", friendRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
