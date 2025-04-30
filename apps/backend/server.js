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
const { Video } = require("./models");
const isProd = process.env.PROD === "true";

let s3;
if (isProd) {
  const AWS = require('aws-sdk');
  AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_AWS,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS,
    region: process.env.REGION_AWS || 'us-east-2'
  });
  s3 = new AWS.S3();
}

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
        
        // Security check to prevent path traversal
        if (videoId.includes('..') || videoId.includes('/') || videoId.includes('\\')) {
          return res.status(400).send("Invalid video ID");
        }
        
        // Find video in database
        const video = await Video.findByPk(videoId);
        if (!video) {
          return res.status(404).send("Video not found");
        }
        
        // Handle CloudFront URL
        if (video.cloudFrontUrl) {
          return res.redirect(video.cloudFrontUrl);
        } 
        else if (video.s3Key) {
          // Generate CloudFront URL if not in database
          const cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${video.s3Key}`;
          
          // Update video record with CloudFront URL for future use
          video.cloudFrontUrl = cloudFrontUrl;
          await video.save();
          
          return res.redirect(cloudFrontUrl);
        }
        else if (video.s3Location) {
          // Generate a signed URL for private S3 objects
          const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_VIDEO_BUCKET,
            Key: video.s3Key,
            Expires: 60 // URL valid for 60 seconds
          });
          
          return res.redirect(signedUrl);
        } 
        else {
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
    console.error('Unable to start server & synch DB:', err);
    process.exit(1);
  }
}

startServer();