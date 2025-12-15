
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

// --- API KEY ---
const API_KEY = (process.env.API_KEY || process.env.GEMINI_API_KEY || "").trim();

console.log("--- SERVER DIAGNOSTICS ---");
if (API_KEY) {
    console.log(`✅ AI Key Detected: ${API_KEY.substring(0, 4)}...`);
} else {
    console.error("❌ CRITICAL: NO API KEY FOUND. Quizzes will not generate.");
}

const PORT = process.env.PORT || 3000;
let prebakedLevelsCache = {};

// Load Prebaked Data (Robust)
(async () => {
    try {
        const dataPath = path.join(__dirname, 'data', 'prebaked_levels.json');
        console.log(`Loading prebaked data from: ${dataPath}`);
        const data = await fs.readFile(dataPath, 'utf-8');
        prebakedLevelsCache = JSON.parse(data);
        console.log(`✅ Prebaked levels loaded. Keys: ${Object.keys(prebakedLevelsCache).length}`);
    } catch (e) { 
        console.error("⚠️ Failed to load prebaked_levels.json:", e.message);
        prebakedLevelsCache = {}; // Ensure defined
    }
})();

// --- JSON EXTRACTION ENGINE (ROBUST) ---
function extractAndParseJSON(text) {
    if (!text) return null;
    let cleanText = text.trim();

    // 1. Try direct parse
    try { return JSON.parse(cleanText); } catch (e) {}

    // 2. Remove Markdown Code Blocks (```json ... ``` or just ``` ... ```)
    cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '');
    try { return JSON.parse(cleanText); } catch (e) {}

    // 3. Hunter-Seeker: Find the outermost { }
    const firstOpen = cleanText.indexOf('{');
    const lastClose = cleanText.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        const jsonCandidate = cleanText.substring(firstOpen, lastClose + 1);
        try { return JSON.parse(jsonCandidate); } catch (e) {}
    }

    // 4. Try Array format [ ]
    const firstArr = cleanText.indexOf('[');
    const lastArr = cleanText.lastIndexOf(']');
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
        const jsonCandidate = cleanText.substring(firstArr, lastArr + 1);
        try { return JSON.parse(jsonCandidate); } catch (e) {}
    }

    console.error("❌ JSON PARSE FAILED. Raw Output:", text.substring(0, 100) + "...");
    return null;
}

// --- AI CLIENT ---
let ai;
if (API_KEY) {
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
    journey: (topic) => ({ topicName: topic, totalLevels: 10, description: "Generated offline." })
};

// --- GENERATION HANDLERS ---

async function generateWithFallback(callFn, fallbackFn) {
    if (!ai) return fallbackFn();
    try {
        const response = await callFn('gemini-1.5-flash'); // Use stable model
        const data = extractAndParseJSON(response.text);
        return data || fallbackFn();
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        return fallbackFn();
    }
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
    res.json({ status: API_KEY ? 'online' : 'offline', message: API_KEY ? 'Connected' : 'No Key' });
});

app.post('/api/generate-journey-plan', async (req, res) => {
    const { topic } = req.body;
    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Create a learning journey for "${topic}". JSON only: { "topicName": string, "totalLevels": number (10-50), "description": string }`,
            config: { responseMimeType: 'application/json' }
        }),
        () => FALLBACK.journey(topic)
    );
    res.json(result);
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level } = req.body;
    
    // Check prebaked
    if (prebakedLevelsCache[topic]) {
        console.log(`Using prebaked data for: ${topic}`);
        return res.json({ questions: prebakedLevelsCache[topic].questions });
    }

    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Generate 3 quiz questions for ${topic} (Level ${level}). JSON format: { "questions": [ { "question": string, "options": [string, string, string, string], "correctAnswerIndex": number, "explanation": string } ] }`,
            config: { responseMimeType: 'application/json' }
        }),
        () => FALLBACK.questions(topic)
    );
    res.json(result);
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level } = req.body;
    
    if (prebakedLevelsCache[topic]) return res.json({ lesson: prebakedLevelsCache[topic].lesson });

    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Write a short, fun lesson for ${topic} (Level ${level}). Max 100 words. JSON: { "lesson": "markdown text" }`,
            config: { responseMimeType: 'application/json' }
        }),
        () => FALLBACK.lesson(topic)
    );
    res.json(result);
});

// Mock other endpoints to prevent 404s
app.post('/api/generate-curriculum-outline', (req, res) => res.json({ chapters: ["Basics", "Advanced", "Mastery"] }));
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Think about the core principles." }));
app.get('/api/topics', async (req, res) => {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
        res.json(JSON.parse(data));
    } catch { res.json([]); }
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
