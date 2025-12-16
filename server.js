
// --- IMPORTS & SETUP ---
import 'dotenv/config'; 
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
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
    console.log(`✅ AI Key Detected: ${API_KEY.substring(0, 4)}... (Length: ${API_KEY.length})`);
    if (API_KEY.startsWith('hf_')) {
        console.warn("⚠️ CRITICAL WARNING: Hugging Face key detected. This app requires Google Gemini.");
    }
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
        console.log(`✅ Prebaked levels loaded.`);
    } catch (e) { 
        prebakedLevelsCache = {}; 
    }
})();

// --- SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `
You are an elite educational intelligence engine.
Your task is to generate structured learning content in strict JSON format.
1. Analyze the user's topic.
2. If the topic is valid, generate the requested JSON.
3. If the topic is nonsense, generate a polite JSON error.
4. IMPORTANT: Do not include markdown formatting (like \`\`\`json) in your response. Return ONLY the raw JSON string.
`;

// --- JSON EXTRACTION ENGINE (ROBUST) ---
function extractAndParseJSON(text) {
    if (!text) return null;
    let cleanText = text.trim();
    // Remove Markdown Code Blocks
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
    
    try { return JSON.parse(cleanText); } catch (e) {
        // Hunter-Seeker: Find outermost brackets
        const firstOpen = cleanText.indexOf('{');
        const lastClose = cleanText.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            try { return JSON.parse(cleanText.substring(firstOpen, lastClose + 1)); } catch (e2) {}
        }
    }
    return null;
}

// --- AI CLIENT ---
let ai;
if (API_KEY && !API_KEY.startsWith('hf_')) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

// --- FALLBACK DATA ---
const FALLBACK = {
    questions: (topic) => ({
        questions: [
            {
                question: `(Offline Mode) What is the core concept of ${topic}?`,
                options: ["It is unknown", "It relies on fundamentals", "It is magic", "It is irrelevant"],
                correctAnswerIndex: 1,
                explanation: "This is a fallback question because the AI connection failed."
            },
            {
                question: "Which of these is a best practice?",
                options: ["Doing nothing", "Consistent Practice", "Rushing", "Quitting"],
                correctAnswerIndex: 1,
                explanation: "Consistency is key."
            },
            {
                question: "True or False: Errors help you learn.",
                options: ["True", "False", "Maybe", "Depends"],
                correctAnswerIndex: 0,
                explanation: "Debugging is learning."
            }
        ]
    }),
    lesson: (topic) => ({ lesson: `### ${topic}\n\n**Status: Offline.**\nUnable to generate new lesson content at this time. Please check server logs.` }),
    journey: (topic) => ({ topicName: topic, totalLevels: 10, description: "Generated offline due to connection issues." })
};

// --- DUAL-ENGINE GENERATION HANDLER ---
async function generateWithFallback(contents, config, fallbackFn, label) {
    if (!ai) {
        console.warn(`[${label}] No API Key. Using fallback.`);
        return fallbackFn();
    }

    // 1. Try Primary Model (Gemini 3 Pro - Smarter)
    try {
        console.log(`[${label}] Trying Engine A (Gemini 3 Pro)...`);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: contents,
            config: { ...config, responseMimeType: 'application/json' }
        });
        
        const data = extractAndParseJSON(response.text);
        if (data) return data;
        throw new Error("Invalid JSON from Pro");
    } catch (errPro) {
        console.warn(`[${label}] Engine A Failed: ${errPro.message}. Switching to Engine B...`);
        
        // 2. Try Secondary Model (Gemini 2.5 Flash - Faster/More Stable)
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: { ...config, responseMimeType: 'application/json' }
            });
            
            const data = extractAndParseJSON(response.text);
            if (data) {
                console.log(`[${label}] ✅ Engine B Success.`);
                return data;
            }
        } catch (errFlash) {
            console.error(`[${label}] ❌ All Engines Failed.`, errFlash.message);
        }
    }

    return fallbackFn();
}

// --- EXPRESS APP ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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
        `Create a learning journey for "${topic}". JSON only: { "topicName": string, "totalLevels": number (between 10 and 50), "description": string }`,
        { systemInstruction: SYSTEM_INSTRUCTION },
        () => FALLBACK.journey(topic),
        "JOURNEY_PLAN"
    );
    res.json(result);
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level } = req.body;
    if (prebakedLevelsCache[topic]) {
        return res.json({ questions: prebakedLevelsCache[topic].questions });
    }
    const result = await generateWithFallback(
        `Generate 3 quiz questions for ${topic} (Level ${level}). JSON format: { "questions": [ { "question": string, "options": [string, string, string, string], "correctAnswerIndex": number, "explanation": string } ] }`,
        { systemInstruction: SYSTEM_INSTRUCTION },
        () => FALLBACK.questions(topic),
        "QUIZ_GEN"
    );
    res.json(result);
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level } = req.body;
    if (prebakedLevelsCache[topic]) {
        return res.json({ lesson: prebakedLevelsCache[topic].lesson });
    }
    const result = await generateWithFallback(
        `Write a short, engaging lesson for ${topic} (Level ${level}). Max 100 words. JSON: { "lesson": "markdown text" }`,
        { systemInstruction: SYSTEM_INSTRUCTION },
        () => FALLBACK.lesson(topic),
        "LESSON_GEN"
    );
    res.json(result);
});

app.post('/api/generate-curriculum-outline', (req, res) => res.json({ chapters: ["Basics", "Advanced", "Mastery"] }));
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Think about the core principles." }));
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
            { text: `Analyze this image/document. Identify the main topic and create a learning journey. JSON only: { "topicName": string, "totalLevels": number (10-50), "description": string }` },
            { inlineData: { mimeType: mimeType, data: fileData } }
        ],
        { systemInstruction: SYSTEM_INSTRUCTION },
        () => FALLBACK.journey("Analyzed Content"),
        "FILE_ANALYSIS"
    );
    res.json(result);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
