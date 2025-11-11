import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Basic rate limiting to prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// API route for generating quizzes
app.post('/api/generate', apiLimiter, async (req, res) => {
    const { topic, numQuestions, difficulty } = req.body;

    if (!topic || !numQuestions) {
        return res.status(400).json({ error: 'Topic and number of questions are required.' });
    }

    const prompt = `Create a fun multiple-choice quiz about "${topic}". I need ${numQuestions} questions.
Your tone should be friendly, engaging, and conversational. Use simple, everyday language that's easy for anyone to understand, avoiding jargon.
The quiz difficulty should be "${difficulty || 'Medium'}".
For each question, provide:
1. The question text.
2. Four possible answer options.
3. The index of the correct answer.
4. A brief, clear explanation for the correct answer, also written in a friendly and simple tone.`;

    const schema = {
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

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error('API_KEY is not configured in the environment.');
            return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
        }
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const finishReason = response.candidates?.[0]?.finishReason;
        const text = response.text;
        
        if (finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
            let errorMessage = "The AI response was stopped for an unexpected reason.";
             if(finishReason === 'SAFETY') {
                 errorMessage = "The request was blocked due to safety concerns. Please try a different topic.";
             } else if (finishReason === 'RECITATION') {
                 errorMessage = "The request was blocked due to recitation concerns.";
             }
             throw new Error(errorMessage);
        }

        if (!text) {
            throw new Error("The AI returned an empty response.");
        }
        
        // The response text is already a JSON string because of responseMimeType
        res.json(JSON.parse(text));

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: error.message || 'Failed to generate quiz from AI service.' });
    }
});

// Serve static files from the root directory
app.use(express.static(path.resolve(__dirname)));

// Catch-all route to serve index.html for client-side routing
// This regex ensures we don't accidentally intercept API calls.
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});