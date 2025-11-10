// server.js
import express from 'express';
import path from 'path';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
// Serve static files from the root directory
app.use(express.static(path.resolve()));

// Gemini AI setup
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const modelConfig = {
    model: "gemini-2.5-flash",
    config: { safetySettings }
};


// API Endpoint for non-streaming generation
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, schema } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
            config: {
                ...modelConfig.config,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
            }
        });

        res.json({ text: response.text });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate content from AI.' });
    }
});

// API Endpoint for streaming generation
app.post('/api/generate-stream', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const responseStream = await ai.models.generateContentStream({
            ...modelConfig,
            contents: prompt
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for await (const chunk of responseStream) {
            res.write(chunk.text);
        }
        res.end();

    } catch (error) {
        console.error('API Stream Error:', error);
        if (!res.headersSent) {
             res.status(500).json({ error: error.message || 'Failed to generate content stream from AI.' });
        } else {
            res.end();
        }
    }
});


// Fallback to index.html for single-page application routing
app.get('*', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
