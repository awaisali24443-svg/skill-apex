
import 'dotenv/config'; 
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import rateLimit from 'express-rate-limit';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = (process.env.API_KEY || "").trim();
const HF_API_KEY = (process.env.HF_API_KEY || "").trim(); 
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: API_KEY });

const BASE_SYSTEM_INSTRUCTION = `You are the Skill Apex Neural Core, a world-class technical mentor. 
Your goal is to forge elite engineers. Your tone is professional, futuristic, and encouraging. 
Ensure technical accuracy is 100%. If a topic is complex, break it down using first-principles thinking.
IMPORTANT: Your response must be strictly valid JSON according to the requested schema. Do not include markdown formatting like \`\`\`json.`;

const QUIZ_SCHEMA = { 
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
                    explanation: { type: Type.STRING },
                    technicalInsight: { type: Type.STRING, description: "An advanced tip related to this question." }
                } 
            } 
        } 
    } 
};

/**
 * HELPER: Cleans AI output to ensure valid JSON.
 * Removes markdown code blocks and whitespace.
 */
function cleanAIOutput(text) {
    if (!text) return "{}";
    // Remove ```json and ``` wrapping
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    // Locate first '{' and last '}' to strip any preamble text
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    return clean;
}

/**
 * FALLBACK ENGINE: Hugging Face Inference
 */
async function callHuggingFace(prompt, schemaDescription) {
    if (!HF_API_KEY) throw new Error("Hugging Face API Key missing.");
    
    const model = "meta-llama/Llama-3-8B-Instruct";
    const hfUrl = `https://api-inference.huggingface.co/models/${model}`;
    
    const fullPrompt = `${BASE_SYSTEM_INSTRUCTION}\n\nTask: ${prompt}\n\nJSON Schema Requirement: ${schemaDescription}\n\nReturn ONLY the JSON object.`;

    const response = await fetch(hfUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: fullPrompt,
            parameters: { max_new_tokens: 2000, return_full_text: false }
        })
    });

    if (!response.ok) throw new Error(`HF Error: ${response.statusText}`);
    
    const result = await response.json();
    let text = result[0]?.generated_text || "";
    return JSON.parse(cleanAIOutput(text));
}

/**
 * NEURAL CONTROLLER: Orchestrates Gemini with HF Fallback
 */
async function generateAIContent({ model, prompt, schema, schemaDescription }) {
    try {
        // Attempt Primary Engine: Gemini
        const response = await ai.models.generateContent({
            model: model || 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                systemInstruction: BASE_SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });
        
        // Sanitize output even from Gemini to be safe
        const text = response.text;
        return JSON.parse(cleanAIOutput(text));

    } catch (geminiError) {
        console.warn("Gemini Engine Offline or Throttled. Activating Hugging Face Fallback...", geminiError.message);
        try {
            return await callHuggingFace(prompt, schemaDescription);
        } catch (hfError) {
            console.error("Critical Failure: Both AI Engines Unreachable.", hfError.message);
            throw new Error("Neural Core connection lost. Please verify API keys.");
        }
    }
}

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname)));

app.post('/api/generate-journey-plan', async (req, res) => {
    try {
        const { topic } = req.body;
        const result = await generateAIContent({
            model: 'gemini-3-pro-preview',
            prompt: `Architect a 100-level learning journey for "${topic}". Focus on professional mastery.`,
            schemaDescription: "{ topicName: string, totalLevels: number, description: string, difficulty: 'Beginner'|'Intermediate'|'Advanced' }",
            schema: {
                type: Type.OBJECT,
                properties: {
                    topicName: { type: Type.STRING },
                    totalLevels: { type: Type.INTEGER },
                    description: { type: Type.STRING },
                    difficulty: { type: Type.STRING }
                }
            }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-curriculum-outline', async (req, res) => {
    try {
        const { topic, totalLevels } = req.body;
        const result = await generateAIContent({
            model: 'gemini-3-flash-preview',
            prompt: `Create a high-level 5-chapter curriculum outline for a ${totalLevels}-level course on "${topic}".`,
            schemaDescription: "{ chapters: string[] }",
            schema: {
                type: Type.OBJECT,
                properties: { chapters: { type: Type.ARRAY, items: { type: Type.STRING } } }
            }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-level-questions', async (req, res) => {
    try {
        const { topic, level } = req.body;
        const result = await generateAIContent({
            model: 'gemini-3-pro-preview',
            prompt: `Generate 5 elite-level questions for "${topic}" at Level ${level}. Focus on edge cases and architectural principles.`,
            schemaDescription: "An object with a 'questions' array. Each question has 'question', 'options' (array), 'correctAnswerIndex', 'explanation', and 'technicalInsight'.",
            schema: QUIZ_SCHEMA
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/explain-error', async (req, res) => {
    try {
        const { topic, question, userSelection, correctOption } = req.body;
        const result = await generateAIContent({
            model: 'gemini-3-flash-preview',
            prompt: `The student is learning ${topic}. Question: "${question}". They chose "${userSelection}" but the correct answer is "${correctOption}". Explain the logical fallacy in their choice briefly and technically.`,
            schemaDescription: "{ explanation: string }",
            schema: { type: Type.OBJECT, properties: { explanation: { type: Type.STRING } } }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NEW INTERVIEW ENDPOINT ---
app.post('/api/interview-step', async (req, res) => {
    try {
        const { history, topic } = req.body;
        
        // Construct the prompt context from history
        let conversationLog = "Conversation History:\n";
        history.forEach(h => {
            conversationLog += `${h.role === 'model' ? 'Interviewer' : 'User'}: ${h.text}\n`;
        });

        const prompt = `
        You are an adaptive learning assistant conducting a placement interview.
        Topic: ${topic || "Not yet specified"}.
        
        GOAL: Determine the user's skill level (1-100) for this topic.
        
        INSTRUCTIONS:
        1. If topic is unknown, ask for it.
        2. Ask 3-5 targeted diagnostic questions, one by one.
        3. Start basic. If they answer well, jump to intermediate/advanced questions instantly.
        4. If they struggle, stay basic.
        5. Keep tone friendly but professional. Use phrases like "No worries if you're new".
        6. After ~4 questions or if you are confident, conclude.
        
        ${conversationLog}
        
        RESPONSE FORMAT (JSON ONLY):
        If continuing: { "status": "continue", "message": "Next question text here" }
        If concluding: { "status": "complete", "message": "Summary of assessment", "recommendedLevel": <integer 1-100>, "topic": "<confirmed topic>" }
        `;

        const result = await generateAIContent({
            model: 'gemini-3-flash-preview', // Faster for chat
            prompt: prompt,
            schemaDescription: "JSON with status, message, and optional recommendedLevel/topic.",
            schema: {
                type: Type.OBJECT,
                properties: {
                    status: { type: Type.STRING, enum: ["continue", "complete"] },
                    message: { type: Type.STRING },
                    recommendedLevel: { type: Type.INTEGER },
                    topic: { type: Type.STRING }
                },
                required: ["status", "message"]
            }
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/debug-status', (req, res) => res.json({ status: 'online' }));

const pages = ['topics', 'library', 'history', 'leaderboard', 'profile', 'aural', 'settings', 'level', 'report', 'study', 'game', 'interview'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, `pages/${page}.html`)));
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

server.listen(PORT, () => console.log(`Neural Core Online on port ${PORT} (Dual-AI Resilience Enabled)`));
