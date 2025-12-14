
import { GoogleGenAI, Type } from "@google/genai";
import { showToast } from './toastService.js';

// ==================================================================================
// 🔑 CONFIGURATION
// ==================================================================================
const API_KEY = "AIzaSyDCcZwOe8v-I58rPHg3wHGKwPNTxYvl7ho"; 
// ==================================================================================

let ai = null;

// --- INITIALIZATION ---
try {
    if (API_KEY) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
        console.log("✅ AI Client Initialized");
    } else {
        console.warn("⚠️ API Key missing. App running in fallback mode.");
    }
} catch (e) {
    console.error("AI Init Error:", e);
}

// --- PERSONA DEFINITIONS ---
const PERSONA = `
You are ApexCore, an advanced AI Tutor designed for a Tech Expo.
TONE: Professional, encouraging, but use LOCAL ANALOGIES to explain complex tech.
GUIDELINES:
1. If explaining speed/latency, use examples like "Traffic in Peshawar" or "Cricket ball speed".
2. If explaining loops/structure, reference "Brick Kiln" or "Textile Loom".
3. Keep English simple and high-impact.
4. NO long paragraphs. Bullet points are best.
`;

// --- FALLBACK DATA ---
const FALLBACK_DATA = {
    journey: (topic) => ({
        topicName: topic || "IT Mastery",
        totalLevels: 10,
        description: `(Offline Mode) A comprehensive training course on ${topic}.`,
        isFallback: true
    }),
    curriculum: () => ({
        chapters: ["Fundamentals", "Tools & Technologies", "Real-world Application", "Expert Mastery"]
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
        ]
    }),
    lesson: (topic) => ({
        lesson: `### System Briefing: ${topic}\n\n**Status:** Offline Backup Protocol Active.\n\nSince the AI connection is currently offline, we are accessing the local reserve archives.\n\n*   **Core Concept:** Mastery of ${topic} requires understanding both the 'How' and the 'Why'.\n*   **Industry Standard:** This skill is highly valued in the global market.\n*   **Objective:** Prove your knowledge to proceed.\n\nProceed to the challenge.`
    })
};

// --- HELPER: Parse JSON Safely ---
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
        try { return JSON.parse(clean); } catch (e2) { return null; }
    }
}

// --- API FUNCTIONS ---

export async function fetchTopics() {
    return [
        { name: "AI & Machine Learning", description: "Master Python, TensorFlow, and PyTorch.", styleClass: "topic-programming" },
        { name: "Cybersecurity", description: "Penetration testing and network defense.", styleClass: "topic-space" },
        { name: "Web Development", description: "Full-stack mastery with React and Node.", styleClass: "topic-arts" },
        { name: "Cloud Computing", description: "AWS, Azure, and Google Cloud architecture.", styleClass: "topic-medicine" },
        { name: "Blockchain", description: "Smart contracts and decentralized apps.", styleClass: "topic-finance" },
        { name: "Game Design", description: "Unity, Unreal Engine, and C# scripting.", styleClass: "topic-philosophy" }
    ];
}

export async function generateJourneyPlan(topic) {
    if (!ai) return FALLBACK_DATA.journey(topic);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze "${topic}". Output JSON: { topicName, totalLevels (10-50), description }`,
            config: {
                responseMimeType: 'application/json',
                systemInstruction: PERSONA,
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
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.journey(topic);
    } catch (error) {
        console.error("Journey Gen Failed:", error);
        return FALLBACK_DATA.journey(topic);
    }
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    if (!ai) return FALLBACK_DATA.curriculum();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Break into 4 chapter titles. JSON: { chapters: [] }`,
            config: {
                responseMimeType: 'application/json',
                systemInstruction: PERSONA
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.curriculum();
    } catch (e) {
        return FALLBACK_DATA.curriculum();
    }
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    if (!ai) return FALLBACK_DATA.questions(topic);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Level ${level}. Generate 3 scenario-based multiple choice questions.`,
            config: {
                responseMimeType: 'application/json',
                systemInstruction: PERSONA,
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
                    },
                    required: ["questions"]
                }
            }
        });
        
        const data = cleanAndParseJSON(response.text);
        if (data && data.questions) return data;
        return FALLBACK_DATA.questions(topic);
    } catch (e) {
        console.error("Question Gen Failed:", e);
        return FALLBACK_DATA.questions(topic);
    }
}

export async function generateLevelLesson({ topic, level, totalLevels }) {
    if (!ai) return FALLBACK_DATA.lesson(topic);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a short, exciting lesson for ${topic} level ${level}. Under 150 words. Use simple analogies.`,
            config: {
                responseMimeType: 'application/json',
                systemInstruction: PERSONA,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lesson: { type: Type.STRING }
                    },
                    required: ["lesson"]
                }
            }
        });
        return cleanAndParseJSON(response.text) || FALLBACK_DATA.lesson(topic);
    } catch (e) {
        return FALLBACK_DATA.lesson(topic);
    }
}

export async function generateHint({ topic, question, options }) {
    if (!ai) return { hint: "Review the key concepts." };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Question: ${question}. Options: ${options.join(', ')}. Give a short hint without revealing the answer.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { hint: { type: Type.STRING } }
                }
            }
        });
        return cleanAndParseJSON(response.text) || { hint: "Think logically about the requirements." };
    } catch (e) {
        return { hint: "Hint unavailable offline." };
    }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    if (!ai) return { explanation: "Offline mode: Unable to analyze specific error." };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Question: ${question}. User chose: ${userChoice} (Wrong). Correct: ${correctChoice}. Explain why the user is wrong and why the correct answer is right.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { explanation: { type: Type.STRING } }
                }
            }
        });
        return cleanAndParseJSON(response.text) || { explanation: "Review the lesson material." };
    } catch (e) {
        return { explanation: "Analysis failed." };
    }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    if (!ai) return { topicName: "Scanned Topic", totalLevels: 10, description: "Image analyzed (Offline)" };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: imageBase64
                    }
                },
                { text: "Analyze this image and suggest a technical learning topic title, total levels (10-30), and description." }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topicName: { type: Type.STRING },
                        totalLevels: { type: Type.INTEGER },
                        description: { type: Type.STRING }
                    }
                }
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (e) {
        return { topicName: "Visual Analysis", totalLevels: 10, description: "Could not analyze image." };
    }
}

export function getAIClient() {
    return ai;
}
