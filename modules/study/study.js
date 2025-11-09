import { generateStudyGuideStream, generateFlashcardsFromGuide } from '../../services/geminiService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

let sceneManager;
let quizContext = null;
let currentGuideContent = '';
let flashcards = [];
let currentFlashcardIndex = 0;

async function streamStudyGuide() {
    const contentEl = document.getElementById('study-content');
    contentEl.innerHTML = ''; // Clear placeholder
    
    try {
        const stream = await generateStudyGuideStream(quizContext.prompt);
        let accumulatedText = '';
        for await (const chunk of stream) {
            accumulatedText += chunk;
            contentEl.innerHTML = marked.parse(accumulatedText);
        }
        currentGuideContent = accumulatedText; // Store final content
        document.getElementById('start-quiz-btn').disabled = false;
        document.getElementById('study-tools-section').classList.remove('hidden');
    } catch (error) {
        contentEl.innerHTML = `<p style="color:var(--color-danger)">Failed to generate study guide. Please try again.</p>`;
    }
}

function handleStartQuiz() {
    if (quizContext) {
        startQuizFlow(quizContext);
    }
}

async function handleGenerateFlashcards() {
    const genFlashcardsBtn = document.getElementById('generate-flashcards-btn');
    genFlashcardsBtn.classList.add('loading');
    genFlashcardsBtn.disabled = true;

    try {
        const flashcardData = await generateFlashcardsFromGuide(currentGuideContent);
        flashcards = flashcardData;
        if (flashcards && flashcards.length > 0) {
            currentFlashcardIndex = 0;
            showFlashcardModal();
        } else {
            window.showToast("Could not generate flashcards from this guide.", "error");
        }
    } catch (error) {
        window.showToast("An error occurred while creating flashcards.", "error");
    } finally {
        genFlashcardsBtn.classList.remove('loading');
        genFlashcardsBtn.disabled = false;
    }
}

function showFlashcardModal() {
    renderCurrentFlashcard();
    document.getElementById('flashcard-modal-overlay').classList.remove('hidden');
}

function hideFlashcardModal() {
    document.getElementById('flashcard-modal-overlay').classList.add('hidden');
    document.getElementById('flashcard-flipper').classList.remove('flipped');
}

function renderCurrentFlashcard() {
    const card = flashcards[currentFlashcardIndex];
    document.getElementById('flashcard-front').textContent = card.term;
    document.getElementById('flashcard-back').textContent = card.definition;
    document.getElementById('flashcard-flipper').classList.remove('flipped');
    
    document.getElementById('flashcard-counter').textContent = `${currentFlashcardIndex + 1} / ${flashcards.length}`;
    document.getElementById('flashcard-prev-btn').disabled = currentFlashcardIndex === 0;
    document.getElementById('flashcard-next-btn').disabled = currentFlashcardIndex === flashcards.length - 1;
}

function flipCard() {
    document.getElementById('flashcard-flipper').classList.toggle('flipped');
}

function nextCard() {
    if (currentFlashcardIndex < flashcards.length - 1) {
        currentFlashcardIndex++;
        renderCurrentFlashcard();
    }
}

function prevCard() {
    if (currentFlashcardIndex > 0) {
        currentFlashcardIndex--;
        renderCurrentFlashcard();
    }
}


export function init() {
    const contextString = sessionStorage.getItem('quizContext');
    if (!contextString) {
        window.showToast("No study topic selected.", "error");
        window.location.hash = '#home';
        return;
    }
    quizContext = JSON.parse(contextString);

    document.getElementById('study-topic-title').textContent = `Study Guide: ${quizContext.topicName}`;
    document.getElementById('back-btn').href = quizContext.returnHash || '#home';

    streamStudyGuide();

    document.getElementById('start-quiz-btn').addEventListener('click', handleStartQuiz);
    document.getElementById('generate-flashcards-btn').addEventListener('click', handleGenerateFlashcards);
    document.getElementById('flashcard-close-btn').addEventListener('click', hideFlashcardModal);
    document.getElementById('flashcard-flipper').addEventListener('click', flipCard);
    document.getElementById('flashcard-next-btn').addEventListener('click', nextCard);
    document.getElementById('flashcard-prev-btn').addEventListener('click', prevCard);

    sceneManager = initModuleScene('.background-canvas', 'atomicStructure');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    quizContext = null;
    currentGuideContent = '';
    flashcards = [];
}
