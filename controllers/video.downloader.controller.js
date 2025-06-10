const { downloadYtVideo } = require('../services/downloadVideo.service');
const fs = require('fs');
const path = require('path');

// Validation function for download input
function validateDownloadInput({ url, platform }) {
    if (!url) {
        throw new Error('URL is required');
    }

    if (!platform) {
        throw new Error('Platform is required');
    }

    // Validate URL format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url)) {
        throw new Error('Invalid URL format');
    }

    // Validate platform
    const supportedPlatforms = ['youtube', 'instagram'];
    if (!supportedPlatforms.includes(platform.toLowerCase())) {
        throw new Error('Unsupported platform. Supported platforms: youtube, instagram');
    }
}

// Download and immediately serve the file
async function downloadAndServe(req, res, next) {
    try {
        const { url, platform } = req.body;

        // Validate input
        validateDownloadInput({ url, platform });

        console.log('Starting download for:', url, 'Platform:', platform);

        // Call the download service
        const result = await downloadYtVideo(url, platform);

        // Check if download was successful
        if (!result.success) {
            console.error('Download service failed:', result.error);
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        const filePath = result.filePath;
        console.log('Download completed, file path:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found at:', filePath);
            return res.status(404).json({
                success: false,
                error: 'Downloaded file not found'
            });
        }

        // Get file stats for proper headers
        const stats = fs.statSync(filePath);
        const ext = path.extname(result.fileName).toLowerCase();

        // Set appropriate content type
        let contentType = 'video/mp4';
        if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mkv') contentType = 'video/x-matroska';
        else if (ext === '.avi') contentType = 'video/x-msvideo';

        console.log('Serving file:', result.fileName, 'Size:', stats.size, 'Type:', contentType);

        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');

        // Stream the file to user
        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error streaming file' });
            }
        });

        fileStream.on('end', () => {
            console.log('File stream completed for:', result.fileName);
            // Optional: Delete file after sending to save server space
            setTimeout(() => {
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error deleting file:', err);
                    else console.log('File deleted after download:', result.fileName);
                });
            }, 1000); // Wait 1 second before deleting
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('downloadAndServe error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

// Alternative: Just return download info (for frontend to handle)
async function downloadYt(req, res, next) {
    try {
        const { url, platform } = req.body;

        // Validate input
        validateDownloadInput({ url, platform });

        console.log('Starting download process for:', url);

        // Call the download service
        const result = await downloadYtVideo(url, platform);

        // Check if download was successful
        if (!result.success) {
            console.error('Download failed:', result.error);
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        console.log('Download successful:', result.fileName);

        // Return success with actual filename
        res.json({
            success: true,
            message: 'click the below link to download your file',
            downloadUrl: `/api/download-file/${encodeURIComponent(result.fileName)}`,
            fileName: result.fileName,
            fileSize: fs.existsSync(result.filePath) ? fs.statSync(result.filePath).size : 0
        });

    } catch (error) {
        console.error('downloadYt error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Serve individual files with better error handling
async function serveFile(req, res, next) {
    try {
        const { filename } = req.params;
        const decodedFilename = decodeURIComponent(filename);
        const filePath = path.join('./downloads', decodedFilename);

        console.log('Serving file request for:', decodedFilename);
        console.log('Full file path:', filePath);
s
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return res.status(404).json({
                success: false,
                error: 'File not found',
                requestedFile: decodedFilename
            });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const ext = path.extname(decodedFilename).toLowerCase();

        // Set appropriate content type
        let contentType = 'video/mp4';
        if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mkv') contentType = 'video/x-matroska';
        else if (ext === '.avi') contentType = 'video/x-msvideo';

        console.log('File found, serving:', decodedFilename, 'Size:', stats.size);

        // Set headers for download with CORS
        res.setHeader('Content-Disposition', `attachment; filename="${decodedFilename}"`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');

        // Stream file
        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Error streaming file'
                });
            }
        });

        fileStream.on('end', () => {
            console.log('File streaming completed for:', decodedFilename);
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('serveFile error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

// Debug endpoint to list available files
async function listFiles(req, res) {
    try {
        const downloadPath = './downloads';

        if (!fs.existsSync(downloadPath)) {
            return res.json({
                success: true,
                files: [],
                message: 'Downloads directory does not exist'
            });
        }

        const files = fs.readdirSync(downloadPath).map(filename => {
            const filePath = path.join(downloadPath, filename);
            const stats = fs.statSync(filePath);
            return {
                filename,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        });

        res.json({
            success: true,
            files,
            count: files.length
        });

    } catch (error) {
        console.error('listFiles error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    downloadYt,
    downloadAndServe,
    serveFile,
    listFiles
};