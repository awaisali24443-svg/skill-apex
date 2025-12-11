
import { showToast } from './toastService.js';

let prebakedData = null;

// --- Load Prebaked Data (Magic Trick) ---
async function loadPrebakedData() {
    if (!prebakedData) {
        try {
            const res = await fetch('data/prebaked_levels.json');
            if (res.ok) {
                prebakedData = await res.json();
            }
        } catch (e) {
            console.warn("Failed to load prebaked levels", e);
        }
    }
}

// --- LOCAL MOCK DATABASE (Client-Side Fallback) ---
const MOCK_DB = {
    "general": {
        lesson: "### General Knowledge\n\n**Briefing:** Test your awareness of the world around you. This module covers geography, history, and common facts.\n\n*   **Focus:** Accuracy and speed.\n*   **Goal:** Answer questions correctly.",
        questions: [
            {
                question: "Which planet is known as the Red Planet?",
                options: ["Venus", "Mars", "Jupiter", "Saturn"],
                correctAnswerIndex: 1,
                explanation: "Mars appears red due to iron oxide (rust) on its surface."
            },
            {
                question: "What is the capital of France?",
                options: ["London", "Berlin", "Madrid", "Paris"],
                correctAnswerIndex: 3,
                explanation: "Paris is the capital and most populous city of France."
            },
            {
                question: "Which element has the chemical symbol 'O'?",
                options: ["Gold", "Oxygen", "Osmium", "Olive"],
                correctAnswerIndex: 1,
                explanation: "O stands for Oxygen on the periodic table."
            }
        ]
    }
};

// Helper to find data or return generic fallback
function getMockData(topic) {
    const t = topic.toLowerCase();
    
    // Check prebaked first (Exact or partial match)
    if (prebakedData) {
        const key = Object.keys(prebakedData).find(k => k.toLowerCase().includes(t) || t.includes(k.toLowerCase()));
        if (key) return prebakedData[key];
    }

    return MOCK_DB["general"];
}

// --- MOCK SERVICE FUNCTIONS (No API Calls - Offline Mode) ---

export async function fetchTopics() {
    return [
        { name: "General Knowledge", description: "Test your awareness of the world.", styleClass: "topic-arts" },
        { name: "Coding & Tech", description: "Programming, web, and computers.", styleClass: "topic-programming" },
        { name: "Science", description: "Physics, Biology, and Chemistry.", styleClass: "topic-science" }
    ];
}

export async function generateJourneyPlan(topic) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800)); 
    return {
        topicName: topic,
        totalLevels: 10,
        description: `A custom quiz set focused on ${topic}.`
    };
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
        topicName: "Scanned Topic",
        totalLevels: 10,
        description: "A quiz generated from your uploaded image."
    };
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    return {
        chapters: ["Fundamentals", "Core Concepts", "Advanced Theory", "Mastery"]
    };
}

export async function generateLevelQuestions({ topic, level }) {
    await loadPrebakedData();
    
    // MAGIC TRICK: If Level 1, try to find prebaked data for instant load
    if (level === 1) {
        const data = getMockData(topic);
        if (data && data.questions) {
            // Tiny delay to make it feel like "Fast AI" rather than "Static"
            await new Promise(r => setTimeout(r, 600));
            return { questions: data.questions };
        }
    }

    // Default Fallback
    await new Promise(resolve => setTimeout(resolve, 1000));
    const data = MOCK_DB["general"];
    return { questions: data.questions };
}

export async function generateInteractiveLevel({ topic, level }) {
    return {
        challengeType: "match",
        instruction: "Match the concepts.",
        items: [
            { id: "1", text: "Concept A", match: "Definition A" },
            { id: "2", text: "Concept B", match: "Definition B" }
        ]
    };
}

export async function generateLevelLesson({ topic, level }) {
    await loadPrebakedData();

    if (level === 1) {
        const data = getMockData(topic);
        if (data && data.lesson) {
            await new Promise(r => setTimeout(r, 600));
            return { lesson: data.lesson };
        }
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    return { lesson: MOCK_DB["general"].lesson };
}

export async function generateBossBattle({ topic, chapter }) {
    return generateLevelQuestions({ topic, level: 1 }); 
}

export async function generateHint({ topic, question, options }) {
    return { hint: "Think about the definition of the key terms in the question." };
}

export async function generateSpeech(text) {
    console.warn("Speech generation requires API. Feature disabled in offline mode.");
    return null;
}

export async function explainConcept(topic, concept, context) {
    return { explanation: `${concept} is a fundamental part of ${topic}.` };
}

export async function fetchDailyChallenge() {
    const data = getMockData("general");
    const q = data.questions[0];
    return {
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        topic: "General Knowledge"
    };
}

export async function explainError(topic, question, userChoice, correctChoice) {
    return { explanation: `You chose '${userChoice}', but the correct answer is '${correctChoice}' because it aligns with the facts of ${topic}.` };
}
