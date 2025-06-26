const { downloadYtVideo, downloadYtVideoWithCookies } = require('../services/downloadVideo.service');
const path = require('path');
const fs = require('fs');

const downloadYt = async (req, res) => {
    try {
        const { url, platform = 'youtube' } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        console.log('Starting download process for:', url);

        const result = await downloadYtVideo(url, platform);

        if (result.success) {
            // Double-check that file exists before responding
            if (!fs.existsSync(result.filePath)) {
                console.error('File was reported as downloaded but does not exist:', result.filePath);
                return res.status(500).json({
                    success: false,
                    message: 'Download completed but file not accessible'
                });
            }

            // Create download URL
            const downloadUrl = `/api/download-file/${encodeURIComponent(result.fileName)}`;

            return res.json({
                success: true,
                message: result.message,
                fileName: result.fileName,
                downloadUrl: downloadUrl,
                filePath: result.filePath
            });
        } else {
            console.error('Download failed:', result.error);
            return res.status(400).json({
                success: false,
                message: result.error || 'Download failed'
            });
        }

    } catch (error) {
        console.error('Controller error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during download'
        });
    }
};

const serveFile = async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(process.cwd(), 'downloads', filename);

        console.log('Serving file:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Set appropriate headers
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fileSize);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error streaming file'
                });
            }
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('Serve file error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error serving file'
        });
    }
};

module.exports = {
    downloadYt,
    serveFile
};