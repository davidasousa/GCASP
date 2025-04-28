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
app.use('/api', videoRoutes); // so /videos becomes /api/videos

const path = require("path");
const fs = require("fs");

app.get("/videos/stream/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).send("Video not found");
    }

    const range = req.headers.range;
    if (!range) {
      return res.status(416).send("Range header required");
    }

    const CHUNK_SIZE = 10 ** 6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, stats.size - 1);
    const contentLength = end - start + 1;

    const headers = {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4", // adjust if you support other formats
    };

    res.writeHead(206, headers);
    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  });
});


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
