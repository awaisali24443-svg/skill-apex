
import { showToast } from './toastService.js';
import * as configService from './configService.js';

// ==================================================================================
// 🔌 API CONFIGURATION
// We now route requests to the Node.js server (server.js) which handles the Gemini API safely.
// ==================================================================================
const API_BASE_URL = '/api'; 

// --- HELPER: Dynamic Fallback Generator ---
function generateFallbackQuestions(topic, level) {
    const t = topic || "Advanced Tech";
    return [
        {
            question: `In the context of ${t}, what is the primary function of the core component?`,
            options: ["To reduce latency", "To process data streams", "To create a visual output", "To store redundant logs"],
            correctAnswerIndex: 1,
            explanation: `Core components in ${t} are designed to handle data throughput efficiently.`
        },
        {
            question: `When optimizing for scale in ${t}, which strategy is most effective?`,
            options: ["Vertical Scaling", "Horizontal Scaling", "Deleting old data", "Ignoring errors"],
            correctAnswerIndex: 1,
            explanation: "Horizontal scaling (adding more nodes) is generally preferred for distributed systems."
        },
        {
            question: `Scenario: A critical failure occurs in the ${t} subsystem. What is the first mitigation step?`,
            options: ["Check the logs", "Reboot everything", "Call the CEO", "Panic"],
            correctAnswerIndex: 0,
            explanation: "Root cause analysis via logs is essential before taking remediation actions."
        }
    ];
}

const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "IT Mastery",
        totalLevels: 10,
        description: `(Offline Mode) A specialized training course on ${topic}. Server connection unavailable.`,
        isFallback: true
    }),
    curriculum: () => ({
        chapters: ["Fundamentals", "Tools & Technologies", "Real-world Application", "Expert Mastery"],
        isFallback: true
    }),
    questions: (topic, level) => ({
        questions: generateFallbackQuestions(topic, level),
        isFallback: true
    }),
    lesson: (topic, level) => ({
        lesson: `### ⚡ System Briefing: ${topic} (Level ${level})\n\n**Status:** Simulated Data Stream.\n\nWe are currently operating in a low-bandwidth environment. The neural core has generated a procedural briefing for this level.\n\n*   **Objective:** Master the fundamentals of ${topic}.\n*   **Focus:** Precision and consistency.\n\nProceed to the assessment phase to validate your knowledge.`,
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
        return FALLBACK_DATA.questions(topic, level);
    }
    return data;
}

export async function generateLevelLesson({ topic, level, totalLevels }) {
    const data = await postToServer('/generate-level-lesson', { topic, level, totalLevels });
    if (!data || !data.lesson) return FALLBACK_DATA.lesson(topic, level);
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
