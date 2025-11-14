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
const __dirname = path.dirname(__filename); // Corrected this line
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
const quizGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "An array of quiz questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "The question text." },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers." },
                    correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer in the options array." },
                    explanation: { type: Type.STRING, description: "A brief explanation for why the correct answer is correct." }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
        }
    },
    required: ["questions"]
};

const learningPathSchema = {
    type: Type.OBJECT,
    properties: {
        path: {
            type: Type.ARRAY,
            description: "A comprehensive, granular array of learning steps.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the learning step/level." },
                    topic: { type: Type.STRING, description: "A concise, URL-friendly slug or keyword for the topic of this step." }
                },
                required: ["name", "topic"]
            }
        }
    },
    required: ["path"]
};


const mindMapNodeSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of this node or concept." },
        children: {
            type: Type.ARRAY,
            description: "An array of child nodes, representing sub-concepts.",
            items: {
                type: Type.OBJECT, // Self-referential structure
                properties: {
                    name: { type: Type.STRING },
                    children: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } } // Limit depth for schema simplicity
                            }
                        }
                    }
                }
            }
        }
    },
    required: ["name"]
};

const synthesisGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A concise, engaging title for the learning content." },
        summary: {
            type: Type.STRING,
            description: "A detailed summary of the key concepts, formatted in Markdown. Use headings (#), lists (*), and bold text (**).",
        },
        analogies: {
            type: Type.ARRAY,
            description: "An array of 2-3 powerful and relatable analogies that relate this complex topic to simpler, well-understood concepts.",
            items: { type: Type.STRING }
        },
        mind_map: {
            type: Type.OBJECT,
            description: "A hierarchical mind map of the topic, with a central root node and nested children.",
            properties: {
                root: mindMapNodeSchema
            },
            required: ["root"]
        }
    },
    required: ["title", "summary", "analogies", "mind_map"]
};


const socraticAssessmentSchema = {
    type: Type.OBJECT,
    properties: {
        isComplete: { type: Type.BOOLEAN, description: "True if the Socratic dialogue should end, false otherwise." },
        passed: { type: Type.BOOLEAN, description: "If isComplete is true, this indicates if the user demonstrated sufficient understanding." },
        assessment: { type: Type.STRING, description: "If isComplete is true, this is a final, qualitative summary of the user's understanding." },
        nextQuestion: { type: Type.STRING, description: "If isComplete is false, this is the next Socratic question to ask the user." },
    },
    required: ["isComplete"]
};


const performanceAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        weakTopics: {
            type: Type.ARRAY,
            description: "An array of up to 3 topic names where the user has shown the weakest performance.",
            items: { type: Type.STRING }
        }
    },
    required: ["weakTopics"]
};


// --- GEMINI SERVICE FUNCTIONS ---
/**
 * Generates a quiz using the Gemini API.
 * @param {string} topic - The quiz topic.
 * @param {number} numQuestions - The number of questions.
 * @param {string} difficulty - The difficulty level.
 * @param {string} [learningContext] - Optional text to base the quiz on.
 * @returns {Promise<object>} The parsed quiz data.
 */
async function generateQuizContent(topic, numQuestions, difficulty, learningContext) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");

    const toneInstruction = "Your tone should be friendly, encouraging, and natural, as if a helpful tutor is speaking. Phrase everything in simple, easy-to-understand language.";

    let prompt;
    if (learningContext && learningContext.trim()) {
        prompt = `${toneInstruction} Generate a ${difficulty} level multiple-choice quiz with exactly ${numQuestions} questions about "${topic}". The questions must be based *only* on the information provided in the following text: "${learningContext}". For each question, provide 4 options, the 0-based index of the correct answer, and a brief explanation. Ensure the content is accurate and educational.`;
    } else {
        prompt = `${toneInstruction} Generate a ${difficulty} level multiple-choice quiz with exactly ${numQuestions} questions about "${topic}". For each question, provide 4 options, the 0-based index of the correct answer, and a brief explanation. Ensure the content is accurate and educational.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: quizGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Quiz Generation):', error);
        throw new Error('Failed to generate quiz. The AI may have refused to generate content for this topic.');
    }
}

/**
 * Generates a learning path using the Gemini API.
 * @param {string} goal - The learning goal.
 * @returns {Promise<object>} The parsed learning path data.
 */
async function generateLearningPathContent(goal) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const prompt = `Create a comprehensive, highly granular, step-by-step learning path for the goal: "${goal}". Break the topic down into at least 30 small, distinct, and logically ordered learning levels. For each level, provide a friendly and encouraging name and a concise, URL-friendly topic keyword. The output should be a single flat array of these levels. Do not group them into clusters.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: learningPathSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Learning Path):', error);
        throw new Error('Failed to generate learning path.');
    }
}

/**
 * Generates a full synthesis package for a topic.
 * @param {string} topic - The learning topic.
 * @returns {Promise<object>} The parsed synthesis content.
 */
async function generateSynthesisContent(topic) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const prompt = `Adopt the persona of a friendly, enthusiastic, and patient tutor. Generate a comprehensive synthesis package for the topic: "${topic}". The entire package should be written in a natural, conversational, and easy-to-understand language, avoiding jargon where possible or explaining it simply. It must include a detailed summary in Markdown, 2-3 powerful and relatable analogies, and a hierarchical mind map with a root node and nested children.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: synthesisGenerationSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Synthesis Generation):', error);
        throw new Error('Failed to generate synthesis package.');
    }
}

/**
 * Generates speech from text using the Gemini API.
 * @param {string} text - The text to convert to speech.
 * @returns {Promise<string>} The base64 encoded audio data.
 */
async function generateSpeechContent(text) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const prompt = `As a friendly tutor, say the following in an encouraging and clear voice: ${text}`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            throw new Error("API did not return audio data.");
        }
        return audioData;
    } catch (error) {
        console.error('Gemini API Error (Speech Generation):', error);
        throw new Error('Failed to generate audio.');
    }
}

/**
 * Generates the next turn in a Socratic dialogue.
 * @param {string} summary - The lesson summary for context.
 * @param {Array<object>} history - The chat history.
 * @returns {Promise<object>} The parsed Socratic response.
 */
async function generateSocraticResponse(summary, history) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");
    const historyString = history.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');

    const prompt = `You are a Socratic Tutor AI. Your goal is to test a user's understanding of a topic through a brief, 3-turn dialogue. You must be friendly, encouraging, and guide the user to discover concepts themselves rather than giving direct answers.
    
    CONTEXT: The user has just studied the following summary: "${summary}"
    
    RULES:
    1.  Your dialogue must not exceed 3 AI turns.
    2.  Start with a broad, open-ended question based on the summary.
    3.  Analyze the user's responses to ask insightful follow-up questions that probe their reasoning.
    4.  On your THIRD turn, you MUST end the conversation. Set "isComplete" to true.
    5.  When "isComplete" is true, you MUST provide a final "assessment" of the user's understanding and a boolean "passed" status. Passing requires a demonstrated grasp of the core concepts, not just keyword matching. Be encouraging even if they don't pass.
    6.  If the conversation is not complete, provide the "nextQuestion".
    
    Current chat history:
    ${historyString}
    
    Generate the next response based on these rules and the provided schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: socraticAssessmentSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Socratic Chat):', error);
        throw new Error('Failed to generate Socratic response.');
    }
}


/**
 * Analyzes user quiz history to find weak topics.
 * @param {Array<object>} history - The user's quiz history.
 * @returns {Promise<object>} The parsed analysis.
 */
async function analyzeUserPerformance(history) {
    if (!ai) throw new Error("AI Service not initialized. Check server configuration.");

    const historySummary = history.map(item => 
        `Topic: "${item.topic}", Score: ${item.score}/${item.totalQuestions}`
    ).join('; ');

    const prompt = `Analyze the following user quiz history: "${historySummary}". Identify up to 3 topics where the user consistently has the lowest scores (as a percentage). Focus on topics where they have multiple attempts or low scores on high-question-count quizzes. Do not suggest topics where they have a high score.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: performanceAnalysisSchema,
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error('Gemini API Error (Performance Analysis):', error);
        throw new Error('Failed to analyze user performance.');
    }
}


// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// --- API ENDPOINTS ---
app.get('/api/topics', async (req, res) => {
    if (topicsCache) {
        return res.json(topicsCache);
    }
    try {
        const filePath = path.join(__dirname, 'data', 'topics.json');
        const data = await fs.readFile(filePath, 'utf8');
        topicsCache = JSON.parse(data);
        res.json(topicsCache);
    } catch (err) {
        console.error('Failed to read topics.json:', err);
        res.status(500).json({ error: 'Failed to load topic data.' });
    }
});

app.post('/api/generate', async (req, res) => {
    const { topic, numQuestions, difficulty, learningContext } = req.body;
    if (!topic || !numQuestions || !difficulty) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }
    try {
        const quizData = await generateQuizContent(topic, numQuestions, difficulty, learningContext);
        res.json(quizData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-path', async (req, res) => {
    const { goal } = req.body;
    if (!goal) {
        return res.status(400).json({ error: 'Missing goal parameter.' });
    }
    try {
        const pathData = await generateLearningPathContent(goal);
        res.json(pathData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-synthesis', async (req, res) => {
    const { topic } = req.body;
    if (!topic) {
        return res.status(400).json({ error: 'Missing topic parameter.' });
    }
    try {
        const synthesisData = await generateSynthesisContent(topic);
        res.json(synthesisData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-speech', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Missing text parameter.' });
    }
    try {
        const audioData = await generateSpeechContent(text);
        res.json({ audioData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/socratic-chat', async (req, res) => {
    const { summary, history } = req.body;
    if (!summary || !history) {
        return res.status(400).json({ error: 'Missing summary or history.' });
    }
    try {
        const socraticData = await generateSocraticResponse(summary, history);
        res.json(socraticData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/analyze-performance', async (req, res) => {
    const { history } = req.body;
    if (!history || !Array.isArray(history)) {
        return res.status(400).json({ error: 'Missing or invalid history.' });
    }
    try {
        const analysisData = await analyzeUserPerformance(history);
        res.json(analysisData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- WEBSOCKET AURAL MODE ---
wss.on('connection', async (ws, req) => {
    let session;
    console.log('Client connected to WebSocket');

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const systemInstruction = url.searchParams.get('systemInstruction') || 'You are a helpful AI tutor.';

        if (!ai) {
             ws.send(JSON.stringify({ type: 'error', message: 'AI Service is not initialized on the server.' }));
             ws.close();
             return;
        }

        session = await ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: systemInstruction,
            },
            callbacks: {
                onmessage: (message) => {
                    ws.send(JSON.stringify({ type: 'gemini_message', message }));
                },
                onerror: (e) => {
                    console.error('WebSocket session error:', e);
                    ws.send(JSON.stringify({ type: 'error', message: 'An error occurred in the AI session.' }));
                },
                onclose: () => {
                    console.log('WebSocket session closed.');
                },
            },
        });
    } catch (error) {
        console.error('Failed to create Live session:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to the AI service.' }));
        ws.close();
        return;
    }

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'audio_input') {
                await session.sendRealtimeInput({ media: data.payload });
            }
        } catch (error) {
            console.error('Error processing client message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (session) {
            session.close();
        }
    });
});


// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});