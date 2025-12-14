
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

// Robust Key Extraction
const rawKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const API_KEY = rawKey ? rawKey.trim() : null;

console.log("--- SYSTEM STARTUP DIAGNOSTICS ---");
console.log(`Node Version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
if (API_KEY) {
    console.log(`✅ API Key Detected. Length: ${API_KEY.length} characters.`);
    console.log(`🔑 Key Preview: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
} else {
    console.error("❌ FATAL: API_KEY is missing in process.env!");
    console.log("   Checked: API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY");
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
    `,
    sage: `Persona: A Wise Professor. Tone: Thoughtful, deep.`,
    commander: `Persona: Tactical Mission Control. Tone: Urgent, military.`,
    eli5: `Persona: A Creative Workshop Director. Tone: Playful.`
};

function getSystemInstruction(personaKey = 'apex') {
    return `${PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.apex} 
    RULES: Keep it short. Under 150 words.`;
}

// STRICT JSON INSTRUCTION - For data generation tasks to ensure speed and validity
function getStrictJsonInstruction() {
    return `You are a specialized Data Generator API. 
    Output PURE JSON matching the requested schema. 
    Do not include markdown formatting, preambles, or explanations.
    Focus on accuracy and valid JSON syntax.`;
}

// --- FALLBACK DATA GENERATORS (Safety Net) ---
const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "Robotics Mastery",
        totalLevels: 50,
        description: `(Offline Simulation) A comprehensive training course on ${topic}. Server could not reach AI.`,
        isFallback: true
    }),
    curriculum: (topic) => ({
        chapters: ["Sensors & Input", "Processing Logic", "Actuators & Motion", "Advanced AI Control"],
        isFallback: true
    }),
    questions: (topic) => ({
        questions: [
            {
                question: `In the context of ${topic}, what is the primary function of a PID controller?`,
                options: ["To cool down motors", "To correct errors and maintain stability", "To generate random numbers", "To connect to Wi-Fi"],
                correctAnswerIndex: 1,
                explanation: "PID (Proportional-Integral-Derivative) controllers allow systems to automatically correct errors to reach a target state."
            },
            {
                question: `A robot needs to detect the distance to a wall. Which sensor is best?`,
                options: ["Microphone", "Ultrasonic Sensor", "Thermometer", "Gyroscope"],
                correctAnswerIndex: 1,
                explanation: "Ultrasonic sensors emit sound waves and measure the echo time to calculate distance."
            },
            {
                question: `What does 'GPIO' stand for on a Raspberry Pi?`,
                options: ["General Purpose Input/Output", "Graphic Processing Input Only", "Global Position In Orbit", "General Power In Out"],
                correctAnswerIndex: 0,
                explanation: "GPIO pins allow the computer to interact with the physical world (LEDs, Motors, Sensors)."
            }
        ],
        isFallback: true
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Offline Backup Protocol Active.\n\nSince the AI connection is currently offline, we are accessing the local reserve archives.\n\n*   **Core Concept:** Mastery of ${topic} requires understanding the loop of Sense -> Think -> Act.\n*   **Industry Standard:** Automation is the future of manufacturing and logistics.\n*   **Objective:** Prove your knowledge to proceed.\n\nProceed to the challenge.`,
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
    
    // Updated Prompt for Dynamic Level Calculation
    const prompt = `
    Analyze the complexity of the subject: "${topic}". 
    Calculate the precise number of levels required to master it.
    
    SCALING RULES:
    1. Micro Skills (e.g., "Tying a shoelace", "Boiling an egg") -> 3 to 9 Levels.
    2. Basic Skills (e.g., "Changing a tire", "Making Tea") -> 10 to 25 Levels.
    3. Moderate Skills (e.g., "High School Algebra", "Basic Excel") -> 30 to 80 Levels.
    4. Professional Skills (e.g., "React Development", "Digital Marketing") -> 100 to 300 Levels.
    5. Massive Fields (e.g., "Medical Degree", "Quantum Physics", "Civil Engineering") -> 500 to 1500 Levels.
    
    Return a specific number based on the depth of the topic.
    
    Output purely JSON: { 
        topicName: string, 
        totalLevels: integer, 
        description: string (short, engaging marketing pitch) 
    }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getStrictJsonInstruction(),
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
                systemInstruction: getStrictJsonInstruction()
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.curriculum(topic);
    } catch (error) {
        return FALLBACK_DATA.curriculum(topic);
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    if (!ai) return FALLBACK_DATA.questions(topic);
    
    const prompt = `Topic: ${topic}. Level ${level} of ${totalLevels}. Generate 3 multiple choice questions. Scenario based.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: getStrictJsonInstruction(),
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
            contents: `Write a short, exciting lesson for ${topic} level ${level} of ${totalLevels}. Under 150 words. Use simple analogies.`,
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

app.post('/api/generate-hint', (req, res) => res.json({ hint: "Review the core concepts. Look for keywords in the question." }));
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

wss.on('connection', (ws) => {
    console.log('WS Connected');
    if (!ai) {
        ws.send(JSON.stringify({ type: 'error', message: 'AI Voice Unavailable (Server Offline Mode)' }));
    }
    ws.on('close', () => console.log('WS Disconnected'));
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
