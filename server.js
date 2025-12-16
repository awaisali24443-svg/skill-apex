
// --- IMPORTS & SETUP ---
import 'dotenv/config'; 
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import http from 'http';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- API KEY SETUP ---
const API_KEY = (process.env.API_KEY || process.env.GEMINI_API_KEY || "").trim();

console.log("--- SERVER DIAGNOSTICS ---");
if (API_KEY) {
    console.log(`✅ AI Key Detected: ${API_KEY.substring(0, 4)}...`);
} else {
    console.error("❌ CRITICAL: NO API KEY FOUND. Server running in simulated mode.");
}

const PORT = process.env.PORT || 3000;
let prebakedLevelsCache = {};

// Load Prebaked Data
(async () => {
    try {
        const dataPath = path.join(__dirname, 'data', 'prebaked_levels.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        prebakedLevelsCache = JSON.parse(data);
    } catch (e) { prebakedLevelsCache = {}; }
})();

// --- AI CLIENT ---
let ai;
if (API_KEY && !API_KEY.startsWith('hf_')) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

// --- SCHEMAS ---
const QUIZ_SCHEMA = {
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
                }
            }
        }
    }
};

const LESSON_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        lesson: { type: Type.STRING }
    }
};

const JOURNEY_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        topicName: { type: Type.STRING },
        totalLevels: { type: Type.INTEGER },
        description: { type: Type.STRING }
    }
};

// --- DUAL-ENGINE GENERATION HANDLER ---
async function generateWithFallback(contents, config, fallbackFn, label, schema = null) {
    if (!ai) {
        console.warn(`[${label}] No API Key. Using fallback.`);
        return fallbackFn();
    }

    // 1. Try Primary Model (Gemini 3 Pro)
    try {
        console.log(`[${label}] Asking Gemini 3 Pro...`);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: contents,
            config: { 
                ...config, 
                responseMimeType: 'application/json',
                responseSchema: schema // Force Structured Output
            }
        });
        
        // Direct object return due to schema enforcement
        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("Empty response");
    } catch (errPro) {
        console.warn(`[${label}] Pro Failed: ${errPro.message}. Switching to Flash...`);
        
        // 2. Try Secondary Model (Gemini 2.5 Flash)
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: { 
                    ...config, 
                    responseMimeType: 'application/json',
                    responseSchema: schema 
                }
            });
            if (response.text) {
                return JSON.parse(response.text);
            }
        } catch (errFlash) {
            console.error(`[${label}] All Engines Failed.`, errFlash.message);
        }
    }

    return fallbackFn();
}

// --- EXPRESS APP ---
const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

// --- ENDPOINTS ---

app.get('/api/client-config', (req, res) => {
    if (!API_KEY) return res.status(503).json({ error: 'No API Key' });
    res.json({ apiKey: API_KEY });
});

app.post('/api/debug-status', (req, res) => {
    res.json({ status: ai ? 'online' : 'offline', message: ai ? 'Connected' : 'Server Offline / Invalid Key' });
});

app.post('/api/generate-journey-plan', async (req, res) => {
    const { topic } = req.body;
    const result = await generateWithFallback(
        `Create a learning journey for "${topic}".`,
        { systemInstruction: "You are an educational architect." },
        () => ({ topicName: topic, totalLevels: 10, description: "Generated offline." }),
        "JOURNEY_PLAN",
        JOURNEY_SCHEMA
    );
    res.json(result);
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level } = req.body;
    // Check Prebaked first
    if (prebakedLevelsCache[topic]) {
        return res.json({ questions: prebakedLevelsCache[topic].questions });
    }
    
    const result = await generateWithFallback(
        `Generate 3 quiz questions for ${topic} (Level ${level}).`,
        { systemInstruction: "Generate tough but fair technical questions." },
        () => ({ questions: [] }), // Frontend handles empty array as fallback trigger
        "QUIZ_GEN",
        QUIZ_SCHEMA
    );
    res.json(result);
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level } = req.body;
    if (prebakedLevelsCache[topic]) {
        return res.json({ lesson: prebakedLevelsCache[topic].lesson });
    }
    const result = await generateWithFallback(
        `Write a short, engaging lesson for ${topic} (Level ${level}). Use Markdown.`,
        { systemInstruction: "You are an expert tutor." },
        () => ({ lesson: "Offline lesson unavailable." }),
        "LESSON_GEN",
        LESSON_SCHEMA
    );
    res.json(result);
});

app.post('/api/generate-curriculum-outline', (req, res) => res.json({ chapters: ["Basics", "Advanced", "Mastery"] }));
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Think about the core principles." }));
app.post('/api/explain-error', (req, res) => res.json({ explanation: "This answer is incorrect because of fundamental principles." }));

app.get('/api/topics', async (req, res) => {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
        res.json(JSON.parse(data));
    } catch { res.json([]); }
});

app.post('/api/generate-journey-from-file', async (req, res) => {
    const { fileData, mimeType } = req.body;
    const result = await generateWithFallback(
        [
            { text: `Analyze this document. Identify the main topic and create a learning journey.` },
            { inlineData: { mimeType: mimeType, data: fileData } }
        ],
        { systemInstruction: "Analyze content deeply." },
        () => ({ topicName: "Analyzed Content", totalLevels: 10, description: "Offline Analysis" }),
        "FILE_ANALYSIS",
        JOURNEY_SCHEMA
    );
    res.json(result);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
