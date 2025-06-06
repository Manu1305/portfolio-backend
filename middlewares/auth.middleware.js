const { API_KEY } = require('../config/constants');
const logger = require('../utils/logger');

function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
console.log(`Received API key: ${apiKey}`); // Debugging line to check the received API key
    console.log(`Expected API key: ${API_KEY}`); // Debugging line to check the expected API key
    if (!apiKey || apiKey !== API_KEY) {
        logger.warn(`Unauthorized access attempt from IP: ${req.ip}`);
        return res.status(401).json({
            success: false,
            error: 'Invalid API key'
        });
    }

    next();
}

module.exports = { authenticate };