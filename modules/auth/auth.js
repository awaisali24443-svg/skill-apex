
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

let elements = {};
let isLoginMode = true;

// --- DEMO SCENARIOS (TRENDING IT TOPICS EDITION) ---
// 1. Python Mastery: Level 1 (Entry)
// 2. Web Development: Level 5 (Visuals)
// 3. Machine Learning: Level 30 (Advanced)
// 4. Prompt Engineering: Level 50 (Boss Battle)

const DEMO_SCENARIOS = [
    {
        topic: "Python Mastery",
        level: 1,
        totalLevels: 50,
        style: "topic-programming",
        desc: "The world's most popular language.",
        lesson: "### **MISSION BRIEFING: PYTHON BASICS**\n\n**STATUS:** Interpreter Online.\n\n*   **Readability:** Python is designed to be read like English.\n*   **Variables:** Containers for storing data values. No type declaration needed.\n*   **Indentation:** Python uses whitespace to define blocks of code instead of curly braces `{}`.\n\nInitialize script.",
        questions: [
            { question: "How do you output text to the console in Python?", options: ["echo('Hello')", "console.log('Hello')", "print('Hello')", "System.out.println('Hello')"], correctAnswerIndex: 2, explanation: "`print()` is the standard function to display output in Python." },
            { question: "Which symbol is used for comments in Python?", options: ["//", "#", "/*", "<!--"], correctAnswerIndex: 1, explanation: "The `#` symbol starts a comment line in Python." },
            { question: "How do you define a block of code (like a loop body)?", options: ["Curly Braces {}", "Indentation (Whitespace)", "Parentheses ()", "End statements"], correctAnswerIndex: 1, explanation: "Python enforces indentation to define scope, keeping code clean and readable." }
        ]
    },
    {
        topic: "Web Development",
        level: 5,
        totalLevels: 60,
        style: "topic-arts",
        desc: "Building the modern web.",
        lesson: "### **MISSION BRIEFING: THE DOM**\n\n**STATUS:** Browser Rendering.\n\n*   **HTML:** The skeleton/structure of the page.\n*   **CSS:** The skin/style of the page.\n*   **JavaScript:** The muscles/logic that make it interactive.\n*   **DOM:** The Document Object Model - how JS sees and changes HTML.\n\nStyle the interface.",
        questions: [
            { question: "Which HTML tag is used for the largest heading?", options: ["<head>", "<h6>", "<h1>", "<header>"], correctAnswerIndex: 2, explanation: "`<h1>` represents the highest section level heading." },
            { question: "Which CSS property changes the text color?", options: ["font-color", "text-color", "color", "foreground"], correctAnswerIndex: 2, explanation: "The `color` property sets the foreground color of text content." },
            { question: "What is the correct HTML element for inserting JavaScript?", options: ["<script>", "<js>", "<javascript>", "<code>"], correctAnswerIndex: 0, explanation: "The `<script>` tag is used to embed or reference executable client-side scripts." }
        ]
    },
    {
        topic: "Machine Learning",
        level: 30,
        totalLevels: 100,
        style: "topic-space",
        desc: "Teaching computers to learn.",
        lesson: "### **MISSION BRIEFING: SUPERVISED LEARNING**\n\n**STATUS:** Training Model.\n\n*   **Labeled Data:** Input data that has the correct answer attached (e.g., photo of cat + label 'Cat').\n*   **Training vs Testing:** Use 80% of data to teach, 20% to test accuracy.\n*   **Overfitting:** When a model memorizes the training data but fails on new, unseen data.\n\nOptimize parameters.",
        questions: [
            { question: "What is 'Supervised Learning'?", options: ["Learning without data", "Training on labeled data with known answers", "Finding hidden patterns in unlabeled data", "Letting the AI explore randomly"], correctAnswerIndex: 1, explanation: "Supervised learning maps input to output based on example input-output pairs." },
            { question: "If a model performs perfectly on training data but fails in the real world, it is:", options: ["Underfitting", "Overfitting", "Generalized", "Optimized"], correctAnswerIndex: 1, explanation: "Overfitting means the model learned the 'noise' of the training set rather than the general rule." },
            { question: "What is a 'Feature' in ML?", options: ["A bug", "An individual measurable property of the data", "The output label", "The software version"], correctAnswerIndex: 1, explanation: "Features are the input variables (like pixels in an image or words in a text) used for prediction." }
        ]
    },
    {
        topic: "Prompt Engineering",
        level: 50,
        totalLevels: 50, // Boss Context
        style: "topic-robotics",
        desc: "Mastering Generative AI.",
        lesson: "### **BOSS BATTLE: LLM CONTROL**\n\n**STATUS:** CONTEXT WINDOW ACTIVE.\n\n*   **Persona:** Giving the AI a role (e.g., 'Act as a Senior Engineer') improves output quality.\n*   **Chain of Thought:** Asking the AI to 'think step-by-step' drastically reduces logic errors.\n*   **Few-Shot:** Providing examples in the prompt to guide the style/format.\n\n**OBJECTIVE:** Extract precise data.",
        questions: [
            { question: "What is 'Hallucination' in the context of AI?", options: ["The AI gets a virus", "The AI generates confident but factually incorrect info", "The AI becomes sentient", "The AI refuses to answer"], correctAnswerIndex: 1, explanation: "Hallucinations occur when models invent plausible-sounding but false information." },
            { question: "Which technique involves giving the AI examples of input and output?", options: ["Zero-Shot Prompting", "Few-Shot Prompting", "Blind Prompting", "Code Injection"], correctAnswerIndex: 1, explanation: "Few-Shot prompting provides a few demonstrations to steer the model's behavior." },
            { question: "Asking the model to 'Let's think step by step' is known as:", options: ["Chain of Thought", "Brainstorming", "Recursion", "Jailbreaking"], correctAnswerIndex: 0, explanation: "Chain of Thought prompting encourages the model to break down complex reasoning tasks." }
        ]
    }
];

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
    console.log("Injecting Expo Demo Data (Trending Topics)...");

    // 1. PRE-BAKED LEVEL CACHE (Instant Load)
    DEMO_SCENARIOS.forEach(scenario => {
        const cacheKey = `kt-level-cache-${scenario.topic.toLowerCase()}-${scenario.level}`;
        if (!localStorage.getItem(cacheKey)) {
            const cacheEntry = {
                timestamp: Date.now(),
                data: {
                    lesson: scenario.lesson,
                    questions: scenario.questions
                }
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        }
    });

    // 2. ACTIVE JOURNEYS (Matches the new topics)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
        const sampleJourneys = DEMO_SCENARIOS.map(scenario => ({
            id: `j_${scenario.topic.substring(0, 3)}_${Math.floor(Math.random()*1000)}`,
            goal: scenario.topic,
            description: scenario.desc,
            currentLevel: scenario.level,
            totalLevels: scenario.totalLevels,
            styleClass: scenario.style, 
            createdAt: new Date().toISOString()
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(sampleJourneys));
    }

    // 3. GAMIFICATION STATS
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
        const sampleStats = {
            level: 12,
            xp: 12500,
            currentStreak: 7, 
            lastQuizDate: new Date().toISOString(),
            totalQuizzesCompleted: 25, 
            totalPerfectQuizzes: 5, 
            questionsSaved: 4, 
            nightOwlSessions: 2, 
            fastAnswersCount: 15, 
            totalAuralMinutes: 45, 
            uniqueTopicsPlayed: ["Python", "JavaScript", "AI"], 
            
            dailyQuests: { 
                date: new Date().toDateString(), 
                quests: [
                    { id: 'complete_level', text: 'Complete 1 Level', xp: 50, completed: true }, 
                    { id: 'perfect_score', text: 'Get 100% on a Quiz', xp: 100, completed: false },
                    { id: 'use_hint', text: 'Use a Hint', xp: 20, completed: false }
                ] 
            },
            dailyChallenge: { date: new Date().toDateString(), completed: false }
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(sampleStats));
    }

    // 4. RICH HISTORY (Includes Audio Transcript)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
        const now = Date.now();
        const day = 86400000;
        const sampleHistory = [
            {
                id: `quiz_h_1`,
                type: 'quiz',
                topic: `Machine Learning - Level 29`,
                score: 3,
                totalQuestions: 3,
                date: new Date(now - (day * 0.1)).toISOString(),
                xpGained: 50
            },
            {
                id: `quiz_h_2`,
                type: 'quiz',
                topic: `Web Development - Level 4`,
                score: 2,
                totalQuestions: 3,
                date: new Date(now - (day * 0.5)).toISOString(),
                xpGained: 20
            },
            {
                id: `aural_h_1`,
                type: 'aural',
                topic: 'React vs Angular',
                date: new Date(now - (day * 2)).toISOString(),
                duration: 120, 
                xpGained: 100,
                transcript: [
                    { sender: 'user', text: 'What is the main difference between React and Angular?' },
                    { sender: 'model', text: 'React is a library focused on the View layer, giving you freedom to choose other tools. Angular is a full-fledged framework with everything included (router, http client, etc.).' },
                    { sender: 'user', text: 'Which one is easier to learn?' },
                    { sender: 'model', text: 'React typically has a gentler learning curve because it is just JavaScript, whereas Angular requires learning TypeScript and its specific patterns.' }
                ]
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(sampleHistory));
    }

    // 5. LIBRARY CONTENT
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY)) {
        const sampleLibrary = [
            {
                id: "q_lib_1",
                question: "What is the difference between a List and a Tuple in Python?",
                options: ["No difference", "Lists are mutable, Tuples are immutable", "Tuples are faster", "Lists can store strings only"],
                correctAnswerIndex: 1,
                explanation: "Immutability means Tuples cannot be changed after creation, making them safer for fixed data.",
                srs: { interval: 1, repetitions: 1, easeFactor: 2.5, nextReviewDate: Date.now() - 10000, lastReviewed: Date.now() - 86400000 }
            },
            {
                id: "q_lib_2",
                question: "What does 'Responsive Design' mean in Web Dev?",
                options: ["Fast loading speed", "Works on mobile and desktop", "Reacts to voice commands", "Uses AI"],
                correctAnswerIndex: 1,
                explanation: "Responsive design ensures web pages render well on a variety of devices and window or screen sizes.",
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
