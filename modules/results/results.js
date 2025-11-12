import * as quizStateService from '../../services/quizStateService.js';
import * as libraryService from '../../services/libraryService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as historyService from '../../services/historyService.js';
import { initializeCardGlow } from '../../global/global.js';

let quizState;
let reviewContainer;
let clickHandler;

function animateScore(scorePercent) {
    const scoreRingFg = document.getElementById('score-ring-fg');
    const scoreText = document.getElementById('score-text');
    
    if (!scoreRingFg || !scoreText) return;

    // Animate the SVG ring
    setTimeout(() => {
        scoreRingFg.style.strokeDasharray = `${scorePercent}, 100`;
    }, 100);

    // Animate the text
    let currentScore = 0;
    const duration = 1000;
    const stepTime = Math.abs(Math.floor(duration / scorePercent)) || 20;

    const interval = setInterval(() => {
        currentScore++;
        scoreText.textContent = `${currentScore}%`;
        if (currentScore >= scorePercent) {
            clearInterval(interval);
            scoreText.textContent = `${scorePercent}%`;
        }
    }, stepTime);
}

function renderSummary(scorePercent) {
    const title = document.getElementById('summary-title');
    const details = document.getElementById('summary-details');

    if (scorePercent === 100) {
        title.textContent = "Perfect Score!";
        // If this was part of a learning path, mark step as complete
        if(quizState.learningPathId) {
            learningPathService.completeStep(quizState.learningPathId);
            const nextPath = learningPathService.getPathById(quizState.learningPathId);
            const actions = document.getElementById('results-actions');
            actions.innerHTML = `<a href="/#/learning-path/${nextPath.id}" class="btn btn-primary">Next Step</a>`;
        }
    } else if (scorePercent >= 80) {
        title.textContent = "Excellent Job!";
    } else if (scorePercent >= 50) {
        title.textContent = "Good Effort!";
    } else {
        title.textContent = "Keep Practicing!";
    }
    details.textContent = `You answered ${quizState.score} out of ${quizState.questions.length} questions correctly.`;
}

function renderReview() {
    reviewContainer = document.getElementById('review-container');
    const template = document.getElementById('review-item-template');
    reviewContainer.innerHTML = '';
    
    quizState.questions.forEach((question, index) => {
        const item = template.content.cloneNode(true);
        const userAnswerIndex = quizState.userAnswers[index];
        const isCorrect = userAnswerIndex === question.correctAnswerIndex;
        
        item.querySelector('.review-question-text').textContent = `${index + 1}. ${question.question}`;
        
        const userAnswerEl = item.querySelector('.user-answer');
        userAnswerEl.classList.add(isCorrect ? 'correct' : 'incorrect');
        userAnswerEl.querySelector('.answer-text').textContent = question.options[userAnswerIndex] ?? 'Not answered';

        item.querySelector('.correct-answer .answer-text').textContent = question.options[question.correctAnswerIndex];
        item.querySelector('.review-explanation').textContent = question.explanation;
        
        const saveBtn = item.querySelector('.save-question-btn');
        if (libraryService.isQuestionSaved(question)) {
            saveBtn.textContent = 'Saved';
            saveBtn.disabled = true;
        } else {
            saveBtn.dataset.questionIndex = index;
        }

        reviewContainer.appendChild(item);
    });
    initializeCardGlow(reviewContainer);
}

export function init(appState) {
    quizState = quizStateService.getQuizState();

    if (!quizState) {
        window.location.hash = '/';
        return;
    }

    soundService.playSound('finish');
    const scorePercent = quizState.questions.length > 0 ? Math.round((quizState.score / quizState.questions.length) * 100) : 0;
    
    renderSummary(scorePercent);
    animateScore(scorePercent);
    renderReview();
    
    reviewContainer = document.getElementById('review-container');
    clickHandler = (event) => {
        const button = event.target.closest('.save-question-btn');
        if (button && !button.disabled) {
            const questionIndex = parseInt(button.dataset.questionIndex, 10);
            const question = quizState.questions[questionIndex];
            
            const saved = libraryService.saveQuestion(question);
            if (saved) {
                button.textContent = 'Saved';
                button.disabled = true;
            }
        }
    };
    reviewContainer.addEventListener('click', clickHandler);
}

export function destroy() {
    // Save attempt to history before clearing
    historyService.addQuizAttempt(quizStateService.getQuizState());
    
    // Crucial for cleaning up the finished quiz state
    quizStateService.endQuiz();
    if(reviewContainer && clickHandler) {
        reviewContainer.removeEventListener('click', clickHandler);
    }
}