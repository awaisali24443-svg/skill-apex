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

const handleApiError = (error) => {
    console.error("Error generating content with Gemini:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
         throw new Error("The API key is invalid. Please check your configuration.");
    }
    throw new Error("Failed to generate content. The topic might be too specific or there was a network issue. Please try again.");
};

const aiCoachSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        message: { type: Type.STRING },
        action: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, description: "Either 'quiz' or 'study'" },
                label: { type: Type.STRING, description: "The text for the action button, e.g., 'Take a Refresher Quiz'" },
                topic: { type: Type.STRING, description: "The topic for the action" }
            },
            required: ['type', 'label', 'topic']
        }
    },
    required: ['title', 'message', 'action']
};

export const generateAICoachSuggestion = async (topicName, username) => {
    const prompt = `As an AI Coach for a quiz app, the user '${username}' is struggling with the topic "${topicName}". Generate a short, encouraging message for their dashboard. Suggest a specific action: either a refresher quiz or a study session on this topic. Provide a title, a message, and the action details in the requested JSON format.`;
    const systemInstruction = `You are a friendly, encouraging AI Coach. Your goal is to help users improve without making them feel discouraged. Keep your message concise and positive.`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: aiCoachSchema,
                systemInstruction: systemInstruction,
            },
        });

        try {
            return JSON.parse(response.text.trim());
        } catch (parseError) {
             console.error("Failed to parse AI Coach JSON response:", response.text, parseError);
            throw new Error("The AI Coach returned an invalid response.");
        }
    } catch (error) {
        handleApiError(error);
    }
};

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

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
                systemInstruction: systemInstruction || "You are a helpful and engaging quiz creator."
            },
        });

        let jsonData;
        try {
            jsonData = JSON.parse(response.text.trim());
        } catch (parseError) {
            console.error("Failed to parse JSON response from Gemini:", response.text, parseError);
            throw new Error("The AI returned an invalid response. Please try again.");
        }
        
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            throw new Error("Invalid quiz data format received from API.");
        }
        return jsonData;

    } catch (error) {
        handleApiError(error);
    }
};

export const generateStudyGuide = async (prompt, systemInstruction) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction || "You are a helpful and concise study guide creator."
            },
        });
        const textContent = response.text?.trim();
        if (!textContent) {
            throw new Error("Invalid (empty) data received from API.");
        }
        return textContent;
    } catch (error) {
        handleApiError(error);
    }
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

/**
 * Generates personalized feedback from an AI Coach.
 * @param {string} prompt - The prompt containing the user's quiz results.
 * @returns {Promise<string>} - A promise that resolves to the AI coach's feedback.
 */
export const generateAICoachInsight = async (prompt) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are a friendly and encouraging AI Coach for the 'Knowledge Tester' quiz app. Your goal is to provide a brief, positive, and insightful summary of the user's performance. Highlight one area they did well in and one concept they might want to review, based on the questions they got wrong. Keep it concise (2-3 sentences) and use a supportive tone. Do not use markdown."
            },
        });
        const textContent = response.text?.trim();
        if (!textContent) {
            throw new Error("Invalid (empty) data received from API.");
        }
        return textContent;
    } catch (error) {
        handleApiError(error);
    }
};