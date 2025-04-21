require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { sequelize } = require("./models");
const friendRoutes = require("./routes/friends");
const setupSwagger = require("./swagger");
const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const xssClean = require("xss-clean");

const app = express();

app.use(cors());
app.use(express.json());
app.use(xssClean());
app.use("/auth", authRoutes);
app.use("/videos", videoRoutes);
app.use("/friends", friendRoutes);

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
  

setupSwagger(app);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
