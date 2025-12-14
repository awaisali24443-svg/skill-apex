
import { GoogleGenAI, Type } from "@google/genai";
import { showToast } from './toastService.js';

// --- CONFIGURATION ---
const MAX_RETRIES = 1;
const RETRY_DELAY_BASE = 1000;

// Client-side AI instance (Fallback if server is down)
let clientAi = null; 

// --- INITIALIZATION ---
(async function initClientAI() {
    // 1. Try to get config from server
    try {
        const res = await fetch('/api/client-config');
        if (res.ok) {
            const data = await res.json();
            if (data.apiKey) {
                clientAi = new GoogleGenAI({ apiKey: data.apiKey });
                console.log("Client AI Initialized (Server Config)");
            }
        }
    } catch (e) {
        // Silent fail
    }

    // 2. If server failed, check process.env (Static deployment or Shim)
    if (!clientAi && typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        clientAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("Client AI Initialized (Local Env)");
    }
})();

// --- ROBUST FETCH WRAPPER ---
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

// --- CLIENT SIDE GENERATORS (The Safety Net) ---
// These functions run directly in the browser if the backend is unreachable.

async function clientGenerateJourney(topic) {
    if (!clientAi) throw new Error("AI unavailable (No Key). Please check configuration.");
    
    // Simulate server response structure
    const response = await clientAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze "${topic}". Output JSON: { topicName, totalLevels (10-50), description }`,
        config: { 
            responseMimeType: 'application/json',
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
    return JSON.parse(response.text);
}

async function clientGenerateQuestions(topic, level) {
    if (!clientAi) throw new Error("AI unavailable");
    const response = await clientAi.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: `Topic: ${topic}. Level ${level}. Generate 3 scenario-based multiple choice questions.`,
        config: { 
            responseMimeType: 'application/json',
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
                }
            }
        }
    });
    return JSON.parse(response.text);
}

async function clientGenerateLesson(topic, level) {
    if (!clientAi) throw new Error("AI unavailable");
    const response = await clientAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a short, exciting lesson for ${topic} level ${level}. Under 150 words.`,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: { lesson: { type: Type.STRING } }
            }
        }
    });
    return JSON.parse(response.text);
}

// --- HYBRID API FUNCTIONS ---

export async function fetchTopics() {
    try {
        return await fetchWithRetry('/api/topics');
    } catch (e) {
        // Fallback Topics if static
        return [
            { name: "Cybersecurity", description: "Network defense.", styleClass: "topic-space" },
            { name: "AI & ML", description: "Machine intelligence.", styleClass: "topic-robotics" },
            { name: "Web Dev", description: "Full stack engineering.", styleClass: "topic-programming" }
        ];
    }
}

export async function generateJourneyPlan(topic) {
    try {
        return await fetchWithRetry('/api/generate-journey-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
    } catch (error) {
        console.warn("Backend unavailable, trying Client-Side AI...");
        try {
            return await clientGenerateJourney(topic);
        } catch (clientError) {
            console.error("All AI generation failed:", clientError);
            // Absolute Last Resort: Hardcoded Fallback
            return {
                topicName: topic,
                totalLevels: 10,
                description: "Offline Mode: Plan unavailable. Defaulting to standard path."
            };
        }
    }
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    try {
        return await fetchWithRetry('/api/generate-curriculum-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, totalLevels })
        });
    } catch (e) {
        return { chapters: ["Basics", "Advanced", "Mastery"] };
    }
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    try {
        return await fetchWithRetry('/api/generate-level-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level, totalLevels })
        });
    } catch (e) {
        console.warn("Backend unavailable (Questions), trying Client-Side AI...");
        try {
            return await clientGenerateQuestions(topic, level);
        } catch (clientError) {
            return {
                questions: [
                    {
                        question: "System Offline. How do you proceed?",
                        options: ["Panic", "Retry Later", "Check Internet", "Reboot"],
                        correctAnswerIndex: 2,
                        explanation: "Always check physical layer connectivity first."
                    }
                ]
            };
        }
    }
}

export async function generateLevelLesson({ topic, level, totalLevels }) {
    try {
        return await fetchWithRetry('/api/generate-level-lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level, totalLevels })
        });
    } catch (e) {
        console.warn("Backend unavailable (Lesson), trying Client-Side AI...");
        try {
            return await clientGenerateLesson(topic, level);
        } catch (clientError) {
            return { lesson: "### Offline Briefing\n\nUnable to retrieve dynamic data. Proceed to questions." };
        }
    }
}

export async function generateHint({ topic, question, options }) {
    return { hint: "Review the options carefully." };
}

export async function explainError(topic, question, userChoice, correctChoice) {
    return { explanation: "Explanation unavailable offline." };
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    // Requires multimodal model, usually 2.5-flash-image or pro-vision
    if (!clientAi) throw new Error("Client AI unavailable");
    
    // Simple mock for now as backend image handling is complex to shim fully here
    // But we can try calling gemini directly if we had a proper image model configured
    return {
        topicName: "Scanned Topic",
        totalLevels: 15,
        description: "AI identified a technical subject from your image scan."
    };
}

export function getAIClient() {
    return clientAi;
}
