// server.js

const express = require('express');
const path = require('path');
// Using the modern GoogleGenAI class
const { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.resolve(__dirname)));

// --- Gemini API Proxy Endpoint ---
app.post('/api/gemini/generate', async (req, res) => {
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "Server is missing API key." });
    }
    
    // Modern initialization
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    try {
        const { type, payload } = req.body;
        
        // This is a common model config
        const modelConfig = {
            model: "gemini-2.5-flash",
            config: { safetySettings }
        };

        let schema;
        let prompt;
        let stream = false;

        switch (type) {
            case 'quiz':
            case 'challenge':
                schema = {
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
                prompt = payload.prompt;
                break;
            
            case 'study':
                stream = true;
                prompt = payload.prompt;
                break;

            case 'flashcards':
                schema = {
                    type: Type.OBJECT,
                    properties: {
                        flashcards: {
                             type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    front: { type: Type.STRING },
                                    back: { type: Type.STRING }
                                },
                                required: ["front", "back"]
                            }
                        }
                    },
                    required: ["flashcards"]
                };
                prompt = `Based on the following study guide content, generate a concise set of flashcards. Each flashcard should have a 'front' (a question or term) and a 'back' (the answer or definition):\n\n${payload.guideContent}`;
                break;
            
            case 'path':
                schema = {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        steps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["title", "description"]
                            }
                        }
                    },
                    required: ["title", "steps"]
                };
                prompt = `Create a structured learning path for the goal: "${payload.goal}". The path should have a main 'title' and a series of 'steps', where each step has its own 'title' and a brief 'description'.`;
                break;

            default:
                return res.status(400).json({ message: "Invalid generation type specified." });
        }
        
        // Handle streaming vs. non-streaming responses
        if (stream) {
            const responseStream = await ai.models.generateContentStream({
                ...modelConfig,
                contents: prompt
            });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            for await (const chunk of responseStream) {
                res.write(chunk.text);
            }
            return res.end();
        } else {
            if (schema) {
                modelConfig.config.responseMimeType = "application/json";
                modelConfig.config.responseSchema = schema;
            }
            const response = await ai.models.generateContent({
                ...modelConfig,
                contents: prompt,
            });
            // The modern response text is directly on the `text` property.
            const jsonData = JSON.parse(response.text);
            return res.json(jsonData);
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        // The modern SDK may have a different error structure
        if (error.message && error.message.includes('SAFETY')) {
            return res.status(400).json({ message: "Request blocked. The topic may be restricted due to safety policies." });
        }
        return res.status(500).json({ message: "An error occurred while communicating with the AI." });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});