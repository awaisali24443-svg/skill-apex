export async function generateQuiz(topic, numQuestions, difficulty = 'Medium') {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic,
                numQuestions,
                difficulty,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            // If the server sent back an error object, use its message
            throw new Error(data.error || 'An error occurred while generating the quiz.');
        }

        // Validate the received data structure
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
        // Re-throw the error so the calling module (loading.js) can catch it
        throw error;
    }
}
