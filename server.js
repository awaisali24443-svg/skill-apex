
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
const __dirname = path.dirname(__filename);
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

// --- FALLBACK DATA GENERATORS (The "At Any Cost" Safety Net) ---
const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "IT Mastery",
        totalLevels: 20,
        description: `(Offline Simulation) A comprehensive training course on ${topic}. Covers fundamentals, advanced techniques, and practical application.`,
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
const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

try {
    if (!apiKey) {
        console.warn("⚠️ API Key missing. Server will run in OFFLINE FALLBACK MODE.");
    } else {
        ai = new GoogleGenAI({ apiKey: apiKey });
        console.log(`✅ GoogleGenAI initialized.`);
    }
} catch (error) {
    console.error(`Failed to initialize AI: ${error.message}`);
}

// --- SERVICE FUNCTIONS WITH FALLBACK ---

async function generateJourneyPlan(topic, persona) {
    if (!ai) return FALLBACK_DATA.journey(topic);
    
    // EXPO OPTIMIZATION: Use Flash for speed
    const prompt = `Analyze "${topic}". Output JSON: { topicName, totalLevels (10-50), description }`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona)
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
            contents: `Topic: ${topic}. Level ${level}. Generate 3 scenario-based multiple choice questions. JSON format.`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona)
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.questions(topic);
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
            contents: `Write a short, exciting lesson for ${topic} level ${level}. Under 150 words. Use simple analogies. JSON: { lesson: string }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getSystemInstruction(persona)
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.lesson(topic);
    } catch (error) {
        return FALLBACK_DATA.lesson(topic);
    }
}

// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }); // Increased limit for expo
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.status(200).send('OK'));

// Helper for safe route handling
const safeHandler = (fn) => async (req, res) => {
    try {
        const result = await fn(req.body);
        res.json(result);
    } catch (e) {
        console.error("Route Error:", e);
        // Even if the handler crashes, try to return fallback data based on endpoint
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

// Simple endpoints that don't strictly need AI
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Review the core concepts mentioned in the briefing." }));
app.post('/api/explain-error', (req, res) => res.json({ explanation: "The selected answer contradicts the standard best practices for this scenario." }));

app.get('/api/topics', async (req, res) => {
    try {
        if (!topicsCache) topicsCache = JSON.parse(await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8'));
        res.json(topicsCache);
    } catch (error) { res.status(500).json({ error: 'Could not load topics data.' }); }
});

// --- WEBSOCKETS ---
wss.on('connection', (ws) => {
    console.log('WS Connected');
    // If AI is missing, send a polite error immediately via WS
    if (!ai) {
        ws.send(JSON.stringify({ type: 'error', message: 'AI Voice Unavailable (Offline Mode)' }));
        // Don't close immediately, let client handle it
    }
    
    // ... existing WS logic would go here, wrapped in try/catch ...
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
