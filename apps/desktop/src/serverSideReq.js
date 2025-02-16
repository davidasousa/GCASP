// Server Side Request Handeling

import fs from 'fs';
import path from 'node:path';
import express from 'express';

export async function loadMP4File(server) {
	// Server Side File Sending
	server.get(`/videos/:videoTimestamp`, async (req, res) => {
		const newpath = path.join(
			__dirname, 
			`../../currentVideos/output${req.params.videoTimestamp}.mp4`
		);

		fs.access(newpath, fs.constants.F_OK, (err) => {
			if (err) { res.status(404).send("Video Not Found"); }
			res.sendFile(newpath);
		});
	});
}
