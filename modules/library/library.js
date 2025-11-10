import * as libraryService from '../../services/libraryService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

async function renderLibrary() {
    const grid = document.getElementById('library-grid');
    const quizzes = await libraryService.getSavedQuizzes();

    if (quizzes.length === 0) {
        grid.innerHTML = `<p class="empty-library-message">Your library is empty. Save a quiz from the results screen to find it here. <a href="#custom-quiz">Create a quiz now!</a></p>`;
        return;
    }

    grid.innerHTML = quizzes.map(quiz => `
        <div class="library-card">
            <div>
                <h3>${quiz.topic}</h3>
                <div class="library-card-meta">
                    Saved on ${new Date(quiz.savedAt).toLocaleDateString()}
                    <br>
                    ${quiz.questionCount} questions
                </div>
            </div>
            <div class="library-card-actions">
                <button class="btn btn-danger delete-quiz-btn" data-quiz-id="${quiz.id}">Delete</button>
                <button class="btn btn-primary replay-quiz-btn" data-quiz-id="${quiz.id}">Replay</button>
            </div>
        </div>
    `).join('');

    attachListeners();
}

function attachListeners() {
    document.querySelectorAll('.replay-quiz-btn').forEach(btn => {
        btn.addEventListener('click', handleReplay);
    });
    document.querySelectorAll('.delete-quiz-btn').forEach(btn => {
        btn.addEventListener('click', handleDelete);
    });
}

async function handleReplay(e) {
    const quizId = e.target.dataset.quizId;
    const quiz = await libraryService.getQuizFromLibrary(quizId);
    if (quiz) {
        await startQuizFlow({
            ...quiz.quizContext,
            returnHash: '#library'
        }, quiz.quizData);
    }
}

async function handleDelete(e) {
    const quizId = e.target.dataset.quizId;
    const confirmed = await window.showConfirmationModal({
        title: "Delete Quiz?",
        text: "Are you sure you want to permanently delete this quiz from your library?",
        confirmText: "Delete"
    });

    if (confirmed) {
        await libraryService.deleteQuizFromLibrary(quizId);
        window.showToast("Quiz deleted from library.", "success");
        renderLibrary(); // Re-render the list
    }
}


export async function init() {
    await renderLibrary();
    sceneManager = await initModuleScene('.background-canvas', 'calmGeometric');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}