# G-CASP  
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

## Use Cases
- **Reactive Clipping**: Capture gameplay moments without pausing.
- **Editing & Compression**: Trim clips and reduce file size for easy sharing.
- **Uploading**: Seamlessly share highlights on the G-CASP platform.
- **Social Browsing**: View trending clips and support your friends.

## Getting Started

### Step 1: Download
Head to the [Releases](https://github.com/davidasousa/GCASP/releases) section of the repository and download the latest version of G-CASP for Windows.

### Step 2: Install
Run the installer and follow the on-screen instructions to complete the setup.

### Step 3: Launch & Configure
Once installed, open G-CASP from your desktop or Start Menu. Set up your preferences like:
- Clip length (e.g., last 30 seconds)
- Video resolution (default: 1080p, 30fps)
- Hotkey for clipping
- Target game window or screen

### Step 4: Record & Share
Start gaming! Use your configured hotkey to capture highlights. Trim or compress your clips and upload them to the G-CASP platform or share them anywhere.

## Support
If you experience issues or have feedback, feel free to open an issue in the GitHub repository or contact us directly.

## Authors
- David Sousa (dsousa@purdue.edu)  
- Robert Rozhanskyy (rrozhans@purdue.edu)  
- Yilong Peng (peng280@purdue.edu)
