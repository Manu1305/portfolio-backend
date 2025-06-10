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

    // CORS configuration - Allow all origins for development/testing
    app.use(cors({
        origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true, // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-KEY', 'x-api-key', 'Authorization'],
        credentials: true, // Allow credentials
        optionsSuccessStatus: 200 // Some legacy browsers choke on 204
    }));

    // Handle preflight requests explicitly
    app.options('*', cors());

    // Disable X-Powered-By header
    app.disable('x-powered-by');
}

module.exports = { setupSecurity };