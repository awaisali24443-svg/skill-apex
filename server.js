
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

// --- DYNAMIC PERSONA SYSTEM ---
const PERSONA_DEFINITIONS = {
    apex: `Persona: A fusion of a Senior Educator, Cognitive Psychologist, and Lead Game Designer.
           Tone: Professional, encouraging, gamified, and precise.`,
    
    sage: `Persona: A Socratic Philosopher and Wise Mentor.
           Tone: Thoughtful, deep, and inquisitive. 
           Style: Often answer questions with guiding questions to provoke thought. Use metaphors from nature and logic.`,
    
    commander: `Persona: A Futuristic Military Drill Instructor.
           Tone: Intense, direct, strict, and high-energy.
           Style: No fluff. Focus on discipline, 'mission objectives', and 'tactical knowledge'. Call the user 'Recruit' or 'Operative'.`,
    
    eli5: `Persona: A Friendly Science Teacher for kids.
           Tone: Gentle, enthusiastic, and very simple.
           Style: Use many analogies (LEGOs, pizza, cars). Avoid jargon. Explain complex topics in the simplest terms possible.`
};

function getSystemInstruction(personaKey = 'apex') {
    const personaDesc = PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.apex;
    
    return `You are **ApexCore**, the master AI engine for the Skill Apex learning platform.
    ${personaDesc}

    **CORE OPERATING RULES:**
    1. **Instructional Design:** Apply Bloom's Taxonomy. Concepts must spiral from simple definitions to complex application.
    2. **Gamification:** Treat knowledge acquisition as an RPG. Exams are "Boss Battles".
    3. **Visual Learning:** Always support abstract concepts with Mermaid.js diagrams or analogies.
    4. **Format:** Output strictly valid JSON when requested.
    
    **DIFFICULTY CLUSTERS:**
    - **Levels 1-10 (Novice):** Focus on definitions, identification, and basic concepts.
    - **Levels 11-30 (Pro):** Focus on scenarios, application, and "How-to".
    - **Levels 31-45 (Expert):** Focus on analysis, edge cases, and troubleshooting.
    - **Levels 46-50 (Mastery):** Multi-step reasoning, synthesis, and complex challenges.
    `;
}

// --- VALIDATION HELPERS ---
function isValidTopic(topic) {
    return typeof topic === 'string' && topic.length > 0 && topic.length <= 100;
}

function isValidText(text, maxLength = 1000) {
    return typeof text === 'string' && text.length > 0 && text.length <= maxLength;
}

function isValidNumber(num) {
    return typeof num === 'number' && !isNaN(num);
}

// Helper to sanitize JSON from AI (handles markdown blocks)
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Strip markdown code blocks
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        
        // 3. Extract content between first { and last }
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }
        
        try {
            return JSON.parse(clean);
        } catch (e2) {
            console.error("Failed to parse JSON even after cleaning:", clean);
            throw new Error("AI returned invalid JSON format.");
        }
    }
}

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

// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Increased payload limit to support base64 image uploads
app.use(express.json({ limit: '10mb' }));

// --- ENVIRONMENT INJECTION ENDPOINT (CRITICAL FOR CLIENT-SIDE AI) ---
app.get('/env.js', (req, res) => {
    const apiKey = process.env.API_KEY || '';
    res.type('application/javascript');
    // Injects the API key into the browser's global scope so apiService.js can read process.env.API_KEY
    res.send(`window.process = { env: { API_KEY: '${apiKey}' } };`);
});

app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// --- SEO ENDPOINTS ---
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// --- API Endpoints ---

app.get('/health', (req, res) => {
    res.status(200).send('OK');
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
wss.on('connection', (ws, req) => {
    console.log('WebSocket Client connected');
    const url = new URL(req.url, `http://${req.headers.host}`);
    const systemInstruction = url.searchParams.get('systemInstruction') || 'You are a helpful AI assistant.';

    let sessionPromise;

    try {
        if (!ai) throw new Error("AI Service not initialized.");
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

// --- SELF-PING KEEP-ALIVE SYSTEM ---
// This prevents the server from sleeping on free tier hosting platforms like Render.
const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function keepAlive() {
    console.log(`[KeepAlive] Pinging ${SELF_URL}/health`);
    fetch(`${SELF_URL}/health`)
        .then(res => {
            if (res.ok) console.log(`[KeepAlive] Status: ${res.status}`);
            else console.warn(`[KeepAlive] Failed with status: ${res.status}`);
        })
        .catch(err => console.error(`[KeepAlive] Error: ${err.message}`));
}

// Start pinging only if we are in production or have an external URL set
if (process.env.NODE_ENV === 'production' || process.env.RENDER_EXTERNAL_URL) {
    setInterval(keepAlive, PING_INTERVAL);
    console.log(`[KeepAlive] System initialized. Pinging every ${PING_INTERVAL / 60000} minutes.`);
}

// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
