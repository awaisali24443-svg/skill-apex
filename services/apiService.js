
import { GoogleGenAI } from "@google/genai";
import { showToast } from './toastService.js';

// --- CONFIGURATION ---
const MAX_RETRIES = 2;
const RETRY_DELAY_BASE = 1500;

// Client-side AI instance (for Live API mainly)
let ai = null; 
let isConfigLoaded = false;

// --- INITIALIZATION ---
(async function initClientAI() {
    try {
        const res = await fetch('/api/client-config');
        if (res.ok) {
            const data = await res.json();
            if (data.apiKey) {
                ai = new GoogleGenAI({ apiKey: data.apiKey });
                isConfigLoaded = true;
                console.log("Client AI Initialized from Server Config");
            }
        }
    } catch (e) {
        console.warn("Could not fetch client config (Offline Mode?)");
    }
})();

// --- ROBUST FETCH WRAPPER ---
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    try {
        const response = await fetch(url, options);
        
        // Handle non-200 responses
        if (!response.ok) {
            // 500s are worth retrying, 400s usually mean bad request
            if (response.status >= 500 && retries > 0) {
                console.log(`Retrying ${url}... (${retries} left)`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`Server Error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            // If we get HTML (like a 404 page or Nginx error), don't crash, just log and throw
            const text = await response.text();
            console.warn("Received non-JSON response:", text.substring(0, 50));
            throw new Error("Invalid response format (Expected JSON)");
        }

    } catch (error) {
        if (retries > 0) {
            console.log(`Fetch failed (${error.message}), retrying...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

// --- API FUNCTIONS ---

export async function fetchTopics() {
    try {
        return await fetchWithRetry('/api/topics');
    } catch (e) {
        console.warn("Using fallback topics");
        return [
            { name: "Python Mastery", description: "Learn Python.", styleClass: "topic-programming" },
            { name: "Web Development", description: "Build websites.", styleClass: "topic-arts" }
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
        console.error("Journey Gen Failed:", error);
        return {
            topicName: topic || "Skill",
            totalLevels: 20,
            description: `(Offline Simulation) Custom training path for ${topic}.`
        };
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
        return { chapters: ["Core Concepts", "Advanced Techniques", "Practical Application", "Mastery"] };
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
        console.error("Question Gen Failed:", e);
        // Fallback handled by Game Level, but returning structure here is safer
        return {
            questions: [
                {
                    question: `(Connection Error) What is the core of ${topic}?`,
                    options: ["Consistency", "Speed", "Luck", "Magic"],
                    correctAnswerIndex: 0,
                    explanation: "Consistency is key."
                }
            ]
        };
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
        return { lesson: `### Connection Interrupted\n\nWe could not retrieve the lesson for **${topic}**. Please check your internet connection.` };
    }
}

export async function generateHint({ topic, question, options }) {
    try {
        return await fetchWithRetry('/api/generate-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, question, options })
        });
    } catch (e) {
        return { hint: "Review the options carefully." };
    }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    try {
        return await fetchWithRetry('/api/explain-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, question, userChoice, correctChoice })
        });
    } catch (e) {
        return { explanation: "Offline Mode: The selected answer is incorrect." };
    }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    // This endpoint is mocked in server.js but we can call it
    try {
        return await fetchWithRetry('/api/generate-journey-from-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 })
        });
    } catch(e) {
        return {
            topicName: "Scanned Topic",
            totalLevels: 10,
            description: "Analyzed from image."
        };
    }
}

export function getAIClient() {
    return ai;
}
