import { GoogleGenAI, Type } from "@google/genai";

if (!window.process?.env?.API_KEY) {
    throw new Error("API_KEY environment variable is not set. Ensure config.js is loaded.");
}

const ai = new GoogleGenAI({ apiKey: window.process.env.API_KEY });

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
        },
        aiInsight: {
            type: Type.STRING,
            description: 'Optional. If the user got this question wrong before, provide a helpful insight into the likely misconception. e.g., "It seems you might be confusing X with Y..."'
        }
      },
      required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
    }
};

/**
 * A generic content generation function to reduce code duplication.
 * @param {string} prompt - The full prompt.
 * @param {object} config - The configuration object for generateContent.
 * @returns {Promise<any>} - The parsed response from the API.
 */
async function generateContent(prompt, config) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: config,
        });

        const textContent = response.text?.trim();
        if (!textContent) {
            throw new Error("Invalid (empty) data received from API.");
        }

        if (config.responseMimeType === "application/json") {
            const jsonData = JSON.parse(textContent);
            if (config.responseSchema.type === Type.ARRAY && (!Array.isArray(jsonData) || jsonData.length === 0)) {
                throw new Error("Invalid quiz data format received from API.");
            }
            return jsonData;
        }

        return textContent;

    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("The API key is invalid. Please check your configuration.");
        }
        throw new Error("Failed to generate content. The topic might be too specific or there was a network issue. Please try again.");
    }
}


export const generateQuiz = async (prompt, systemInstruction, performanceHistory = null) => {
    if (performanceHistory && performanceHistory.recentCorrectPercentage > -1) {
        let difficultyHint = '';
        if (performanceHistory.recentCorrectPercentage > 80) {
            difficultyHint = "The user is excelling; increase the difficulty slightly.";
        } else if (performanceHistory.recentCorrectPercentage < 40) {
            difficultyHint = "The user is struggling; decrease the difficulty slightly.";
        }
        prompt = `${prompt} ${difficultyHint}`;
    }

    const config = {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        systemInstruction: systemInstruction || "You are a helpful and engaging quiz creator."
    };

    return generateContent(prompt, config);
};

export const generateStudyGuide = async (prompt, systemInstruction) => {
    const config = {
        systemInstruction: systemInstruction || "You are a helpful and concise study guide creator."
    };
    return generateContent(prompt, config);
};

/**
 * Generates a targeted "Nemesis Quiz" based on user's weak spots.
 * @param {string} topicName - The name of the topic for the quiz.
 * @param {string} missedConcepts - A comma-separated string of concepts the user struggles with.
 * @returns {Promise<string>} - A promise that resolves to the full generation prompt.
 */
export const generateNemesisQuiz = (topicName, missedConcepts) => {
    return `Generate a challenging 5-question multiple-choice quiz about "${topicName}". This is a "Nemesis Quiz" designed to target the user's weak spots. Focus specifically on the following concepts they have struggled with: ${missedConcepts}. The questions should test their understanding of these specific areas.`;
};