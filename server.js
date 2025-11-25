
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
            description: "A new, compelling, one-sentence description for this learning journey."
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

const questionsGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of exactly 6 multiple-choice questions.",
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

const lessonGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        lesson: {
            type: Type.STRING,
            description: "A high-impact, 'Presentation Style' lesson. Use bullet points, emojis, and bold text. NO long paragraphs. If a process is described, include a mermaid.js diagram."
        }
    },
    required: ["lesson"]
};

// NEW: Interactive Challenge Schema
const interactiveChallengeSchema = {
    type: Type.OBJECT,
    properties: {
        challengeType: { 
            type: Type.STRING, 
            enum: ["sequence", "match"],
            description: "Choose 'sequence' for ordering tasks (e.g., history, code logic) or 'match' for associations (e.g., terms to definitions)."
        },
        instruction: { 
            type: Type.STRING,
            description: "The instruction for the user (e.g., 'Arrange the phases of Mitosis in order' or 'Match the HTTP codes to their meanings')."
        },
        items: {
            type: Type.ARRAY,
            description: "For 'sequence', return 4-5 items in the CORRECT order. For 'match', return 4 pairs.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING, description: "The visible text (e.g., 'Prophase' or '404')." },
                    match: { type: Type.STRING, description: "Only for 'match' type. The paired value (e.g., 'Not Found')." }
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
        return cleanAndParseJSON(response.text);
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
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Curriculum Outline for ${topic}):`, error);
        throw new Error('Failed to generate a curriculum outline.');
    }
}

async function generateLevelQuestions(topic, level, totalLevels) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    // Adaptive Roleplay Logic: Levels > 10 get scenarios instead of definitions
    const isScenarioMode = level > 10;
    
    let instructions = `
    1. The questions should introduce and test a specific concept appropriate for this level.
    2. Questions must be challenging but fair.
    3. Include plausible distractors.`;

    if (isScenarioMode) {
        instructions = `
        1. **ROLEPLAY MODE:** Do NOT ask "What is X?". Instead, generate a **Scenario**.
           - Format: "You are a [Job Role]. [Situation happens]. What action do you take?"
           - Example: "You are a SysAdmin. A server hits 100% CPU. Which command identifies the culprit?"
        2. Test practical application of the concept, not just memory.
        3. Make the distractors plausible mistakes a junior might make in that situation.`;
    }

    const prompt = `You are an expert educator creating a quiz for a student learning "${topic}".
    Current Level: ${level} / ${totalLevels}.
    
    TASK: Generate exactly 6 multiple-choice questions for this specific level.
    
    RULES:
    ${instructions}
    
    Generate the JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: questionsGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level Questions ${level}):`, error);
        throw new Error('Failed to generate questions.');
    }
}

async function generateInteractiveLevel(topic, level) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `You are a game designer creating an interactive challenge for the topic "${topic}" at Level ${level}.
    
    TASK: Create either a "Sequence" challenge (ordering items) OR a "Match" challenge (pairing items). Choose the one that best fits the concept for this level.
    
    RULES:
    - If Sequence: Provide 4-5 steps/items in the CORRECT order.
    - If Match: Provide 4 pairs of terms and definitions/associations.
    - Keep items concise (max 5-7 words).
    
    Return the JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: interactiveChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Interactive Level ${level}):`, error);
        throw new Error('Failed to generate interactive challenge.');
    }
}

async function generateLevelLesson(topic, level, totalLevels, questionsContext) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    let contextInstruction = "";
    if (questionsContext && questionsContext.length > 0) {
        const questionsText = JSON.stringify(questionsContext);
        contextInstruction = `CONTEXT: The student has been assigned these questions: ${questionsText}. Ensure the lesson covers these answers.`;
    } else {
        contextInstruction = `CONTEXT: Design a lesson for Level ${level} of the topic "${topic}". Cover key concepts suitable for this stage.`;
    }
    
    const prompt = `You are a charismatic, world-class keynote speaker. You are teaching a masterclass on "${topic}" (Level ${level}).
    
    ${contextInstruction}
    
    YOUR GOAL: Write a high-impact, "Presentation Style" lesson that teaches the concepts required.
    
    RULES:
    1. **NO WALLS OF TEXT.** Do not write standard paragraphs.
    2. **Tone:** Conversational, high-energy, and direct. Like a TED Talk.
    3. **Structure:**
       - Start with a "Hook" (1 sentence).
       - Use **Bullet Points** with EMOJIS (🚀, 💡, 🔑) for core concepts.
       - Use **Bold** for key terms.
    4. **Visualization:** If the concept involves a process or hierarchy, you MUST include a Mermaid.js diagram (start with \`\`\`mermaid).
    
    Generate the JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: lessonGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Level Lesson ${level}):`, error);
        throw new Error('Failed to generate lesson.');
    }
}

async function generateBossBattleContent(topic, chapter) {
    if (!ai) throw new Error("AI Service not initialized.");
    const startLevel = (chapter - 1) * 50 + 1;
    const endLevel = chapter * 50;
    
    const prompt = `You are a tough but fair AI quiz master creating a "Boss Battle" for a learning game about "${topic}". This is a cumulative test for Chapter ${chapter} (levels ${startLevel}-${endLevel}).
    
    RULES:
    1. Generate exactly 10 challenging multiple-choice questions.
    2. **Scenario Mode:** Use complex "Real World" scenarios where the user must apply multiple concepts to solve a problem. No simple definitions.
    3. Difficulty: Very Hard. Distractors should be highly plausible.
    4. Tone: Epic final boss. The user must prove their mastery.
    
    Generate the 10 questions based on these rules and the provided JSON schema.`;

    try {
        // Using gemini-3-pro-preview for complex reasoning tasks like Boss Battles
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: bossBattleGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
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
        return cleanAndParseJSON(response.text);
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
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error(`Gemini API Error (Explain Concept):`, error);
        throw new Error('Failed to generate explanation.');
    }
}

async function generateDailyChallenge() {
    if (!ai) throw new Error("AI Service not initialized.");
    const categories = ["Science", "Technology", "History", "Space", "Coding", "Biology"];
    const topic = categories[Math.floor(Math.random() * categories.length)];
    
    const prompt = `Generate one single, interesting trivia question about "${topic}".
    Difficulty: Medium.
    Format: JSON with question, options (4), correctAnswerIndex, and topic.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
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

async function explainError(topic, question, userChoice, correctChoice) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `The user answered a question about "${topic}" incorrectly.
    Question: "${question}"
    User Chose: "${userChoice}" (Incorrect)
    Correct Answer: "${correctChoice}"
    
    Task: Explain WHY the user's choice is a common misconception or why it is wrong in this context. Be specific to the error.
    
    Return JSON with 'explanation'.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
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
    if (!isValidTopic(topic)) return res.status(400).json({ error: 'Invalid parameter: topic' });
    try {
        const plan = await generateJourneyPlan(topic);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-curriculum-outline', async (req, res) => {
    const { topic, totalLevels } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const outline = await generateCurriculumOutline(topic, totalLevels);
        res.json(outline);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level, totalLevels } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(level) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateLevelQuestions(topic, level, totalLevels);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-interactive-level', async (req, res) => {
    const { topic, level } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(level)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateInteractiveLevel(topic, level);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level, totalLevels, questions } = req.body;
    // Relaxed validation: questions are optional now for parallel generation
    if (!isValidTopic(topic) || !isValidNumber(level) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateLevelLesson(topic, level, totalLevels, questions);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-boss-battle', async (req, res) => {
    const { topic, chapter } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(chapter)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const bossContent = await generateBossBattleContent(topic, chapter);
        res.json(bossContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-hint', async (req, res) => {
    const { topic, question, options } = req.body;
    if (!isValidTopic(topic) || !isValidText(question) || !options) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const hint = await generateHint(topic, question, options);
        res.json(hint);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-speech', async (req, res) => {
    const { text } = req.body;
    if (!isValidText(text, 5000)) return res.status(400).json({ error: 'Invalid text' });
    try {
        const audioContent = await generateSpeech(text);
        res.json({ audioContent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/explain-concept', async (req, res) => {
    const { topic, concept, context } = req.body;
    if (!isValidTopic(topic) || !isValidText(concept)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const result = await explainConcept(topic, concept, context || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/daily-challenge', async (req, res) => {
    try { res.json(await generateDailyChallenge()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/explain-error', async (req, res) => {
    const { topic, question, userChoice, correctChoice } = req.body;
    if (!isValidTopic(topic) || !isValidText(question)) return res.status(400).json({ error: 'Invalid parameters' });
    try { res.json(await explainError(topic, question, userChoice, correctChoice)); } catch (e) { res.status(500).json({ error: e.message }); }
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
