// server.js

const express = require('express');
const path = require('path');
// Using the legacy GoogleGenerativeAI class for compatibility
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.resolve(__dirname)));

// --- Gemini API Proxy Endpoint ---
app.post('/api/gemini/generate', async (req, res) => {
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "Server is missing API key." });
    }
    
    // Legacy initialization
    const genAI = new GoogleGenerativeAI(process.env.API_KEY);

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // Older compatible model name
    const modelName = "gemini-pro";

    try {
        const { type, payload } = req.body;
        
        let prompt;
        let stream = false;
        
        // Instruction to ensure JSON output for older models that don't support responseSchema
        const jsonInstruction = "\n\nImportant: The entire response must be a single, valid JSON object matching the requested structure. Do not include any markdown formatting like ```json ... ```.";

        switch (type) {
            case 'quiz':
            case 'challenge':
                prompt = payload.prompt + jsonInstruction;
                break;
            
            case 'study':
                stream = true;
                prompt = payload.prompt;
                break;

            case 'flashcards':
                prompt = `Based on the following study guide content, generate a concise set of flashcards. Each flashcard should have a 'front' (a question or term) and a 'back' (the answer or definition). Return the result as a JSON object with a 'flashcards' key containing an array of these objects.${jsonInstruction}\n\n${payload.guideContent}`;
                break;
            
            case 'path':
                prompt = `Create a structured learning path for the goal: "${payload.goal}". The path should have a main 'title' and a series of 'steps', where each step has its own 'title' and a brief 'description'. Return the result as a JSON object with 'title' and 'steps' keys.${jsonInstruction}`;
                break;

            default:
                return res.status(400).json({ message: "Invalid generation type specified." });
        }
        
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });

        // Handle streaming vs. non-streaming responses
        if (stream) {
            const result = await model.generateContentStream({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            for await (const chunk of result.stream) {
                res.write(chunk.text());
            }
            return res.end();
        } else {
            const generationConfig = {
                responseMimeType: "application/json",
            };
            const jsonModel = genAI.getGenerativeModel({ model: modelName, safetySettings, generationConfig });
            const result = await jsonModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // The model might still wrap the JSON in markdown, so we need to clean it.
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const jsonData = JSON.parse(cleanedText);
            return res.json(jsonData);
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
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