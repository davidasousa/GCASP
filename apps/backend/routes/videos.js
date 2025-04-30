const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {User, Video } = require("../models");
const router = express.Router();
const ffmpeg = require("fluent-ffmpeg");

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

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // limit to 100MB
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


/**
 * @swagger
 * tags:
 *   name: Video
 *   description: Video management
 */

/**
 * @swagger
 * /videos/upload:
 *   post:
 *     summary: Upload a video file
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, video]
 *             properties:
 *               title:
 *                 type: string
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Only video formats (mp4, mov, mkv, avi, webm), max size 100MB
 *     responses:
 *       200:
 *         description: Video uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 video:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                     duration:
 *                       type: number
 *                       description: Duration in seconds
 *                     resolution:
 *                       type: string
 *                       description: Format "1920x1080"
 *                     status:
 *                       type: string
 *                       enum: [published, hidden]
 *                     processingStatus:
 *                       type: string
 *                       enum: [processing, ready, failed]
 *                       description: Processing state of the video
 *       400:
 *         description: Invalid file or upload error
 */
router.post("/upload", authenticateToken, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const user = await User.findByPk(req.user.id);

  const filepath = path.join(uploadDir, req.file.filename);
  const baseData = {
    userId: req.user.id,
    title: req.body.title,
    filename: req.file.filename,
    size: req.file.size,
    processingStatus: "processing", // start as processing
    username: user?.username || "Unknown",
  };

  try {
    const created = await Video.create(baseData); // create early to get ID

    // Extract metadata
    ffmpeg.ffprobe(filepath, async (err, metadata) => {
      if (err) {
        created.processingStatus = "failed";
        await created.save();
        return res.status(500).json({ message: "Metadata extraction failed", error: err.message });
      }

      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      created.duration = metadata.format.duration;
      created.resolution = `${videoStream.width}x${videoStream.height}`;
      created.processingStatus = "ready";
      await created.save();

      res.json({ message: "Video uploaded", video: created });
    });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /videos/{videoId}:
 *   delete:
 *     summary: Delete a video
 *     tags: [Video]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Video deleted successfully
 */
router.delete("/:videoId", authenticateToken, async (req, res) => {
  const video = await Video.findByPk(req.params.videoId);
  if (!video || video.userId !== req.user.id)
    return res.status(404).json({ message: "Video not found or unauthorized" });

  await video.destroy();
  res.json({ message: "Video deleted" });
});

/**
 * @swagger
 * /videos/{videoId}/hide:
 *   patch:
 *     summary: Hide a video
 *     tags: [Video]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Video hidden
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
 * @swagger
 * /videos/{videoId}/publish:
 *   patch:
 *     summary: Publish a hidden video
 *     tags: [Video]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Video published
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
 * @swagger
 * /shared-videos:
 *   get:
 *     summary: Get all publicly shared videos
 *     tags: [Video]
 *     responses:
 *       200:
 *         description: A list of published videos
 *       500:
 *         description: Server error
 */
router.get("/shared-videos", async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: {
        status: "published",
        processingStatus: "ready",
      },
      include: [{ model: User, attributes: ["username"] }],
      order: [["createdAt", "DESC"]],
    });
    const result = videos.map(video => ({
      id: video.id,
      userId: video.userId,                      // Add userId here!
      title: video.title,
      filename: video.filename,
      resolution: video.resolution,
      duration: video.duration,
      size: video.size,
      status: video.status,
      processingStatus: video.processingStatus,
      username: video.User?.username || "Unknown", // Also keep username
    }));
    res.json({ videos:result });
  } catch (err) {
    console.error("Failed to fetch shared videos:", err);
    res.status(500).json({ error: "Failed to load shared videos" });
  }
});


module.exports = router;
