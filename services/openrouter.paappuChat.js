const fetch = require('node-fetch');
const { OPENROUTER_API_KEY, SITE_URL, SITE_NAME } = require('../config/constants');
const logger = require('../utils/logger');
const portfolioChatSystemPrompt = require('../texts/portfolio');
const sonaData = require('../texts/paappu'); // Contains { health, motivation, memories }

async function generateResponseForPaapu(userMessage, chatHistory = [], category, model) {
    try {
        // Add category-based context if applicable
        let additionalPrompt = '';
        if (category === 'health') {
            additionalPrompt = sonaData.health;
        } else if (category === 'motivation') {
            additionalPrompt = sonaData.motivation;
        } else if (category === 'memories') {
            additionalPrompt = sonaData.memories;
        }

        // Final system prompt
        const finalSystemPrompt = `
This AI is designed specifically for romantic and heartfelt conversations. 
It should only interact with Sona (also lovingly known as Paaru or Queen). 
The assistant must always be respectful and refer to her as "queen" or "ma'am" in every reply.

${portfolioChatSystemPrompt}

${additionalPrompt}
        `.trim();

        // Format chat history
        let formattedHistory = [];
        if (chatHistory && Array.isArray(chatHistory)) {
            formattedHistory = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        }

        // Add current message
        const currentMessage = { role: 'user', content: userMessage };

        const messages = [
            { role: 'system', content: finalSystemPrompt },
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

        const data = await respsssonse.json();
        return {
            response: data.choices[0]?.message?.content || 'No response generated',
            model_used: model
        };
    } catch (error) {
        logger.error(`OpenRouter service error: ${error.message}`);
        throw error;
    }
}

module.exports = { generateResponseForPaapu };
