import { getQuizState } from '../../services/quizStateService.js';
import { saveQuestion, isQuestionSaved } from '../../services/libraryService.js';
import { markStepComplete } from '../../services/learningPathService.js';
import { PASSING_SCORE_PERCENTAGE } from '../../constants.js';
import { toastService } from '../../services/toastService.js';
import { initializeCardGlow } from '../../global/global.js';

let appStateRef;
let retakeBtn, toggleReviewBtn;

const handleRetakeQuiz = () => {
    const originalTopic = appStateRef.context.topic;
    if (originalTopic) {
        appStateRef.context = { topic: originalTopic };
        window.location.hash = '#loading';
    } else {
        // Fallback for safety, e.g., if session state was lost
        window.location.hash = '#custom-quiz';
    }
};

const handleToggleReview = () => {
    const reviewDetails = document.getElementById('review-details');
    if (reviewDetails) {
        reviewDetails.classList.toggle('visible');
        toggleReviewBtn.textContent = reviewDetails.classList.contains('visible') 
            ? 'Hide Details' 
            : 'Show Details';
    }
};

function animateScore(finalScore, scoreEl) {
    let currentScore = 0;
    const duration = 1000; // 1 second
    const stepTime = 20; // update every 20ms
    const increment = finalScore / (duration / stepTime);

    const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= finalScore) {
            currentScore = finalScore;
            clearInterval(timer);
        }
        scoreEl.textContent = `${Math.round(currentScore)}%`;
    }, stepTime);
}

function renderResults(appState) {
    appStateRef = appState;
    const { questions, userAnswers, score } = getQuizState();
    
    const scorePercent = Math.round((score / questions.length) * 100);

    const scoreRingFg = document.getElementById('score-ring-fg');
    const scoreText = document.getElementById('score-text');
    const finalScoreText = document.getElementById('final-score-text');
    const title = document.getElementById('results-title');
    retakeBtn = document.getElementById('retake-quiz-btn');
    toggleReviewBtn = document.getElementById('toggle-review-btn');
    
    finalScoreText.textContent = `You answered ${score} out of ${questions.length} questions correctly.`;

    // Animate the score ring and text
    setTimeout(() => {
        scoreRingFg.setAttribute('stroke-dasharray', `${scorePercent}, 100`);
        animateScore(scorePercent, scoreText);
    }, 100);

    // Update title based on score
    if (scorePercent >= PASSING_SCORE_PERCENTAGE) {
        title.textContent = "Congratulations!";
    } else {
        title.textContent = "Keep Practicing!";
    }

    const pathContext = appState.context.learningPathContext;
    if (pathContext && scorePercent >= PASSING_SCORE_PERCENTAGE) {
        markStepComplete(pathContext.pathId, pathContext.stepId);
        console.log(`Marked step ${pathContext.stepId} of path ${pathContext.pathId} as complete.`);
    }

    renderQuestionReview(questions, userAnswers);

    if (retakeBtn) {
        retakeBtn.addEventListener('click', handleRetakeQuiz);
    }
    if (toggleReviewBtn) {
        toggleReviewBtn.addEventListener('click', handleToggleReview);
    }
}

function renderQuestionReview(questions, userAnswers) {
    const container = document.getElementById('question-review-container');
    const template = document.getElementById('review-item-template');
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const reviewItem = template.content.cloneNode(true);
        reviewItem.querySelector('.review-question-text').textContent = `${index + 1}. ${q.question}`;
        
        const optionsContainer = reviewItem.querySelector('.review-options');
        q.options.forEach((opt, optIndex) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'option';
            optionEl.textContent = opt;

            if (optIndex === q.correctAnswerIndex) {
                optionEl.classList.add('correct');
            } else if (optIndex === userAnswers[index]) {
                optionEl.classList.add('incorrect');
            }

            if (optIndex === userAnswers[index]) {
                optionEl.classList.add('user-answer');
            }

            optionsContainer.appendChild(optionEl);
        });

        reviewItem.querySelector('.review-explanation p').textContent = q.explanation;
        
        const saveBtn = reviewItem.querySelector('.save-question-btn');
        if (isQuestionSaved(q)) {
            saveBtn.classList.add('saved');
            saveBtn.disabled = true;
        } else {
            saveBtn.addEventListener('click', () => {
                if (saveQuestion(q)) {
                    saveBtn.classList.add('saved');
                    saveBtn.disabled = true;
                    toastService.show('Question saved to library!');
                }
            });
        }

        container.appendChild(reviewItem);
    });
    
    initializeCardGlow(); // Apply effect to newly rendered cards
}

export function init(appState) {
    console.log("Results module initialized.");
    renderResults(appState);
}

export function destroy() {
    if (retakeBtn) {
        retakeBtn.removeEventListener('click', handleRetakeQuiz);
    }
    if (toggleReviewBtn) {
        toggleReviewBtn.removeEventListener('click', handleToggleReview);
    }
    console.log("Results module destroyed.");
}