import { generateStudyGuideStream, generateFlashcardsFromGuide } from '../../services/geminiService.js';
import { NUM_QUESTIONS, UNLOCK_SCORE } from '../../constants.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { checkAndUnlockAchievements } from '../../services/achievementService.js';

let sceneManager;
let quizContext = null;
let fullStudyGuideContent = '';
let flashcards = [];
let currentFlashcardIndex = 0;

async function streamStudyGuide() {
    const contentEl = document.getElementById('study-content');
    contentEl.innerHTML = '';
    
    try {
        const stream = generateStudyGuideStream(quizContext.prompt);
        for await (const chunk of stream) {
            contentEl.innerHTML += chunk.replace(/\n/g, '<br>');
        }
        fullStudyGuideContent = contentEl.innerText;
        document.getElementById('start-quiz-btn').disabled = false;
        document.getElementById('study-tools-section').classList.remove('hidden');
        
        // Check for achievement after successful generation
        const newAchievements = await checkAndUnlockAchievements('study_guide_generated');
        newAchievements.forEach(ach => window.showToast(`🏆 Achievement Unlocked: ${ach.name}`, 'success'));

    } catch (error) {
        contentEl.innerHTML = `<p style="color: var(--color-danger);">Error generating guide: ${error.message}</p>`;
    }
}

function handleStartQuiz() {
    const updatedContext = {
        ...quizContext,
        prompt: `Generate a quiz with ${NUM_QUESTIONS} questions about "${quizContext.topicName}". A user needs a score of ${UNLOCK_SCORE} to pass.`,
        generationType: 'quiz'
    };
    startQuizFlow(updatedContext);
}

async function handleGenerateFlashcards() {
    const btn = document.getElementById('generate-flashcards-btn');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        flashcards = await generateFlashcardsFromGuide(fullStudyGuideContent);
        if (flashcards.length > 0) {
            openFlashcardModal();
        } else {
            window.showToast("Could not generate flashcards from this guide.", "error");
        }
    } catch (error) {
        window.showToast(error.message, "error");
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

function openFlashcardModal() {
    currentFlashcardIndex = 0;
    document.getElementById('flashcard-modal-overlay').classList.remove('hidden');
    renderCurrentFlashcard();
}

function closeFlashcardModal() {
    document.getElementById('flashcard-modal-overlay').classList.add('hidden');
}

function renderCurrentFlashcard() {
    const card = flashcards[currentFlashcardIndex];
    document.getElementById('flashcard-front').textContent = card.front;
    document.getElementById('flashcard-back').textContent = card.back;
    document.getElementById('flashcard-counter').textContent = `${currentFlashcardIndex + 1} / ${flashcards.length}`;
    
    document.getElementById('flashcard-prev-btn').disabled = currentFlashcardIndex === 0;
    document.getElementById('flashcard-next-btn').disabled = currentFlashcardIndex === flashcards.length - 1;
    document.getElementById('flashcard-flipper').classList.remove('flipped');
}

function showNextFlashcard() {
    if (currentFlashcardIndex < flashcards.length - 1) {
        currentFlashcardIndex++;
        renderCurrentFlashcard();
    }
}

function showPrevFlashcard() {
    if (currentFlashcardIndex > 0) {
        currentFlashcardIndex--;
        renderCurrentFlashcard();
    }
}

export async function init() {
    const contextString = sessionStorage.getItem('quizContext');
    quizContext = JSON.parse(contextString);

    if (!quizContext) {
        window.location.hash = '#home'; return;
    }

    document.getElementById('study-topic-title').textContent = `Study Guide: ${quizContext.topicName}`;
    document.getElementById('back-btn').href = quizContext.returnHash;
    
    document.getElementById('start-quiz-btn').addEventListener('click', handleStartQuiz);
    document.getElementById('generate-flashcards-btn').addEventListener('click', handleGenerateFlashcards);
    document.getElementById('flashcard-close-btn').addEventListener('click', closeFlashcardModal);
    document.getElementById('flashcard-next-btn').addEventListener('click', showNextFlashcard);
    document.getElementById('flashcard-prev-btn').addEventListener('click', showPrevFlashcard);
    document.getElementById('flashcard-flipper').addEventListener('click', () => {
        document.getElementById('flashcard-flipper').classList.toggle('flipped');
    });

    streamStudyGuide();
    sceneManager = await initModuleScene('.background-canvas', 'microscopic');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    quizContext = null;
    fullStudyGuideContent = '';
    flashcards = [];
}