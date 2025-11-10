// server.js
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
// Serve static files from the root directory
app.use(express.static(path.resolve()));

// Gemini AI setup
// Ensure API_KEY is set in your environment
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelConfig = {
    model: "gemini-2.5-flash",
};

// API Endpoint for quiz generation
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, schema } = req.body;
        if (!prompt || !schema) {
            return res.status(400).json({ error: 'Prompt and schema are required' });
        }

        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        // Let's add more robust error checking from the API response itself
        if (!response.text) {
             console.error('API Error: No text in response', response);
             let errorMessage = 'The AI returned an empty response.';
             if (response?.candidates?.[0]?.finishReason === 'SAFETY') {
                 errorMessage = 'The request was blocked due to safety concerns. Please try a different topic.';
             }
             return res.status(500).json({ error: errorMessage });
        }

        res.json({ text: response.text });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate content from AI.' });
    }
});

// Fallback to index.html for single-page application routing
app.get('*', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
