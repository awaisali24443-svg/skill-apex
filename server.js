
// --- IMPORTS & SETUP ---
import 'dotenv/config'; // Load env vars immediately
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

// --- ROBUST KEY EXTRACTION ---
// Trims whitespace and handles potential quoting issues in .env files
const rawKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const API_KEY = rawKey ? rawKey.replace(/["']/g, "").trim() : null;

console.log("--- SYSTEM STARTUP DIAGNOSTICS ---");
console.log(`Node Version: ${process.version}`);
if (API_KEY) {
    console.log(`✅ API Key Detected. Length: ${API_KEY.length} chars.`);
} else {
    console.error("❌ FATAL: API_KEY is missing! Server will run in FALLBACK MODE.");
}
console.log("----------------------------------");

const PORT = process.env.PORT || 3000;
let topicsCache = null;

// --- FALLBACK DATA (Offline/Error Mode) ---
const FALLBACK_DATA = {
    questions: (topic) => ({
        questions: [
            {
                question: `(Offline Mode) What is a key concept of ${topic}?`,
                options: ["Confusion", "Consistency", "Chaos", "Complexity"],
                correctAnswerIndex: 1,
                explanation: "Consistency is crucial for mastery."
            },
            {
                question: `Which tool helps with ${topic}?`,
                options: ["Hammer", "Computer", "Wrench", "Drill"],
                correctAnswerIndex: 1,
                explanation: "Computers are the primary tool for this field."
            },
            {
                question: "Why learn this skill?",
                options: ["For fun", "Career Growth", "No reason", "To sleep"],
                correctAnswerIndex: 1,
                explanation: "This skill is highly valued in the industry."
            }
        ]
    }),
    lesson: (topic) => ({
        lesson: `### Offline Briefing: ${topic}\n\n**Status:** Server Connection Limited.\n\nWe are currently unable to reach the AI core. Engaging local backup protocols.\n\n*   Review the basics.\n*   Practice consistently.\n\nProceed to the challenge.`
    }),
    journey: (topic) => ({
        topicName: topic,
        totalLevels: 10,
        description: "Generated via Offline Protocol."
    }),
    curriculum: (topic) => ({
        chapters: ["Basics", "Intermediate", "Advanced", "Mastery"]
    })
};

// --- GEMINI SETUP ---
let ai = null;
if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
}

// --- SELF-HEALING JSON PARSER ---
function cleanAndParseJSON(text) {
    if (!text) return null;
    let clean = text.trim();
    
    // 1. Remove Markdown Code Blocks
    if (clean.includes('```')) {
        clean = clean.replace(/```json/g, '').replace(/```/g, '');
    }
    
    // 2. Attempt Parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse Warning: Trying to repair JSON...");
        // 3. Simple Repair: Find first '{' and last '}'
        const first = clean.indexOf('{');
        const last = clean.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
            try {
                return JSON.parse(clean.substring(first, last + 1));
            } catch (e2) {
                console.error("JSON Repair Failed:", e2.message);
                return null;
            }
        }
        return null;
    }
}

// --- GENERATION FUNCTIONS ---

async function generateLevelQuestions(topic, level, totalLevels) {
    if (!ai) return FALLBACK_DATA.questions(topic);

    const prompt = `
    Generate 3 multiple-choice questions for the topic "${topic}" (Level ${level}/${totalLevels}).
    
    CRITICAL RULES:
    1. Output strictly valid JSON.
    2. Format: { "questions": [ { "question": "...", "options": ["A","B","C","D"], "correctAnswerIndex": 0, "explanation": "..." } ] }
    3. Ensure options are an array of 4 strings.
    4. Ensure correctAnswerIndex is a number (0-3).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
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
        
        // Validation
        if (data && data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            return data;
        }
        throw new Error("Invalid structure returned from AI");

    } catch (error) {
        console.error("AI Gen Error (Questions):", error.message);
        return FALLBACK_DATA.questions(topic);
    }
}

async function generateLevelLesson(topic, level, totalLevels) {
    if (!ai) return FALLBACK_DATA.lesson(topic);

    const prompt = `
    Write a short, engaging lesson/briefing for "${topic}" (Level ${level}/${totalLevels}).
    Format: Markdown. Keep it under 150 words. Use bullet points.
    Return JSON: { "lesson": "markdown string here" }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { lesson: { type: Type.STRING } },
                    required: ["lesson"]
                }
            }
        });
        
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.lesson(topic);
    } catch (error) {
        console.error("AI Gen Error (Lesson):", error.message);
        return FALLBACK_DATA.lesson(topic);
    }
}

async function generateJourneyPlan(topic) {
    if (!ai) return FALLBACK_DATA.journey(topic);
    
    const prompt = `Analyze "${topic}". Output JSON: { "topicName": "${topic}", "totalLevels": 20, "description": "Short pitch." }`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.journey(topic);
    } catch (e) {
        return FALLBACK_DATA.journey(topic);
    }
}

// --- EXPRESS APP ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api', limiter);

// Helper to wrap async routes
const safe = (fn) => async (req, res) => {
    try {
        const result = await fn(req.body);
        res.json(result);
    } catch (e) {
        console.error("API Error:", e.message);
        // Determine fallback based on URL
        if(req.url.includes('questions')) res.json(FALLBACK_DATA.questions(req.body.topic || 'Unknown'));
        else if(req.url.includes('lesson')) res.json(FALLBACK_DATA.lesson(req.body.topic || 'Unknown'));
        else res.status(500).json({ error: "Internal Error" });
    }
};

app.get('/api/client-config', (req, res) => {
    if (!API_KEY) return res.status(503).json({ error: 'Server Offline' });
    res.json({ apiKey: API_KEY });
});

app.post('/api/generate-level-questions', safe((b) => generateLevelQuestions(b.topic, b.level, b.totalLevels)));
app.post('/api/generate-level-lesson', safe((b) => generateLevelLesson(b.topic, b.level, b.totalLevels)));
app.post('/api/generate-journey-plan', safe((b) => generateJourneyPlan(b.topic)));
app.post('/api/generate-curriculum-outline', (req, res) => res.json(FALLBACK_DATA.curriculum(req.body.topic))); // Simple mock for outline to save tokens
app.post('/api/generate-hint', (req, res) => res.json({ hint: "Read the question carefully. The answer is often in the details." }));
app.post('/api/explain-error', (req, res) => res.json({ explanation: "That answer is incorrect based on standard principles of the subject." }));

app.get('/api/topics', async (req, res) => {
    try {
        if (!topicsCache) {
            const data = await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
            topicsCache = JSON.parse(data);
        }
        res.json(topicsCache);
    } catch (e) {
        res.json([]);
    }
});

// Mock Image Gen for now
app.post('/api/generate-journey-from-image', (req, res) => {
    res.json({ topicName: "Scanned Topic", totalLevels: 10, description: "Analyzed from image." });
});

wss.on('connection', (ws) => {
    console.log('WS Connected');
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
