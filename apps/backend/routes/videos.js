const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const { User, Video } = require("../models");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Configure AWS from environment variables
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_AWS,
  secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS,
  region: process.env.REGION_AWS || 'us-east-2'
});

// Create S3 service object
const s3 = new AWS.S3();

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

// Configure S3 storage
const storage = multerS3({
  s3: s3,
  bucket: process.env.S3_VIDEO_BUCKET,
  acl: 'private',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    // Generate unique ID for the video
    const videoId = uuidv4();
    
    // Extract user info
    const userId = req.user ? req.user.id : 'anonymous';
    
    // Get original filename without special characters to avoid S3 issues
    const sanitizedFilename = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Create organized folder structure: users/{userId}/videos/{videoId}/{filename}
    const key = `users/${userId}/videos/${videoId}/${sanitizedFilename}`;
    
    // Store videoId for later use
    req.videoId = videoId;
    
    cb(null, key);
  },
  metadata: function (req, file, cb) {
    cb(null, { 
      fieldName: file.fieldname,
      userId: req.user ? req.user.id : 'anonymous',
      contentType: file.mimetype
    });
  }
});

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
    
    const s3Key = req.file.key;
    const s3Location = req.file.location;
    
    // Create CloudFront URL
    const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
    if (!cloudFrontDomain) {
      return res.status(500).json({ message: "CloudFront domain not configured" });
    }
    
    const cloudFrontUrl = `https://${cloudFrontDomain}/${s3Key}`;
    
    // Parse metadata from request body
    let metadata = {};
    try {
      if (req.body.metadata) {
        metadata = JSON.parse(req.body.metadata);
      }
    } catch (parseError) {
      console.error("Error parsing metadata:", parseError);
      // Continue with upload even if metadata parsing fails
    }
    
    // Create database record with metadata
    const created = await Video.create({
      userId: req.user.id,
      title: req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      filename: path.basename(req.file.originalname),
      size: req.file.size,
      processingStatus: "ready",
      username: user.username,
      s3Key: s3Key,
      s3Location: s3Location,
      cloudFrontUrl: cloudFrontUrl,
      duration: metadata.duration || 0,
      resolution: (metadata.width && metadata.height) ? 
        `${metadata.width}x${metadata.height}` : undefined
    });
    
    // Respond with the created video
    res.json({ 
      message: "Video uploaded successfully",
      video: {
        id: created.id,
        title: created.title,
        videoUrl: cloudFrontUrl,
        duration: created.duration,
        resolution: created.resolution
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
    
    if (video.s3Key) {
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
    // Parse pagination parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({ 
        error: "Invalid pagination parameters. Page must be >= 1 and limit between 1-50" 
      });
    }
    
    // Calculate offset for SQL query
    const offset = (page - 1) * limit;
    
    // Get total count and paginated results
    const { count, rows } = await Video.findAndCountAll({
      where: {
        status: "published",
        processingStatus: "ready",
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      // Include username for display purposes
      include: [
        {
          model: User,
          attributes: ['username'],
          required: false
        }
      ]
    });
    
    // Process videos to ensure they have CloudFront URLs
    const processedVideos = rows.map(video => {
      const videoJson = video.toJSON();
      
      // Make sure CloudFront URL exists
      if (!videoJson.cloudFrontUrl && videoJson.s3Key) {
        videoJson.cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${videoJson.s3Key}`;
        
        // Update in database if missing
        Video.update(
          { cloudFrontUrl: videoJson.cloudFrontUrl },
          { where: { id: video.id } }
        ).catch(err => console.error(`Error updating CloudFront URL: ${err}`));
      }
      
      // Use username from User relationship if available
      if (video.User && video.User.username && !videoJson.username) {
        videoJson.username = video.User.username;
      }
      
      // Set videoUrl property for frontend consumption
      videoJson.videoUrl = videoJson.cloudFrontUrl || 
                          `/videos/stream/${video.id}`;
      
      // Add formatted timestamp
      videoJson.uploadedAt = new Date(videoJson.createdAt).toLocaleString();
      
      return videoJson;
    });
    
    // Return videos with pagination metadata
    res.json({ 
      videos: processedVideos,
      pagination: {
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < Math.ceil(count / limit),
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Failed to fetch shared videos:", err);
    res.status(500).json({ 
      error: "Failed to load shared videos",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Refresh a video's CloudFront URL (handles token expiration)
 */
router.get("/:videoId/refresh-url", authenticateToken, async (req, res) => {
	try {
		const video = await Video.findByPk(req.params.videoId);
		if (!video) {
			return res.status(404).json({ message: "Video not found" });
		}
		
		// Generate a fresh CloudFront URL
		const cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${video.s3Key}`;
		
		// Update video record with new CloudFront URL
		video.cloudFrontUrl = cloudFrontUrl;
		await video.save();
		
		res.json({
			id: video.id,
			cloudFrontUrl: cloudFrontUrl
		});
	} catch (error) {
		console.error("Error refreshing video URL:", error);
		res.status(500).json({ message: "Server error", error: error.message });
	}
});

module.exports = router;