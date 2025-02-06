import fs from 'fs';
import path from 'node:path';
import express from 'express';

export const loadMP4File = (filepath, server, port) => {
	// Serve video file
	filepath = path.resolve(__dirname,'../../', filepath);
	console.log(filepath);

	// Send File As Video
	server.get('/video', (req, res) => {
		if(!fs.existsSync(filepath)) {
			return res.status(404).send('Video Not Found');
		}
		res.setHeader('Content-Type', 'video/mp4');
		res.sendFile(filepath);
		return res.status(200).send('Video Found & Sent');
	});

	// Log To Console
	server.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
}
