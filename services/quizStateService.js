let quizState = null;

const defaultState = {
    questions: [],
    topic: 'Unknown Topic',
    userAnswers: [],
    currentIndex: 0,
    score: 0,
    startTime: null,
    endTime: null,
};

/**
 * Initializes a new quiz session, replacing any existing state.
 * @param {object} quizData - The quiz data object received from the API.
 * @param {Array<object>} quizData.questions - The array of question objects.
 * @param {string} [quizData.topic] - The topic of the quiz.
 * @param {string} [quizData.learningPathId] - Optional ID if the quiz is part of a learning path.
 * @param {number} [quizData.learningPathStepIndex] - Optional index if the quiz is part of a learning path.
 */
export function startQuiz(quizData) {
    quizState = {
        ...defaultState,
        questions: quizData.questions,
        topic: quizData.topic,
        userAnswers: new Array(quizData.questions.length).fill(null),
        startTime: Date.now(),
    };
    // If a learning path is in context, store its ID with the quiz state
    if(quizData.learningPathId) {
        quizState.learningPathId = quizData.learningPathId;
    }
    // Store step index if provided
    if(quizData.learningPathStepIndex !== undefined) {
        quizState.learningPathStepIndex = quizData.learningPathStepIndex;
    }
}

/**
 * Retrieves the current state of the active quiz.
 * @returns {object|null} The current quiz state object, or null if no quiz is active.
 */
export function getQuizState() {
    return quizState;
}

/**
 * Gets the question object for the current index.
 * @returns {object|null} The current question object, or null if the quiz is over or inactive.
 */
export function getCurrentQuestion() {
    if (!quizState || quizState.currentIndex >= quizState.questions.length) {
        return null;
    }
    return quizState.questions[quizState.currentIndex];
}

/**
 * Records the user's answer for the current question and updates the score.
 * @param {number} answerIndex - The 0-based index of the user's selected option.
 * @returns {boolean} True if the answer was correct, false otherwise.
 */
export function answerQuestion(answerIndex) {
    if (!quizState) return false;

    const currentQuestion = getCurrentQuestion();
    // Add a guard clause to prevent crash if question is not found
    if (!currentQuestion) {
        console.error("Attempted to answer a question that could not be found in the current state.");
        return false;
    }
    
    const isCorrect = currentQuestion.correctAnswerIndex === answerIndex;

    quizState.userAnswers[quizState.currentIndex] = answerIndex;
    if (isCorrect) {
        quizState.score++;
    }
    return isCorrect;
}

/**
 * Advances the quiz to the next question.
 * @returns {boolean} True if there are more questions, false if the quiz is finished.
 */
export function nextQuestion() {
    if (!quizState) return false;

    if (quizState.currentIndex < quizState.questions.length - 1) {
        quizState.currentIndex++;
        return true; // More questions available
    } else {
        quizState.endTime = Date.now();
        return false; // Quiz finished
    }
}

/**
 * Clears the active quiz state.
 * Should be called when the user finishes reviewing results and leaves the quiz flow.
 */
export function endQuiz() {
    quizState = null;
}