const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    logger.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};