
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

// --- SYSTEM INSTRUCTION (THE BRAIN) ---
const SYSTEM_INSTRUCTION = `
ROLE & IDENTITY
You are an elite educational intelligence engine designed for live demonstrations, public expos, and first-time users.
Your behavior must always feel intelligent, calm, adaptive, and helpful.
You are not a chatbot. You are a learning decision-maker.

CORE PRINCIPLE (NON-NEGOTIABLE)
Never generate content immediately. Always THINK FIRST.
Before responding, silently perform:
1. Topic analysis
2. Feasibility evaluation
3. Output mode decision
4. Quality check

STEP 1 — TOPIC FEASIBILITY ANALYSIS
Determine if the topic is Learnable, Testable, Structured, or Informational only.

STEP 2 — OUTPUT MODE RULES
Classify into EXACTLY ONE mode, but handle the JSON output structure strictly as defined below:

MODE 1: Full Learning Journey + Quiz
- Use when: Topic has clear progression, concepts can be tested meaningfully.
- Output JSON Key: "questions"

MODE 2: Lesson / Concept Explanation
- Use when: Topic is specific, no progression needed, user wants understanding not assessment.
- Output JSON Key: "lesson"

MODE 3: Graceful Redirection / Informational
- Use when: Topic is unclear, not meaningful, or purely factual (time, weather).
- Output JSON Key: "error" (Provide a helpful message in this field)

STEP 3 — CONTENT QUALITY RULES
- Be engaging, not textbook-like.
- Be short and clear (Expo visitors have low patience).
- Use examples and analogies.
- Avoid unnecessary jargon.

STEP 4 — QUIZ INTELLIGENCE RULES
- Questions must match lesson content directly.
- Be unambiguous.
- Difficulty must match the level.

TECHNICAL REQUIREMENT (CRITICAL)
You must **ALWAYS** return valid JSON. Do not include markdown code blocks (like \`\`\`json). Just the raw JSON object.
`;

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

async function generateWithFallback(callFn, fallbackFn, label) {
    if (!ai) {
        console.warn(`[${label}] No API Key available. Using fallback.`);
        return fallbackFn();
    }
    try {
        console.log(`[${label}] Calling Gemini API...`);
        const response = await callFn('gemini-2.5-flash'); // Use latest model for smarts
        const data = extractAndParseJSON(response.text);
        if (data) {
            console.log(`[${label}] ✅ Success.`);
            return data;
        } else {
            console.warn(`[${label}] ⚠️ Valid JSON not found in response.`);
            return fallbackFn();
        }
    } catch (error) {
        console.error(`[${label}] ❌ AI Generation Error:`, error.message);
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
    
    // Journeys are always generated via API as they are dynamic
    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Create a learning journey for "${topic}". JSON only: { "topicName": string, "totalLevels": number (10-50), "description": string }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: SYSTEM_INSTRUCTION
            }
        }),
        () => FALLBACK.journey(topic),
        "JOURNEY_PLAN"
    );
    res.json(result);
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level } = req.body;
    
    // 1. CHECK JSON CACHE (Prebaked Data)
    if (prebakedLevelsCache[topic]) {
        console.log(`[CACHE HIT] Found prebaked data for: ${topic}`);
        return res.json({ questions: prebakedLevelsCache[topic].questions });
    }

    // 2. CACHE MISS -> CALL API KEY IMMEDIATELY
    console.log(`[CACHE MISS] Generating fresh questions for: ${topic}`);
    
    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Generate 3 quiz questions for ${topic} (Level ${level}). JSON format: { "questions": [ { "question": string, "options": [string, string, string, string], "correctAnswerIndex": number, "explanation": string } ] }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: SYSTEM_INSTRUCTION
            }
        }),
        () => FALLBACK.questions(topic),
        "QUIZ_GEN"
    );
    res.json(result);
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level } = req.body;
    
    // 1. CHECK JSON CACHE
    if (prebakedLevelsCache[topic]) {
        console.log(`[CACHE HIT] Found prebaked lesson for: ${topic}`);
        return res.json({ lesson: prebakedLevelsCache[topic].lesson });
    }

    // 2. CACHE MISS -> CALL API KEY IMMEDIATELY
    console.log(`[CACHE MISS] Generating fresh lesson for: ${topic}`);

    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: `Write a short, fun lesson for ${topic} (Level ${level}). Max 100 words. JSON: { "lesson": "markdown text" }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: SYSTEM_INSTRUCTION
            }
        }),
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

// New Endpoint for Generic File/Image to Journey
app.post('/api/generate-journey-from-file', async (req, res) => {
    const { fileData, mimeType } = req.body;
    
    const result = await generateWithFallback(
        (model) => ai.models.generateContent({
            model: model,
            contents: [
                { text: `Analyze this image/document. Identify the main topic and create a learning journey. JSON only: { "topicName": string, "totalLevels": number (10-50), "description": string }` },
                { inlineData: { mimeType: mimeType, data: fileData } }
            ],
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: SYSTEM_INSTRUCTION
            }
        }),
        () => FALLBACK.journey("Analyzed Content"),
        "FILE_ANALYSIS"
    );
    res.json(result);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
