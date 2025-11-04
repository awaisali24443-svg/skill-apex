import * as quizState from '../../services/quizStateService.js';
import { playSound } from '../../services/soundService.js';

let quizData = null;
let userAnswers = [];
let currentQuestionIndex = 0;
let quizContext = {};

const quizContainer = document.getElementById('quiz-container');

async function renderQuiz() {
    if (!quizData || !quizData[currentQuestionIndex]) {
        handleError("Quiz data is missing or invalid.");
        return;
    }

    const question = quizData[currentQuestionIndex];
    const optionsHtml = question.options.map((option, index) => `
        <button data-option-index="${index}" class="quiz-option">
            ${option}
        </button>
    `).join('');

    const newContent = document.createElement('div');
    newContent.id = 'quiz-content-wrapper';
    newContent.innerHTML = `
        <div class="progress-bar">
            <div class="progress-bar-inner" style="width: ${((currentQuestionIndex + 1) / quizData.length) * 100}%"></div>
        </div>
        <div class="question-header">
            <span>Question ${currentQuestionIndex + 1} / ${quizData.length}</span>
            <span>${quizContext.topicName || ''} ${quizContext.isLeveled === false ? '' : `- Level ${quizContext.level || ''}`}</span>
        </div>
        <h2 class="question-text">${question.question}</h2>
        <div class="options-grid">${optionsHtml}</div>
        <div id="quiz-feedback"></div>
    `;
    
    // Animate transition
    const oldContent = quizContainer.querySelector('#quiz-content-wrapper');
    if (oldContent) {
        oldContent.classList.add('exiting');
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    quizContainer.innerHTML = '';
    quizContainer.appendChild(newContent);

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.addEventListener('click', handleAnswerSelect);
    });
}

function handleAnswerSelect(e) {
    const selectedButton = e.currentTarget;
    const selectedAnswerIndex = parseInt(selectedButton.dataset.optionIndex, 10);
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = quizData[currentQuestionIndex];
    const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;
    playSound(isCorrect ? 'correct' : 'incorrect');

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.disabled = true;
        const index = parseInt(button.dataset.optionIndex, 10);
        if (index === question.correctAnswerIndex) {
            button.classList.add('correct');
        } else if (index === selectedAnswerIndex) {
            button.classList.add('incorrect');
        } else {
            button.classList.add('faded');
        }
    });

    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    document.getElementById('quiz-feedback').innerHTML = `
        <button id="next-btn" class="btn btn-primary">${isLastQuestion ? 'Finish Quiz' : 'Next Question'}</button>
    `;
    document.getElementById('next-btn').addEventListener('click', handleNext);

    quizState.saveQuizState({ quizData, userAnswers, currentQuestionIndex, quizContext });
}

function handleNext() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        renderQuiz();
    } else {
        // Prepare data for the results page
        sessionStorage.setItem('quizResults', JSON.stringify({
            quizData,
            userAnswers,
            quizContext
        }));
        quizState.clearQuizState();
        window.location.hash = '#results';
    }
}

function handleError(message, shouldClearState = false) {
    console.error(message);
    // In a real app, you might want a more robust error display
    alert(message); 
    if (shouldClearState) {
        quizState.clearQuizState();
    }
    window.location.hash = '#home';
}

function startNewQuiz() {
    const dataString = sessionStorage.getItem('generatedQuizData');
    if (!dataString) {
        // Redirect if there's no quiz data (e.g., page reload)
        window.location.hash = quizContext.returnHash || '#home';
        return;
    }
    
    try {
        quizData = JSON.parse(dataString);
        userAnswers = new Array(quizData.length).fill(null);
        currentQuestionIndex = 0;
        
        const contextString = sessionStorage.getItem('quizContext');
        if (!contextString) throw new Error("Quiz context is missing.");
        quizContext = JSON.parse(contextString);

        renderQuiz();

        // Save initial state for resuming
        quizState.saveQuizState({ quizData, userAnswers, currentQuestionIndex, quizContext });

        // Clean up session storage
        sessionStorage.removeItem('generatedQuizData');
        sessionStorage.removeItem('quizError');

    } catch (err) {
        handleError("Failed to start the quiz. The quiz data was invalid.", true);
    }
}

function resumeQuiz() {
    const saved = quizState.loadQuizState();
    quizData = saved.quizData;
    userAnswers = saved.userAnswers;
    currentQuestionIndex = saved.currentQuestionIndex;
    quizContext = saved.quizContext;
    renderQuiz();
}

function init() {
    if (quizState.hasSavedState()) {
        resumeQuiz();
    } else {
        startNewQuiz();
    }
}

init();