#!/bin/bash
FFMPEG_URL="https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z"
FFMPEG_OUTPUT="ffmpeg.7z"
DEP_DIR="windowsDependencies"

# Making Dependency Folder
mkdir "$DEP_DIR"

# Downloading FFMPEG For Windows
echo "Downloading FFMPEG For Windows From $FFMPEG_URL..."
wget -O "$FFMPEG_OUTPUT" "$FFMPEG_URL"
# Unziping
7z x "$FFMPEG_OUTPUT"
# Removing 7z And Renaming
rm *.7z
mv ffmpeg* windowsDependencies/ffmpegDir
