// services/geminiService.js

// This file has been refactored to communicate with the application's backend server,
// which now securely handles all interactions with the Gemini API.

async function handleApiResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred.' }));
        console.error("Backend API Error:", errorData);
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response.json();
}

/**
 * Generates a quiz by calling the backend API.
 * @param {string} prompt - The prompt detailing the quiz requirements.
 * @returns {Promise<Array<object>>} A promise that resolves to the quiz data.
 */
export async function generateQuiz(prompt) {
    try {
        const schema = {
            type: "OBJECT",
            properties: {
               questions: {
                   type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            question: { type: "STRING" },
                            options: { type: "ARRAY", items: { type: "STRING" } },
                            correctAnswerIndex: { type: "INTEGER" },
                            explanation: { type: "STRING" }
                        },
                        required: ["question", "options", "correctAnswerIndex", "explanation"]
                    }
               }
            },
            required: ["questions"]
        };
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema })
        });
        
        const data = await handleApiResponse(response);
        const quizData = JSON.parse(data.text).questions;

        // --- Client-side validation ---
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
            throw new Error("Received malformed quiz data from the server.");
        }
        return quizData;

    } catch (error) {
        console.error("Frontend Error in generateQuiz:", error);
        if (error.message && error.message.includes('SAFETY')) { // Passthrough safety message
             throw new Error("Request blocked. The topic may be restricted due to safety policies.");
        }
        throw new Error(error.message || "Failed to generate quiz. The server might be busy. Please try again later.");
    }
}

/**
 * Generates a study guide by fetching a stream from the backend.
 * @param {string} prompt - The prompt for the study guide.
 * @returns {AsyncGenerator<string, void, unknown>} An async generator that yields text chunks.
 */
export async function* generateStudyGuideStream(prompt) {
    try {
        const response = await fetch('/api/generate-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok || !response.body) {
            const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred.' }));
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield decoder.decode(value, { stream: true });
        }
    } catch (error) {
        console.error("Frontend Error in generateStudyGuideStream:", error);
        throw new Error(error.message || "Failed to generate study guide stream.");
    }
}


/**
 * Generates flashcards from the content of a study guide by calling the backend.
 * @param {string} guideContent - The text content of the study guide.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of flashcard objects.
 */
export async function generateFlashcardsFromGuide(guideContent) {
    try {
        const schema = {
            type: "OBJECT",
            properties: {
                flashcards: {
                     type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            front: { type: "STRING" },
                            back: { type: "STRING" }
                        },
                        required: ["front", "back"]
                    }
                }
            },
            required: ["flashcards"]
        };
        const prompt = `Based on the following study guide content, generate a concise set of flashcards. Each flashcard should have a 'front' (a question or term) and a 'back' (the answer or definition):\n\n${guideContent}`;

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema })
        });
        
        const data = await handleApiResponse(response);
        const flashcards = JSON.parse(data.text).flashcards;
        if (!Array.isArray(flashcards)) {
            throw new Error("Generated flashcard data is not a valid array.");
        }
        return flashcards;
    } catch (error) {
        console.error("Frontend Error in generateFlashcardsFromGuide:", error);
        throw new Error(error.message || "Failed to generate flashcards. The guide might be too short or complex.");
    }
}

/**
 * Generates a structured learning path based on a user's goal by calling the backend.
 * @param {string} goal - The user's learning objective.
 * @returns {Promise<object>} A promise that resolves to the learning path data.
 */
export async function generateLearningPath(goal) {
     try {
        const schema = {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                steps: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            description: { type: "STRING" }
                        },
                        required: ["title", "description"]
                    }
                }
            },
            required: ["title", "steps"]
        };
        const prompt = `Create a structured learning path for the goal: "${goal}". The path should have a main 'title' and a series of 'steps', where each step has its own 'title' and a brief 'description'.`;

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema })
        });

        const data = await handleApiResponse(response);
        const pathData = JSON.parse(data.text);
        if (!pathData.title || !Array.isArray(pathData.steps) || pathData.steps.length === 0) {
            throw new Error("Invalid learning path format received from server.");
        }
        return pathData;
    } catch (error) {
        console.error("Frontend Error in generateLearningPath:", error);
        throw new Error(error.message || "Failed to generate a learning path. The server might be busy or the topic is too complex. Please try a different goal.");
    }
}

/**
 * Creates a prompt for a "Nemesis Quiz" based on user's missed concepts.
 * This is a prompt generator, so it stays on the client side. No changes needed.
 * @param {string} topicName - The name of the topic.
 * @param {string} missedConcepts - A comma-separated string of concepts the user struggled with.
 * @returns {string} The generated prompt string.
 */
export function generateNemesisQuiz(topicName, missedConcepts) {
    return `Generate a targeted quiz with 5 multiple-choice questions about "${topicName}". Focus specifically on these tricky concepts that the user has struggled with before: ${missedConcepts}. The questions should test understanding of these specific areas to help the user improve.`;
}