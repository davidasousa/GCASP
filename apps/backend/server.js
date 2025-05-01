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
const { sequelize, User, Video, Friendship } = require("./models");
const friendRoutes = require("./routes/friends");
const setupSwagger = require("./swagger");
const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const xssClean = require("xss-clean");
const { Video } = require("./models");
const isProd = process.env.PROD === "true";
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.REGION_AWS,
  credentials: {
    accessKeyId:     process.env.ACCESS_KEY_AWS,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS
  }
});
console.log("Initialized S3 client");
console.log("Will use bucket:", process.env.S3_VIDEO_BUCKET);

async function startServer() {
  try {
    // 1) Authenticate & connect
    await sequelize.authenticate();
    console.log('PostgreSQL Connected');

    // 2) Drop all existing ENUMs
    const [enumRows] = await sequelize.query(`
      SELECT DISTINCT quote_ident(t.typname) AS enum_name
        FROM pg_type t
        JOIN pg_enum e       ON t.oid = e.enumtypid;
    `);
    if (enumRows.length) {
      for (const { enum_name } of enumRows) {
        await sequelize.query(`DROP TYPE IF EXISTS ${enum_name} CASCADE;`);
        console.log('Dropped ENUM type:', enum_name);
      }
    } else {
      console.log('No ENUM types to drop');
    }
    await User.sync({ force: true });
    await Video.sync({ force: true });
    await Friendship.sync({ force: true });
    console.log('All dependent tables synced');
    
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

    // LOG ANY HITS TO /videos/upload
    app.use("/videos/upload", (req, res, next) => {
      console.log("Hit /videos/upload at", new Date().toISOString());
      next();
    });

    app.use(helmet());
    app.use(compression());

    // Global rate limiter (catch-all): 100 req per 15m
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(globalLimiter);

    // Slow down repeated requests after threshold
    app.use(
      slowDown({
        windowMs: 15 * 60 * 1000,
        delayAfter: 500, // allow 500 free requests...
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
    
    // Video streaming endpoint
    app.get("/videos/stream/:videoId", async (req, res) => {
      try {
        const videoId = req.params.videoId;
        if (["..","/","\\"].some(ch => videoId.includes(ch))) {
          return res.status(400).send("Invalid video ID");
        }
        const video = await Video.findByPk(videoId);
        if (!video) return res.status(404).send("Video not found");

        if (video.cloudFrontUrl) {
          return res.redirect(video.cloudFrontUrl);
        } else if (video.s3Key) {
          // generate signed URL
          const command = new GetObjectCommand({
            Bucket: process.env.S3_VIDEO_BUCKET,
            Key: video.s3Key
          });
          const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
          return res.redirect(signedUrl);
        } else {
          return res.status(500).send("Video source not available");
        }
      } catch (error) {
        console.error("Error streaming video:", error);
        return res.status(500).send("Server error");
      }
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
    console.error('Unable to start server & sync DB:', err);
    process.exit(1);
  }
}

startServer();