const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { Video } = require("../models");
const router = express.Router();
const ffmpeg = require("fluent-ffmpeg");
const uploadDir = path.join(__dirname, "../uploads");

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

  const filepath = path.join(uploadDir, req.file.filename);

  const baseData = {
    userId: req.user.id,
    title: req.body.title,
    filename: req.file.filename, // ensure this is stored
    size: req.file.size,
    processingStatus: "processing",
  };

  try {
    const created = await Video.create(baseData);

    ffmpeg.ffprobe(filepath, async (err, metadata) => {
      if (err) {
        created.processingStatus = "failed";
        await created.save();
        return res.status(500).json({ message: "Metadata extraction failed" });
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
 * /videos/shared:
 *   get:
 *     summary: Get all shared (published) videos with sorting
 *     tags: [Video]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, duration, title]
 *         description: Sort videos by this field (default: createdAt)
 *     responses:
 *       200:
 *         description: List of published videos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       resolution:
 *                         type: string
 *                       duration:
 *                         type: number
 *                       shareUrl:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [published, hidden]
 *                       processingStatus:
 *                         type: string
 *                         enum: [processing, ready, failed]
 *                       uploader:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 */
router.get("/shared", async (req, res) => {
  const videos = await Video.findAll({
    where: {
      status: "published",
      processingStatus: "ready",
    },
    include: {
      association: "User",
      attributes: ["id", "username"],
    },
  });

  const result = videos.map(v => ({
    id: v.id,
    title: v.title,
    filename: v.filename, 
    resolution: v.resolution,
    duration: v.duration,
    status: v.status,
    processingStatus: v.processingStatus,
    shareUrl: `${process.env.APP_URL || "http://localhost:5001"}/videos/stream/${v.filename}`,
    uploader: {
      id: v.User.id,
      username: v.User.username,
    },
    createdAt: v.createdAt, // also useful for “time ago”
  }));

  res.json({ videos: result });
});
const { createReadStream, existsSync } = require("fs");

/**
 * @swagger
 * /stream/{filename}:
 *   get:
 *     summary: Stream a video file
 *     tags: [Video]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Filename of the video to stream
 *     responses:
 *       200:
 *         description: Video stream
 */
router.get("/stream/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Video not found");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });

    file.pipe(res);
  }
});

module.exports = router;
