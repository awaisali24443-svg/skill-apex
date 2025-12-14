
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

let elements = {};
let isLoginMode = true;

function toggleMode() {
    isLoginMode = !isLoginMode;
    elements.title.textContent = isLoginMode ? 'System Login' : 'New Registration';
    elements.subtitle.textContent = isLoginMode ? 'Identify yourself to access the neural network.' : 'Create a new profile to begin your journey.';
    elements.submitBtnText.textContent = isLoginMode ? 'Connect' : 'Register';
    elements.toggleText.textContent = isLoginMode ? 'New user?' : 'Already have an account?';
    elements.toggleBtn.textContent = isLoginMode ? 'Initialize New Account' : 'Login with Existing ID';
    elements.error.style.display = 'none';
    if (elements.forgotBtn) elements.forgotBtn.style.display = isLoginMode ? 'block' : 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    if (!email || !password) return;
    
    elements.submitBtn.disabled = true;
    elements.submitBtnText.style.display = 'none';
    elements.submitBtnSpinner.style.display = 'block';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
        } else {
            await firebaseService.register(email, password);
            showToast('Account created successfully!', 'success');
        }
    } catch (error) {
        handleError(error);
    }
}

async function handleGoogleLogin() {
    try { await firebaseService.loginWithGoogle(); } catch (error) { handleError(error); }
}

function populateGuestData() {
    console.log("Populating Extensive Mock Data...");

    // 1. GAMIFICATION STATS (Look impressive instantly)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
        const sampleStats = {
            level: 24,
            xp: 24500,
            currentStreak: 12,
            lastQuizDate: new Date().toISOString(),
            totalQuizzesCompleted: 145,
            totalPerfectQuizzes: 42,
            questionsSaved: 18,
            nightOwlSessions: 8,
            fastAnswersCount: 320,
            dailyQuests: { date: new Date().toDateString(), quests: [] },
            dailyChallenge: { date: new Date().toDateString(), completed: false }
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(sampleStats));
    }

    // 2. ACTIVE JOURNEYS (Varied progress and topics)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
        const sampleJourneys = [
            {
                id: "journey_mock_1",
                goal: "Cybersecurity Ops",
                description: "Advanced penetration testing and network defense strategies.",
                currentLevel: 67,
                totalLevels: 150,
                styleClass: "topic-space", 
                createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
            },
            {
                id: "journey_mock_2",
                goal: "React & Next.js",
                description: "Building scalable front-end applications with modern frameworks.",
                currentLevel: 12,
                totalLevels: 40,
                styleClass: "topic-programming", 
                createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
            },
            {
                id: "journey_mock_3",
                goal: "Astrophysics 101",
                description: "Understanding stellar evolution and black holes.",
                currentLevel: 5,
                totalLevels: 500, // Show off the dynamic large number scaling
                styleClass: "topic-medicine",
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(sampleJourneys));
    }

    // 3. EXTENSIVE HISTORY (Mix of wins, losses, and aural sessions)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
        const now = Date.now();
        const day = 86400000;
        const sampleHistory = [];
        
        // Add some quizzes
        for(let i=0; i<10; i++) {
            const isPerfect = Math.random() > 0.5;
            const score = isPerfect ? 5 : Math.floor(Math.random() * 4) + 1;
            const topic = i % 2 === 0 ? "Cybersecurity Ops" : "React & Next.js";
            const level = (i % 2 === 0 ? 67 : 12) - Math.floor(i/2);
            
            sampleHistory.push({
                id: `quiz_hist_${i}`,
                type: 'quiz',
                topic: `${topic} - Level ${level}`,
                score: score,
                totalQuestions: 5,
                date: new Date(now - (day * i * 0.2)).toISOString(),
                xpGained: score * 10
            });
        }

        // Add an Aural Session
        sampleHistory.push({
            id: `aural_hist_mock`,
            type: 'aural',
            topic: 'Voice Interview Practice',
            date: new Date(now - (day * 0.1)).toISOString(),
            duration: 185, // seconds
            xpGained: 50,
            transcript: [
                { sender: 'user', text: 'Tell me about the event loop in JavaScript.' },
                { sender: 'model', text: 'The event loop is what allows Node.js to perform non-blocking I/O operations despite being single-threaded.' }
            ]
        });
        
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(sampleHistory));
    }

    // 4. SMART LIBRARY (Rich content)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY)) {
        const sampleLibrary = [
            {
                id: "q_lib_1",
                question: "What is the primary function of the 'useEffect' hook in React?",
                options: ["Manage State", "Handle Side Effects", "Create Context", "Optimize Rendering"],
                correctAnswerIndex: 1,
                explanation: "useEffect lets you perform side effects in function components, like data fetching or DOM manipulation.",
                srs: { interval: 1, repetitions: 1, easeFactor: 2.5, nextReviewDate: Date.now() - 10000, lastReviewed: Date.now() - 86400000 }
            },
            {
                id: "q_lib_2",
                question: "In Python, which data type is mutable?",
                options: ["Tuple", "String", "List", "Integer"],
                correctAnswerIndex: 2,
                explanation: "Lists in Python can be changed after creation (mutable), unlike tuples or strings.",
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: Date.now(), lastReviewed: null }
            },
            {
                id: "q_lib_3",
                question: "What does the HTTP status code 404 signify?",
                options: ["Server Error", "Unauthorized", "Not Found", "Bad Gateway"],
                correctAnswerIndex: 2,
                explanation: "404 indicates that the server cannot find the requested resource.",
                srs: { interval: 3, repetitions: 2, easeFactor: 2.6, nextReviewDate: Date.now() + 86400000, lastReviewed: Date.now() }
            },
            {
                id: "q_lib_4",
                question: "Which of these is a symmetric encryption algorithm?",
                options: ["RSA", "AES", "ECC", "Diffie-Hellman"],
                correctAnswerIndex: 1,
                explanation: "AES (Advanced Encryption Standard) uses the same key for encryption and decryption.",
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: Date.now(), lastReviewed: null }
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(sampleLibrary));
    }
}

async function handleGuestLogin() {
    try {
        populateGuestData(); 
        await firebaseService.loginAsGuest();
    } catch (error) {
        handleError(error);
    }
}

function handleError(error) {
    console.error(error);
    elements.error.textContent = error.message;
    elements.error.style.display = 'block';
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

export function init() {
    const container = document.getElementById('auth-container');
    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            if (!document.querySelector('link[href="./modules/auth/auth.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = './modules/auth/auth.css';
                document.head.appendChild(link);
            }
            
            elements = {
                form: document.getElementById('auth-form'),
                emailInput: document.getElementById('auth-email'),
                passwordInput: document.getElementById('auth-password'),
                submitBtn: document.getElementById('auth-submit-btn'),
                submitBtnText: document.querySelector('#auth-submit-btn .btn-text'),
                submitBtnSpinner: document.querySelector('#auth-submit-btn .spinner'),
                toggleBtn: document.getElementById('auth-toggle-btn'),
                googleBtn: document.getElementById('google-login-btn'),
                guestBtn: document.getElementById('guest-login-btn'),
                forgotBtn: document.getElementById('forgot-password-btn'),
                title: document.getElementById('auth-title'),
                subtitle: document.getElementById('auth-subtitle'),
                toggleText: document.getElementById('auth-toggle-text'),
                error: document.getElementById('auth-error')
            };
            
            if(elements.form) elements.form.addEventListener('submit', handleSubmit);
            if(elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleMode);
            if(elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleLogin);
            if(elements.guestBtn) elements.guestBtn.addEventListener('click', handleGuestLogin);
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}
