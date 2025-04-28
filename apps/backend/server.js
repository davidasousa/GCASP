require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sequelize } = require("./models");
const friendRoutes = require("./routes/friends");
const setupSwagger = require("./swagger");
const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const xssClean = require("xss-clean");

async function startServer() {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database Synced');

    const app = express();
    app.set("trust proxy", 1);

    // Health check endpoint before middleware
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });

    app.use(helmet());
    app.use(compression());

    // Global rate limiter (catch-all): 100 req per 15m
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(globalLimiter);

    // Slow down repeated requests after threshold
    app.use(
      slowDown({
        windowMs: 15 * 60 * 1000,
        delayAfter: 50, // allow 50 free requests...
        delayMs: () => 500, // begin adding 500ms of delay per request above 50
      })
    );

    app.use(cors());
    app.use(express.json());
    app.use(xssClean());

    // API Routes
    app.use("/auth", authRoutes);
    app.use("/videos", videoRoutes);
    app.use("/friends", friendRoutes);
    
    // Add the video streaming endpoint with security improvements
    app.get("/videos/stream/:filename", (req, res) => {
      const filename = req.params.filename;
      
      // Security check to prevent path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).send("Invalid filename");
      }
      
      const filePath = path.join(__dirname, "uploads", filename);

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          return res.status(404).send("Video not found");
        }

        const range = req.headers.range;
        
        // Handle missing range header gracefully
        if (!range) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          const stream = fs.createReadStream(filePath);
          stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
              res.status(500).send('Error streaming video');
            }
          });
          return stream.pipe(res);
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
        
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).send('Error streaming video');
          }
        });
        
        stream.pipe(res);
      });
    });

    // Global error handler
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
  } catch (err) {
    console.error('Unable to start server & synch DB:', err);
    process.exit(1);
  }
}

startServer();