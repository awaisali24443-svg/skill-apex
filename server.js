// --- IMPORTS & SETUP ---
import express from 'express';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import 'dotenv/config';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import http from 'http';
import { WebSocketServer } from 'ws';

// --- CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.filename);
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

const levelGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        lesson: {
            type: Type.STRING,
            description: "A very short, single-paragraph lesson for this specific level, formatted in Markdown. It should build upon previous levels and be very focused."
        },
        questions: {
            type: Type.ARRAY,
            description: "An array of 2-3 multiple-choice questions based *only* on the provided lesson text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["lesson", "questions"]
};

const quizGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of multiple-choice questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["questions"]
};


// --- GEMINI SERVICE FUNCTIONS ---

/**
 * Generates a game level (lesson + quiz) using the Gemini API.
 * @param {string} topic - The overall topic.
 * @param {number} level - The level number (1-500).
 * @returns {Promise<object>} The parsed level data.
 */
async function generateLevelContent(topic, level) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `You are a friendly and encouraging AI tutor creating a 500-level learning game about "${topic}". The user is on Level ${level} and is a complete beginner.
    
    RULES:
    1. The difficulty must increase extremely gradually from Level 1 to 500. Level 1 must be incredibly simple, assuming zero prior knowledge. For example, for "C++", Level 1 should explain what a programming language is, who created C++, and its primary purpose. Level 500 should cover expert-level concepts.
    2. Generate a bite-sized, single-paragraph lesson for Level ${level}. This lesson MUST build upon the knowledge of the previous levels and introduce ONE new, small concept.
    3. Generate 2-3 simple multiple-choice questions that test understanding of *only the concepts in this specific lesson*.
    4. Your tone must be super encouraging, like a game.
    
    Generate the lesson and questions based on these rules and the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: levelGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level ${level} Generation for ${topic}):`, error);
        throw new Error('Failed to generate the next level. The AI may be busy or the topic is restricted.');
    }
}

/**
 * Generates a standard quiz using the Gemini API.
 * @param {string} topic 
 * @param {number} numQuestions 
 * @param {string} difficulty 
 * @returns {Promise<object>} The parsed quiz data.
 */
async function generateQuizContent(topic, numQuestions, difficulty) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Generate a ${difficulty} quiz with ${numQuestions} multiple-choice questions about "${topic}". Each question must have exactly 4 options. Provide a brief explanation for the correct answer. Your tone must be that of a fun, encouraging quiz master.`;

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
        console.error(`Gemini API Error (Quiz Generation for ${topic}):`, error);
        throw new Error('Failed to generate the quiz. The AI may be busy or the topic is restricted.');
    }
}


// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// --- API Endpoints ---

app.post('/api/generate-quiz', async (req, res) => {
    const { topic, numQuestions, difficulty } = req.body;
    if (!topic || !numQuestions || !difficulty) {
        return res.status(400).json({ error: 'Missing required parameters: topic, numQuestions, difficulty' });
    }
    try {
        const quiz = await generateQuizContent(topic, numQuestions, difficulty);
        res.json(quiz);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level', async (req, res) => {
    const { topic, level } = req.body;
    if (!topic || !level) {
        return res.status(400).json({ error: 'Missing required parameters: topic, level' });
    }
    try {
        const levelContent = await generateLevelContent(topic, level);
        res.json(levelContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/topics', async (req, res) => {
    try {
        if (!topicsCache) {
            const topicsJson = await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
            topicsCache = JSON.parse(topicsJson);
        }
        res.json(topicsCache);
    } catch (error) {
        console.error('Failed to read topics file:', error);
        res.status(500).json({ error: 'Could not load topics data.' });
    }
});


// --- WEBSOCKETS ---
// WebSocket logic for aural mode remains but is currently unused by the simplified front-end.
wss.on('connection', (ws, req) => {
    console.log('WebSocket Client connected');
    const url = new URL(req.url, `http://${req.headers.host}`);
    const systemInstruction = url.searchParams.get('systemInstruction') || 'You are a helpful AI assistant.';

    let sessionPromise;

    try {
        if (!ai) {
            throw new Error("AI Service not initialized.");
        }
        sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => console.log('Live session opened'),
                onmessage: (message) => ws.send(JSON.stringify({ type: 'gemini_message', message })),
                onerror: (e) => {
                    console.error('Live session error:', e);
                    ws.send(JSON.stringify({ type: 'error', message: 'An AI session error occurred.' }));
                },
                onclose: () => console.log('Live session closed'),
            }
        });
    } catch (error) {
        console.error('Failed to connect to Gemini Live:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
        ws.close();
        return;
    }

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'audio_input' && parsed.payload) {
                sessionPromise?.then(session => session.sendRealtimeInput({ media: parsed.payload }));
            }
        } catch (e) {
            console.error('Error processing message from client:', e);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket Client disconnected');
        sessionPromise?.then(session => session.close());
    });
});


// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});