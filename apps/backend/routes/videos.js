const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { Video } = require("../models");
const router = express.Router();

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
 *                 description: "Only .mp4, .mov, .avi, .mkv, .webm formats allowed. Max size: 100MB"
 *     responses:
 *       200:
 *         description: Video uploaded successfully
 *       400:
 *         description: Invalid file type or size exceeded
 */

router.post("/upload", authenticateToken, upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const newVideo = await Video.create({
    userId: req.user.id,
    title: req.body.title,
    filename: req.file.filename,
  });

  res.json({ message: "Video uploaded", video: newVideo });
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

module.exports = router;
