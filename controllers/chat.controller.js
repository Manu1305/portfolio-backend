const { generateResponseForPaapu } = require('../services/openrouter.paappuChat');
const { generateResponseForPortfolio } = require('../services/openrouter.portfolio.service');
const { generateResponse } = require('../services/openrouter.service');
const { validateChatInput } = require('../utils/validator');

async function handleChat(req, res, next) {
    try {
        const { message, model = 'mistralai/mistral-7b-instruct:free' } = req.body;
console.log(req.body,'req.body');
        validateChatInput({ message, model });

        console.log(`Generating response using : ${message}, model: ${model}`);
        const result = await generateResponse(message, model);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}


async function portfolioChat(req, res) {
    try {
        const { message, chatHistory, sessionId, model = 'mistralai/mistral-7b-instruct:free' } = req.body;
             // Validate required fields
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string'
            });
        }

        // Call service with separate parameters
        const result = await generateResponseForPortfolio(
            message,           // Current user message
            chatHistory || [], // Previous chat history
            model // Model name
        );

        res.json({
            success: true,
            data: {
                response: result.response,
                model: result.model_used,
                sessionId: sessionId
            }
        });

    } catch (error) {
        console.error('Portfolio chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response'
        });
    }
}


async function handlepapuChat(req, res) {
    try {
        const { message, chatHistory,category  } = req.body;

        // Validate required fields
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string'
            });
        }

        // Call service with separate parameters
        const result = await generateResponseForPaapu(
            message,           // Current user message
            chatHistory || [],
            category, // Previous chat history
            'microsoft/wizardlm-2-8x22b' // Model name
        );

        res.json({
            success: true,
            data: {
                response: result.response,
                model: result.model_used,
                
            }
        });

    } catch (error) {
        console.error('Portfolio chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response'
        });
    }
}

module.exports = { handleChat, portfolioChat, handlepapuChat };