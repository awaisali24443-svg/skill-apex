import { GoogleGenAI, Type } from "@google/genai";

/**
 * Creates a new GoogleGenAI instance.
 * Per official guidelines, a new instance should be created before each API call
 * to ensure the most up-to-date API key is used.
 */
const getAI = () => new GoogleGenAI({ apiKey: window.process.env.API_KEY });

const quizSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: {
                type: Type.STRING,
                description: 'The quiz question.'
            },
            options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of exactly 4 possible answers.'
            },
            correctAnswerIndex: {
                type: Type.INTEGER,
                description: 'The 0-based index of the correct answer in the options array.'
            },
            explanation: {
                type: Type.STRING,
                description: 'A brief explanation for why the correct answer is right and the others are wrong.'
            }
        },
        required: ['question', 'options', 'correctAnswerIndex', 'explanation']
    }
};

const flashcardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            term: {
                type: Type.STRING,
                description: 'The key term or concept for the front of the flashcard.'
            },
            definition: {
                type: Type.STRING,
                description: 'The definition or explanation for the back of the flashcard.'
            }
        },
        required: ['term', 'definition']
    }
};

const learningPathSchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: 'A concise and engaging title for the learning path based on the user\'s goal.'
        },
        steps: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'The title of this specific learning step.' },
                    description: { type: Type.STRING, description: 'A brief, one-sentence description of what this step covers.' }
                },
                required: ['title', 'description']
            },
            description: 'An array of 5 to 7 learning steps, starting from the basics and progressing logically.'
        }
    },
    required: ['title', 'steps']
};


/**
 * Generates a quiz based on a given prompt using the Gemini API.
 * @param {string} prompt - The prompt detailing the quiz requirements.
 * @returns {Promise<Array<object>>} A promise that resolves to the quiz data.
 */
export async function generateQuiz(prompt) {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
                temperature: 0.7,
                topP: 1,
                topK: 32,
            },
        });

        const jsonText = response.text.trim();
        const quizData = JSON.parse(jsonText);

        if (!Array.isArray(quizData) || quizData.length === 0) {
            throw new Error("Generated quiz data is not a valid array.");
        }
        quizData.forEach(q => {
            if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctAnswerIndex !== 'number' || !q.explanation) {
                throw new Error("Invalid question format in the generated quiz data.");
            }
        });

        return quizData;

    } catch (error) {
        console.error("Error generating quiz with Gemini:", error);
        if (error.message.includes("JSON") || error.message.includes("format")) {
            throw new Error("The AI returned an invalid format. This can happen with complex topics. Please try again.");
        }
        throw new Error("Failed to generate quiz. The AI might be busy or the topic is restricted. Please try again later.");
    }
}

/**
 * Generates a study guide as a stream of text chunks.
 * @param {string} prompt - The prompt for the study guide.
 * @returns {AsyncGenerator<string, void, unknown>} An async generator that yields text chunks.
 */
export async function generateStudyGuideStream(prompt) {
    const ai = getAI();
    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.5,
                topP: 1,
                topK: 32,
            }
        });
        
        async function* streamGenerator() {
            for await (const chunk of responseStream) {
                yield chunk.text;
            }
        }

        return streamGenerator();

    } catch (error) {
        console.error("Error generating study guide stream with Gemini:", error);
        throw new Error("Failed to generate study guide. Please try again.");
    }
}

/**
 * Generates flashcards from the content of a study guide.
 * @param {string} guideContent - The text content of the study guide.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of flashcard objects.
 */
export async function generateFlashcardsFromGuide(guideContent) {
    const ai = getAI();
    const prompt = `Based on the following study guide, generate a set of 5-10 key flashcards (term and definition) that cover the most important concepts.

Study Guide:
---
${guideContent}
---

Generate the flashcards in the required JSON format.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: flashcardSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const flashcards = JSON.parse(jsonText);
        
        if (!Array.isArray(flashcards)) {
            throw new Error("Generated flashcard data is not a valid array.");
        }
        return flashcards;

    } catch (error) {
        console.error("Error generating flashcards with Gemini:", error);
        throw new Error("Failed to generate flashcards. The guide might be too short or complex.");
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

/**
 * Generates a structured learning path based on a user's goal.
 * @param {string} goal - The user's learning objective.
 * @returns {Promise<object>} A promise that resolves to the learning path data.
 */
export async function generateLearningPath(goal) {
    const ai = getAI();
    const prompt = `A user wants to achieve the following goal: "${goal}". Generate a structured learning path with 5-7 logical steps to help them achieve this. Each step should have a clear title and a short description. The path should start with fundamental concepts and progressively build up to more advanced topics.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: learningPathSchema,
            },
        });
        const jsonText = response.text.trim();
        const pathData = JSON.parse(jsonText);
        if (!pathData.title || !Array.isArray(pathData.steps) || pathData.steps.length === 0) {
            throw new Error("Invalid learning path format received from AI.");
        }
        return pathData;
    } catch (error) {
        console.error("Error generating learning path with Gemini:", error);
        throw new Error("Failed to generate a learning path. The AI might be busy or the topic is too complex. Please try a different goal.");
    }
}
