import * as quizStateService from '../../services/quizStateService.js';
import * as soundService from '../../services/soundService.js';

let appState;
let answered = false;
let elements = {};

function renderQuestion() {
    const question = quizStateService.getCurrentQuestion();
    const state = quizStateService.getQuizState();
    
    if (!question) {
        window.location.hash = '/';
        return;
    }

    // Update progress
    const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
    elements.progressBarFill.style.width = `${progress}%`;
    elements.progressText.textContent = `Question ${state.currentIndex + 1} / ${state.questions.length}`;
    
    // Update content
    elements.questionText.textContent = question.question;
    elements.optionsContainer.innerHTML = '';
    
    const optionTemplate = document.getElementById('option-template');
    question.options.forEach((optionText, index) => {
        const option = optionTemplate.content.cloneNode(true).querySelector('button');
        option.textContent = optionText;
        option.dataset.index = index;
        elements.optionsContainer.appendChild(option);
    });

    elements.explanationContainer.style.display = 'none';
    answered = false;
}

function handleOptionClick(event) {
    const button = event.target.closest('.option-btn');
    if (answered || !button) {
        return;
    }
    answered = true;

    const selectedIndex = parseInt(button.dataset.index, 10);
    const isCorrect = quizStateService.answerQuestion(selectedIndex);
    const question = quizStateService.getCurrentQuestion();

    soundService.playSound(isCorrect ? 'correct' : 'incorrect');

    // Update button styles
    const optionButtons = elements.optionsContainer.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex) {
            btn.classList.add('incorrect');
        }
        btn.disabled = true;
    });

    // Show explanation
    elements.explanationText.textContent = question.explanation;
    elements.explanationContainer.style.display = 'block';
}

function handleNextQuestion() {
    const hasNext = quizStateService.nextQuestion();
    if (hasNext) {
        renderQuestion();
    } else {
        window.location.hash = '/results';
    }
}

export function init(globalState) {
    appState = globalState;
    const quizData = quizStateService.getQuizState();

    if (!quizData || !quizData.questions) {
        console.error("No quiz data found, redirecting.");
        window.location.hash = '/';
        return;
    }

    soundService.playSound('start');
    
    elements = {
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-text'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        explanationContainer: document.getElementById('explanation-container'),
        explanationText: document.getElementById('explanation-text'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
    };

    elements.optionsContainer.addEventListener('click', handleOptionClick);
    elements.nextQuestionBtn.addEventListener('click', handleNextQuestion);

    renderQuestion();
}

export function destroy() {
    if (elements.optionsContainer) {
        elements.optionsContainer.removeEventListener('click', handleOptionClick);
    }
    if (elements.nextQuestionBtn) {
        elements.nextQuestionBtn.removeEventListener('click', handleNextQuestion);
    }
}