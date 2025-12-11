
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
    apex: `Persona: An Elite Training Simulator for Professionals.
           Tone: High-stakes, immersive, direct, and encouraging.
           Style: NEVER ask "What is X?". ALWAYS ask "Situation X is happening. What do you do?". Treat the user like an operator in the field.`,
    
    sage: `Persona: A Socratic Mentor using Real-World Case Studies.
           Tone: Thoughtful, deep, but practical.
           Style: Frame every question as a dilemma requiring wisdom. Use analogies from nature or history.`,
    
    commander: `Persona: Tactical Mission Control.
           Tone: Urgent, military-grade precision.
           Style: "Situation Report: [Scenario]. Orders: [Question]." Focus on rapid decision making under pressure.`,
    
    eli5: `Persona: A Creative Workshop Director.
           Tone: Playful, imaginative, and hands-on.
           Style: Use "Imagine you are building a lego castle..." style analogies to explain complex topics.`
};

function getSystemInstruction(personaKey = 'apex') {
    const personaDesc = PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.apex;
    
    return `You are **ApexCore**, the master engine for Skill Apex.
    ${personaDesc}

    **CORE OPERATING RULES:**
    1. **NO ROTE MEMORIZATION:** Do not ask definitions. Ask for *Application*.
    2. **SCENARIO FIRST:** Start every question with a tiny context (e.g., "You are a Manager...", "The server is crashing...", "You are painting a sunset...").
    3. **VISUAL LANGUAGE:** Use emoji and vivid verbs.
    4. **FORMAT:** Output strictly valid JSON.
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
        // 2. Strip markdown code blocks and aggressive cleanup
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        
        // 3. Extract content between first { or [ and last } or ]
        const firstOpen = clean.search(/[\{\[]/);
        // Find last occurrence of } or ]
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
        console.warn("WARNING: API_KEY is not defined. AI features will fail.");
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log('GoogleGenAI initialized successfully.');
    }
} catch (error) {
    console.error(`Failed to initialize GoogleGenAI: ${error.message}`);
}

// --- GEMINI SCHEMAS ---

const journeyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        topicName: { type: Type.STRING },
        totalLevels: { type: Type.INTEGER },
        description: { type: Type.STRING }
    },
    required: ["topicName", "totalLevels", "description"]
};

const curriculumOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        chapters: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["chapters"]
};

const questionsGenerationSchema = {
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
};

const lessonGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        lesson: { type: Type.STRING }
    },
    required: ["lesson"]
};

const interactiveChallengeSchema = {
    type: Type.OBJECT,
    properties: {
        challengeType: { type: Type.STRING, enum: ["sequence", "match"] },
        instruction: { type: Type.STRING },
        items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    match: { type: Type.STRING }
                },
                required: ["id", "text"]
            }
        }
    },
    required: ["challengeType", "instruction", "items"]
};

const bossBattleGenerationSchema = {
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
};

const hintGenerationSchema = {
    type: Type.OBJECT,
    properties: { hint: { type: Type.STRING } },
    required: ["hint"]
};

const explanationSchema = {
    type: Type.OBJECT,
    properties: { explanation: { type: Type.STRING } },
    required: ["explanation"]
};

const dailyChallengeSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswerIndex: { type: Type.INTEGER },
        topic: { type: Type.STRING }
    },
    required: ["question", "options", "correctAnswerIndex", "topic"]
};


// --- GEMINI SERVICE FUNCTIONS ---

async function generateJourneyPlan(topic, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Analyze the topic "${topic}".
    Task: Design a comprehensive learning path.
    Output: 
    1. Topic Name (Formal).
    2. Total Levels (Multiple of 10).
    3. Description: A compelling, exciting 1-sentence hook about mastering this skill.
    Return JSON.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Journey Plan):`, error);
        throw new Error('Failed to generate a learning plan.');
    }
}

async function generateJourneyPlanFromImage(imageBase64, mimeType, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Analyze this image. Identify the educational concept.
    1. Identify the core "Topic Name".
    2. Determine the ideal number of levels (multiple of 10).
    3. Write a compelling description.
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Flash is better for image analysis speed
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: imageBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Image Analysis):`, error);
        throw new Error('Failed to analyze image.');
    }
}

async function generateCurriculumOutline(topic, totalLevels, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const numChapters = Math.ceil(totalLevels / 50);
    const prompt = `Topic: "${topic}". Total Levels: ${totalLevels}.
    Task: Break this into exactly ${numChapters} chapter titles.
    Return JSON.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: curriculumOutlineSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Curriculum):`, error);
        throw new Error('Failed to generate outline.');
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    // --- UPDATED LOGIC: ALL LEVELS ARE SCENARIO-BASED ---
    // We no longer use simple definitions for low levels. 
    // We force "Application" at all stages to impress users in the Expo.
    
    let scenarioDepth = "";
    if (level <= 5) {
        scenarioDepth = "SIMPLE SCENARIOS: 'You are attempting to X. What do you use?'. Focus on basic application and Scaffolding.";
    } else if (level <= 30) {
        scenarioDepth = "REAL WORLD PROBLEMS: 'A system failed with error Y. What is the cause?'. Focus on troubleshooting.";
    } else {
        scenarioDepth = "COMPLEX CASE STUDIES: Multi-variable problems requiring synthesis of concepts.";
    }

    const prompt = `Create a **Scenario-Based** quiz for "${topic}". Level: ${level} / ${totalLevels}.
    
    ${scenarioDepth}
    
    CRITICAL RULES:
    1. **NO 'What is X?' questions.**
    2. Place the user in a role (e.g. 'You are a Manager', 'You are a Developer', 'You are an Artist').
    3. Present a situation, then ask for the solution.
    4. Generate exactly 3 high-quality questions.
    
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: questionsGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level Questions):`, error);
        throw new Error('Failed to generate questions. Please try again.');
    }
}

async function generateInteractiveLevel(topic, level, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Create an interactive challenge for "${topic}" Level ${level}.
    TASK: Sequence OR Match challenge.
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: interactiveChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Interactive):`, error);
        throw new Error('Failed to generate interactive challenge.');
    }
}

async function generateLevelLesson(topic, level, totalLevels, questionsContext, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    // SCAFFOLDING & EXPO OPTIMIZATION
    let styleGuide = "";
    if (level <= 5) {
        styleGuide = `**MISSION BRIEFING (Foundational):**
        1. Explain the core concept simply using a real-world analogy.
        2. Explain *why* this matters.
        3. Keep it encouraging.`;
    } else {
        styleGuide = `**EXECUTIVE BRIEFING:**
        1. Bullet points only.
        2. Focus on strategy and edge cases.
        3. No fluff.`;
    }

    const prompt = `Write a short Educational Lesson for "${topic}" (Level ${level}).
    
    ${styleGuide}
    
    CONSTRAINT: Keep it under 150 words. Punchy and clear.
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: lessonGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level Lesson):`, error);
        throw new Error('Failed to generate lesson.');
    }
}

async function generateBossBattleContent(topic, chapter, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Create a **Boss Battle Exam** for "${topic}" Chapter ${chapter}.
    Generate 10 CHALLENGING Scenario-based questions.
    Context: 'The system is critical. You have one chance to fix it.'
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: bossBattleGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Boss Battle):`, error);
        throw new Error('Failed to generate the boss battle.');
    }
}

async function generateHint(topic, question, options, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Provide a hint for this quiz question about ${topic}: "${question}".
    Don't reveal the answer directly. Use Socratic method.
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: hintGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Hint):`, error);
        throw new Error('Failed to generate a hint.');
    }
}

async function generateSpeech(text) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("AI did not return audio data.");
        return base64Audio;
    } catch (error) {
        console.error(`Gemini API Error (Speech):`, error);
        throw new Error('Failed to generate speech.');
    }
}

async function explainConcept(topic, concept, context, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Explain "${concept}" in the context of ${topic}.
    Keep it concise and clear.
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Explain):`, error);
        throw new Error('Failed to generate explanation.');
    }
}

async function generateDailyChallenge(persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Generate one single, interesting trivia question.
    Format: JSON with question, options (4), correctAnswerIndex, and topic.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: dailyChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error("Daily Challenge Error:", error);
        throw new Error("Failed to generate challenge.");
    }
}

async function explainError(topic, question, userChoice, correctChoice, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Explain why "${userChoice}" is wrong and "${correctChoice}" is right for the question: "${question}" (${topic}).
    Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error("Error Explanation Error:", error);
        throw new Error("Failed to explain error.");
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
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// --- API Endpoints ---

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/robots.txt', (req, res) => { res.type('text/plain'); res.sendFile(path.join(__dirname, 'robots.txt')); });
app.get('/sitemap.xml', (req, res) => { res.type('application/xml'); res.sendFile(path.join(__dirname, 'sitemap.xml')); });

app.post('/api/generate-journey-plan', async (req, res) => {
    try { res.json(await generateJourneyPlan(req.body.topic, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-journey-from-image', async (req, res) => {
    try { res.json(await generateJourneyPlanFromImage(req.body.imageBase64, req.body.mimeType, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-curriculum-outline', async (req, res) => {
    try { res.json(await generateCurriculumOutline(req.body.topic, req.body.totalLevels, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-level-questions', async (req, res) => {
    try { res.json(await generateLevelQuestions(req.body.topic, req.body.level, req.body.totalLevels, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-interactive-level', async (req, res) => {
    try { res.json(await generateInteractiveLevel(req.body.topic, req.body.level, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-level-lesson', async (req, res) => {
    try { res.json(await generateLevelLesson(req.body.topic, req.body.level, req.body.totalLevels, req.body.questions, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-boss-battle', async (req, res) => {
    try { res.json(await generateBossBattleContent(req.body.topic, req.body.chapter, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-hint', async (req, res) => {
    try { res.json(await generateHint(req.body.topic, req.body.question, req.body.options, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-speech', async (req, res) => {
    try { res.json({ audioContent: await generateSpeech(req.body.text) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/explain-concept', async (req, res) => {
    try { res.json(await explainConcept(req.body.topic, req.body.concept, req.body.context, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/daily-challenge', async (req, res) => {
    try { res.json(await generateDailyChallenge('apex')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/explain-error', async (req, res) => {
    try { res.json(await explainError(req.body.topic, req.body.question, req.body.userChoice, req.body.correctChoice, req.body.persona)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/topics', async (req, res) => {
    try {
        if (!topicsCache) topicsCache = JSON.parse(await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8'));
        res.json(topicsCache);
    } catch (error) { res.status(500).json({ error: 'Could not load topics data.' }); }
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
            },
            callbacks: {
                onopen: () => console.log('Live session opened'),
                onmessage: (message) => ws.send(JSON.stringify({ type: 'gemini_message', message })),
                onerror: (e) => ws.send(JSON.stringify({ type: 'error', message: 'An AI session error occurred.' })),
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
        } catch (e) { console.error('Error processing message:', e); }
    });

    ws.on('close', () => { sessionPromise?.then(session => session.close()); });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
