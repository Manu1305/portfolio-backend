const express = require('express');
const router = express.Router();
const { handleChat, portfolioChat, handlepapuChat } = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rate-limiter.middleware');
const { downloadYt, serveFile, getVideoInfo, downloadFromS3Video, serveFromS3, getPresignedDownloadUrl } = require('../controllers/video.downloader.controller');

// Apply rate limiting to all API routes
router.use(createRateLimiter());

// Chat endpoint
router.post('/chat', authenticate, handleChat);
router.post('/chat/portfolio-assistant', authenticate, portfolioChat);
router.post('/yt-download',authenticate,downloadYt)
router.get('/download-file/:filename', serveFile);
router.post('/pappu-ai', authenticate,handlepapuChat)
router.post('/video-info', authenticate, getVideoInfo);
router.post('/download-from-s3', downloadFromS3Video);
router.post('/serve-from-s3', serveFromS3);
 router.post('/get-presigned-url', getPresignedDownloadUrl);
// 404 handler for API routes
router.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

module.exports = router;