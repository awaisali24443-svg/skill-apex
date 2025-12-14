
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
    try { 
        await firebaseService.loginWithGoogle(); 
    } catch (error) { 
        // If Google fails (likely domain issue), suggest Guest
        handleError({ message: "Google Login failed. Use 'Try as Guest' for the Expo demo." });
    }
}

function populateGuestData() {
    console.log("Populating Local IT Expo Data...");

    // 1. GAMIFICATION STATS (Look impressive instantly)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
        const sampleStats = {
            level: 18,
            xp: 18500,
            currentStreak: 65,
            lastQuizDate: new Date().toISOString(),
            totalQuizzesCompleted: 92,
            totalPerfectQuizzes: 35,
            questionsSaved: 15,
            dailyQuests: { date: new Date().toDateString(), quests: [] },
            dailyChallenge: { date: new Date().toDateString(), completed: false }
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(sampleStats));
    }

    // 2. ACTIVE JOURNEYS (Highly recognizable, "Cool" IT topics)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
        const sampleJourneys = [
            {
                id: "journey_expo_1",
                goal: "Ethical Hacking & Security",
                description: "Learn penetration testing, Kali Linux, and how to secure networks against cyber attacks.",
                currentLevel: 15,
                totalLevels: 50,
                styleClass: "topic-space", // Purple/Dark look
                createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
            },
            {
                id: "journey_expo_2",
                goal: "Full-Stack Web Development",
                description: "Master the MERN Stack (MongoDB, Express, React, Node) and build professional websites.",
                currentLevel: 42,
                totalLevels: 60,
                styleClass: "topic-programming", // Blue/Tech look
                createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
            },
            {
                id: "journey_expo_3",
                goal: "Freelancing Mastery",
                description: "How to rank on Upwork/Fiverr, communicate with clients, and build a digital career.",
                currentLevel: 8,
                totalLevels: 20,
                styleClass: "topic-finance", // Gold/Money look
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(sampleJourneys));
    }

    // 3. EXTENSIVE HISTORY
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
        const now = Date.now();
        const day = 86400000;
        const sampleHistory = [];
        
        for(let i=0; i<8; i++) {
            const isPerfect = Math.random() > 0.6;
            const score = isPerfect ? 5 : Math.floor(Math.random() * 4) + 1;
            const topic = i % 2 === 0 ? "Ethical Hacking & Security" : "Full-Stack Web Development";
            const level = (i % 2 === 0 ? 15 : 42) - Math.floor(i/2);
            
            sampleHistory.push({
                id: `quiz_hist_${i}`,
                type: 'quiz',
                topic: `${topic} - Level ${level}`,
                score: score,
                totalQuestions: 5,
                date: new Date(now - (day * i * 0.5)).toISOString(),
                xpGained: score * 10
            });
        }
        
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(sampleHistory));
    }

    // 4. SMART LIBRARY (Questions judges will understand and find smart)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY)) {
        const sampleLibrary = [
            {
                id: "q_lib_1",
                question: "In Web Development, what does 'React' use to improve performance?",
                options: ["Direct DOM manipulation", "Virtual DOM", "SQL Database", "Flash Player"],
                correctAnswerIndex: 1,
                explanation: "React uses a Virtual DOM to minimize slow updates to the real browser DOM.",
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: Date.now(), lastReviewed: null }
            },
            {
                id: "q_lib_2",
                question: "Which tool is commonly used for 'Packet Sniffing' in Ethical Hacking?",
                options: ["Photoshop", "Wireshark", "MS Word", "Notepad"],
                correctAnswerIndex: 1,
                explanation: "Wireshark is the industry standard for analyzing network traffic and packets.",
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: Date.now(), lastReviewed: null }
            },
            {
                id: "q_lib_3",
                question: "What is the primary benefit of Freelancing?",
                options: ["Fixed Salary", "Global Clients & Dollar Income", "Free Health Insurance", "9 to 5 Timing"],
                correctAnswerIndex: 1,
                explanation: "Freelancing allows access to international markets, often resulting in higher earnings in foreign currency.",
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
        // Force redirect if listener doesn't catch it
        setTimeout(() => {
            const container = document.getElementById('auth-container');
            if(container) container.style.display = 'none';
            document.getElementById('app-wrapper').style.display = 'flex';
        }, 1000);
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
