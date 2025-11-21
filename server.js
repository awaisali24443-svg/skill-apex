
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

// --- GEMINI SCHEMAS ---

const journeyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        totalLevels: {
            type: Type.INTEGER,
            description: "The ideal total number of levels (e.g., 70, 250, 600) to comprehensively teach this topic from a complete beginner to an expert. This should be a multiple of 10."
        },
        description: {
            type: Type.STRING,
            description: "A new, compelling, one-sentence description for this specific learning journey."
        }
    },
    required: ["totalLevels", "description"]
};

const curriculumOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        chapters: {
            type: Type.ARRAY,
            description: "An array of concise, well-named chapter titles that outline the learning journey.",
            items: { type: Type.STRING }
        }
    },
    required: ["chapters"]
};

const levelGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        lesson: {
            type: Type.STRING,
            description: "A very short, single-paragraph lesson for this specific level, formatted in Markdown. If a process, flow, or hierarchy is described, you MUST include a mermaid.js diagram code block (```mermaid ... ```) to visualize it."
        },
        questions: {
            type: Type.ARRAY,
            description: "An array of 2-3 multiple-choice questions based *only* on the provided lesson text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["lesson", "questions"]
};

const bossBattleGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of 10 challenging multiple-choice questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
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
    properties: {
        hint: {
            type: Type.STRING,
            description: "A single, short, helpful hint for the provided quiz question. It should guide the user to the correct answer without directly revealing it."
        }
    },
    required: ["hint"]
};

const explanationSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: {
            type: Type.STRING,
            description: "A clear, Socratic explanation of the concept. Use an analogy if possible."
        }
    },
    required: ["explanation"]
};


// --- GEMINI SERVICE FUNCTIONS ---

async function generateJourneyPlan(topic) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `You are an expert curriculum designer. Analyze the topic "${topic}".
    
    Your task is to determine the ideal number of levels to create a comprehensive learning journey that takes a user from a complete novice to an expert.
    
    RULES:
    1. The total number of levels must be a multiple of 10.
    2. A simple topic (e.g., "CSS Flexbox") might be 50-100 levels. A complex topic (e.g., "Quantum Mechanics") might be 700+ levels. Use your judgment.
    3. Also, write a new, exciting one-sentence description for this learning journey.
    
    Return your response in the provided JSON schema.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Journey Plan for ${topic}):`, error);
        throw new Error('Failed to generate a learning plan.');
    }
}

async function generateCurriculumOutline(topic, totalLevels) {
    if (!ai) throw new Error("AI Service not initialized.");
    const numChapters = Math.ceil(totalLevels / 50);
    const prompt = `You are an expert curriculum designer. A learning journey for the topic "${topic}" has been scoped to ${totalLevels} levels.
    
    Your task is to break this journey down into exactly ${numChapters} logical chapters.
    
    RULES:
    1. Provide an array of exactly ${numChapters} chapter titles.
    2. Each title should be concise and descriptive.
    3. The chapters must be in a logical, progressive order.
    
    Return the list of chapter titles in the provided JSON schema.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: curriculumOutlineSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Curriculum Outline for ${topic}):`, error);
        throw new Error('Failed to generate a curriculum outline.');
    }
}

async function generateLevelContent(topic, level, totalLevels) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `You are a friendly and encouraging AI tutor creating a ${totalLevels}-level learning game about "${topic}". The user is on Level ${level}.
    
    RULES:
    1. The difficulty must increase gradually. Level 1 is for complete beginners.
    2. Generate a bite-sized, single-paragraph lesson for Level ${level}. Introduce ONE new concept.
    3. VISUALIZATION: If the concept involves a process, flow, hierarchy, or relationship, you MUST include a Mermaid.js diagram code block (starting with \`\`\`mermaid) to visualize it.
    4. Generate 2-3 simple multiple-choice questions that test understanding of *only the concepts in this specific lesson*.
    5. Tone: Encouraging, gamified.
    
    Generate the lesson and questions based on these rules and the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: levelGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level ${level} Generation for ${topic}):`, error);
        throw new Error('Failed to generate the next level.');
    }
}

async function generateBossBattleContent(topic, chapter) {
    if (!ai) throw new Error("AI Service not initialized.");
    const startLevel = (chapter - 1) * 50 + 1;
    const endLevel = chapter * 50;
    
    const prompt = `You are a tough but fair AI quiz master creating a "Boss Battle" for a learning game about "${topic}". This is a cumulative test for Chapter ${chapter} (levels ${startLevel}-${endLevel}).
    
    RULES:
    1. Generate exactly 10 challenging multiple-choice questions.
    2. Focus on tricky edge cases, common misconceptions, and synthesizing multiple concepts from this chapter.
    3. Questions should require critical thinking, not just memorization.
    4. Difficulty: Hard. Distractors should be plausible.
    5. NO lesson text. Quiz only.
    6. Tone: Epic final boss. The user must prove their mastery.
    
    Generate the 10 questions based on these rules and the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: bossBattleGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Boss Battle Generation for ${topic} Ch. ${chapter}):`, error);
        throw new Error('Failed to generate the boss battle.');
    }
}

async function generateHint(topic, question, options) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const optionsString = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
    
    const prompt = `You are an AI Tutor providing a hint for a quiz.
    
    Topic: "${topic}"
    Question: "${question}"
    Options:
    ${optionsString}
    
    RULES:
    1. Generate a single, short, helpful hint.
    2. DO NOT reveal the correct answer directly.
    3. Guide the user's thinking.
    
    Return the hint in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: hintGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Hint Generation for ${topic}):`, error);
        throw new Error('Failed to generate a hint.');
    }
}

async function generateSpeech(text) {
    if (!ai) throw new Error("AI Service not initialized.");
    if (!text || text.trim().length === 0) {
        throw new Error("Text for speech generation cannot be empty.");
    }
    
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
        if (!base64Audio) {
            throw new Error("AI did not return audio data.");
        }
        return base64Audio;
    } catch (error) {
        console.error(`Gemini API Error (Speech Generation):`, error);
        throw new Error('Failed to generate speech.');
    }
}

async function explainConcept(topic, concept, context) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `You are a Socratic AI tutor. 
    Topic: ${topic}
    Context: ${context}
    
    The student is asking about: "${concept}"
    
    RULES:
    1. Explain this specific concept clearly and concisely (max 3 sentences).
    2. Use a simple analogy if possible to make it "click".
    3. Be encouraging.
    
    Return the explanation in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Explain Concept):`, error);
        throw new Error('Failed to generate explanation.');
    }
}


// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// --- API Endpoints ---

app.post('/api/generate-journey-plan', async (req, res) => {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Missing required parameter: topic' });
    try {
        const plan = await generateJourneyPlan(topic);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-curriculum-outline', async (req, res) => {
    const { topic, totalLevels } = req.body;
    if (!topic || !totalLevels) return res.status(400).json({ error: 'Missing required parameters' });
    try {
        const outline = await generateCurriculumOutline(topic, totalLevels);
        res.json(outline);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level', async (req, res) => {
    const { topic, level, totalLevels } = req.body;
    if (!topic || !level || !totalLevels) return res.status(400).json({ error: 'Missing required parameters' });
    try {
        const levelContent = await generateLevelContent(topic, level, totalLevels);
        res.json(levelContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-boss-battle', async (req, res) => {
    const { topic, chapter } = req.body;
    if (!topic || !chapter) return res.status(400).json({ error: 'Missing required parameters' });
    try {
        const bossContent = await generateBossBattleContent(topic, chapter);
        res.json(bossContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-hint', async (req, res) => {
    const { topic, question, options } = req.body;
    if (!topic || !question || !options) return res.status(400).json({ error: 'Missing required parameters' });
    try {
        const hint = await generateHint(topic, question, options);
        res.json(hint);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-speech', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Missing text' });
    try {
        const audioContent = await generateSpeech(text);
        res.json({ audioContent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/explain-concept', async (req, res) => {
    const { topic, concept, context } = req.body;
    if (!topic || !concept) return res.status(400).json({ error: 'Missing topic or concept' });
    try {
        const result = await explainConcept(topic, concept, context || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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


// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
