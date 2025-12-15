
import { showToast } from './toastService.js';
import * as configService from './configService.js';

// ==================================================================================
// 🔌 API CONFIGURATION
// We now route requests to the Node.js server (server.js) which handles the Gemini API safely.
// ==================================================================================
const API_BASE_URL = '/api'; 

// --- FALLBACK DATA (Offline Mode) ---
const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "IT Mastery",
        totalLevels: 10,
        description: `(Offline Mode) A comprehensive training course on ${topic}. Server connection unavailable.`,
        isFallback: true
    }),
    curriculum: () => ({
        chapters: ["Fundamentals", "Tools & Technologies", "Real-world Application", "Expert Mastery"],
        isFallback: true
    }),
    questions: (topic) => ({
        questions: [
            {
                question: `Scenario: You are working on a project related to ${topic} and the system crashes. What is the first logical step?`,
                options: ["Panic", "Check the logs/debug", "Restart everything immediately", "Call the client"],
                correctAnswerIndex: 1,
                explanation: "Debugging and log analysis is the professional first step in any IT crisis."
            },
            {
                question: `In the context of ${topic}, which practice ensures long-term success?`,
                options: ["Taking shortcuts", "Consistent Learning", "Copying code", "Using outdated tools"],
                correctAnswerIndex: 1,
                explanation: "Technology evolves rapidly; consistency is the only way to stay relevant."
            },
            {
                question: `A client asks for a feature in ${topic} that is technically impossible. What do you do?`,
                options: ["Say yes and fake it", "Ignore them", "Explain the limitation and offer an alternative", "Quit the project"],
                correctAnswerIndex: 2,
                explanation: "Professionalism involves managing expectations and finding viable technical solutions."
            }
        ],
        isFallback: true
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Offline Backup Protocol Active.\n\nSince the AI connection is currently offline, we are accessing the local reserve archives.\n\n*   **Core Concept:** Mastery of ${topic} requires understanding both the 'How' and the 'Why'.\n*   **Industry Standard:** This skill is highly valued in the global market.\n*   **Objective:** Prove your knowledge to proceed.\n\nProceed to the challenge.`,
        isFallback: true
    })
};

// --- HELPER: Network Request Wrapper ---
async function postToServer(endpoint, body) {
    try {
        const config = configService.getConfig();
        const payload = { ...body, persona: config.aiPersona || 'apex' };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.warn(`API Error [${endpoint}]:`, error);
        return null; // Triggers fallback
    }
}

// --- API FUNCTIONS ---

export async function fetchTopics() {
    try {
        const response = await fetch(`${API_BASE_URL}/topics`);
        if(response.ok) return await response.json();
        throw new Error('Topics load failed');
    } catch (e) {
        // Fallback Topics
        return [
            { name: "AI & Machine Learning", description: "Master Python, TensorFlow, and PyTorch.", styleClass: "topic-programming" },
            { name: "Cybersecurity", description: "Penetration testing and network defense.", styleClass: "topic-space" },
            { name: "Web Development", description: "Full-stack mastery with React and Node.", styleClass: "topic-arts" },
            { name: "Cloud Computing", description: "AWS, Azure, and Google Cloud architecture.", styleClass: "topic-medicine" },
            { name: "Blockchain", description: "Smart contracts and decentralized apps.", styleClass: "topic-finance" },
            { name: "Game Design", description: "Unity, Unreal Engine, and C# scripting.", styleClass: "topic-philosophy" }
        ];
    }
}

export async function generateJourneyPlan(topic) {
    const data = await postToServer('/generate-journey-plan', { topic });
    if (!data) return FALLBACK_DATA.journey(topic);
    return data;
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    const data = await postToServer('/generate-curriculum-outline', { topic, totalLevels });
    if (!data) return FALLBACK_DATA.curriculum();
    return data;
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    const data = await postToServer('/generate-level-questions', { topic, level, totalLevels });
    
    // Validate structure
    if (!data || !data.questions || !Array.isArray(data.questions)) {
        console.warn("Invalid questions data received, using fallback.");
        return FALLBACK_DATA.questions(topic);
    }
    return data;
}

export async function generateLevelLesson({ topic, level, totalLevels }) {
    const data = await postToServer('/generate-level-lesson', { topic, level, totalLevels });
    if (!data || !data.lesson) return FALLBACK_DATA.lesson(topic);
    return data;
}

export async function generateHint({ topic, question, options }) {
    const data = await postToServer('/generate-hint', { topic, question, options });
    return data || { hint: "Review the briefing carefully. Identify keywords." };
}

export async function explainError(topic, question, userChoice, correctChoice) {
    const data = await postToServer('/explain-error', { topic, question, userChoice, correctChoice });
    return data || { explanation: "This option is incorrect based on standard principles." };
}

/**
 * Uploads a file (PDF or Image) to generate a journey based on its content.
 * @param {string} fileBase64 - Base64 encoded file data (no data URL prefix).
 * @param {string} mimeType - The MIME type of the file (e.g., 'application/pdf', 'image/png').
 */
export async function generateJourneyFromFile(fileBase64, mimeType) {
    const data = await postToServer('/generate-journey-from-file', { 
        fileData: fileBase64, 
        mimeType: mimeType 
    });
    
    if (!data) {
        return { 
            topicName: "Document Analysis", 
            totalLevels: 10, 
            description: "Offline fallback: Could not process file via AI.", 
            isFallback: true 
        };
    }
    return data;
}

// --- DIAGNOSTICS ---
export async function checkSystemStatus() {
    const start = Date.now();
    try {
        const response = await fetch(`${API_BASE_URL}/debug-status`, { method: 'POST' });
        if (!response.ok) throw new Error('Network Error');
        
        const data = await response.json();
        const latency = Date.now() - start;
        
        if (data.status === 'online') {
            return { status: 'online', latency, message: 'Neural Link Stable' };
        } else {
            // Return the specific server error
            return { status: 'offline', latency, message: data.message || 'AI Error' };
        }
    } catch (e) {
        return { status: 'error', latency: 0, message: 'Server Unreachable' };
    }
}

// Helper to get client for Aural Mode (which must run in browser)
// We fetch the key from the server first to keep it somewhat obscure
export async function getAIClient() {
    try {
        const { GoogleGenAI } = await import("@google/genai");
        const res = await fetch(`${API_BASE_URL}/client-config`);
        if(!res.ok) throw new Error("Could not fetch config");
        const { apiKey } = await res.json();
        return new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to init AI Client for Live Mode", e);
        return null;
    }
}
