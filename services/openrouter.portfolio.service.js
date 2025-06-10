const fetch = require('node-fetch');
const { OPENROUTER_API_KEY, SITE_URL, SITE_NAME } = require('../config/constants');
const logger = require('../utils/logger');
const portfolioChatSystemPrompt = require('../texts/portfolio');

async function generateResponseForPortfolio(userMessage, chatHistory = [], model) {
    try {
        // Format message history for OpenRouter
        let formattedHistory = [];

        if (chatHistory && Array.isArray(chatHistory)) {
            formattedHistory = chatHistory.map(msg => ({
                role: msg.role, // 'user' or 'assistant'
                content: msg.content
            }));
        }

        // Add current user message
        const currentMessage = { role: 'user', content: userMessage };

        // Build messages array
        const messages = [
            { role: 'system', content: portfolioChatSystemPrompt },
            ...formattedHistory,
            currentMessage
        ];

        console.log('Sending to OpenRouter:', JSON.stringify(messages, null, 2)); // Debug log

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': SITE_URL,
                'X-Title': SITE_NAME,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 1000,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        return {
            response: data.choices[0]?.message?.content || 'No response generated',
            model_used: model
        };
    } catch (error) {
        logger.error(`OpenRouter service error: ${error.message}`);
        throw error;
    }
}

module.exports = { generateResponseForPortfolio };