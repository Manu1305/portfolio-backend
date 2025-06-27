const { downloadYtVideo, downloadYtVideoWithCookies } = require('../services/downloadVideo.service');
const { downloadFromS3Url, downloadFromS3, deleteFromS3, getPresignedUrl } = require('../config/helpers');
const path = require('path');
const fs = require('fs');

const downloadYt = async (req, res) => {
    try {
        const { url, platform = 'youtube', useCookies = false } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        // Validate URL format
        const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/i;
        if (!urlPattern.test(url)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid YouTube URL format'
            });
        }

        console.log('Starting download process for:', url);
        console.log('Platform:', platform);
        console.log('Use cookies:', useCookies);

        let result;

        if (useCookies) {
            // Try with cookies first
            result = await downloadYtVideoWithCookies(url, platform);

            // If cookies method fails, fall back to regular method
            if (!result.success) {
                console.log('Cookie method failed, trying regular method...');
                result = await downloadYtVideo(url);
            }
        } else {
            result = await downloadYtVideo(url);
        }

        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                fileName: result.fileName,
                s3Url: result.s3Url,
                videoInfo: result.videoInfo
            });
        } else {
            console.error('Download failed:', result.error);

            // Provide more specific error messages
            let errorMessage = result.error;
            if (result.error.includes('Video unavailable')) {
                errorMessage = 'Video is unavailable or private';
            } else if (result.error.includes('Sign in to confirm')) {
                errorMessage = 'Video requires sign-in to access';
            } else if (result.error.includes('This video is not available')) {
                errorMessage = 'Video is not available in your region';
            }

            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }

    } catch (error) {
        console.error('Controller error:', error);

        // Handle specific error types
        if (error.message.includes('ENOTFOUND')) {
            return res.status(400).json({
                success: false,
                message: 'Network error: Could not connect to YouTube'
            });
        } else if (error.message.includes('timeout')) {
            return res.status(408).json({
                success: false,
                message: 'Download timeout: Please try again'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error during download'
        });
    }
};

// New endpoint to download video from S3 URL
const downloadFromS3Video = async (req, res) => {
    try {
        const { s3Url, fileName } = req.body;

        if (!s3Url) {
            return res.status(400).json({
                success: false,
                message: 'S3 URL is required'
            });
        }

        console.log('Downloading video from S3:', s3Url);

        // Optional: specify custom local file path
        let localFilePath = null;
        if (fileName) {
            const downloadDir = './downloads';
            localFilePath = path.join(downloadDir, fileName);
        }

        const result = await downloadFromS3Url(s3Url, localFilePath);

        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                localFilePath: result.localFilePath,
                fileSize: result.fileSize
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

    } catch (error) {
        console.error('S3 download error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error downloading from S3'
        });
    }
};

// Enhanced serve file endpoint that can also download from S3 if file not found locally
const serveFile = async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(process.cwd(), 'downloads', filename);

        console.log('Serving file:', filePath);

        // Check if file exists locally
        if (!fs.existsSync(filePath)) {
            console.log('File not found locally, checking if we should download from S3...');

            // You could implement logic here to download from S3 if you have the S3 key
            // For now, just return file not found
            console.error('File not found:', filePath);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Set appropriate headers for download (not streaming)
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fileSize);

        // Read entire file into memory and send it
        const fileBuffer = fs.readFileSync(filePath);
        res.send(fileBuffer);

    } catch (error) {
        console.error('Serve file error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error serving file'
        });
    }
};

// Endpoint to serve file directly from S3 (downloads the file first, then serves it)
const serveFromS3 = async (req, res) => {
    try {
        const { s3Url } = req.body;

        if (!s3Url) {
            return res.status(400).json({
                success: false,
                message: 'S3 URL is required'
            });
        }

        console.log('Downloading and serving file from S3:', s3Url);

        // Download from S3 first
        const downloadResult = await downloadFromS3Url(s3Url);

        if (!downloadResult.success) {
            return res.status(400).json({
                success: false,
                message: downloadResult.error
            });
        }

        const filePath = downloadResult.localFilePath;
        const filename = path.basename(filePath);

        // Set headers for download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', downloadResult.fileSize);

        // Read and send file
        const fileBuffer = fs.readFileSync(filePath);
        res.send(fileBuffer);

        // Optional: Clean up the downloaded file after serving
        setTimeout(() => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Cleaned up temporary file:', filePath);
                }
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError.message);
            }
        }, 1000);

    } catch (error) {
        console.error('Serve from S3 error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error serving file from S3'
        });
    }
};

// New endpoint to get video info without downloading
const getVideoInfo = async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        const YtDlpWrap = require('yt-dlp-wrap').default;
        const ytDlpWrap = new YtDlpWrap();

        const options = [
            url,
            '--dump-json',
            '--no-playlist',
            '--skip-download'
        ];

        const result = await ytDlpWrap.execPromise(options);
        const videoInfo = JSON.parse(result);

        return res.json({
            success: true,
            videoInfo: {
                title: videoInfo.title,
                duration: videoInfo.duration,
                uploader: videoInfo.uploader,
                description: videoInfo.description,
                thumbnail: videoInfo.thumbnail,
                view_count: videoInfo.view_count,
                upload_date: videoInfo.upload_date
            }
        });

    } catch (error) {
        console.error('Get video info error:', error);
        return res.status(400).json({
            success: false,
            message: 'Could not retrieve video information'
        });
    }
};
const getPresignedDownloadUrl = async (req, res) => {
    try {
        const { s3Url, expiresIn = 3600 } = req.body;

        if (!s3Url) {
            return res.status(400).json({
                success: false,
                message: 'S3 URL is required'
            });
        }

        // Extract S3 key from URL
        let s3Key;
        const bucketName = process.env.AWS_S3_BUCKET;

        if (s3Url.includes(`${bucketName}.s3.`)) {
            // Format: https://bucket.s3.region.amazonaws.com/key
            const urlParts = s3Url.split(`${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`);
            s3Key = urlParts[1];
        } else if (s3Url.includes('s3.amazonaws.com')) {
            // Format: https://s3.amazonaws.com/bucket/key
            const urlParts = s3Url.split(`s3.amazonaws.com/${bucketName}/`);
            s3Key = urlParts[1];
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid S3 URL format'
            });
        }

        if (!s3Key) {
            return res.status(400).json({
                success: false,
                message: 'Could not extract S3 key from URL'
            });
        }

        console.log('Generating presigned URL for key:', s3Key);

        const presignedUrl = await getPresignedUrl(s3Key, expiresIn);

        return res.json({
            success: true,
            presignedUrl: presignedUrl,
            expiresIn: expiresIn,
            message: 'Presigned URL generated successfully'
        });

    } catch (error) {
        console.error('Get presigned URL error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error generating download link'
        });
    }
};

module.exports = {
    downloadYt,
    downloadFromS3Video,
    serveFile,
    serveFromS3,
    getVideoInfo,
    getPresignedDownloadUrl
};