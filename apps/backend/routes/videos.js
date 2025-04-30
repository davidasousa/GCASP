const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { User, Video } = require("../models");
const router = express.Router();
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require('uuid');

// Determine if we're running in production mode
const isProd = process.env.PROD === "true";
console.log(`Running in ${isProd ? "PRODUCTION" : "DEVELOPMENT"} mode`);

// AWS S3 setup (only load if in production)
let s3, multerS3;
if (isProd) {
  const AWS = require('aws-sdk');
  multerS3 = require('multer-s3');
  
  // Configure AWS from environment variables
  AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_AWS,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS,
    region: process.env.REGION_AWS || 'us-east-2'
  });
  
  // Create S3 service object
  s3 = new AWS.S3();
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access Denied" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid Token" });
  }
}

// Configure storage based on environment
let storage;
let uploadDir;

if (isProd) {
  // === PRODUCTION: S3 STORAGE ===
  storage = multerS3({
    s3: s3,
    bucket: process.env.S3_VIDEO_BUCKET,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      // Generate unique ID for the video
      const videoId = uuidv4();
      
      // Extract user info
      const userId = req.user ? req.user.id : 'anonymous';
      
      // Create folder structure: videos/userId/videoId/filename
      const key = `videos/${userId}/${videoId}/${path.basename(file.originalname)}`;
      
      // Store videoId for later use
      req.videoId = videoId;
      
      cb(null, key);
    },
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    }
  });
} else {
  // === DEVELOPMENT: LOCAL STORAGE ===
  uploadDir = path.join(__dirname, "../uploads");
  
  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadDir}`);
  }
  
  storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      // Generate unique filename using uuid
      const videoId = uuidv4();
      const filename = `${videoId}-${file.originalname}`;
      // Store videoId for later use
      req.videoId = videoId;
      cb(null, filename);
    }
  });
}

// Setup upload with size limit and file type filtering
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // limit to 200MB
  fileFilter: (req, file, cb) => {
    const filetypes = /mp4|mov|avi|mkv|webm/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith("video/");

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files are allowed!"));
    }
  },
});

// Upload video endpoint
router.post("/upload", authenticateToken, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    let baseData;
    
    if (isProd) {
      // === S3 STORAGE HANDLING ===
      const s3Key = req.file.key;
      const s3Location = req.file.location;
      const cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
      
      baseData = {
        userId: req.user.id,
        title: req.body.title,
        filename: path.basename(req.file.originalname),
        size: req.file.size,
        processingStatus: "processing",
        username: user?.username || "Unknown",
        s3Key: s3Key,
        s3Location: s3Location,
        cloudFrontUrl: cloudFrontUrl
      };
    } else {
      // === LOCAL STORAGE HANDLING ===
      const filepath = req.file.path;
      const filename = req.file.filename;
      
      baseData = {
        userId: req.user.id,
        title: req.body.title,
        filename: filename,
        size: req.file.size,
        processingStatus: "processing",
        username: user?.username || "Unknown"
      };
    }
    
    // Create initial database record
    const created = await Video.create(baseData);
    
    // Process metadata differently based on environment
    if (isProd) {
      // Run ffprobe against the S3 file
      try {
        // Get a signed URL for ffprobe
        const signedUrl = s3.getSignedUrl('getObject', {
          Bucket: process.env.S3_VIDEO_BUCKET,
          Key: baseData.s3Key,
          Expires: 60 // URL expires in 60 seconds
        });
        
        // Extract metadata using ffprobe
        ffmpeg.ffprobe(signedUrl, async (err, metadata) => {
          if (err) {
            created.processingStatus = "failed";
            await created.save();
            console.error("Metadata extraction failed:", err);
            return;
          }
          
          try {
            const videoStream = metadata.streams.find(s => s.codec_type === "video");
            if (videoStream) {
              created.duration = metadata.format.duration;
              created.resolution = `${videoStream.width}x${videoStream.height}`;
              created.processingStatus = "ready";
              await created.save();
              console.log("Video metadata updated successfully");
            } else {
              created.processingStatus = "failed";
              await created.save();
              console.error("No video stream found in file");
            }
          } catch (updateErr) {
            console.error("Error updating video metadata:", updateErr);
          }
        });
      } catch (ffprobeErr) {
        console.error("Error during ffprobe extraction:", ffprobeErr);
        // Still continue with the upload
      }
    } else {
      // Local file - extract metadata directly
      const filepath = req.file.path;
      
      // Extract metadata
      ffmpeg.ffprobe(filepath, async (err, metadata) => {
        if (err) {
          created.processingStatus = "failed";
          await created.save();
          console.error("Metadata extraction failed:", err);
          return;
        }
        
        const videoStream = metadata.streams.find(s => s.codec_type === "video");
        if (videoStream) {
          created.duration = metadata.format.duration;
          created.resolution = `${videoStream.width}x${videoStream.height}`;
          created.processingStatus = "ready";
          await created.save();
        } else {
          created.processingStatus = "failed";
          await created.save();
        }
      });
    }
    
    // Respond with appropriate video URL based on environment
    let videoUrl;
    if (isProd) {
      videoUrl = baseData.cloudFrontUrl;
    } else {
      videoUrl = `/videos/stream/${created.id}`;
    }
    
    // Respond immediately without waiting for ffprobe
    res.json({ 
      message: "Video uploaded",
      video: {
        id: created.id,
        title: created.title,
        videoUrl: videoUrl
      }
    });
    
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * Delete a video
 */
router.delete("/:videoId", authenticateToken, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    
    if (video.userId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to delete this video" });
    }
    
    if (isProd && video.s3Key) {
      // Delete from S3
      const params = {
        Bucket: process.env.S3_VIDEO_BUCKET,
        Key: video.s3Key
      };
      
      try {
        await s3.deleteObject(params).promise();
        console.log(`Deleted S3 object: ${video.s3Key}`);
      } catch (s3Error) {
        console.error("Error deleting from S3:", s3Error);
        // Continue with DB deletion even if S3 deletion fails
      }
    } else if (!isProd) {
      // Delete local file if it exists
      const localFiles = fs.readdirSync(uploadDir);
      const videoFile = localFiles.find(file => file.startsWith(video.filename));
      
      if (videoFile) {
        const filePath = path.join(uploadDir, videoFile);
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted local file: ${filePath}`);
        } catch (fileError) {
          console.error("Error deleting local file:", fileError);
        }
      }
    }
    
    // Delete from database
    await video.destroy();
    res.json({ message: "Video deleted successfully" });
    
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * Hide a video
 */
router.patch("/:videoId/hide", authenticateToken, async (req, res) => {
  const video = await Video.findByPk(req.params.videoId);
  if (!video || video.userId !== req.user.id)
    return res.status(404).json({ message: "Video not found or unauthorized" });

  video.status = "hidden";
  await video.save();
  res.json({ message: "Video hidden" });
});

/**
 * Publish a hidden video
 */
router.patch("/:videoId/publish", authenticateToken, async (req, res) => {
  const video = await Video.findByPk(req.params.videoId);
  if (!video || video.userId !== req.user.id)
    return res.status(404).json({ message: "Video not found or unauthorized" });

  video.status = "published";
  await video.save();
  res.json({ message: "Video published" });
});

/**
 * Get all publicly shared videos
 */
router.get("/shared-videos", async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: {
        status: "published",
        processingStatus: "ready",
      },
      order: [["createdAt", "DESC"]],
    });
    
    // Process videos based on environment
    const processedVideos = videos.map(video => {
      const videoJson = video.toJSON();
      
      if (isProd) {
        // Use CloudFront URL for production
        if (!videoJson.cloudFrontUrl && videoJson.s3Key) {
          videoJson.cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${videoJson.s3Key}`;
        }
        videoJson.videoUrl = videoJson.cloudFrontUrl;
      } else {
        // Use local streaming endpoint for development
        videoJson.videoUrl = `/videos/stream/${videoJson.id}`;
      }
      
      return videoJson;
    });
    
    res.json({ videos: processedVideos });
  } catch (err) {
    console.error("Failed to fetch shared videos:", err);
    res.status(500).json({ error: "Failed to load shared videos" });
  }
});

module.exports = router;