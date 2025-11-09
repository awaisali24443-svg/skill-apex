import { startQuizFlow } from '../../services/navigationService.js';

let quizContext = {};

/**
 * A simple markdown to HTML converter.
 * Handles headings (##, ###), lists (* or -), and bold (**text**).
 * @param {string} markdown - The markdown text to convert.
 * @returns {string} - The converted HTML string.
 */
function renderMarkdown(markdown) {
    return markdown
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(\n|^)[\*\-] (.*)/g, '$1<li>$2</li>')
        .replace(/(\<\/li\>)(?!<br\/><li>)/g, '</li></ul>') // Close UL
        .replace(/(<li>.*<\/li\>)/g, '<ul>$1') // Open UL
        .replace(/<\/ul><ul>/g, ''); // Fix consecutive lists
}

function handleStartQuiz() {
    // We already have the context from the study guide generation
    if (quizContext) {
        // Ensure the generationType is quiz for the next step
        const newContext = { ...quizContext, generationType: 'quiz' };
        startQuizFlow(newContext);
    } else {
        window.showToast("Could not start quiz. Context is missing.", "error");
        window.location.hash = '#home';
    }
}

function init() {
    const studyContent = sessionStorage.getItem('studyGuideContent');
    const contextString = sessionStorage.getItem('quizContext');

    if (!studyContent || !contextString) {
        window.showToast("Study guide data not found. Please try again.", "error");
        window.location.hash = '#home';
        return;
    }

    quizContext = JSON.parse(contextString);

    // Set up the page elements
    const titleEl = document.getElementById('study-topic-title');
    const contentEl = document.getElementById('study-content');
    const backBtn = document.getElementById('back-btn');
    const startQuizBtn = document.getElementById('start-quiz-btn');

    if (titleEl) titleEl.textContent = `Study Guide: ${quizContext.topicName}`;
    if (backBtn) backBtn.href = quizContext.returnHash || '#home';
    if (contentEl) {
        contentEl.innerHTML = renderMarkdown(studyContent);
    }
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', handleStartQuiz);
    }
}

// Clean up sessionStorage when the user navigates away from the study page
window.addEventListener('hashchange', () => {
    sessionStorage.removeItem('studyGuideContent');
    sessionStorage.removeItem('quizContext');
}, { once: true });

init();