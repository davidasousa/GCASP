const express = require("express");
const jwt = require("jsonwebtoken");
const { User, Friendship } = require("../models");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Friends
 *   description: Friend management system
 */

function authenticateToken(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "No Token Provided" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid Token Format" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid Token" });
  }
}

/**
 * @swagger
 * /friends/add/{friendUsername}:
 *   post:
 *     summary: Add a user as a friend
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendUsername
 *         required: true
 *         schema:
 *           type: string
 *         description: Username of the friend to add
 *     responses:
 *       200:
 *         description: Friend added
 *       404:
 *         description: User not found
 */

router.post("/add/:friendUsername", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friend = await User.findOne({ where: { username: req.params.friendUsername } });
    if (!friend) return res.status(404).json({ message: "Friend not found" });
    await Friendship.create({ userId, friendId: friend.id });
    res.json({ message: "Friend added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /friends:
 *   get:
 *     summary: Get friend list
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 friends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 */

router.get("/", authenticateToken, async (req, res) => {
  try {
    const friendships = await Friendship.findAll({
      where: { userId: req.user.id },
      include: [{ model: User, as: "Friend", attributes: ["id", "username", "email"] }],
    });

    const friendsList = friendships.map(f => ({
      id: f.Friend.id,
      username: f.Friend.username,
      email: f.Friend.email,
    }));

    res.json({ friends: friendsList });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /friends/profile/{friendUsername}:
 *   get:
 *     summary: Get friend's profile
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendUsername
 *         required: true
 *         schema:
 *           type: string
 *         description: Username of the friend
 *     responses:
 *       200:
 *         description: Friend profile retrieved
 *       403:
 *         description: Not friends with this user
 *       404:
 *         description: Friend not found
 */

router.get("/profile/:friendUsername", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friend = await User.findOne({ where: { username: req.params.friendUsername } });
    if (!friend) return res.status(404).json({ message: "Friend not found" });

    const isFriend = await Friendship.findOne({ where: { userId, friendId: friend.id } });
    if (!isFriend) return res.status(403).json({ message: "You are not friends with this user" });

    res.json({ username: friend.username, email: friend.email });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /friends/remove/{friendUsername}:
 *   delete:
 *     summary: Remove a friend
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendUsername
 *         required: true
 *         schema:
 *           type: string
 *         description: Username of the friend to remove
 *     responses:
 *       200:
 *         description: Friend removed
 *       404:
 *         description: Friend not found
 */

router.delete("/remove/:friendUsername", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friend = await User.findOne({ where: { username: req.params.friendUsername } });
    if (!friend) return res.status(404).json({ message: "Friend not found" });

    await Friendship.destroy({ where: { userId, friendId: friend.id } });
    res.json({ message: "Friend removed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
