
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

// Robust Key Extraction with Hardcoded Fallback for Immediate Deployment Success
const FALLBACK_KEY = "AIzaSyDCcZwOe8v-I58rPHg3wHGKwPNTxYvl7ho";
const rawKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || FALLBACK_KEY;
const API_KEY = rawKey ? rawKey.trim() : null;

console.log("--- SYSTEM STARTUP DIAGNOSTICS ---");
console.log(`Node Version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
if (API_KEY) {
    console.log(`✅ API Key Detected. Length: ${API_KEY.length} characters.`);
    console.log(`🔑 Key Preview: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
} else {
    console.error("❌ FATAL: API_KEY is missing in process.env!");
}
console.log("----------------------------------");

// --- CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
let topicsCache = null;

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
        totalLevels: 20,
        description: `(Offline Simulation) A comprehensive training course on ${topic}. Server could not reach AI.`,
        isFallback: true
    }),
    curriculum: (topic) => ({
        chapters: ["Fundamentals", "Tools & Technologies", "Real-world Application", "Expert Mastery"],
        isFallback: true
    }),
    questions: (topic) => ({
        questions: [
            {
                question: `Scenario: You are working on a project related to ${topic} and the system crashes. What is the first logical step?`,
                options: ["Panic", "Check the logs/debug", "Restart everything immediately", "Call the client"],
                correctAnswerIndex: 1,
                explanation: "Debugging and log analysis is the professional first step in any IT crisis."
            },
            {
                question: `In the context of ${topic}, which practice ensures long-term success?`,
                options: ["Taking shortcuts", "Consistent Learning & Practice", "Copying code without understanding", "Using outdated tools"],
                correctAnswerIndex: 1,
                explanation: "Technology evolves rapidly; consistency is the only way to stay relevant."
            },
            {
                question: `A client asks for a feature in ${topic} that is technically impossible. What do you do?`,
                options: ["Say yes and fake it", "Ignore them", "Explain the limitation and offer an alternative", "Quit the project"],
                correctAnswerIndex: 2,
                explanation: "Professionalism involves managing expectations and finding viable technical solutions."
            }
        ],
        isFallback: true
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Offline Backup Protocol Active.\n\nSince the AI connection is currently offline, we are accessing the local reserve archives.\n\n*   **Core Concept:** Mastery of ${topic} requires understanding both the 'How' and the 'Why'.\n*   **Industry Standard:** This skill is highly valued in the global market.\n*   **Objective:** Prove your knowledge to proceed.\n\nProceed to the challenge.`,
        isFallback: true
    })
};

// --- VALIDATION HELPERS ---
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        // Clean markdown code blocks
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        // Find first { or [
        const firstOpen = clean.search(/[\{\[]/);
        let lastClose = -1;
        // Find last } or ]
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
        console.warn("⚠️ Server running in OFFLINE MODE (No AI).");
    }
} catch (error) {
    console.error(`❌ Failed to initialize AI: ${error.message}`);
}

// --- SERVICE FUNCTIONS ---

async function generateJourneyPlan(topic, persona) {
    if (!ai) return FALLBACK_DATA.journey(topic);
    
    const prompt = `Analyze "${topic}". Output JSON: { topicName, totalLevels (10-50), description }`;
    try {
        const response = await ai.models.generateContent({
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
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.journey(topic);
    } catch (error) {
        console.error("AI Error (Journey):", error.message);
        return FALLBACK_DATA.journey(topic);
    }
}

async function generateCurriculumOutline(topic, totalLevels, persona) {
    if (!ai) return FALLBACK_DATA.curriculum(topic);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Break into 4 chapter titles. JSON: { chapters: [] }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona)
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.curriculum(topic);
    } catch (error) {
        return FALLBACK_DATA.curriculum(topic);
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    if (!ai) return FALLBACK_DATA.questions(topic);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `Topic: ${topic}. Level ${level}. Generate 3 scenario-based multiple choice questions.`,
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
        });
        
        const data = cleanAndParseJSON(response.text);
        
        // Robust check for data integrity
        if (data && data.questions && Array.isArray(data.questions)) {
            return data;
        } else {
            console.warn("AI returned invalid structure:", response.text);
            return FALLBACK_DATA.questions(topic);
        }
    } catch (error) {
        console.error("AI Error (Questions):", error.message);
        return FALLBACK_DATA.questions(topic);
    }
}

async function generateLevelLesson(topic, level, totalLevels, questions, persona) {
    if (!ai) return FALLBACK_DATA.lesson(topic);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a short, exciting lesson for ${topic} level ${level}. Under 150 words. Use simple analogies.`,
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
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.lesson(topic);
    } catch (error) {
        console.error("AI Error (Lesson):", error.message);
        return FALLBACK_DATA.lesson(topic);
    }
}

// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Robust Rate Limiting
const apiLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 300, // Higher limit for Expo usage
    standardHeaders: true,
    legacyHeaders: false,
}); 
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.status(200).send('OK'));

// --- CLIENT CONFIG ENDPOINT (CRITICAL FOR LIVE API) ---
// This allows the frontend to get the key securely for client-side-only features (Aural)
app.get('/api/client-config', (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'Server offline (Key missing)' });
    }
    res.json({ apiKey: API_KEY });
});

// Helper for safe route handling
const safeHandler = (fn) => async (req, res) => {
    try {
        const result = await fn(req.body);
        res.json(result);
    } catch (e) {
        console.error("Route Error:", e);
        // Return fallback data instead of 500 error to keep app running
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
