require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "cf0b741e6593f1e8acc72edb847c99d1f5031d49fef712b6271c0c6d550d452c",
       SITE_URL: process.env.SITE_URL || 'http://localhost:3000',
    SITE_NAME: process.env.SITE_NAME || 'Test App',
    API_KEY: process.env.API_KEY,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100,
  };