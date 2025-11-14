import * as quizStateService from '../../services/quizStateService.js';
import * as libraryService from '../../services/libraryService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as historyService from '../../services/historyService.js';
import * as soundService from '../../services/soundService.js';

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

    // Animate the text with requestAnimationFrame for smoothness
    let startTimestamp = null;
    const duration = 1200; // Animation duration in milliseconds

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = timestamp - startTimestamp;
        const currentPercentage = Math.min(Math.floor(scorePercent * (progress / duration)), scorePercent);
        
        scoreText.textContent = `${currentPercentage}%`;

        if (progress < duration) {
            requestAnimationFrame(step);
        } else {
            // Ensure final value is accurate
            scoreText.textContent = `${scorePercent}%`;
        }
    };

    // Handle the case of a zero score without animation
    if (scorePercent === 0) {
        scoreText.textContent = '0%';
        return;
    }

    requestAnimationFrame(step);
}

function renderSummary(scorePercent) {
    const title = document.getElementById('summary-title');
    const details = document.getElementById('summary-details');
    const actions = document.getElementById('results-actions');

    if (scorePercent === 100) {
        title.textContent = "Perfect Score!";
    } else if (scorePercent >= 80) {
        title.textContent = "Excellent Job!";
    } else if (scorePercent >= 50) {
        title.textContent = "Good Effort!";
    } else {
        title.textContent = "Keep Practicing!";
    }
    details.textContent = `You answered ${quizState.score} out of ${quizState.questions.length} questions correctly.`;

    // Calculate and display duration
    const durationMs = quizState.endTime - quizState.startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
    const durationFormatted = `${minutes}:${seconds.padStart(2, '0')}`;
    document.getElementById('summary-time').textContent = durationFormatted;

    // Handle Learning Path logic
    if (quizState.learningPathId && quizState.learningPathStepIndex !== undefined) {
        // Record score for this step
        learningPathService.recordStepScore(quizState.learningPathId, quizState.learningPathStepIndex, quizState.score, quizState.questions.length);

        if (scorePercent >= 80) {
            learningPathService.completeStep(quizState.learningPathId);
            const nextPath = learningPathService.getPathById(quizState.learningPathId);
            
            if (nextPath && nextPath.currentStep < nextPath.path.length) {
                actions.innerHTML = `<a href="/#/learning-path/${nextPath.id}" class="btn btn-primary">Continue to Next Step</a>`;
            } else {
                actions.innerHTML = `<a href="/#/learning-path/${nextPath.id}" class="btn btn-primary">Path Complete!</a>`;
            }
        } else {
            actions.innerHTML = `<a href="/#/learning-path/${quizState.learningPathId}" class="btn btn-primary">Try Step Again</a> <a href="/#/home" class="btn">Go Home</a>`;
        }
    }
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
}

export function init(appState) {
    quizState = quizStateService.getQuizState();

    if (!quizState) {
        window.location.hash = '/';
        return;
    }

    // Save attempt to history. The service now prevents duplicates.
    historyService.addQuizAttempt(quizState);
    
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
    // Crucial for cleaning up the finished quiz state
    quizStateService.endQuiz();
    if(reviewContainer && clickHandler) {
        reviewContainer.removeEventListener('click', clickHandler);
    }
}