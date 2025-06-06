const { generateResponseForPortfolio } = require('../services/openrouter.portfolio.service');
const { generateResponse } = require('../services/openrouter.service');
const { validateChatInput } = require('../utils/validator');

async function handleChat(req, res, next) {
    try {
        const { message, model = 'mistralai/mistral-7b-instruct:free' } = req.body;

        validateChatInput({ message, model });

        const result = await generateResponse(message, model);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function portfolioChat(req, res, next) {
    try {
        const { message, model = 'mistralai/mistral-7b-instruct:free' } = req.body;

        validateChatInput({ message, model });

        const result = await generateResponseForPortfolio(message, model);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}
module.exports = { handleChat, portfolioChat };