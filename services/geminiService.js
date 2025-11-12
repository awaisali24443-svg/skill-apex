export async function generateQuiz(topic, topicId, numQuestions, difficulty = 'Medium') {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic,
                topicId,
                numQuestions,
                difficulty,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred while generating the quiz.');
        }

        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error("Received invalid or empty quiz data from the server.");
        }
        
        for(const q of data.questions) {
            if(!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correctAnswerIndex !== 'number' || !q.explanation) {
                 throw new Error("Server returned a malformed question object.");
            }
        }

        return data;
    } catch (error) {
        console.error("Error in generateQuiz service:", error);
        throw error;
    }
}

export async function generateLearningPath(goal) {
    try {
        const response = await fetch('/api/generate-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate learning path.');
        }
        
        if (!data.path || !Array.isArray(data.path)) {
            throw new Error("Received invalid path data from the server.");
        }

        return data;
    } catch (error) {
        console.error("Error in generateLearningPath service:", error);
        throw error;
    }
}
