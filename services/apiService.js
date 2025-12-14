
import { GoogleGenAI } from "@google/genai";
import { showToast } from './toastService.js';

// --- CONFIGURATION ---
const MAX_RETRIES = 2;
const RETRY_DELAY_BASE = 1000;

// Client-side AI instance (for Live API mainly)
let ai = null; 
let isConfigLoaded = false;

// --- INITIALIZATION ---
// Fetch the key from the server so we can use Client-Side SDK features if needed
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
        if (!response.ok) {
            // If server error 5xx, retry. If 4xx, throw.
            if (response.status >= 500 && retries > 0) {
                console.log(`Retrying ${url}... (${retries} left)`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`Server Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            console.log(`Fetch failed, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

// --- API FUNCTIONS (Routing to Server) ---

export async function fetchTopics() {
    try {
        return await fetchWithRetry('/api/topics');
    } catch (e) {
        console.warn("Using fallback topics");
        return [
            { name: "General Knowledge", description: "Test your awareness.", styleClass: "topic-arts" },
            { name: "Tech Fundamentals", description: "Basic computer science.", styleClass: "topic-programming" }
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
        // Fallback structure
        return {
            topicName: topic,
            totalLevels: 10,
            description: "Offline Mode: Detailed plan unavailable. Defaulting to standard path."
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
        return { chapters: ["Basics", "Intermediate", "Advanced", "Mastery"] };
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
        // Return minimal fallback structure to prevent crash
        return {
            questions: [
                {
                    question: "Network connection lost. What is the best action?",
                    options: ["Panic", "Retry Later", "Check Cables", "Reboot"],
                    correctAnswerIndex: 1,
                    explanation: "Retry logic is essential in distributed systems."
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
        return { lesson: "### Offline Briefing\n\nUnable to retrieve dynamic lesson data from HQ. Proceed to questions based on your existing knowledge." };
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
        return { hint: "Review the question options carefully." };
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
        return { explanation: "An error occurred while fetching the explanation." };
    }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    // Mock for now, requires image upload endpoint on server
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                topicName: "Scanned Topic",
                totalLevels: 15,
                description: "AI identified a technical subject from your image scan."
            });
        }, 1500);
    });
}

// Accessor to get the AI instance for Client-Side-Only modules (Like Live API)
export function getAIClient() {
    return ai;
}
