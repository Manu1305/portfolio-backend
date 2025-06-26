const express = require('express');
const router = express.Router();
const { handleChat, portfolioChat, handlepapuChat } = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rate-limiter.middleware');
const { downloadYt, serveFile } = require('../controllers/video.downloader.controller');

// Apply rate limiting to all API routes
router.use(createRateLimiter());

// Chat endpoint
router.post('/chat', authenticate, handleChat);
router.post('/chat/portfolio-assistant', authenticate, portfolioChat);
router.post('/yt-download',authenticate,downloadYt)
router.get('/download-file/:filename', serveFile);
router.post('/pappu-ai', authenticate,handlepapuChat)
// 404 handler for API routes
router.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

module.exports = router;