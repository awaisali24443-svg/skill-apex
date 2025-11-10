import { Type } from '@google/genai';

export async function generateQuiz(topic, numQuestions, difficulty = 'Medium') {
    const prompt = `Generate a quiz with ${numQuestions} multiple-choice questions about "${topic}". The difficulty should be ${difficulty}. For each question, provide 4 options, the index of the correct answer, and a brief explanation for why it's correct.`;
    
    // Using the official Type enum is more robust
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

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred.' }));
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        const data = await response.json();
        const parsedData = JSON.parse(data.text);

        // Basic validation of the returned data
        if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
            throw new Error("AI returned invalid or empty quiz data.");
        }

        return parsedData;

    } catch (error) {
        console.error("Error in generateQuiz service:", error);
        // Re-throw the error so the calling module can handle it (e.g., show a message to the user)
        throw error;
    }
}
