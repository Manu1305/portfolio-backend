function validateChatInput({ message, model }) {
    if (!message || typeof message !== 'string') {
        const error = new Error('Message is required and should be a string');
        error.statusCode = 400;
        throw error;
    }

    if (message.length > 1000) {
        const error = new Error('Message too long. Max 1000 characters allowed');
        error.statusCode = 400;
        throw error;
    }

    if (model && typeof model !== 'string') {
        const error = new Error('Model should be a string');
        error.statusCode = 400;
        throw error;
    }
}

module.exports = { validateChatInput };