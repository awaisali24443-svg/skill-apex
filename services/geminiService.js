// services/geminiService.js
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";

// Initialize the Gemini client directly in the frontend.
// The API_KEY is expected to be available in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const modelConfig = {
    model: "gemini-2.5-flash",
    config: { safetySettings }
};

/**
 * Generates a quiz by calling the Gemini API directly.
 * @param {string} prompt - The prompt detailing the quiz requirements.
 * @returns {Promise<Array<object>>} A promise that resolves to the quiz data.
 */
export async function generateQuiz(prompt) {
    try {
        const schema = {
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
        
        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
            config: {
                ...modelConfig.config,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        const quizData = JSON.parse(response.text).questions;

        // --- Robust Validation ---
        if (!Array.isArray(quizData) || quizData.length === 0) {
            throw new Error("Generated quiz data is not a valid array.");
        }
        const isValid = quizData.every(q => 
            q && typeof q.question === 'string' && Array.isArray(q.options) &&
            q.options.length > 1 && typeof q.correctAnswerIndex === 'number' &&
            q.correctAnswerIndex >= 0 && q.correctAnswerIndex < q.options.length &&
            typeof q.explanation === 'string'
        );
        if (!isValid) {
            console.error("Malformed quiz data received:", quizData);
            throw new Error("Received malformed quiz data from the AI.");
        }
        return quizData;

    } catch (error) {
        console.error("Gemini API Error in generateQuiz:", error);
        if (error.message && error.message.includes('SAFETY')) {
            throw new Error("Request blocked. The topic may be restricted due to safety policies.");
        }
        throw new Error("Failed to generate quiz. The AI might be busy or the topic is restricted. Please try again later.");
    }
}

/**
 * Generates a study guide as a stream of text chunks.
 * @param {string} prompt - The prompt for the study guide.
 * @returns {AsyncGenerator<string, void, unknown>} An async generator that yields text chunks.
 */
export async function* generateStudyGuideStream(prompt) {
    try {
        const responseStream = await ai.models.generateContentStream({
            ...modelConfig,
            contents: prompt
        });

        for await (const chunk of responseStream) {
            yield chunk.text;
        }
    } catch (error) {
        console.error("Gemini API Error in generateStudyGuideStream:", error);
        if (error.message && error.message.includes('SAFETY')) {
            throw new Error("Request blocked due to safety policies.");
        }
        throw new Error("Failed to generate study guide stream.");
    }
}


/**
 * Generates flashcards from the content of a study guide.
 * @param {string} guideContent - The text content of the study guide.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of flashcard objects.
 */
export async function generateFlashcardsFromGuide(guideContent) {
    try {
        const schema = {
            type: Type.OBJECT,
            properties: {
                flashcards: {
                     type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            front: { type: Type.STRING },
                            back: { type: Type.STRING }
                        },
                        required: ["front", "back"]
                    }
                }
            },
            required: ["flashcards"]
        };
        const prompt = `Based on the following study guide content, generate a concise set of flashcards. Each flashcard should have a 'front' (a question or term) and a 'back' (the answer or definition):\n\n${guideContent}`;

        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
            config: {
                ...modelConfig.config,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        const flashcards = JSON.parse(response.text).flashcards;
        if (!Array.isArray(flashcards)) {
            throw new Error("Generated flashcard data is not a valid array.");
        }
        return flashcards;
    } catch (error) {
        console.error("Gemini API Error in generateFlashcardsFromGuide:", error);
        throw new Error("Failed to generate flashcards. The guide might be too short or complex.");
    }
}

/**
 * Generates a structured learning path based on a user's goal.
 * @param {string} goal - The user's learning objective.
 * @returns {Promise<object>} A promise that resolves to the learning path data.
 */
export async function generateLearningPath(goal) {
     try {
        const schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                steps: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["title", "description"]
                    }
                }
            },
            required: ["title", "steps"]
        };
        const prompt = `Create a structured learning path for the goal: "${goal}". The path should have a main 'title' and a series of 'steps', where each step has its own 'title' and a brief 'description'.`;

        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
            config: {
                ...modelConfig.config,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const pathData = JSON.parse(response.text);
        if (!pathData.title || !Array.isArray(pathData.steps) || pathData.steps.length === 0) {
            throw new Error("Invalid learning path format received from AI.");
        }
        return pathData;
    } catch (error) {
        console.error("Gemini API Error in generateLearningPath:", error);
        throw new Error("Failed to generate a learning path. The AI might be busy or the topic is too complex. Please try a different goal.");
    }
}

/**
 * Creates a prompt for a "Nemesis Quiz" based on user's missed concepts.
 * @param {string} topicName - The name of the topic.
 * @param {string} missedConcepts - A comma-separated string of concepts the user struggled with.
 * @returns {string} The generated prompt string.
 */
export function generateNemesisQuiz(topicName, missedConcepts) {
    return `Generate a targeted quiz with 5 multiple-choice questions about "${topicName}". Focus specifically on these tricky concepts that the user has struggled with before: ${missedConcepts}. The questions should test understanding of these specific areas to help the user improve.`;
}