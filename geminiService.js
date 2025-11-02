import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const quizSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: {
          type: Type.STRING,
          description: 'The quiz question text.'
        },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: 'An array of exactly 4 possible answers.'
        },
        correctAnswerIndex: {
          type: Type.INTEGER,
          description: 'The 0-based index of the correct answer in the options array.'
        },
        explanation: {
            type: Type.STRING,
            description: 'A brief explanation of why the correct answer is right.'
        }
      },
      required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
    }
};

/**
 * Generates a quiz on a given topic using the Gemini API.
 * @param {string} topic - The topic for the quiz.
 * @param {number} numQuestions - The number of questions to generate.
 * @returns {Promise<Array<object>>} - A promise that resolves to the quiz data.
 */
export const generateQuiz = async (topic, numQuestions) => {
    const prompt = `Generate a fun and challenging quiz with ${numQuestions} multiple-choice questions about "${topic}". Each question must have exactly 4 options. Provide a brief explanation for each correct answer.`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: quizSchema,
            },
        });

        const jsonText = response.text.trim();
        const quizData = JSON.parse(jsonText);

        if (!Array.isArray(quizData) || quizData.length === 0) {
            throw new Error("Invalid quiz data format received from API.");
        }

        return quizData;

    } catch (error) {
        console.error("Error generating quiz with Gemini:", error);
        throw new Error("Failed to generate quiz. The topic might be too specific or there was a network issue. Please try again.");
    }
};