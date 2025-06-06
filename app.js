const express = require('express');
const morgan = require('morgan');
const { setupSecurity } = require('./config/security');
const apiRoutes = require('./routes/api.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

function createApp() {
    const app = express();

    // Security setup
    setupSecurity(app);

    // Logging
    app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

    // Body parsers
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API routes
    app.use('/api', apiRoutes);

    // 404 handler
    app.use(notFoundHandler);

    // Error handler
    app.use(errorHandler);

    return app;
}

module.exports = createApp;