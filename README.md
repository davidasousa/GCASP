
# G-CASP 🎮📹  
**Gaming Capture Application & Social Platform**

## Overview
**G-CASP** is a lightweight desktop tool and integrated social platform that allows gamers and internet users to seamlessly capture, edit, and share gameplay highlights. By running silently in the background, it enables users to instantly save the last few moments of video and audio with a single hotkey. G-CASP also provides tools for trimming and compressing clips and uploading them to a community feed or sharing externally.

## Features
- **Reactive Video Capture** – Instantly save the last N seconds of gameplay with a hotkey.
- **Built-in Editor** – Trim and compress clips for easy storage and sharing.
- **Cloud Uploads** – Upload highlights to the G-CASP community platform.
- **Social Platform Integration** – Browse, view, and engage with clips from others.
- **Customizable Settings** – Configure capture resolution, clip length, and target application.

## Why G-CASP?
Unlike tools like OBS or Nvidia Shadowplay, G-CASP:
- Works across most Windows PCs (not GPU-restricted),
- Offers an intuitive user experience with minimal setup,
- Embeds social sharing directly into the workflow,
- Allows flexible file sharing (Discord, Drive, etc.) via compression.

## How It Works
G-CASP has two major components:
1. **Desktop Application (Electron + FFmpeg)**
   - Captures and saves reactive clips
   - Provides local editing and compression tools
   - Enables uploads to the web platform
2. **Web Platform (Node.js + Express + AWS)**
   - Hosts uploaded clips
   - Features a user feed and clip discovery system
   - Handles authentication and video playback

## Technologies Used
| Component       | Technology         |
|----------------|--------------------|
| Desktop UI     | Electron, React    |
| Video Capture  | FFmpeg, fluent-ffmpeg |
| Backend Server | Node.js, Express   |
| Auth           | Passport.js        |
| Storage        | AWS S3, EC2, PostgreSQL |
| Testing/CI     | Jest, GitHub Actions |
| Video Player   | Video.js           |

## Use Cases
- **Reactive Clipping**: Capture gameplay moments without pausing.
- **Editing & Compression**: Trim clips and reduce file size for easy sharing.
- **Uploading**: Seamlessly share highlights on the G-CASP platform.
- **Social Browsing**: View trending clips and support your friends.

## Getting Started
> Requirements: Node.js, FFmpeg, PostgreSQL, AWS credentials

### Clone the Repository
```bash
git clone https://github.com/davidasousa/GCASP.git
cd GCASP
```

### Install Dependencies
```bash
npm install
```

### Set Up Environment Variables
Create a `.env` file with the following fields:
```env
PORT=5000
DATABASE_URL=your_postgresql_db
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
JWT_SECRET=your_jwt_secret
```

### Run the Application
```bash
npm start
```

## Contributing
Feel free to fork this repository and submit pull requests! For larger changes, please open an issue first to discuss your ideas.

## License
This project is licensed under the MIT License.

## Authors
- David Sousa (dsousa@purdue.edu)  
- Robert Rozhanskyy (rrozhans@purdue.edu)  
- Yilong Peng (peng280@purdue.edu)
