require('dotenv').config();
console.log("🔹 MongoDB URI:", process.env.MONGO_URI);
console.log("🔹 JWT Secret:", process.env.JWT_SECRET);
console.log("🔹 Server Port:", process.env.PORT);

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./modules/user');

const router = express.Router();
const app = express();
app.use(cors());
app.use(express.json());


// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure storage for uploaded videos
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Upload Video Endpoint
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ message: 'Upload successful', filename: req.file.filename });
});

// Stream Video Endpoint
app.get('/stream/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
    }
    res.sendFile(filePath);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err));

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

// Register User
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        res.json({ message: "User registered successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Login User
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Protected Route Example
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Middleware for checking token
function authenticateToken(req, res, next) {
    console.log("🔹 Incoming Authorization Header:", req.header("Authorization"));

    const authHeader = req.header("Authorization");
    if (!authHeader) {
        console.log("No Token Provided!");
        return res.status(401).json({ message: "Access Denied, No Token Provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("🔹 Extracted Token:", token);

    if (!token) {
        console.log("Invalid Token Format!");
        return res.status(401).json({ message: "Invalid Token Format" });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token Verified:", verified);
        req.user = verified;
        next();
    } catch (err) {
        console.log("Invalid Token:", err.message);
        res.status(400).json({ message: "Invalid Token" });
    }
}

// Add Friend API
router.post("/add-friend/:friendUsername", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Logged-in user ID (ObjectId)
        const friendUsername = req.params.friendUsername; // Friend's username (string)

        console.log("🔹 Searching for friend by username:", friendUsername);

        // 🔥 Find the friend's ObjectId using their username
        const friend = await User.findOne({ username: friendUsername });

        if (!friend) return res.status(404).json({ message: "Friend not found" });

        // Ensure we use the ObjectId
        const friendId = friend._id.toString(); 
        console.log("Found Friend ObjectId:", friendId);

        // Find the logged-in user
        const user = await User.findById(userId);

        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: "Already friends" });
        }

        // Store ObjectId in the "friends" array
        user.friends.push(friendId);
        friend.friends.push(userId);

        await user.save();
        await friend.save();

        console.log("Friend added successfully:", friend.username);

        res.json({ message: "Friend added successfully", friend: friend.username });
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});



// Get Friend's Profile API
router.get("/friend-profile/:friendUsername", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const friendUsername = req.params.friendUsername;

        console.log("🔹 Checking profile for:", friendUsername);

        // Find friend's ObjectId by username
        const friend = await User.findOne({ username: friendUsername }).select("-password");

        if (!friend) return res.status(404).json({ message: "Friend not found" });

        // Use ObjectId for comparison
        const friendId = friend._id.toString();
        const user = await User.findById(userId);

        if (!user.friends.includes(friendId)) {
            return res.status(403).json({ message: "You are not friends with this user" });
        }

        console.log("Friend profile found:", friend.username);
        res.json(friend);
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get("/friend-list", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        console.log("🔹 Fetching friends for User ID:", userId);

        // Find user and populate friends
        const user = await User.findById(userId).populate("friends", "username email -_id");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log("Friend list retrieved:", user.friends);

        res.json({ friends: user.friends });
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


app.use("/api/friends", router);
app.use('/api/auth', router);