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

app.use('/api/auth', router);