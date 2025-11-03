import { GoogleGenAI, Type } from "@google/genai";
import { NUM_QUESTIONS } from '../constants.js';
import type { QuizData } from '../types.js';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set. Ensure config.js is loaded.");
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
          description: 'An array of 4 possible answers.'
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


export const generateQuiz = async (topic: string): Promise<QuizData> => {
    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". Each question should have 4 options. Provide a brief explanation for each correct answer.`;
    
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
        const quizData = JSON.parse(jsonText) as QuizData;

        if (!Array.isArray(quizData) || quizData.length === 0) {
            throw new Error("Invalid quiz data format received from API.");
        }

        return quizData;

    } catch (error) {
        console.error("Error generating quiz with Gemini:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The API key is invalid. Please check your configuration.");
        }
        throw new Error("Failed to generate quiz. The topic might be too specific or there was a network issue. Please try again.");
    }
};
