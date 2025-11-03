const QUIZ_STATE_KEY = 'quizInProgress';

export const saveQuizState = (state) => {
    try {
        const stateString = JSON.stringify(state);
        localStorage.setItem(QUIZ_STATE_KEY, stateString);
    } catch (e) {
        console.error("Could not save quiz state to localStorage", e);
    }
};

export const loadQuizState = () => {
    try {
        const stateString = localStorage.getItem(QUIZ_STATE_KEY);
        if (stateString === null) {
            return null;
        }
        return JSON.parse(stateString);
    } catch (e) {
        console.error("Could not load quiz state from localStorage", e);
        return null;
    }
};

export const clearQuizState = () => {
    try {
        localStorage.removeItem(QUIZ_STATE_KEY);
    } catch (e) {
        console.error("Could not clear quiz state from localStorage", e);
    }
};

export const hasSavedState = () => {
    return localStorage.getItem(QUIZ_STATE_KEY) !== null;
};
