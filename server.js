
// --- IMPORTS & SETUP ---
import 'dotenv/config'; // Load env vars immediately
import express from 'express';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import http from 'http';
import { WebSocketServer } from 'ws';

// --- DEBUG & ENVIRONMENT CHECK ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================================================================================
// API KEY CONFIGURATION
// Checking both common variable names for maximum compatibility
// ==================================================================================
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

console.log("--- SYSTEM STARTUP DIAGNOSTICS ---");
console.log(`Node Version: ${process.version}`);
if (API_KEY) {
    console.log(`✅ API Key Detected. Length: ${API_KEY.length} characters.`);
} else {
    console.error("❌ FATAL: API_KEY (or GEMINI_API_KEY) is missing in environment variables!");
}
console.log("----------------------------------");

// --- CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
let topicsCache = null;
let prebakedLevelsCache = {}; // IN-MEMORY DATABASE

// Load Prebaked Data on Start
(async () => {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data', 'prebaked_levels.json'), 'utf-8');
        prebakedLevelsCache = JSON.parse(data);
        console.log(`✅ Loaded ${Object.keys(prebakedLevelsCache).length} prebaked topics into memory.`);
    } catch (e) {
        console.warn("⚠️ Could not load prebaked_levels.json:", e.message);
    }
})();

// --- DYNAMIC PERSONA SYSTEM (LOCALIZED) ---
const PERSONA_DEFINITIONS = {
    apex: `
    You are ApexCore, an advanced AI Tutor designed for a Tech Expo in Pakistan.
    
    TONE: Professional, encouraging, but use LOCAL ANALOGIES to explain complex tech.
    
    GUIDELINES:
    1. If explaining speed/latency, use examples like "Traffic in Peshawar" or "Cricket ball speed (Shoaib Akhtar)".
    2. If explaining loops/structure, maybe reference "Brick Kiln (Bhatta)" or "Textile Loom".
    3. Keep English simple and high-impact.
    4. NO long paragraphs. Bullet points are best.
    
    Your goal is to impress judges by making high-tech concepts feel native and understandable.
    `,
    sage: `Persona: A Wise Professor. Tone: Thoughtful, deep.`,
    commander: `Persona: Tactical Mission Control. Tone: Urgent, military.`,
    eli5: `Persona: A Creative Workshop Director. Tone: Playful.`
};

function getSystemInstruction(personaKey = 'apex') {
    return `${PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.apex} 
    RULES: No rote memorization. Scenario-based questions. JSON output only.`;
}

// --- FALLBACK DATA GENERATORS (Safety Net) ---
const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "IT Mastery",
        totalLevels: 10,
        description: `(Offline Simulation) A specialized training course on ${topic}. AI connection currently stabilizing.`,
        isFallback: true
    }),
    curriculum: (topic) => ({
        chapters: ["Fundamentals", "Core Concepts", "Advanced Theory", "Mastery Protocol"],
        isFallback: true
    }),
    questions: (topic) => ({
        questions: [
            {
                question: `Scenario: You are optimizing a system for ${topic}. What is the most critical first step?`,
                options: ["Guessing solutions", "Analyzing Requirements", "Writing code immediately", "Ignoring the problem"],
                correctAnswerIndex: 1,
                explanation: "Analysis always precedes execution in professional engineering."
            },
            {
                question: `In the context of ${topic}, why is scalability important?`,
                options: ["It looks cool", "To handle growth efficiently", "To use more RAM", "It is not important"],
                correctAnswerIndex: 1,
                explanation: "Scalability ensures systems don't crash under increased load."
            },
            {
                question: `A critical bug is found in ${topic}. How do you react?`,
                options: ["Hide it", "Blame the intern", "Isolate, Reproduce, Fix", "Delete the project"],
                correctAnswerIndex: 2,
                explanation: "Standard debugging protocol: Isolate the issue, reproduce it, then apply the fix."
            }
        ],
        isFallback: true
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Simulated Data Link.\n\nWe are accessing the local backup archives for **${topic}**.\n\n*   **Concept 1:** Understanding the basics is key to mastering this field.\n*   **Concept 2:** Practical application beats theory every time.\n\n**Action:** Proceed to the quiz to test your baseline knowledge.`,
        isFallback: true
    })
};

// --- VALIDATION HELPERS ---
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        const firstOpen = clean.search(/[\{\[]/);
        let lastClose = -1;
        for (let i = clean.length - 1; i >= 0; i--) {
            if (clean[i] === '}' || clean[i] === ']') {
                lastClose = i;
                break;
            }
        }
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }
        try { return JSON.parse(clean); } catch (e2) { return null; }
    }
}

// --- GEMINI API SETUP ---
let ai;

try {
    if (API_KEY) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
        console.log(`✅ GoogleGenAI initialized.`);
    } else {
        console.warn("⚠️ Server running in OFFLINE MODE (No AI Key). Fallback data will be used.");
    }
} catch (error) {
    console.error(`❌ Failed to initialize AI: ${error.message}`);
}

// --- AGGRESSIVE RETRY HELPER ---
async function callAIWithRetry(fn, retries = 5, delay = 2000) {
    try {
        return await fn();
    } catch (error) {
        const status = error.status || error.code; 
        if (retries > 0 && (status === 429 || status === 503 || status === 'RESOURCE_EXHAUSTED')) {
            console.warn(`⚠️ AI Busy (Status ${status}). Retrying in ${delay}ms... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, delay));
            return callAIWithRetry(fn, retries - 1, Math.floor(delay * 1.5)); 
        }
        console.error("❌ AI Call Failed Final:", error.message);
        throw error;
    }
}

// --- SERVICE FUNCTIONS ---

async function generateJourneyPlan(topic, persona) {
    // 1. Check Offline DB (Instant)
    if (prebakedLevelsCache[topic]) {
        console.log(`⚡ Serving Prebaked Journey for: ${topic}`);
        return {
            topicName: topic,
            totalLevels: 50, // Standard size for prebaked
            description: "High-performance training module loaded from local archives. 100% Reliable.",
            isPrebaked: true
        };
    }

    if (!ai) return FALLBACK_DATA.journey(topic);
    
    const prompt = `Analyze "${topic}". Output JSON: { topicName, totalLevels (10-50), description }`;
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona),
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topicName: { type: Type.STRING },
                        totalLevels: { type: Type.INTEGER },
                        description: { type: Type.STRING }
                    },
                    required: ["topicName", "totalLevels", "description"]
                }
            }
        }));
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.journey(topic);
    } catch (error) {
        console.error("Error in generateJourneyPlan:", error);
        // We do NOT return fallback here if this is a debug call, we let error propagate
        if (topic === "PING_TEST_PROTOCOL_DEBUG") throw error; 
        return FALLBACK_DATA.journey(topic);
    }
}

async function generateCurriculumOutline(topic, totalLevels, persona) {
    if (!ai) return FALLBACK_DATA.curriculum(topic);
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Break into 4 chapter titles. JSON: { chapters: [] }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona)
            }
        }));
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.curriculum(topic);
    } catch (error) {
        console.error("Error in generateCurriculumOutline:", error);
        return FALLBACK_DATA.curriculum(topic);
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    // 1. Check Prebaked DB
    if (prebakedLevelsCache[topic]) {
        console.log(`⚡ Serving Prebaked Questions for: ${topic}`);
        const data = prebakedLevelsCache[topic];
        return { questions: data.questions };
    }

    if (!ai) return FALLBACK_DATA.questions(topic);
    
    const ratio = level / totalLevels;
    let focusArea = "";
    if (ratio < 0.2) focusArea = "Focus: Fundamental Definitions & Vocabulary.";
    else if (ratio < 0.6) focusArea = "Focus: Practical Application & Usage.";
    else focusArea = "Focus: Complex Architecture & Strategy.";

    const prompt = `
    Topic: ${topic}. Level: ${level}/${totalLevels}. ${focusArea}
    Generate 3 multiple choice questions.
    `;

    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona),
                responseSchema: {
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
                }
            }
        }));
        
        const data = cleanAndParseJSON(response.text);
        if (data && data.questions && Array.isArray(data.questions)) {
            return data;
        } else {
            return FALLBACK_DATA.questions(topic);
        }
    } catch (error) {
        console.error("Error in generateLevelQuestions:", error);
        return FALLBACK_DATA.questions(topic);
    }
}

async function generateLevelLesson(topic, level, totalLevels, questions, persona) {
    // 1. Check Prebaked DB
    if (prebakedLevelsCache[topic]) {
        console.log(`⚡ Serving Prebaked Lesson for: ${topic}`);
        return { lesson: prebakedLevelsCache[topic].lesson };
    }

    if (!ai) return FALLBACK_DATA.lesson(topic);
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a short, exciting lesson briefing for ${topic}, Level ${level}. Under 150 words.`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona),
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lesson: { type: Type.STRING }
                    },
                    required: ["lesson"]
                }
            }
        }));
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.lesson(topic);
    } catch (error) {
        console.error("Error in generateLevelLesson:", error);
        return FALLBACK_DATA.lesson(topic);
    }
}

// --- NEW MULTIMODAL SERVICE ---
async function generateJourneyFromFile(fileData, mimeType, persona) {
    if (!ai) return FALLBACK_DATA.journey("Document Analysis");

    const prompt = `
    Analyze the provided document or image.
    1. Identify the CORE TOPIC (e.g. "Biology", "Financial Report Analysis", "History of Rome").
    2. Create a catchy Topic Name.
    3. Determine a suitable number of levels (10-30).
    4. Write a brief description summarizing the content.
    Output JSON: { topicName, totalLevels, description }
    `;

    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: fileData
                        }
                    },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona),
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topicName: { type: Type.STRING },
                        totalLevels: { type: Type.INTEGER },
                        description: { type: Type.STRING }
                    },
                    required: ["topicName", "totalLevels", "description"]
                }
            }
        }));
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.journey("Analyzed Content");
    } catch (error) {
        console.error("Multimodal Error:", error);
        return FALLBACK_DATA.journey("Analyzed Content");
    }
}

// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// FIX: REQUIRED FOR DEPLOYMENT (Render/Heroku/etc)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' })); // Limit increased for file uploads
app.use(express.static(path.join(__dirname)));

// Robust Rate Limiting
const apiLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
}); 
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/client-config', (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'Server offline (Key missing)' });
    }
    res.json({ apiKey: API_KEY });
});

// --- DEBUG ENDPOINT FOR CLIENT ---
app.post('/api/debug-status', async (req, res) => {
    if (!API_KEY) {
        return res.json({ status: 'error', message: 'Env Var API_KEY is missing on Server' });
    }
    if (!ai) {
        return res.json({ status: 'error', message: 'AI Client failed to initialize' });
    }
    try {
        // Try a very simple generation to test the key validity
        await generateJourneyPlan("PING_TEST_PROTOCOL_DEBUG", "apex");
        res.json({ status: 'online', message: 'AI Responded Successfully' });
    } catch (e) {
        res.json({ 
            status: 'error', 
            message: e.message || 'Unknown API Error',
            code: e.status || e.code
        });
    }
});

// Helper for safe route handling
const safeHandler = (fn) => async (req, res) => {
    try {
        const result = await fn(req.body);
        res.json(result);
    } catch (e) {
        console.error("Route Error:", e);
        if (req.path.includes('questions')) res.json(FALLBACK_DATA.questions(req.body.topic));
        else if (req.path.includes('lesson')) res.json(FALLBACK_DATA.lesson(req.body.topic));
        else if (req.path.includes('journey')) res.json(FALLBACK_DATA.journey(req.body.topic));
        else res.status(500).json({ error: "Internal Server Error" });
    }
};

app.post('/api/generate-journey-plan', safeHandler((body) => generateJourneyPlan(body.topic, body.persona)));
app.post('/api/generate-curriculum-outline', safeHandler((body) => generateCurriculumOutline(body.topic, body.totalLevels, body.persona)));
app.post('/api/generate-level-questions', safeHandler((body) => generateLevelQuestions(body.topic, body.level, body.totalLevels, body.persona)));
app.post('/api/generate-level-lesson', safeHandler((body) => generateLevelLesson(body.topic, body.level, body.totalLevels, body.questions, body.persona)));

// New Endpoint for Files
app.post('/api/generate-journey-from-file', safeHandler((body) => generateJourneyFromFile(body.fileData, body.mimeType, body.persona)));

// Utility Endpoints
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Review the core concepts mentioned in the briefing. Look for keywords." }));
app.post('/api/explain-error', (req, res) => res.json({ explanation: "The selected answer contradicts standard best practices. Re-read the question carefully." }));

app.get('/api/topics', async (req, res) => {
    try {
        if (!topicsCache) {
            const data = await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
            topicsCache = JSON.parse(data);
        }
        res.json(topicsCache);
    } catch (error) { res.status(500).json({ error: 'Could not load topics data.' }); }
});

// --- WEBSOCKETS ---
wss.on('connection', (ws) => {
    console.log('WS Connected');
    if (!ai) {
        ws.send(JSON.stringify({ type: 'error', message: 'AI Voice Unavailable (Server Offline Mode)' }));
    }
    ws.on('close', () => console.log('WS Disconnected'));
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
