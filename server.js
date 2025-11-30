
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

// --- GEMINI SCHEMAS ---

const journeyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        topicName: {
            type: Type.STRING,
            description: "The identified core topic from the image or text (e.g., 'Mitosis', 'Pythagorean Theorem')."
        },
        totalLevels: {
            type: Type.INTEGER,
            description: "The ideal total number of levels (e.g., 50, 100, 300) to comprehensively teach this topic. Multiple of 10."
        },
        description: {
            type: Type.STRING,
            description: "A compelling, gamified one-sentence description for this learning journey."
        }
    },
    required: ["topicName", "totalLevels", "description"]
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

async function generateJourneyPlan(topic, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Analyze the topic "${topic}".
    
    Task: Determine the ideal number of levels to create a comprehensive learning journey that takes a user from a complete novice to an expert.
    
    RULES:
    1. The total number of levels must be a multiple of 10.
    2. A simple topic might be 50 levels. A complex topic (e.g., "Quantum Mechanics") might be 200+ levels.
    3. Write a new, exciting one-sentence description for this learning journey.
    4. Set "topicName" to the cleaned up version of "${topic}".
    
    Return your response in the provided JSON schema.`;
    
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
        console.error(`Gemini API Error (Journey Plan for ${topic}):`, error);
        throw new Error('Failed to generate a learning plan.');
    }
}

async function generateJourneyPlanFromImage(imageBase64, mimeType, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Analyze this image. Identify the educational concept, diagram, code snippet, or historical event shown.
    
    1. Identify the core "Topic Name".
    2. Create a comprehensive learning journey plan for this specific topic.
    3. Determine the ideal number of levels (multiple of 10).
    4. Write a compelling description based on the image content.
    
    Return the response in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: imageBase64
                        }
                    },
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
    const prompt = `A learning journey for the topic "${topic}" has been scoped to ${totalLevels} levels.
    
    Task: Break this journey down into exactly ${numChapters} logical chapters.
    
    RULES:
    1. Provide an array of exactly ${numChapters} chapter titles.
    2. Each title should be concise and descriptive.
    3. The chapters must be in a logical, progressive order following the Spiral Curriculum method.
    
    Return the list of chapter titles in the provided JSON schema.`;
    
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
        console.error(`Gemini API Error (Curriculum Outline for ${topic}):`, error);
        throw new Error('Failed to generate a curriculum outline.');
    }
}

async function generateLevelQuestions(topic, level, totalLevels, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    // ApexCore Difficulty Clusters
    let complexityInstruction = "";
    if (level <= 10) {
        complexityInstruction = "**NOVICE MODE:** Focus on definitions, identification, and basic concepts. Questions should be foundational.";
    } else if (level <= 30) {
        complexityInstruction = "**PRO MODE:** Focus on scenarios, practical application, and 'What would you do?' situations. Do not ask simple definitions.";
    } else if (level <= 45) {
        complexityInstruction = "**EXPERT MODE:** Focus on complex analysis, troubleshooting edge cases, and nuance.";
    } else {
        complexityInstruction = "**MASTERY MODE:** High-difficulty, multi-step reasoning required.";
    }

    const prompt = `Create a quiz for a student learning "${topic}".
    Current Level: ${level} / ${totalLevels}.
    
    ${complexityInstruction}
    
    TASK: Generate exactly 6 multiple-choice questions for this specific level.
    
    RULES:
    1. Questions must match the requested difficulty cluster.
    2. Distractors must be plausible misconceptions, not random wrong answers.
    3. Provide a brief, clear explanation for why the answer is correct.
    
    Generate the JSON response.`;

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
        console.error(`Gemini API Error (Level Questions ${level}):`, error);
        throw new Error('Failed to generate questions.');
    }
}

async function generateInteractiveLevel(topic, level, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const prompt = `Create an interactive challenge for the topic "${topic}" at Level ${level}.
    
    TASK: Create either a "Sequence" challenge (ordering items) OR a "Match" challenge (pairing items). Choose the one that best fits the concept for this level.
    
    RULES:
    - If Sequence: Provide 4-5 steps/items in the CORRECT order. Example: Chronological order of events, logical flow of code, or steps in a process.
    - If Match: Provide 4 pairs of terms and definitions/associations.
    - Keep items concise (max 5-7 words).
    
    Return the JSON response.`;

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
        console.error(`Gemini API Error (Interactive Level ${level}):`, error);
        throw new Error('Failed to generate interactive challenge.');
    }
}

async function generateLevelLesson(topic, level, totalLevels, questionsContext, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    let contextInstruction = "";
    if (questionsContext && questionsContext.length > 0) {
        const questionsText = JSON.stringify(questionsContext);
        contextInstruction = `CONTEXT: The student has been assigned these questions: ${questionsText}. Ensure the lesson covers these answers.`;
    } else {
        contextInstruction = `CONTEXT: Design a lesson for Level ${level} of the topic "${topic}". Cover key concepts suitable for this stage.`;
    }
    
    const prompt = `You are teaching a masterclass on "${topic}" (Level ${level}).
    
    ${contextInstruction}
    
    YOUR GOAL: Write a high-impact, "Presentation Style" lesson.
    
    RULES:
    1. **NO WALLS OF TEXT.** Do not write standard paragraphs.
    2. **Tone:** Conversational, high-energy, and direct. Like a TED Talk.
    3. **Structure:**
       - Start with a "Hook" (1 sentence).
       - Use **Bullet Points** with EMOJIS (🚀, 💡, 🔑) for core concepts.
       - Use **Bold** for key terms.
    4. **Visualization:** You MUST include a Mermaid.js diagram (start with \`\`\`mermaid) to visualize the concept (flowchart, graph, or sequence).
    
    Generate the JSON response.`;

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
        console.error(`Gemini API Error (Level Lesson ${level}):`, error);
        throw new Error('Failed to generate lesson.');
    }
}

async function generateBossBattleContent(topic, chapter, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const startLevel = (chapter - 1) * 50 + 1;
    const endLevel = chapter * 50;
    
    const prompt = `Create a "Boss Battle" exam for a learning game about "${topic}". This is a cumulative test for Chapter ${chapter} (levels ${startLevel}-${endLevel}).
    
    RULES:
    1. Generate exactly 10 challenging multiple-choice questions.
    2. **Scenario Mode:** Use complex "Real World" scenarios where the user must apply multiple concepts to solve a problem. No simple definitions.
    3. Difficulty: Very Hard. Distractors should be highly plausible.
    4. Tone: Epic final boss. The user must prove their mastery.
    
    Generate the 10 questions based on these rules and the provided JSON schema.`;

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
        console.error(`Gemini API Error (Boss Battle Generation for ${topic} Ch. ${chapter}):`, error);
        throw new Error('Failed to generate the boss battle.');
    }
}

async function generateHint(topic, question, options, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    
    const optionsString = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
    
    const prompt = `Provide a hint for this quiz question.
    
    Topic: "${topic}"
    Question: "${question}"
    Options:
    ${optionsString}
    
    RULES:
    1. Generate a single, short, helpful hint.
    2. DO NOT reveal the correct answer directly.
    3. Guide the user's logic using Socratic questioning or a partial clue.
    
    Return the hint in the provided JSON schema.`;

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

async function explainConcept(topic, concept, context, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `Topic: ${topic}
    Context: ${context}
    
    The student is asking about: "${concept}"
    
    RULES:
    1. Explain this specific concept clearly and concisely (max 3 sentences).
    2. Use a simple analogy if possible to make it "click".
    3. Be encouraging.
    
    Return the explanation in the provided JSON schema.`;

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
        console.error(`Gemini API Error (Explain Concept):`, error);
        throw new Error('Failed to generate explanation.');
    }
}

async function generateDailyChallenge(persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const categories = ["Science", "Technology", "History", "Space", "Coding", "Biology"];
    const topic = categories[Math.floor(Math.random() * categories.length)];
    
    const prompt = `Generate one single, interesting trivia question about "${topic}".
    Difficulty: Medium.
    Format: JSON with question, options (4), correctAnswerIndex, and topic.`;

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
        console.error("Daily Challenge Error:", error);
        throw new Error("Failed to generate challenge.");
    }
}

async function explainError(topic, question, userChoice, correctChoice, persona) {
    if (!ai) throw new Error("AI Service not initialized.");
    const prompt = `The user answered a question about "${topic}" incorrectly.
    Question: "${question}"
    User Chose: "${userChoice}" (Incorrect)
    Correct Answer: "${correctChoice}"
    
    Task: Explain WHY the user's choice is a common misconception or why it is wrong in this context. Be specific to the error.
    
    Return JSON with 'explanation'.`;

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
        console.error("Error Explanation Error:", error);
        throw new Error("Failed to explain error.");
    }
}


// --- EXPRESS ROUTER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Increased payload limit to support base64 image uploads
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

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/generate-journey-plan', async (req, res) => {
    const { topic, persona } = req.body;
    if (!isValidTopic(topic)) return res.status(400).json({ error: 'Invalid parameter: topic' });
    try {
        const plan = await generateJourneyPlan(topic, persona);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Image Analysis Endpoint
app.post('/api/generate-journey-from-image', async (req, res) => {
    const { imageBase64, mimeType, persona } = req.body;
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'Invalid parameters: image required' });
    try {
        const plan = await generateJourneyPlanFromImage(imageBase64, mimeType, persona);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-curriculum-outline', async (req, res) => {
    const { topic, totalLevels, persona } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const outline = await generateCurriculumOutline(topic, totalLevels, persona);
        res.json(outline);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level-questions', async (req, res) => {
    const { topic, level, totalLevels, persona } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(level) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateLevelQuestions(topic, level, totalLevels, persona);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-interactive-level', async (req, res) => {
    const { topic, level, persona } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(level)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateInteractiveLevel(topic, level, persona);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-level-lesson', async (req, res) => {
    const { topic, level, totalLevels, questions, persona } = req.body;
    // Relaxed validation: questions are optional now for parallel generation
    if (!isValidTopic(topic) || !isValidNumber(level) || !isValidNumber(totalLevels)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const data = await generateLevelLesson(topic, level, totalLevels, questions, persona);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-boss-battle', async (req, res) => {
    const { topic, chapter, persona } = req.body;
    if (!isValidTopic(topic) || !isValidNumber(chapter)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const bossContent = await generateBossBattleContent(topic, chapter, persona);
        res.json(bossContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-hint', async (req, res) => {
    const { topic, question, options, persona } = req.body;
    if (!isValidTopic(topic) || !isValidText(question) || !options) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const hint = await generateHint(topic, question, options, persona);
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
    const { topic, concept, context, persona } = req.body;
    if (!isValidTopic(topic) || !isValidText(concept)) return res.status(400).json({ error: 'Invalid parameters' });
    try {
        const result = await explainConcept(topic, concept, context || '', persona);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/daily-challenge', async (req, res) => {
    try { res.json(await generateDailyChallenge('apex')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/explain-error', async (req, res) => {
    const { topic, question, userChoice, correctChoice, persona } = req.body;
    if (!isValidTopic(topic) || !isValidText(question)) return res.status(400).json({ error: 'Invalid parameters' });
    try { res.json(await explainError(topic, question, userChoice, correctChoice, persona)); } catch (e) { res.status(500).json({ error: e.message }); }
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
