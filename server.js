// server.js

const express = require('express');
const path = require('path');
const { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// CRITICAL FIX: Serve static files from the project root directory
// All your html, css, js files will now be found by the server.
app.use(express.static(path.resolve(__dirname)));

// --- Gemini API Proxy Endpoint ---
// This is your secure backend endpoint to handle all Gemini API calls.
app.post('/api/gemini/generate', async (req, res) => {
    // IMPORTANT: Make sure the API_KEY is set in your Render.com environment variables
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "Server is missing API key." });
    }
    
    const genAI = new GoogleGenAI(process.env.API_KEY);

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    try {
        const { type, payload } = req.body;
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest",
            safetySettings,
        });

        switch (type) {
            case 'quiz':
            case 'challenge': {
                const quizSchema = {
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
                };
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: payload.prompt }] }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: quizSchema }
                });
                const jsonData = JSON.parse(result.response.text());
                return res.json(jsonData);
            }
            
            case 'study': {
                const result = await model.generateContentStream(payload.prompt);
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                for await (const chunk of result.stream) {
                    res.write(chunk.text());
                }
                return res.end();
            }

            case 'flashcards': {
                const flashcardSchema = {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            front: { type: Type.STRING },
                            back: { type: Type.STRING }
                        },
                        required: ["front", "back"]
                    }
                };
                const prompt = `Based on the following study guide content, generate a concise set of flashcards. Each flashcard should have a 'front' (a question or term) and a 'back' (the answer or definition):\n\n${payload.guideContent}`;
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: flashcardSchema }
                });
                const jsonData = JSON.parse(result.response.text());
                return res.json(jsonData);
            }
            
            case 'path': {
                const pathSchema = {
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
                 const prompt = `Create a structured learning path for the goal: "${payload.goal}". The path should have a main 'title' and a series of 'steps', where each step has its own 'title' and a brief 'description'.`;
                 const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: pathSchema }
                });
                const jsonData = JSON.parse(result.response.text());
                return res.json(jsonData);
            }

            default:
                return res.status(400).json({ message: "Invalid generation type specified." });
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        // Check if it's a safety-related error from the API response
        if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
            return res.status(400).json({ message: "Request blocked. The topic may be restricted due to safety policies." });
        }
        return res.status(500).json({ message: "An error occurred while communicating with the AI." });
    }
});

// CRITICAL FIX: Serve the main index.html for any other routes.
// This ensures that deep linking (e.g., going directly to /#login) works.
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
