
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { showToast } from './toastService.js';
import * as configService from './configService.js';

// Initialize Gemini API
// Note: process.env.API_KEY must be configured in your build environment or inserted here.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONSTANTS & CONFIG (Ported from server.js) ---
const PERSONA_DEFINITIONS = {
    apex: `Persona: A fusion of a Senior Educator, Cognitive Psychologist, and Lead Game Designer.
           Tone: Professional, encouraging, gamified, and precise.`,
    
    sage: `Persona: A Socratic Philosopher and Wise Mentor.
           Tone: Thoughtful, deep, and inquisitive. 
           Style: Often answer questions with guiding questions to provoke thought. Use metaphors from nature and logic.`,
    
    commander: `Persona: A Futuristic Military Drill Instructor.
           Tone: Intense, direct, strict, and high-energy.
           Style: No fluff. Focus on discipline, 'mission objectives', and 'tactical knowledge'. Call the user 'Recruit' or 'Operative'.`,
    
    eli5: `Persona: A Friendly Science Teacher for kids.
           Tone: Gentle, enthusiastic, and very simple.
           Style: Use many analogies (LEGOs, pizza, cars). Avoid jargon. Explain complex topics in the simplest terms possible.`
};

function getSystemInstruction(personaKey = 'apex') {
    const personaDesc = PERSONA_DEFINITIONS[personaKey] || PERSONA_DEFINITIONS.apex;
    
    return `You are **ApexCore**, the master AI engine for the Skill Apex learning platform.
    ${personaDesc}

    **CORE OPERATING RULES:**
    1. **Instructional Design:** Apply Bloom's Taxonomy. Concepts must spiral from simple definitions to complex application.
    2. **Gamification:** Treat knowledge acquisition as an RPG. Exams are "Boss Battles".
    3. **Visual Learning:** Always support abstract concepts with Mermaid.js diagrams or analogies.
    4. **Format:** Output strictly valid JSON when requested.
    
    **DIFFICULTY CLUSTERS:**
    - **Levels 1-10 (Novice):** Focus on definitions, identification, and basic concepts.
    - **Levels 11-30 (Pro):** Focus on scenarios, application, and "How-to".
    - **Levels 31-45 (Expert):** Focus on analysis, edge cases, and troubleshooting.
    - **Levels 46-50 (Mastery):** Multi-step reasoning, synthesis, and complex challenges.
    `;
}

function getPersona() {
    return configService.getConfig().aiPersona || 'apex';
}

// --- SCHEMAS ---

const journeyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        topicName: { type: Type.STRING, description: "The identified core topic." },
        totalLevels: { type: Type.INTEGER, description: "Ideal total levels (multiple of 10)." },
        description: { type: Type.STRING, description: "A compelling, gamified description." }
    },
    required: ["topicName", "totalLevels", "description"]
};

const curriculumOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        chapters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Chapter titles." }
    },
    required: ["chapters"]
};

const questionsGenerationSchema = {
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
};

const lessonGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        lesson: { type: Type.STRING, description: "Markdown lesson content with Mermaid diagrams." }
    },
    required: ["lesson"]
};

const interactiveChallengeSchema = {
    type: Type.OBJECT,
    properties: {
        challengeType: { type: Type.STRING, enum: ["sequence", "match"] },
        instruction: { type: Type.STRING },
        items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    match: { type: Type.STRING, nullable: true }
                },
                required: ["id", "text"]
            }
        }
    },
    required: ["challengeType", "instruction", "items"]
};

const bossBattleGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "10 challenging questions.",
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
};

const hintGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        hint: { type: Type.STRING, description: "A helpful hint." }
    },
    required: ["hint"]
};

const explanationSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: { type: Type.STRING, description: "Clear explanation." }
    },
    required: ["explanation"]
};

const dailyChallengeSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswerIndex: { type: Type.INTEGER },
        topic: { type: Type.STRING }
    },
    required: ["question", "options", "correctAnswerIndex", "topic"]
};

// --- HELPER: JSON CLEANER ---
function cleanAndParseJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.replace(/```json/g, '').replace(/```/g, '');
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }
        try {
            return JSON.parse(clean);
        } catch (e2) {
            console.error("Failed to parse JSON:", clean);
            throw new Error("AI returned invalid JSON format.");
        }
    }
}

// --- API FUNCTIONS ---

export async function fetchTopics() {
    // In client-side mode, we just return the static JSON or could fetch from a CDN.
    // For now, we simulate the fetch by importing the static file if possible, or fetching from relative path.
    try {
        const response = await fetch('data/topics.json');
        if (!response.ok) throw new Error('Failed to load topics');
        return await response.json();
    } catch (error) {
        showToast('Error loading topics.', 'error');
        throw error;
    }
}

export async function generateJourneyPlan(topic) {
    const persona = getPersona();
    const prompt = `Analyze the topic "${topic}".
    Task: Determine the ideal number of levels to create a comprehensive learning journey that takes a user from a complete novice to an expert.
    RULES:
    1. The total number of levels must be a multiple of 10.
    2. Write a new, exciting one-sentence description for this learning journey.
    3. Set "topicName" to the cleaned up version of "${topic}".
    Return your response in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate journey plan.');
    }
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    const persona = getPersona();
    const prompt = `Analyze this image. Identify the educational concept, diagram, code snippet, or historical event shown.
    1. Identify the core "Topic Name".
    2. Create a comprehensive learning journey plan for this specific topic.
    3. Determine the ideal number of levels (multiple of 10).
    4. Write a compelling description based on the image content.
    Return the response in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: imageBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: journeyPlanSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to analyze image.');
    }
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    const persona = getPersona();
    const numChapters = Math.ceil(totalLevels / 50);
    const prompt = `A learning journey for the topic "${topic}" has been scoped to ${totalLevels} levels.
    Task: Break this journey down into exactly ${numChapters} logical chapters.
    RULES:
    1. Provide an array of exactly ${numChapters} chapter titles.
    2. Each title should be concise and descriptive.
    Return the list of chapter titles in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: curriculumOutlineSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate curriculum.');
    }
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    const persona = getPersona();
    let complexityInstruction = "";
    if (level <= 10) complexityInstruction = "**NOVICE MODE:** Focus on definitions and basic concepts.";
    else if (level <= 30) complexityInstruction = "**PRO MODE:** Focus on scenarios and practical application.";
    else if (level <= 45) complexityInstruction = "**EXPERT MODE:** Focus on analysis and edge cases.";
    else complexityInstruction = "**MASTERY MODE:** High-difficulty, multi-step reasoning.";

    const prompt = `Create a quiz for a student learning "${topic}".
    Current Level: ${level} / ${totalLevels}.
    ${complexityInstruction}
    TASK: Generate exactly 6 multiple-choice questions for this specific level.
    RULES:
    1. Questions must match the requested difficulty.
    2. Distractors must be plausible misconceptions.
    3. Provide a brief explanation for the correct answer.
    Generate the JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: questionsGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate questions.');
    }
}

export async function generateInteractiveLevel({ topic, level }) {
    const persona = getPersona();
    const prompt = `Create an interactive challenge for the topic "${topic}" at Level ${level}.
    TASK: Create either a "Sequence" challenge (ordering items) OR a "Match" challenge (pairing items).
    RULES:
    - Sequence: 4-5 items in CORRECT order.
    - Match: 4 pairs of terms/definitions.
    Return the JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: interactiveChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate interactive challenge.');
    }
}

export async function generateLevelLesson({ topic, level, totalLevels, questions, signal }) {
    const persona = getPersona();
    let contextInstruction = `CONTEXT: Design a lesson for Level ${level} of the topic "${topic}".`;
    if (questions) {
        contextInstruction += ` The student has questions covering: ${JSON.stringify(questions)}. Ensure the lesson covers these.`;
    }

    const prompt = `You are teaching a masterclass on "${topic}" (Level ${level}).
    ${contextInstruction}
    YOUR GOAL: Write a high-impact, "Presentation Style" lesson.
    RULES:
    1. **NO WALLS OF TEXT.**
    2. **Tone:** Conversational, high-energy.
    3. **Visualization:** You MUST include a Mermaid.js diagram (start with \`\`\`mermaid) to visualize the concept.
    Generate the JSON response.`;

    try {
        // Note: SDK does not support AbortSignal natively in generateContent yet in all versions, 
        // but we can respect it before calling.
        if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: lessonGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        if (signal && signal.aborted) throw error;
        console.error('API Error:', error);
        throw new Error('Failed to generate lesson.');
    }
}

export async function generateBossBattle({ topic, chapter }) {
    const persona = getPersona();
    const prompt = `Create a "Boss Battle" exam for a learning game about "${topic}". This is a cumulative test for Chapter ${chapter}.
    RULES:
    1. Generate exactly 10 challenging multiple-choice questions.
    2. **Scenario Mode:** Use complex "Real World" scenarios.
    3. Difficulty: Very Hard.
    Generate the 10 questions based on these rules and the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: bossBattleGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate boss battle.');
    }
}

export async function generateHint({ topic, question, options }) {
    const persona = getPersona();
    const optionsString = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n');
    const prompt = `Provide a hint for this quiz question.
    Topic: "${topic}"
    Question: "${question}"
    Options:
    ${optionsString}
    RULES:
    1. Generate a single, short, helpful hint.
    2. DO NOT reveal the correct answer directly.
    Return the hint in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: hintGenerationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate hint.');
    }
}

export async function generateSpeech(text) {
    if (!text || text.trim().length === 0) throw new Error("Text cannot be empty.");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("AI did not return audio data.");
        return { audioContent: base64Audio };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate speech.');
    }
}

export async function explainConcept(topic, concept, context) {
    const persona = getPersona();
    const prompt = `Topic: ${topic}
    Context: ${context}
    The student is asking about: "${concept}"
    RULES:
    1. Explain this specific concept clearly and concisely (max 3 sentences).
    2. Use a simple analogy if possible.
    Return the explanation in the provided JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to explain concept.');
    }
}

export async function fetchDailyChallenge() {
    const persona = getPersona();
    const categories = ["Science", "Technology", "History", "Space", "Coding", "Biology"];
    const topic = categories[Math.floor(Math.random() * categories.length)];
    
    const prompt = `Generate one single, interesting trivia question about "${topic}".
    Difficulty: Medium.
    Format: JSON with question, options (4), correctAnswerIndex, and topic.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: dailyChallengeSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to generate daily challenge.');
    }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    const persona = getPersona();
    const prompt = `The user answered a question about "${topic}" incorrectly.
    Question: "${question}"
    User Chose: "${userChoice}" (Incorrect)
    Correct Answer: "${correctChoice}"
    Task: Explain WHY the user's choice is a common misconception or why it is wrong.
    Return JSON with 'explanation'.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: getSystemInstruction(persona),
                responseMimeType: 'application/json',
                responseSchema: explanationSchema,
            }
        });
        return cleanAndParseJSON(response.text);
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to explain error.');
    }
}
