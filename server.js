// --- IMPORTS & SETUP ---
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import http from 'http';
import { WebSocketServer } from 'ws';

// --- CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let topicsCache = null;

// --- GEMINI API SETUP ---
let ai;
try {
    if (!process.env.API_KEY) {
        throw new Error('API_KEY is not defined in environment variables.');
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log('GoogleGenAI initialized successfully.');
} catch (error) {
    console.error(`Failed to initialize GoogleGenAI: ${error.message}`);
    // The server will still start, but API calls will fail gracefully.
}

// --- GEMINI SCHEMAS ---
const quizGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of quiz questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "The question text." },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer in the options array." },
                    explanation: { type: Type.STRING, description: "A brief explanation for why the correct answer is correct." }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["questions"]
};

const learningPathSchema = {
  type: Type.OBJECT,
  properties: {
    path: {
      type: Type.ARRAY,
      description: "An array of learning steps.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the learning step." },
          topic: { type: Type.STRING, description: "A concise, URL-friendly slug or keyword for the topic of this step." }
        },
        required: ["name", "topic"]
      }
    }
  },
  required: ["path"]
};

const learningContentSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A concise, engaging title for the learning summary." },
        summary: {
            type: Type.ARRAY,
            description: "An array of paragraphs that summarize the key concepts of the topic.",
            items: { type: Type.STRING }
        }
    },
    required: ["title", "summary"]
};


// --- GEMINI SERVICE FUNCTIONS ---
/**
 * Generates a quiz using the Gemini API.
 * @param {string} topic - The quiz topic.
 * @param {number} numQuestions - The number of questions.
 * @param {string} difficulty - The difficulty level.
 * @param {string} [learningContext] - Optional text to base the quiz on.
 * @returns {Promise<object>} The parsed quiz data.
 */
async function generateQuizContent(topic, numQuestions, difficulty, learningContext) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");

    let prompt;
    if (learningContext && learningContext.trim()) {
        prompt = `Generate a ${difficulty} level multiple-choice quiz with exactly ${numQuestions} questions about "${topic}". The questions must be based *only* on the information provided in the following text: "${learningContext}". For each question, provide 4 options, the 0-based index of the correct answer, and a brief explanation. Ensure the content is accurate and educational.`;
    } else {
        prompt = `Generate a ${difficulty} level multiple-choice quiz with exactly ${numQuestions} questions about "${topic}". For each question, provide 4 options, the 0-based index of the correct answer, and a brief explanation. Ensure the content is accurate and educational.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: quizGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Quiz Generation):', error);
        throw new Error('Failed to generate quiz. The AI may have refused to generate content for this topic.');
    }
}

/**
 * Generates a learning path using the Gemini API.
 * @param {string} goal - The learning goal.
 * @returns {Promise<object>} The parsed learning path data.
 */
async function generateLearningPathContent(goal) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const prompt = `Create a step-by-step learning path for someone who wants to learn about "${goal}". The path should have between 5 and 10 steps. For each step, provide a name and a concise, URL-friendly topic keyword.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: learningPathSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Learning Path):', error);
        throw new Error('Failed to generate learning path.');
    }
}

/**
 * Generates learning content using the Gemini API.
 * @param {string} topic - The learning topic.
 * @returns {Promise<object>} The parsed learning content.
 */
async function generateLearningContent(topic) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const prompt = `Provide a concise summary of the key concepts for the topic: '${topic}'. The summary should be easy to understand for a beginner and cover the most important points. Make it engaging and educational. Structure the output as a JSON object with a 'title' and 'summary' field, where 'summary' is an array of paragraphs.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: learningContentSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Learning Content):', error);
        throw new Error('Failed to generate learning content.');
    }
}

// --- EXPRESS APP SETUP ---
const app = express();
const server = http.createServer(app);

// --- MIDDLEWARE ---
app.set('trust proxy', 1);
app.use(express.json());
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/', apiLimiter);
app.use(express.static(path.join(__dirname, '/')));


// --- API ROUTE HANDLERS ---
/**
 * Handles GET /api/topics
 */
async function handleGetTopics(req, res, next) {
    if (topicsCache) {
        return res.json(topicsCache);
    }
    try {
        const topicsPath = path.join(__dirname, 'data', 'topics.json');
        const data = await fs.readFile(topicsPath, 'utf8');
        topicsCache = JSON.parse(data);
        res.json(topicsCache);
    } catch (error) {
        console.error('Error reading topics.json:', error);
        next(new Error('Failed to load topics.'));
    }
}

/**
 * Handles POST /api/generate
 */
async function handleGenerateQuiz(req, res, next) {
    const { topic, numQuestions, difficulty, learningContext } = req.body;
    if (!topic || !numQuestions || !difficulty) {
        return res.status(400).json({ error: 'Missing required parameters: topic, numQuestions, difficulty.' });
    }
    try {
        const quizData = await generateQuizContent(topic, numQuestions, difficulty, learningContext);
        res.json(quizData);
    } catch (error) {
        next(error);
    }
}

/**
 * Handles POST /api/generate-path
 */
async function handleGeneratePath(req, res, next) {
    const { goal } = req.body;
    if (!goal) {
        return res.status(400).json({ error: 'Missing required parameter: goal.' });
    }
    try {
        const pathData = await generateLearningPathContent(goal);
        res.json(pathData);
    } catch (error) {
        next(error);
    }
}

/**
 * Handles POST /api/generate-learning-content
 */
async function handleGenerateLearningContent(req, res, next) {
    const { topic } = req.body;
    if (!topic) {
        return res.status(400).json({ error: 'Missing required parameter: topic.' });
    }
    try {
        const contentData = await generateLearningContent(topic);
        res.json(contentData);
    } catch (error) {
        next(error);
    }
}


// --- API ROUTER ---
const apiRouter = express.Router();
apiRouter.get('/topics', handleGetTopics);
apiRouter.post('/generate', handleGenerateQuiz);
apiRouter.post('/generate-path', handleGeneratePath);
apiRouter.post('/generate-learning-content', handleGenerateLearningContent);
app.use('/api', apiRouter);


// --- WEBSOCKET SERVER LOGIC ---
const wss = new WebSocketServer({ server });

/**
 * Handles a new WebSocket client connection for aural conversation.
 * @param {import('ws').WebSocket} ws - The WebSocket instance for the client.
 */
function setupWebSocketConnection(ws) {
    console.log('Client connected to WebSocket');

    if (!ai) {
        ws.send(JSON.stringify({ type: 'error', message: 'Server not configured with API key.' }));
        ws.close();
        return;
    }

    let sessionPromise;

    try {
        sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
                systemInstruction: 'You are a friendly and helpful AI tutor. Keep your responses conversational and concise.',
            },
            callbacks: {
                onopen: () => ws.send(JSON.stringify({ type: 'socket_open' })),
                onmessage: (message) => ws.send(JSON.stringify({ type: 'gemini_message', message })),
                onerror: (e) => ws.send(JSON.stringify({ type: 'error', message: e.message || 'An unknown error occurred' })),
                onclose: () => ws.send(JSON.stringify({ type: 'gemini_closed' })),
            }
        });

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'audio_input') {
                    const session = await sessionPromise;
                    session.sendRealtimeInput({ media: data.payload });
                }
            } catch (e) {
                console.error('Error processing client message:', e);
            }
        });

        ws.on('close', async () => {
            console.log('Client disconnected');
            try {
                if (sessionPromise) {
                    const session = await sessionPromise;
                    session.close();
                }
            } catch (e) {
                console.error('Error closing Gemini session:', e);
            }
        });

    } catch (err) {
        console.error('Failed to connect to Gemini Live:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to connect to AI: ${err.message}` }));
        ws.close();
    }
}

wss.on('connection', setupWebSocketConnection);


// --- SPA FALLBACK & ERROR HANDLING ---
app.get(/^\/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error('Central Error Handler:', err.stack);
    res.status(500).json({ error: err.message || 'An internal server error occurred.' });
});

// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});