import * as quizState from './quizStateService.js';

/**
 * Handles the logic for starting a new quiz, including checking for an active session.
 * This centralized function prevents accidental overwriting of in-progress quizzes.
 * @param {object} quizContext - The context for the new quiz (topic, level, prompt etc.).
 */
export async function startQuizFlow(quizContext) {
    if (quizState.hasSavedState()) {
        const isConfirmed = await window.showConfirmationModal({
            title: 'Quiz in Progress',
            text: 'You have an unfinished quiz. Starting a new one will abandon your current progress. Are you sure you want to continue?',
            confirmText: 'Abandon & Start New',
            cancelText: 'Cancel'
        });

        if (!isConfirmed) {
            return; // User canceled, do nothing.
        }
    }
    
    // Clear any old state before starting a new quiz.
    quizState.clearQuizState();
    
    sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
    window.location.hash = '#loading';
}