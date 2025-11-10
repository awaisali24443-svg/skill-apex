// server.js

const express = require('express');
const path = require('path');
const { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.resolve(__dirname)));

/**
 * Extracts a JSON object from a string, even if it's embedded in markdown or other text.
 * @param {string} text - The text response from the AI.
 * @returns {string} The cleaned, stringified JSON object.
 */
function extractJson(text) {
    if (!text) return null;
    // Attempt to find JSON within markdown code blocks (```json ... ```)
    const markdownMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[2]) {
        return markdownMatch[2];
    }
    // If no markdown, find the first '{' and the last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    return null; // Return null if no valid JSON structure is found
}


// --- Gemini API Proxy Endpoint ---
app.post('/api/gemini/generate', async (req, res) => {
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "Server is missing API key." });
    }
    
    const { type, payload } = req.body;
    if (!type || !payload) {
        return res.status(400).json({ message: "Request must include a 'type' and 'payload'." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const modelName = "gemini-2.5-flash";
        
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        // --- Stream-based generation for Study Guides and Tutor Chat ---
        if (type === 'study' || type === 'chat') {
            const { prompt, history } = payload;
            let contents;
            let systemInstruction;

            if (type === 'chat') {
                systemInstruction = 'You are a friendly and helpful AI Tutor for a learning application named "Knowledge Tester". Explain complex topics simply and encourage the user. Use markdown for formatting like lists, bold text, and code blocks where appropriate.';
                contents = history;
            } else { // 'study'
                systemInstruction = 'You are a helpful assistant that generates concise study guides. Use markdown for formatting.';
                contents = [{ role: 'user', parts: [{ text: prompt }] }];
            }

            const result = await ai.models.generateContentStream({
                model: modelName,
                contents,
                config: { systemInstruction },
                safetySettings
            });

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            for await (const chunk of result) {
                if (chunk.text) {
                    res.write(chunk.text);
                }
            }
            res.end();
            return;
        }

        // --- JSON-based generation for Quizzes, Flashcards, Paths ---
        const quizSchema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswerIndex: { type: Type.INTEGER },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswerIndex", "explanation"]
                    }
                }
            },
            required: ["questions"]
        };
        const flashcardsSchema = {
            type: Type.OBJECT,
            properties: {
                flashcards: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            front: { type: Type.STRING, description: "The front side of the flashcard (a term or question)." },
                            back: { type: Type.STRING, description: "The back side of the flashcard (the definition or answer)." }
                        },
                        required: ["front", "back"]
                    }
                }
            },
            required: ["flashcards"]
        };
        const learningPathSchema = {
             type: Type.OBJECT,
             properties: {
                 title: { type: Type.STRING, description: "The main title of the learning path." },
                 steps: {
                     type: Type.ARRAY,
                     items: {
                         type: Type.OBJECT,
                         properties: {
                             title: { type: Type.STRING, description: "The title of this specific step." },
                             description: { type: Type.STRING, description: "A brief, one-sentence description of what this step covers." }
                         },
                         required: ["title", "description"]
                     }
                 }
             },
             required: ["title", "steps"]
        };

        let config = {
            responseMimeType: "application/json",
        };
        let contents;

        switch (type) {
            case 'quiz':
                config.responseSchema = quizSchema;
                contents = payload.prompt;
                break;
            case 'flashcards':
                config.responseSchema = flashcardsSchema;
                contents = `Based on the following study guide content, generate a set of flashcards with a 'front' (term or question) and a 'back' (definition or answer):\n\n${payload.guideContent}`;
                break;
            case 'path':
                config.responseSchema = learningPathSchema;
                contents = `Create a structured learning path for the goal: "${payload.goal}". The path should have a main title and several sequential steps, each with its own title and a short description.`;
                break;
            default:
                return res.status(400).json({ message: "Invalid generation type specified." });
        }

        const response = await ai.models.generateContent({ 
            model: modelName, 
            contents: contents, 
            config: config, 
            safetySettings 
        });
        
        const cleanedJsonString = extractJson(response.text);
        
        if (!cleanedJsonString) {
             console.error("Could not find any JSON in the AI response:", response.text);
             return res.status(500).json({ message: "AI returned an invalid, non-JSON response. Please try again." });
        }

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanedJsonString);
        } catch (e) {
            console.error("Failed to parse extracted JSON from Gemini response:", cleanedJsonString);
            console.error("Original AI response was:", response.text);
            return res.status(500).json({ message: "AI returned a malformed JSON response. Please try again." });
        }
        
        res.json(jsonResponse);

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ message: "An error occurred while communicating with the AI. It might be busy, or the request may have been blocked for safety reasons." });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});