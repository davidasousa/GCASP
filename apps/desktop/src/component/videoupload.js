import React, { useState } from "react";
import axios from "axios";

const VideoUpload = () => {
    const [file, setFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState("");

    const handleUpload = async () => {
        if (!file) return alert("Please select a file.");
        const formData = new FormData();
        formData.append("video", file);

        try {
            const response = await axios.post("http://localhost:5001/upload", formData);
            setVideoUrl(`http://localhost:5001/stream/${response.data.filename}`);
        } catch (error) {
            console.error("Upload failed", error);
        }
    };

    return (
        <div>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0])} />
            <button onClick={handleUpload}>Upload Video</button>
            {videoUrl && <video src={videoUrl} controls width="500"></video>}
        </div>
    );
};

export default VideoUpload;
