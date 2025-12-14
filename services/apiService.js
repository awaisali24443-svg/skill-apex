
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
        
        // Handle non-200 responses
        if (!response.ok) {
            if (response.status >= 500 && retries > 0) {
                console.log(`Retrying ${url}... (${retries} left)`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_BASE));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`Server Error: ${response.status}`);
        }

        // Check Content-Type to prevent crashing on 500 HTML pages
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            const text = await response.text();
            console.warn("Received non-JSON response:", text.substring(0, 100));
            throw new Error("Invalid response format (Not JSON)");
        }

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
            { name: "Python Mastery", description: "Learn Python from scratch.", styleClass: "topic-programming" },
            { name: "Machine Learning", description: "Basics of AI and Neural Networks.", styleClass: "topic-robotics" }
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
        // Robust Fallback
        return {
            topicName: topic,
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
        // THEMED FALLBACKS FOR OFFLINE MODE
        return {
            questions: [
                {
                    question: `In the context of ${topic}, what is the most important fundamental principle?`,
                    options: ["Speed", "Consistency/Logic", "Randomness", "Complexity"],
                    correctAnswerIndex: 1,
                    explanation: "Foundational logic is key to mastering this subject."
                },
                {
                    question: `Which tool is commonly used when working with ${topic}?`,
                    options: ["Hammer", "IDE / Code Editor", "Microscope", "Telescope"],
                    correctAnswerIndex: 1,
                    explanation: "Software development and IT tasks usually require an Integrated Development Environment."
                },
                {
                    question: "What happens if you ignore error handling in your code?",
                    options: ["Nothing", "The system crashes unexpectedly", "It runs faster", "It fixes itself"],
                    correctAnswerIndex: 1,
                    explanation: "Robust systems require handling edge cases to prevent crashes."
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
        return { lesson: `### **OFFLINE BRIEFING**\n\n**TOPIC:** ${topic}\n\nWe are unable to reach the central AI core. Engaging local backup archives.\n\n*   **Focus:** Review your basics.\n*   **Objective:** Complete the practice questions to maintain your streak.\n\nProceed to the challenge.` };
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
        return { hint: "Review the options. One of them is a standard industry best practice." };
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
        return { explanation: "Offline Mode: The selected answer is incorrect based on standard principles." };
    }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    // Mock for now, requires image upload endpoint on server
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                topicName: "Scanned IT Topic",
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
