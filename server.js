




import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load topics data on startup and cache it ---
let topicsData = null;
try {
    const dataPath = path.resolve(__dirname, 'data', 'topics.json');
    const data = await fs.readFile(dataPath, 'utf-8');
    topicsData = JSON.parse(data);
    console.log('Topics data loaded and cached successfully.');
} catch (error) {
    console.error('FATAL: Could not load topics.json. The topics API will be unavailable.', error);
    // Set to a default structure to avoid crashes on clients expecting an object
    topicsData = { categories: [], topics: {} };
}

// --- Helper function to find a curated topic by its ID ---
function findCuratedTopicById(topicId, data) {
    if (!data || !data.topics) return null;
    for (const categoryId in data.topics) {
        const topicsInCategory = data.topics[categoryId];
        const foundTopic = topicsInCategory.find(t => t.id === topicId);
        if (foundTopic) {
            return foundTopic;
        }
    }
    return null;
}

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

// --- API Routes ---

// API route for serving topics
app.get('/api/topics', apiLimiter, (req, res) => {
    if (topicsData) {
        res.json(topicsData);
    } else {
        // This case should be rare due to startup loading, but it's good practice.
        res.status(500).json({ error: 'Topics data is currently unavailable.' });
    }
});

// API route for generating quizzes
app.post('/api/generate', apiLimiter, async (req, res) => {
    const { topic, topicId, numQuestions, difficulty } = req.body;

    if (!topic) {
        return res.status(400).json({ error: 'Topic is required.' });
    }

    let prompt;
    let curatedTopic = null;

    if (topicId) {
        curatedTopic = findCuratedTopicById(topicId, topicsData);
    }

    if (curatedTopic && curatedTopic.questions && curatedTopic.questions.length > 0) {
        // Handle curated topics: use the pre-defined questions
        console.log(`Generating quiz for curated topic: "${topic}" (ID: ${topicId})`);
        const questionList = curatedTopic.questions.map(q => `- "${q}"`).join('\n');
        prompt = `Create a fun multiple-choice quiz based *only* on the following questions:
${questionList}

Your tone should be friendly, engaging, and conversational. Use simple, everyday language that's easy for anyone to understand, avoiding jargon.
The quiz difficulty should be "${difficulty || 'Medium'}".

For each question, provide:
1. The original question text, exactly as provided.
2. Four possible answer options.
3. The index of the correct answer.
4. A brief, clear explanation for the correct answer, also written in a friendly and simple tone.

Ensure the number of questions in your response exactly matches the number of questions I provided.`;

    } else {
        // Handle custom topics: generate questions from scratch
        console.log(`Generating quiz for custom topic: "${topic}"`);
        if (!numQuestions) {
            return res.status(400).json({ error: 'Number of questions is required for a custom topic.' });
        }
        prompt = `Create a fun multiple-choice quiz about "${topic}". I need ${numQuestions} questions.
Your tone should be friendly, engaging, and conversational. Use simple, everyday language that's easy for anyone to understand, avoiding jargon.
The quiz difficulty should be "${difficulty || 'Medium'}".
For each question, provide:
1. The question text.
2. Four possible answer options.
3. The index of the correct answer.
4. A brief, clear explanation for the correct answer, also written in a friendly and simple tone.`;
    }

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

        // CRITICAL FIX: Use optional chaining and check finishReason to prevent crash on unexpected AI response.
        const finishReason = response.candidates?.[0]?.finishReason;
        const text = response.text;
        
        if (finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
            let errorMessage = "The AI response was stopped for an unexpected reason.";
             if(finishReason === 'SAFETY') {
                 errorMessage = "The request was blocked due to safety concerns. Please try a different topic.";
             } else if (finishReason === 'RECITATION') {
                 errorMessage = "The request was blocked due to recitation concerns.";
             }
             // Send a 400 Bad Request for client-side issues like safety blocks.
             return res.status(400).json({ error: errorMessage });
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