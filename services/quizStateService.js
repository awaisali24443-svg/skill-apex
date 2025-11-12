let quizState = null;

const defaultState = {
    questions: [],
    userAnswers: [],
    currentIndex: 0,
    score: 0,
    startTime: null,
    endTime: null,
};

export function startQuiz(quizData) {
    quizState = {
        ...defaultState,
        questions: quizData.questions,
        userAnswers: new Array(quizData.questions.length).fill(null),
        startTime: Date.now(),
    };
    // If a learning path is in context, store it
    if(quizData.learningPathId) {
        quizState.learningPathId = quizData.learningPathId;
    }
}

export function getQuizState() {
    return quizState;
}

export function getCurrentQuestion() {
    if (!quizState || quizState.currentIndex >= quizState.questions.length) {
        return null;
    }
    return quizState.questions[quizState.currentIndex];
}

export function answerQuestion(answerIndex) {
    if (!quizState) return;

    const currentQuestion = getCurrentQuestion();
    const isCorrect = currentQuestion.correctAnswerIndex === answerIndex;

    quizState.userAnswers[quizState.currentIndex] = answerIndex;
    if (isCorrect) {
        quizState.score++;
    }
    return isCorrect;
}

export function nextQuestion() {
    if (!quizState) return;

    if (quizState.currentIndex < quizState.questions.length - 1) {
        quizState.currentIndex++;
        return true; // More questions available
    } else {
        quizState.endTime = Date.now();
        return false; // Quiz finished
    }
}

export function endQuiz() {
    quizState = null;
}
