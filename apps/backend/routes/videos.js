const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const { User, Video, Friendship } = require("../models");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {S3Client, PutObjectCommand, DeleteObjectCommand} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure AWS from environment variables
const s3Client = new S3Client({
  region: process.env.REGION_AWS || 'us-east-2',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_AWS,
    secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS
  }
});

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

// Step 1: Request a presigned URL for upload
router.post("/request-upload-url", authenticateToken, async (req, res) => {
  console.log("=== /videos/request-upload-url called ===");
  console.log("  Authenticated user ID:", req.user?.id);
  console.log("  Requested filename:", req.body.filename);
  console.log("  Content type:", req.body.contentType);
  
  try {
    // Validate request
    if (!req.body.filename || !req.body.contentType) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        required: ["filename", "contentType"] 
      });
    }
    
    // Sanitize filename
    const safeFilename = path.basename(req.body.filename)
      .replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Generate unique ID for this upload
    const videoId = uuidv4();
    
    // Create S3 key (path)
    const s3Key = `users/${req.user.id}/videos/${videoId}/${safeFilename}`;
    console.log("  Generated S3 key:", s3Key);
    
    // Create command for presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.S3_VIDEO_BUCKET,
      Key: s3Key,
      ContentType: req.body.contentType
    });
    
    // Generate presigned URL
    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 // URL valid for 1 hour
    });
    console.log("  Presigned URL generated with 1 hour expiry");
    
    // Generate CloudFront URL for later use
    const cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
    
    // Return the presigned URL and related info
    res.json({
      uploadUrl: signedUrl,
      videoId,
      s3Key,
      cloudFrontUrl
    });
  } catch (error) {
    console.error("  → Error generating presigned URL:", error);
    res.status(500).json({ 
      message: "Failed to generate upload URL", 
      error: error.message 
    });
  }
});

// Step 2: Complete the upload process after file is uploaded to S3
router.post("/complete-upload", authenticateToken, async (req, res) => {
  console.log("=== /videos/complete-upload called ===");
  console.log("  Authenticated user ID:", req.user?.id);
  console.log("  Video ID:", req.body.videoId);
  console.log("  S3 Key:", req.body.s3Key);
  
  try {
    // Validate request
    if (!req.body.videoId || !req.body.s3Key || !req.body.title) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        required: ["videoId", "s3Key", "title"] 
      });
    }
    
    // Confirm user exists
    const user = await User.findByPk(req.user.id);
    if (!user) {
      console.log("  → User not found in DB:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }
    
    // Generate CloudFront URL
    const cloudFrontUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${req.body.s3Key}`;
    console.log("  CloudFront URL:", cloudFrontUrl);
    
    // Extract metadata from request
    let metadata = {};
    try {
      metadata = req.body.metadata
        ? (typeof req.body.metadata === 'string' 
          ? JSON.parse(req.body.metadata) 
          : req.body.metadata)
        : {};
      console.log("  Processed metadata:", metadata);
    } catch (parseErr) {
      console.warn("  Failed to parse metadata:", parseErr.message);
    }
    
    // Create video record in database
    console.log("  Creating Video record in DB...");
    const created = await Video.create({
      id: req.body.videoId, // Use the ID generated at request time
      userId: req.user.id,
      title: req.body.title,
      filename: path.basename(req.body.s3Key),
      size: req.body.fileSize || 0,
      processingStatus: "ready",
      username: user.username,
      s3Key: req.body.s3Key,
      cloudFrontUrl,
      duration: metadata.duration || 0,
      resolution: metadata.width && metadata.height
        ? `${metadata.width}x${metadata.height}`
        : undefined
    });
    console.log("  Video.create() result:", created.id);
    
    // Return success response
    res.json({
      message: "Video upload completed and recorded successfully",
      video: {
        id: created.id,
        title: created.title,
        videoUrl: cloudFrontUrl,
        duration: created.duration,
        resolution: created.resolution
      }
    });
  } catch (error) {
    console.error("  → Complete upload error:", error);
    res.status(500).json({ 
      message: "Server error recording upload", 
      error: error.message 
    });
  }
});

/**
 * Delete a video
 */
router.delete("/:videoId", authenticateToken, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });
    if (video.userId !== req.user.id) return res.status(403).json({ message: "Unauthorized" });
    if (video.s3Key) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_VIDEO_BUCKET, Key: video.s3Key }));
      console.log(`Deleted S3 object: ${video.s3Key}`);
    }
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

// Get all videos uploaded by the authenticated user
router.get("/my-videos", authenticateToken, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		if (page < 1 || limit < 1 || limit > 50) {
			return res.status(400).json({
				error: "Invalid pagination parameters. Page >=1, limit 1-50"
			});
		}

		const offset = (page - 1) * limit;
		// fetch only this user's videos
		const { count, rows } = await Video.findAndCountAll({
			where: { userId: req.user.id },
			order: [["createdAt", "DESC"]],
			limit,
			offset
		});

		// map to JSON + ensure URL
		const videos = rows.map(v => {
			const json = v.toJSON();
			json.cloudFrontUrl = json.cloudFrontUrl ||
				`https://${process.env.CLOUDFRONT_DOMAIN}/${json.s3Key}`;
			json.videoUrl = json.cloudFrontUrl;
			json.uploadedAt = new Date(json.createdAt).toLocaleString();
			return json;
		});

		res.json({
			videos,
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
		console.error("[my-videos]", err);
		res.status(500).json({ error: "Failed to fetch your videos" });
	}
});

/**
 * Get videos uploaded by users you follow (your “friends”)
 */
router.get("/friends-videos", authenticateToken, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		if (page < 1 || limit < 1 || limit > 50) {
			return res.status(400).json({
				error: "Invalid pagination parameters. Page >=1, limit 1-50"
			});
		}

		// 1) get your friendIds
		const friendships = await Friendship.findAll({
			where: { userId: req.user.id },
			attributes: ["friendId"]
		});
		const friendIds = friendships.map(f => f.friendId);

		// 2) query their videos
		const offset = (page - 1) * limit;
		const { count, rows } = await Video.findAndCountAll({
			where: {
				userId: friendIds,
				status: "published",
				processingStatus: "ready"
			},
			order: [["createdAt", "DESC"]],
			limit,
			offset,
			include: [{ model: User, attributes: ["username"], required: false }]
		});

		// 3) format payload
		const videos = rows.map(video => {
			const json = video.toJSON();
			json.cloudFrontUrl ||= `https://${process.env.CLOUDFRONT_DOMAIN}/${json.s3Key}`;
			json.videoUrl = json.cloudFrontUrl;
			json.username = video.User?.username;
			json.uploadedAt = new Date(json.createdAt).toLocaleString();
			return json;
		});

		res.json({
			videos,
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
		console.error("[friends-videos]", err);
		res.status(500).json({ error: "Failed to fetch friends' videos" });
	}
});

module.exports = router;