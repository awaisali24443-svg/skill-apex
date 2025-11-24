
import * as libraryService from '../../services/libraryService.js';
import * as soundService from '../../services/soundService.js';
import * as markdownService from '../../services/markdownService.js';
import { showToast } from '../../services/toastService.js';

let studyQueue = [];
let currentCard = null;
let elements = {};

function updateProgress() {
    elements.itemsRemaining.textContent = studyQueue.length;
}

function renderCurrentCard() {
    if (studyQueue.length === 0) {
        finishSession();
        return;
    }
    
    currentCard = studyQueue[0];
    
    elements.flashcard.classList.remove('is-flipped');
    elements.controls.classList.remove('visible');
    
    // Short delay to allow flip back animation if needed
    setTimeout(() => {
        elements.question.innerHTML = markdownService.render(currentCard.question);
        elements.answer.innerHTML = markdownService.render(currentCard.options[currentCard.correctAnswerIndex]);
    }, 200);
    
    updateProgress();
}

function handleFlip() {
    if (elements.flashcard.classList.contains('is-flipped')) return;
    
    elements.flashcard.classList.add('is-flipped');
    soundService.playSound('flip');
    
    // Show controls after short delay
    setTimeout(() => {
        elements.controls.classList.add('visible');
    }, 300);
}

function handleRating(quality) {
    if (!currentCard) return;
    
    soundService.playSound(quality > 0 ? 'click' : 'incorrect');
    
    // Process the review
    libraryService.processReview(currentCard.id, quality);
    
    // Remove from queue
    studyQueue.shift();
    
    // If rated "Again" (0), re-queue it at the end of THIS session for immediate drill
    if (quality === 0) {
        studyQueue.push(currentCard);
        showToast('Card requeued for review', 'info', 2000);
    }
    
    renderCurrentCard();
}

function finishSession() {
    elements.scene.style.display = 'none';
    elements.controls.style.display = 'none';
    elements.header.style.display = 'none';
    elements.finishedMessage.style.display = 'block';
    soundService.playSound('achievement');
}

export function init() {
    elements = {
        scene: document.getElementById('flashcard-scene'),
        flashcard: document.getElementById('flashcard'),
        question: document.getElementById('flashcard-question'),
        answer: document.getElementById('flashcard-answer'),
        controls: document.getElementById('study-controls'),
        header: document.getElementById('study-header'),
        itemsRemaining: document.getElementById('items-remaining'),
        emptyMessage: document.getElementById('empty-study-message'),
        finishedMessage: document.getElementById('finished-study-message'),
        quitBtn: document.getElementById('quit-study-btn'),
    };
    
    // 1. Get ALL items to check if library is empty
    const allItems = libraryService.getLibrary();
    if (allItems.length === 0) {
        elements.scene.style.display = 'none';
        elements.header.style.display = 'none';
        elements.emptyMessage.style.display = 'block';
        return;
    }

    // 2. Get DUE items for SRS
    studyQueue = libraryService.getDueQuestions();
    
    if (studyQueue.length === 0) {
        elements.scene.style.display = 'none';
        elements.header.style.display = 'none';
        elements.finishedMessage.style.display = 'block';
        return;
    }

    // Start Session
    elements.header.style.display = 'flex';
    elements.scene.style.display = 'block';
    renderCurrentCard();

    // Interactions
    elements.flashcard.addEventListener('click', handleFlip);
    
    document.querySelectorAll('.btn-rate').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card flip
            const quality = parseInt(btn.dataset.quality);
            handleRating(quality);
        });
    });

    elements.quitBtn.addEventListener('click', () => {
        window.history.back();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyInput);
}

function handleKeyInput(e) {
    if (elements.flashcard.classList.contains('is-flipped')) {
        if (e.key === '1') handleRating(0); // Again
        if (e.key === '2') handleRating(3); // Hard
        if (e.key === '3') handleRating(4); // Good
        if (e.key === '4') handleRating(5); // Easy
    } else {
        if (e.code === 'Space' || e.key === 'Enter') {
            handleFlip();
        }
    }
}

export function destroy() {
    document.removeEventListener('keydown', handleKeyInput);
}
