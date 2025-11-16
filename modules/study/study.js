
import * as libraryService from '../../services/libraryService.js';
import * as soundService from '../../services/soundService.js';

let questions = [];
let currentIndex = 0;
let elements = {};

function renderCard() {
    if (questions.length === 0) return;
    
    const question = questions[currentIndex];
    elements.flashcard.classList.remove('is-flipped');
    
    // Use a short timeout to allow the card to flip back before changing content
    setTimeout(() => {
        elements.question.textContent = question.question;
        elements.answer.textContent = question.options[question.correctAnswerIndex];
        elements.counter.textContent = `${currentIndex + 1} / ${questions.length}`;
    }, 150);
}

function showNextCard() {
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderCard();
    }
}

function showPrevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        renderCard();
    }
}

export function init() {
    questions = libraryService.getQuestionsForStudy();
    
    elements = {
        scene: document.getElementById('flashcard-scene'),
        flashcard: document.getElementById('flashcard'),
        question: document.getElementById('flashcard-question'),
        answer: document.getElementById('flashcard-answer'),
        controls: document.querySelector('.study-controls'),
        prevBtn: document.getElementById('prev-card-btn'),
        nextBtn: document.getElementById('next-card-btn'),
        counter: document.getElementById('card-counter'),
        emptyMessage: document.getElementById('empty-study-message'),
    };
    
    if (questions.length === 0) {
        elements.scene.style.display = 'none';
        elements.controls.style.display = 'none';
        elements.emptyMessage.style.display = 'block';
        return;
    }

    renderCard();

    elements.flashcard.addEventListener('click', () => {
        elements.flashcard.classList.toggle('is-flipped');
        soundService.playSound('flip');
    });

    elements.nextBtn.addEventListener('click', showNextCard);
    elements.prevBtn.addEventListener('click', showPrevCard);
}

export function destroy() {
    // Event listeners are on elements that will be removed from the DOM,
    // so no explicit removal is strictly necessary, but it's good practice.
}
