const helmet = require('helmet');
const cors = require('cors');

function setupSecurity(app) {
    // Helmet for security headers
    app.use(helmet());

    // Get allowed origins from environment or use empty array
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    // Always include localhost:5173 in development
    if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push('http://localhost:5173');
    }

    // CORS configuration
    app.use(cors({
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'X-API-KEY']
    }));

    // Disable X-Powered-By header
    app.disable('x-powered-by');
}

module.exports = { setupSecurity };