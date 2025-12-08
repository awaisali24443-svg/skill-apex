
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
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }
        try {
            return JSON.parse(clean);
        } catch (e2) {
            console.error("Failed to parse JSON:", clean);
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
}

// --- GEMINI SCHEMAS (Unchanged) ---
const journeyPlanSchema = { type: Type.OBJECT, properties: { topicName: { type: Type.STRING }, totalLevels: { type: Type.INTEGER }, description: { type: Type.STRING } }, required: ["topicName", "totalLevels", "description"] };
const curriculumOutlineSchema = { type: Type.OBJECT, properties: { chapters: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["chapters"] };
const questionsGenerationSchema = { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswerIndex: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["question", "options", "correctAnswerIndex", "explanation"] } } }, required: ["questions"] };
const lessonGenerationSchema = { type: Type.OBJECT, properties: { lesson: { type: Type.STRING } }, required: ["lesson"] };
const interactiveChallengeSchema = { type: Type.OBJECT, properties: { challengeType: { type: Type.STRING, enum: ["sequence", "match"] }, instruction: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, match: { type: Type.STRING } }, required: ["id", "text"] } } }, required: ["challengeType", "instruction", "items"] };
const bossBattleGenerationSchema = { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswerIndex: { type: Type.INTEGER }, explanation: { type: Type.STRING } }, required: ["question", "options", "correctAnswerIndex", "explanation"] } } }, required: ["questions"] };
const hintGenerationSchema = { type: Type.OBJECT, properties: { hint: { type: Type.STRING } }, required: ["hint"] };
const explanationSchema = { type: Type.OBJECT, properties: { explanation: { type: Type.STRING } }, required: ["explanation"] };
const dailyChallengeSchema = { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswerIndex: { type: Type.INTEGER }, topic: { type: Type.STRING } }, required: ["question", "options", "correctAnswerIndex", "topic"] };

// --- GEMINI SERVICE FUNCTIONS ---

async function generateJourneyPlan(topic, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Analyze the topic "${topic}". Determine the ideal number of levels (multiple of 10). Write a gamified one-sentence description. Return JSON.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate a learning plan.');
    }
}

async function generateJourneyPlanFromImage(imageBase64, mimeType, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Analyze this image. Identify the educational concept. Identify "Topic Name". Determine ideal levels (multiple of 10). Write description. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Upgraded to Pro for better image analysis
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
        throw new Error('Failed to analyze image.');
    }
}

async function generateCurriculumOutline(topic, totalLevels, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const numChapters = Math.ceil(totalLevels / 50);
    const prompt = `Topic: "${topic}". Total Levels: ${totalLevels}. Break this into exactly ${numChapters} chapter titles. Return JSON.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: curriculumOutlineSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate outline.');
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    let complexityInstruction = "";
    if (level <= 10) complexityInstruction = "**NOVICE MODE:** Focus on definitions and basics.";
    else if (level <= 30) complexityInstruction = "**PRO MODE:** Focus on scenarios and application.";
    else if (level <= 45) complexityInstruction = "**EXPERT MODE:** Focus on complex analysis.";
    else complexityInstruction = "**MASTERY MODE:** Multi-step reasoning.";

    const prompt = `Create a quiz for "${topic}". Level: ${level} / ${totalLevels}. ${complexityInstruction} Generate exactly 6 multiple-choice questions. Rules: Distractors must be plausible. Provide explanations. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: questionsGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate questions.');
    }
}

async function generateInteractiveLevel(topic, level, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Create an interactive challenge for "${topic}" Level ${level}. TASK: Sequence OR Match challenge. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: interactiveChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate interactive challenge.');
    }
}

async function generateLevelLesson(topic, level, totalLevels, questionsContext, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Teach a masterclass on "${topic}" (Level ${level}). Write a high-impact, "Presentation Style" lesson. Use Bullet Points, EMOJIS, and Mermaid.js diagrams. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: lessonGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate lesson.');
    }
}

async function generateBossBattleContent(topic, chapter, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Create a "Boss Battle" exam for "${topic}" Chapter ${chapter}. Generate 10 challenging multiple-choice questions. Difficulty: Very Hard. Real World scenarios. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: bossBattleGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate the boss battle.');
    }
}

async function generateHint(topic, question, options, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Provide a hint for this quiz question about ${topic}: "${question}". Don't reveal the answer directly. Use Socratic method. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: hintGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
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
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("AI did not return audio data.");
        return base64Audio;
    } catch (error) {
        throw new Error('Failed to generate speech.');
    }
}

async function explainConcept(topic, concept, context, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Explain "${concept}" in the context of ${topic}. Keep it concise and clear. Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error('Failed to generate explanation.');
    }
}

async function generateDailyChallenge(persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Generate one single, interesting trivia question. Format: JSON with question, options (4), correctAnswerIndex, and topic.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: dailyChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error("Failed to generate challenge.");
    }
}

async function explainError(topic, question, userChoice, correctChoice, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Explain why "${userChoice}" is wrong and "${correctChoice}" is right for the question: "${question}" (${topic}). Return JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        throw new Error("Failed to explain error.");
    }
}

// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', apiLimiter);

// API Endpoints
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/robots.txt', (req, res) => { res.type('text/plain'); res.sendFile(path.join(__dirname, 'robots.txt')); });
app.get('/sitemap.xml', (req, res) => { res.type('application/xml'); res.sendFile(path.join(__dirname, 'sitemap.xml')); });

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/generate-journey-plan', asyncHandler(async (req, res) => res.json(await generateJourneyPlan(req.body.topic, req.body.persona))));
app.post('/api/generate-journey-from-image', asyncHandler(async (req, res) => res.json(await generateJourneyPlanFromImage(req.body.imageBase64, req.body.mimeType, req.body.persona))));
app.post('/api/generate-curriculum-outline', asyncHandler(async (req, res) => res.json(await generateCurriculumOutline(req.body.topic, req.body.totalLevels, req.body.persona))));
app.post('/api/generate-level-questions', asyncHandler(async (req, res) => res.json(await generateLevelQuestions(req.body.topic, req.body.level, req.body.totalLevels, req.body.persona))));
app.post('/api/generate-interactive-level', asyncHandler(async (req, res) => res.json(await generateInteractiveLevel(req.body.topic, req.body.level, req.body.persona))));
app.post('/api/generate-level-lesson', asyncHandler(async (req, res) => res.json(await generateLevelLesson(req.body.topic, req.body.level, req.body.totalLevels, req.body.questions, req.body.persona))));
app.post('/api/generate-boss-battle', asyncHandler(async (req, res) => res.json(await generateBossBattleContent(req.body.topic, req.body.chapter, req.body.persona))));
app.post('/api/generate-hint', asyncHandler(async (req, res) => res.json(await generateHint(req.body.topic, req.body.question, req.body.options, req.body.persona))));
app.post('/api/generate-speech', asyncHandler(async (req, res) => res.json({ audioContent: await generateSpeech(req.body.text) })));
app.post('/api/explain-concept', asyncHandler(async (req, res) => res.json(await explainConcept(req.body.topic, req.body.concept, req.body.context, req.body.persona))));
app.get('/api/daily-challenge', asyncHandler(async (req, res) => res.json(await generateDailyChallenge('apex'))));
app.post('/api/explain-error', asyncHandler(async (req, res) => res.json(await explainError(req.body.topic, req.body.question, req.body.userChoice, req.body.correctChoice, req.body.persona))));
app.get('/api/topics', asyncHandler(async (req, res) => {
    if (!topicsCache) topicsCache = JSON.parse(await fs.readFile(path.join(__dirname, 'data', 'topics.json'), 'utf-8'));
    res.json(topicsCache);
}));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});

// --- WEBSOCKETS (LIVE API) ---
wss.on('connection', (ws, req) => {
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
                onerror: (e) => ws.send(JSON.stringify({ type: 'error', message: 'AI session error.' })),
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
