import fs from 'fs';
import path from 'node:path';
import express from 'express';

export const loadMP4File = (filepath, server, port) => {
	// Serve video file
	filepath = path.resolve(__dirname,'../../', filepath);
	console.log(filepath);

	server.get('/video', (req, res) => {
		res.setHeader('Content-Type', 'video/mp4');
		res.sendFile(filepath);
	});

	server.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
}
