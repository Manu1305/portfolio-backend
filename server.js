const app = require('./app');
const { PORT, NODE_ENV } = require('./config/constants');
const logger = require('./utils/logger');

app().listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Server URL: http://localhost:${PORT}`);
});