
import { GoogleGenAI } from "@google/genai";
import { showToast } from './toastService.js';

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
const MODEL_TEXT = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

// --- INITIALIZATION ---
let ai;
let isOfflineMode = false;

try {
    if (API_KEY) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
        console.log("✅ AI Client Initialized (Direct Connection)");
    } else {
        console.warn("⚠️ No API Key found. Initializing in Offline Simulation Mode.");
        isOfflineMode = true;
    }
} catch (e) {
    console.error("AI Client Init Failed:", e);
    isOfflineMode = true;
}

// --- SYSTEM PROMPTS ---
const BASE_SYSTEM_INSTRUCTION = `
You are ApexCore, an advanced AI Tutor for a technical quiz application.
TONE: Professional, concise, encouraging.
FORMAT: strictly valid JSON.
`;

// --- HELPERS ---
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        const firstOpen = clean.search(/[\{\[]/);
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
        try { return JSON.parse(clean); } catch (e2) { console.warn("JSON Repair Failed", e2); return null; }
    }
}

// --- ROBUST RETRY LOGIC ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callAIWithRetry(fnCall) {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            return await fnCall();
        } catch (error) {
            attempt++;
            console.warn(`AI Call Failed (Attempt ${attempt}/${MAX_RETRIES}):`, error.message);
            
            // If it's a fatal client error (400, 401), do not retry
            if (error.message.includes('400') || error.message.includes('401') || error.message.includes('API key')) {
                break; 
            }

            if (attempt >= MAX_RETRIES) throw error;
            
            // Exponential Backoff: 1s, 2s, 4s
            const waitTime = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            await delay(waitTime);
        }
    }
    throw new Error("Max retries exceeded");
}

// --- MOCK DATA (Fallback for Offline/No-Key) ---
const MOCK_DB = {
    journey: (topic) => ({
        topicName: topic || "Computer Science",
        totalLevels: 10,
        description: `(Offline Mode) A curated mastery path for ${topic}. Connect API Key for live AI generation.`
    }),
    curriculum: () => ({
        chapters: ["Fundamentals", "Core Concepts", "Advanced Theory", "Practical Mastery"]
    }),
    questions: (topic) => ({
        questions: [
            {
                question: `In the context of ${topic}, which concept is fundamental?`,
                options: ["Complexity", "Structure", "Randomness", "Entropy"],
                correctAnswerIndex: 1,
                explanation: "Structure provides the foundation for all advanced systems."
            },
            {
                question: `What is the primary bottleneck when scaling ${topic}?`,
                options: ["Hardware", "Network Latency", "Human Error", "Resource Management"],
                correctAnswerIndex: 3,
                explanation: "Efficient resource management is key to scalability."
            },
            {
                question: `Which tool is standard industry practice for ${topic}?`,
                options: ["Notepad", "IDE/Specialized Tool", "Spreadsheets", "Calculator"],
                correctAnswerIndex: 1,
                explanation: "Specialized tools increase productivity and reduce error rates."
            }
        ]
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Simulation Mode Active.\n\nWe are currently operating without a live neural link. \n\n*   **Objective:** Understand the core principles of ${topic}.\n*   **Directive:** Analyze the questions carefully.\n\nProceed to the assessment.`
    }),
    hint: { hint: "Focus on the definition of the key terms." },
    explanation: { explanation: "This is the correct answer based on standard industry principles." }
};

// --- API FUNCTIONS ---

export async function fetchTopics() {
    try {
        const response = await fetch('data/topics.json');
        if (response.ok) return await response.json();
    } catch (e) {
        // Fallback if local file fetch fails
    }
    return [
        { name: "General Knowledge", description: "Test your awareness.", styleClass: "topic-arts" },
        { name: "Tech Fundamentals", description: "Basic computer science.", styleClass: "topic-programming" }
    ];
}

export async function generateJourneyPlan(topic) {
    if (isOfflineMode || !ai) return MOCK_DB.journey(topic);

    const prompt = `Analyze "${topic}". Create a learning path. Output JSON: { "topicName": string, "totalLevels": number (10-30), "description": "Short description" }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json', systemInstruction: BASE_SYSTEM_INSTRUCTION }
        }));
        return cleanAndParseJSON(response.text) || MOCK_DB.journey(topic);
    } catch (error) {
        console.error("AI Journey Error (Fallback triggered):", error);
        return MOCK_DB.journey(topic);
    }
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    if (isOfflineMode || !ai) return MOCK_DB.curriculum();

    const prompt = `Topic: ${topic}. Levels: ${totalLevels}. Return 4 distinct chapter titles. JSON: { "chapters": [string, string, string, string] }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json', systemInstruction: BASE_SYSTEM_INSTRUCTION }
        }));
        return cleanAndParseJSON(response.text) || MOCK_DB.curriculum();
    } catch (e) { return MOCK_DB.curriculum(); }
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    if (isOfflineMode || !ai) return MOCK_DB.questions(topic);

    const prompt = `Topic: ${topic}. Level ${level}/${totalLevels}. Generate 3 scenario-based multiple choice questions. JSON: { "questions": [{ "question": string, "options": [string, string, string, string], "correctAnswerIndex": number, "explanation": string }] }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json', systemInstruction: BASE_SYSTEM_INSTRUCTION }
        }));
        const data = cleanAndParseJSON(response.text);
        if (data && data.questions && data.questions.length > 0) return data;
        return MOCK_DB.questions(topic);
    } catch (e) { return MOCK_DB.questions(topic); }
}

export async function generateLevelLesson({ topic, level, totalLevels }) {
    if (isOfflineMode || !ai) return MOCK_DB.lesson(topic);

    const prompt = `Topic: ${topic}. Level ${level}. Write a short (150 words) engaging lesson using an analogy. JSON: { "lesson": "markdown string" }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json', systemInstruction: BASE_SYSTEM_INSTRUCTION }
        }));
        return cleanAndParseJSON(response.text) || MOCK_DB.lesson(topic);
    } catch (e) { return MOCK_DB.lesson(topic); }
}

export async function generateHint({ topic, question, options }) {
    if (isOfflineMode || !ai) return MOCK_DB.hint;

    const prompt = `Question: "${question}". Options: ${JSON.stringify(options)}. Give a subtle hint without revealing the answer. JSON: { "hint": string }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }));
        return cleanAndParseJSON(response.text) || MOCK_DB.hint;
    } catch (e) { return MOCK_DB.hint; }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    if (isOfflineMode || !ai) return MOCK_DB.explanation;

    const prompt = `Question: "${question}". User chose: "${userChoice}" (Wrong). Correct: "${correctChoice}". Explain why. JSON: { "explanation": string }`;
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }));
        return cleanAndParseJSON(response.text) || MOCK_DB.explanation;
    } catch (e) { return MOCK_DB.explanation; }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    if (isOfflineMode || !ai) throw new Error("Offline mode. Cannot analyze images.");

    const prompt = "Analyze this image. Identify the educational topic. JSON: { \"topicName\": string, \"totalLevels\": 15, \"description\": string }";
    
    try {
        const response = await callAIWithRetry(() => ai.models.generateContent({
            model: MODEL_TEXT,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: imageBase64 } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: 'application/json' }
        }));
        return cleanAndParseJSON(response.text) || { topicName: "Scanned Object", totalLevels: 10, description: "Analysis failed." };
    } catch (e) { throw e; }
}

// Accessor to get the AI instance for other modules (like Live API)
export function getAIClient() {
    return ai;
}
